// ==============================================================================
// src/app/api/profile-audit/route.ts
// AI Profile Audit API - Evaluates freelance profiles and generates winning upgrades
// ==============================================================================

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  auditProfileWithAi,
  extractProfileFromUrl,
  extractProfileFromPdfBuffer,
  ExtractedProfileData,
  VollnaProfileAuditResult,
} from "@/lib/ai/profile-importer";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // 60s timeout for Gemini multi-step document analysis

function detectPlatformFromUrl(
  url?: string | null,
  isCurrentProfile?: boolean,
  isRawText?: boolean
): string {
  if (isCurrentProfile) return "pinglead";
  if (!url || isRawText) return "custom";
  const lower = url.toLowerCase();
  if (lower.includes("upwork.com")) return "upwork";
  if (lower.includes("mostaql.com")) return "mostaql";
  if (lower.includes("khamsat.com")) return "khamsat";
  if (lower.includes("nafezly.com")) return "nafezly";
  if (lower.includes("freelancer.com")) return "freelancer";
  if (lower.includes("github.com")) return "github";
  return "other";
}

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ ok: true, platformAudits: {} });
    }

    const { data: profile } = await (supabase.from("freelancer_profiles") as any)
      .select("platform_audits")
      .eq("user_id", user.id)
      .maybeSingle();

    return NextResponse.json({
      ok: true,
      platformAudits: profile?.platform_audits || {},
    });
  } catch (err: any) {
    return NextResponse.json({ ok: true, platformAudits: {} });
  }
}

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";
    let auditResult: VollnaProfileAuditResult | null = null;
    let detectedPlatform = "custom";
    let targetProfileUrl = "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      const profileUrl = formData.get("profileUrl") as string | null;
      const rawText = formData.get("rawText") as string | null;

      if (profileUrl && profileUrl.trim()) {
        targetProfileUrl = profileUrl.trim();
        detectedPlatform = detectPlatformFromUrl(targetProfileUrl);
        const extracted = await extractProfileFromUrl(targetProfileUrl);
        auditResult = await auditProfileWithAi({ profileData: extracted });
      } else if (file && file.size > 0) {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        auditResult = await auditProfileWithAi({ pdfBuffer: buffer });
        detectedPlatform = "upwork";
      } else if (rawText && rawText.trim()) {
        auditResult = await auditProfileWithAi({ rawText: rawText.trim() });
        detectedPlatform = "custom";
      } else {
        return NextResponse.json(
          { error: "يرجى تقديم رابط بروفايل أو نص لفحصه" },
          { status: 400 }
        );
      }
    } else {
      // JSON body
      const body = await req.json();
      const {
        fileBase64,
        profileUrl,
        rawText,
        profileData,
        useCurrentProfile,
      } = body;

      if (useCurrentProfile) {
        detectedPlatform = "pinglead";
        const supabase = await createServerSupabaseClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          return NextResponse.json(
            { error: "يرجى تسجيل الدخول لاستخدام بيانات ملفك الشخصي" },
            { status: 401 }
          );
        }

        const [{ data: profile }, { data: portfolioItems }] = await Promise.all([
          (supabase.from("freelancer_profiles") as any)
            .select("*")
            .eq("user_id", user.id)
            .maybeSingle(),
          (supabase.from("portfolio_items") as any)
            .select("*")
            .eq("user_id", user.id),
        ]);

        if (!profile || (!profile.bio && !profile.title)) {
          return NextResponse.json(
            {
              error:
                "ملفك الشخصي فارغ حالياً. يرجى ملء بياناتك أو إدخال رابط بروفايلك أولاً.",
            },
            { status: 400 }
          );
        }

        const structuredData: ExtractedProfileData = {
          fullName: profile.full_name || "مستقل",
          headline: profile.title || "مطور برمجيات مستقل",
          bio: profile.bio || "",
          skills: profile.skills || [],
          avatarUrl: profile.avatar_url || user.user_metadata?.avatar_url || undefined,
          portfolioItems: (portfolioItems || []).map((p: any) => ({
            title: p.project_title,
            description: p.description,
            project_url: p.live_url,
            skills: p.tags || [],
            category: p.category,
          })),
        };

        auditResult = await auditProfileWithAi({ profileData: structuredData });
      } else if (profileUrl && profileUrl.trim()) {
        targetProfileUrl = profileUrl.trim();
        detectedPlatform = detectPlatformFromUrl(targetProfileUrl);
        const extracted = await extractProfileFromUrl(targetProfileUrl);
        auditResult = await auditProfileWithAi({ profileData: extracted });
      } else if (fileBase64) {
        const buffer = Buffer.from(fileBase64, "base64");
        auditResult = await auditProfileWithAi({ pdfBuffer: buffer });
        detectedPlatform = "upwork";
      } else if (profileData) {
        auditResult = await auditProfileWithAi({ profileData });
        detectedPlatform = detectPlatformFromUrl(profileData.sourceUrl);
      } else if (rawText && rawText.trim()) {
        auditResult = await auditProfileWithAi({ rawText: rawText.trim() });
        detectedPlatform = "custom";
      } else {
        return NextResponse.json(
          { error: "يرجى تقديم بيانات صالحة لفحص البروفايل" },
          { status: 400 }
        );
      }
    }

    if (!auditResult) {
      return NextResponse.json(
        { error: "فشل تقييم البروفايل بواسطة الذكاء الاصطناعي" },
        { status: 500 }
      );
    }

    // Attach metadata
    auditResult.platform = detectedPlatform;
    auditResult.auditUrl = targetProfileUrl || undefined;
    auditResult.auditedAt = new Date().toISOString();

    // Silently attempt to persist in freelancer_profiles.platform_audits if user is logged in
    try {
      const supabase = await createServerSupabaseClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: currentProfile } = await (supabase.from("freelancer_profiles") as any)
          .select("platform_audits")
          .eq("user_id", user.id)
          .maybeSingle();

        const currentAudits = (currentProfile?.platform_audits && typeof currentProfile.platform_audits === "object")
          ? { ...currentProfile.platform_audits }
          : {};

        currentAudits[detectedPlatform] = auditResult;

        await (supabase.from("freelancer_profiles") as any)
          .update({
            platform_audits: currentAudits,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", user.id);
      }
    } catch {
      // Ignored if column doesn't exist yet or unauthenticated
    }

    return NextResponse.json({
      ok: true,
      audit: auditResult,
      platform: detectedPlatform,
    });
  } catch (err: any) {
    console.error("[Profile Audit API] Error:", err);
    return NextResponse.json(
      { error: err.message || "حدث خطأ أثناء فحص البروفايل بالذكاء الاصطناعي" },
      { status: 500 }
    );
  }
}
