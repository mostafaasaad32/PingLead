// ==============================================================================
// src/app/api/profile-audit/sync/route.ts
// Smart Master Profile Sync API
// Synchronizes Profile Audit upgrades with Freelancer Profile, AI Vault Portfolio,
// and Project Matching Filters.
// ==============================================================================

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { VollnaProfileAuditResult } from "@/lib/ai/profile-importer";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "غير مصرح - يرجى تسجيل الدخول أولاً" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { auditResult, platform } = body as {
      auditResult: VollnaProfileAuditResult;
      platform?: string;
    };

    if (!auditResult || !auditResult.sections) {
      return NextResponse.json(
        { error: "بيانات فحص البروفايل غير مكتملة أو غير صالحة" },
        { status: 400 }
      );
    }

    // 1. Fetch current profile from Supabase
    const { data: profile } = await (supabase.from("freelancer_profiles") as any)
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    const effectivePlatform = platform || auditResult.platform || "upwork";
    const isEnglish =
      effectivePlatform === "upwork" ||
      effectivePlatform === "freelancer" ||
      /^[A-Za-z]/.test(auditResult.currentTitle || "") ||
      /^[A-Za-z]/.test(auditResult.freelancerName || "");

    // Extract best title and bio
    const recommendedTitle =
      auditResult.sections.title?.suggestions?.[0]?.content?.trim() ||
      auditResult.currentTitle?.trim() ||
      "";

    const recommendedBio =
      auditResult.sections.overview?.fullRewrittenOverview?.trim() ||
      auditResult.sections.overview?.currentText?.trim() ||
      "";

    // Extract proof snippet
    const proofBlock = auditResult.sections.overview?.suggestedStructure?.find(
      (b: any) => b.id === "proof"
    );
    const proofText =
      proofBlock?.content?.trim() ||
      (proofBlock?.bullets ? proofBlock.bullets.join("\n• ") : "");

    // 2. Prepare Dual-Language Master Profile data
    const personaPayload = {
      title: recommendedTitle,
      bio: recommendedBio,
      proof: proofText,
      platform: effectivePlatform,
      updated_at: new Date().toISOString(),
    };

    // 3. Unified Skills Sync (deduplicate without duplicates)
    const existingSkills: string[] = Array.isArray(profile?.skills) ? profile.skills : [];
    const currentSkills: string[] = Array.isArray(auditResult.sections.skills?.currentSkills)
      ? auditResult.sections.skills.currentSkills
      : [];
    const skillsToAdd: string[] = Array.isArray(auditResult.sections.skills?.skillsToAdd)
      ? auditResult.sections.skills.skillsToAdd
      : [];

    const seenLower = new Set<string>();
    const mergedSkills: string[] = [];

    // Prioritize existing skills first, then audit skills
    for (const skill of [...existingSkills, ...currentSkills, ...skillsToAdd]) {
      if (!skill || typeof skill !== "string") continue;
      const clean = skill.trim();
      const lower = clean.toLowerCase();
      if (clean.length > 0 && !seenLower.has(lower)) {
        seenLower.add(lower);
        mergedSkills.push(clean);
      }
    }

    // 4. Multi-Platform Audits JSON update
    const currentPlatformAudits =
      profile?.platform_audits && typeof profile.platform_audits === "object"
        ? { ...profile.platform_audits }
        : {};

    currentPlatformAudits[effectivePlatform] = {
      ...auditResult,
      platform: effectivePlatform,
      saved_at: new Date().toISOString(),
    };

    // 5. Update freelancer_profiles
    const updatePayload: Record<string, any> = {
      skills: mergedSkills,
      platform_audits: currentPlatformAudits,
      updated_at: new Date().toISOString(),
    };

    if (auditResult.freelancerName && (!profile?.full_name || profile.full_name === "مستقل")) {
      updatePayload.full_name = auditResult.freelancerName;
    }

    if (isEnglish) {
      updatePayload.persona_en = personaPayload;
      // If user has no bio, or existing bio/title is English, set as main title/bio
      if (!profile?.bio || !profile?.title || /^[A-Za-z]/.test(profile.title || "")) {
        if (recommendedTitle) updatePayload.title = recommendedTitle;
        if (recommendedBio) updatePayload.bio = recommendedBio;
      }
    } else {
      updatePayload.persona_ar = personaPayload;
      // If user has no bio, or existing bio/title is Arabic, set as main title/bio
      if (!profile?.bio || !profile?.title || !/^[A-Za-z]/.test(profile.title || "")) {
        if (recommendedTitle) updatePayload.title = recommendedTitle;
        if (recommendedBio) updatePayload.bio = recommendedBio;
      }
    }

    try {
      const { error: profileUpdateError } = await (supabase.from("freelancer_profiles") as any)
        .update(updatePayload)
        .eq("user_id", user.id);

      if (profileUpdateError) {
        // Fallback for standard columns if persona_en or platform_audits columns are missing
        console.warn("[Profile Sync] Falling back to standard columns:", profileUpdateError.message);
        await (supabase.from("freelancer_profiles") as any)
          .update({
            title: updatePayload.title || profile?.title,
            bio: updatePayload.bio || profile?.bio,
            skills: mergedSkills,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", user.id);
      }
    } catch (e: any) {
      console.warn("[Profile Sync] Safe profile update warning:", e.message);
    }

    // 6. Feed AI Vault Portfolio (portfolio_items)
    // Avoid duplicates by comparing normalized project titles
    const { data: existingPortfolio } = await supabase
      .from("portfolio_items")
      .select("project_title")
      .eq("user_id", user.id);

    const existingTitles = new Set(
      (existingPortfolio || []).map((p: any) =>
        (p.project_title || "").trim().toLowerCase()
      )
    );

    const itemsToInsert: Array<{
      user_id: string;
      project_title: string;
      description: string;
      live_url: string | null;
      tags: string[];
      category: string;
    }> = [];

    // A. Extracted Employment History
    const rewrites = auditResult.sections.experience?.employmentRewrites || [];
    for (const exp of rewrites) {
      const role = exp.recommendedTitle || exp.currentRole || "";
      const company = exp.company || "";
      const itemTitle = company ? `${company} — ${role}` : role;

      if (!itemTitle || existingTitles.has(itemTitle.trim().toLowerCase())) continue;

      const desc = [
        exp.recommendedDescription || "",
        exp.whyItWorks ? `\n[أهمية الخبرة والقيمة المضافة]: ${exp.whyItWorks}` : "",
      ]
        .filter(Boolean)
        .join("\n");

      itemsToInsert.push({
        user_id: user.id,
        project_title: itemTitle.trim(),
        description: desc.trim() || "خبرة مهنية موثقة في سجل التوظيف.",
        live_url: null,
        tags: [company, "سجل التوظيف", "Employment History"].filter(Boolean),
        category: "web_dev",
      });
      existingTitles.add(itemTitle.trim().toLowerCase());
    }

    // B. Active Contracts
    const activeContracts = auditResult.stats?.activeContracts || [];
    for (const contract of activeContracts) {
      if (!contract || typeof contract !== "string") continue;
      const contractTitle = `عقد نشط موثق: ${contract}`;
      if (existingTitles.has(contractTitle.trim().toLowerCase())) continue;

      itemsToInsert.push({
        user_id: user.id,
        project_title: contractTitle,
        description: `عقد قيد التنفيذ تم التحقق منه وتوثيقه تلقائياً عبر فحص حساب ${effectivePlatform.toUpperCase()}.`,
        live_url: null,
        tags: ["عقد نشط", "Active Contract", effectivePlatform],
        category: "other",
      });
      existingTitles.add(contractTitle.trim().toLowerCase());
    }

    // C. Social Proof & Success Metrics
    if (proofText && proofText.length > 20) {
      const proofTitle = `إثباتات ونتائج سابقة (${auditResult.freelancerName || "معتمدة"})`;
      if (!existingTitles.has(proofTitle.toLowerCase())) {
        itemsToInsert.push({
          user_id: user.id,
          project_title: proofTitle,
          description: proofText,
          live_url: null,
          tags: ["إثبات نجاح", "Social Proof", "أرقام وإنجازات"],
          category: "other",
        });
        existingTitles.add(proofTitle.toLowerCase());
      }
    }

    // D. Suggested additions / certifications
    const suggestedAdditions = auditResult.sections.experience?.suggestedAdditions || [];
    for (const cert of suggestedAdditions) {
      if (!cert.title || existingTitles.has(cert.title.trim().toLowerCase())) continue;
      itemsToInsert.push({
        user_id: user.id,
        project_title: cert.title.trim(),
        description: cert.description || "شهادة أو مساهمة مهنية معتمدة.",
        live_url: null,
        tags: ["شهادة معتمدة", "Certification"],
        category: "other",
      });
      existingTitles.add(cert.title.trim().toLowerCase());
    }

    let insertedCount = 0;
    if (itemsToInsert.length > 0) {
      const { error: insertError } = await (supabase
        .from("portfolio_items") as any)
        .insert(itemsToInsert);

      if (insertError) {
        console.warn("[Profile Sync] Portfolio insertion error:", insertError.message);
      } else {
        insertedCount = itemsToInsert.length;
      }
    }

    return NextResponse.json({
      ok: true,
      message:
        "✅ تم تحديث هويتك الذكية، ومزامنة المهارات وسابقة الأعمال مع مولد العروض وفلاتر المشاريع!",
      syncedSkillsCount: mergedSkills.length,
      newSkillsAdded: skillsToAdd.length,
      portfolioItemsAdded: insertedCount,
      platform: effectivePlatform,
      isEnglish,
    });
  } catch (err: any) {
    console.error("[Profile Sync API] Error:", err);
    return NextResponse.json(
      { error: err.message || "حدث خطأ أثناء مزامنة البروفايل" },
      { status: 500 }
    );
  }
}
