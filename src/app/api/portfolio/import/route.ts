// ==============================================================================
// src/app/api/portfolio/import/route.ts
// One-Click Portfolio & Profile Importer API
// Supports Upwork PDF, Mostaql, Khamsat, Nafathly, GitHub, & Raw Text
// ==============================================================================

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  extractProfileFromPdfBuffer,
  extractProfileFromUrl,
  extractProfileFromRawText,
  ExtractedProfileData,
} from "@/lib/ai/profile-importer";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // 60 seconds on Vercel Pro/Next.js for AI & PDF extraction

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate user via Supabase
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

    let extractedData: ExtractedProfileData | null = null;
    const contentType = req.headers.get("content-type") || "";

    // 2. Parse Multipart FormData (PDF File or URL or Text)
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      const profileUrl = formData.get("profileUrl") as string | null;
      const rawText = formData.get("rawText") as string | null;

      // Method 1: Upwork Profile PDF Upload
      if (file && file.size > 0) {
        if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") {
          return NextResponse.json(
            { error: "يرجى رفع ملف PDF صالح لبروفايل Upwork" },
            { status: 400 }
          );
        }

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        extractedData = await extractProfileFromPdfBuffer(buffer);
      } else if (profileUrl && profileUrl.trim()) {
        // Method 2: Profile URL (Upwork, Mostaql, Khamsat, Nafathly, GitHub)
        extractedData = await extractProfileFromUrl(profileUrl.trim());
      } else if (rawText && rawText.trim()) {
        // Method 3: Raw Text Paste
        extractedData = await extractProfileFromRawText(rawText.trim());
      } else {
        return NextResponse.json(
          { error: "يرجى توفير رابط بروفايل أو نص لاستيراده" },
          { status: 400 }
        );
      }
    } else {
      // Parse JSON body
      const body = await req.json();
      const { profileUrl, rawText, base64Pdf } = body;

      if (profileUrl && profileUrl.trim()) {
        extractedData = await extractProfileFromUrl(profileUrl.trim());
      } else if (rawText && rawText.trim()) {
        extractedData = await extractProfileFromRawText(rawText.trim());
      } else if (base64Pdf) {
        const buffer = Buffer.from(base64Pdf, "base64");
        extractedData = await extractProfileFromPdfBuffer(buffer);
      } else {
        return NextResponse.json(
          { error: "يرجى توفير رابط بروفايل أو نص خام لاستيراده" },
          { status: 400 }
        );
      }
    }

    if (!extractedData) {
      return NextResponse.json(
        { error: "فشل استخراج البيانات من المدخلات المقدمة" },
        { status: 422 }
      );
    }

    // 3. Database Persistence: Insert Portfolio Items into Supabase
    let insertedPortfolioItems: any[] = [];
    if (extractedData.portfolioItems && extractedData.portfolioItems.length > 0) {
      const itemsToInsert = extractedData.portfolioItems.map((item) => ({
        user_id: user.id,
        project_title: item.title,
        description: item.description,
        live_url: item.project_url || null,
        tags: Array.isArray(item.skills) ? item.skills : [],
        category: item.category || "web_dev",
      }));

      const { data: dbItems, error: itemsError } = await (supabase
        .from("portfolio_items") as any)
        .insert(itemsToInsert)
        .select();

      if (itemsError) {
        console.error("[Portfolio Importer API] Error inserting items:", itemsError);
        throw itemsError;
      }

      insertedPortfolioItems = dbItems || itemsToInsert;
    }

    // 4. Database Persistence: Upsert / Update Freelancer Profile
    const { data: existingProfile } = await (supabase
      .from("freelancer_profiles") as any)
      .select("id, skills, full_name, title, bio")
      .eq("user_id", user.id)
      .maybeSingle();

    const currentSkills = Array.isArray(existingProfile?.skills) ? existingProfile.skills : [];
    const mergedSkills = Array.from(
      new Set([...currentSkills, ...extractedData.skills])
    );

    if (existingProfile) {
      const { error: profileError } = await (supabase
        .from("freelancer_profiles") as any)
        .update({
          full_name: extractedData.fullName || existingProfile.full_name,
          title: extractedData.headline || existingProfile.title,
          bio: extractedData.bio || existingProfile.bio,
          skills: mergedSkills,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);

      if (profileError) {
        console.error("[Portfolio Importer API] Profile update error:", profileError);
      }
    } else {
      const { error: profileError } = await (supabase
        .from("freelancer_profiles") as any)
        .insert({
          user_id: user.id,
          full_name: extractedData.fullName,
          title: extractedData.headline,
          bio: extractedData.bio,
          skills: mergedSkills,
          tone_of_voice: "confident",
        });

      if (profileError) {
        console.error("[Portfolio Importer API] Profile insert error:", profileError);
      }
    }

    // 5. Respond with clean results
    return NextResponse.json({
      ok: true,
      importedCount: insertedPortfolioItems.length,
      profile: {
        fullName: extractedData.fullName,
        headline: extractedData.headline,
        bio: extractedData.bio,
        hourlyRate: extractedData.hourlyRate,
        skills: mergedSkills,
      },
      message:
        insertedPortfolioItems.length > 0
          ? `تم بنجاح استيراد وتحديث البروفايل وإضافة ${insertedPortfolioItems.length} عمل وسابقة مشاريع إلى حسابك.`
          : `تم تحديث بيانات الملف الشخصي بنجاح، ولكن لم يتم العثور على أي مشاريع معروضة في الرابط (معرض الأعمال فارغ).`,
    });
  } catch (err: any) {
    console.error("[Portfolio Importer API] Error:", err);
    return NextResponse.json(
      { error: err.message || "حدث خطأ غير متوقع أثناء استيراد البيانات" },
      { status: 500 }
    );
  }
}
