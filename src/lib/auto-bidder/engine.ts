// ==============================================================================
// src/lib/auto-bidder/engine.ts
// Vollna Auto-Bidding Engine (Smart Scoring, Scheduling, A/B Testing, Queueing)
// ==============================================================================

import { supabaseAdmin } from "../supabase/admin";
import { normalizeText, matchesKeyword } from "../matching/filter-matcher";
import { generateContextAwareProposal } from "../ai/proposal-generator";
import { PortfolioItem } from "../scrapers/types";

export interface SmartAttachment {
  id: string;
  title: string;
  url_or_file: string;
  trigger_conditions?: string;
  description?: string;
}

export interface AutoBiddingConfig {
  id: string;
  user_id: string;
  is_enabled: boolean;
  min_match_score: number;
  schedule_start_hour: number;
  schedule_end_hour: number;
  active_days: string[];
  review_mode: "require_approval" | "full_auto";
  ab_testing_enabled: boolean;
  template_a_id: string | null;
  template_b_id: string | null;
  daily_limit: number;
  smart_delay_minutes: number;
  smart_attachments: SmartAttachment[];
}

export interface JobScoreResult {
  score: number;
  reasons: string[];
  passed: boolean;
}

/**
 * Calculates AI Job Compatibility Score (0 - 100)
 */
export function calculateJobMatchScore(
  projectText: string,
  projectTitle: string,
  skills: string[],
  includeKeywords: string[] = [],
  excludeKeywords: string[] = []
): JobScoreResult {
  const fullText = `${projectTitle}\n${projectText}`;
  const reasons: string[] = [];

  // 1. Negative Check: If any excluded keyword is present, score drops to 0 immediately
  for (const exc of excludeKeywords) {
    if (exc && matchesKeyword(fullText, exc)) {
      return {
        score: 0,
        reasons: [`يحتوي على كلمة مستبعدة (${exc})`],
        passed: false,
      };
    }
  }

  let totalScore = 50; // Base score for verified active job

  // 2. Skill & Include Keyword Matching
  const allKeywords = Array.from(new Set([...skills, ...includeKeywords]));
  let matchedCount = 0;

  for (const kw of allKeywords) {
    if (kw && matchesKeyword(fullText, kw)) {
      matchedCount++;
    }
  }

  if (matchedCount > 0) {
    const boost = Math.min(35, matchedCount * 12);
    totalScore += boost;
    reasons.push(`تطابق ${matchedCount} مهارة وتقنية رئيسية`);
  } else {
    totalScore -= 20;
    reasons.push("لا يوجد تطابق مباشر للمهارات الأساسية");
  }

  // 3. Project Detail & Clarity Score
  if (projectText.length > 300) {
    totalScore += 10;
    reasons.push("وصف المشروع مفصل وواضح المتطلبات");
  } else if (projectText.length < 80) {
    totalScore -= 15;
    reasons.push("وصف المشروع مقتضب جداً");
  }

  // 4. Budget Presence Boost
  if (
    /(?:\$|USD|SAR|EGP|درهم|ريال|دولار|\bbudget\b)/i.test(fullText) ||
    /الميزانية:/i.test(fullText)
  ) {
    totalScore += 5;
    reasons.push("ميزانية واضحة ومحددة");
  }

  const finalScore = Math.min(100, Math.max(0, totalScore));
  return {
    score: finalScore,
    reasons,
    passed: finalScore >= 80,
  };
}

/**
 * Validates whether current moment is within user's active schedule and days
 */
export function isWithinUserSchedule(
  config: AutoBiddingConfig,
  timezone: string = "Africa/Cairo"
): boolean {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      hour12: false,
      weekday: "long",
    });

    const parts = formatter.formatToParts(now);
    const hourPart = parts.find((p) => p.type === "hour");
    const weekdayPart = parts.find((p) => p.type === "weekday");

    const currentHour = hourPart ? parseInt(hourPart.value, 10) : now.getHours();
    const currentDay = weekdayPart ? weekdayPart.value.toLowerCase() : "monday";

    // Check active day
    if (config.active_days && config.active_days.length > 0) {
      const isDayActive = config.active_days.some(
        (d) => d.toLowerCase() === currentDay
      );
      if (!isDayActive) return false;
    }

    // Check operating hours
    const start = config.schedule_start_hour ?? 8;
    const end = config.schedule_end_hour ?? 23;

    if (start <= end) {
      return currentHour >= start && currentHour <= end;
    } else {
      // Overnight schedule (e.g. 20:00 to 04:00)
      return currentHour >= start || currentHour <= end;
    }
  } catch (err) {
    // If timezone is invalid, fallback to UTC/local
    const h = new Date().getHours();
    return h >= config.schedule_start_hour && h <= config.schedule_end_hour;
  }
}

/**
 * Selects best matching smart attachment based on project text
 */
export function selectSmartAttachment(
  attachments: SmartAttachment[],
  projectText: string
): SmartAttachment | null {
  if (!attachments || attachments.length === 0) return null;

  for (const att of attachments) {
    if (att.trigger_conditions) {
      const conditions = att.trigger_conditions
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean);

      for (const cond of conditions) {
        if (matchesKeyword(projectText, cond)) {
          return att;
        }
      }
    }
  }

  // Return first attachment as default fallback
  return attachments[0];
}

/**
 * Dispatches Telegram Notification with 1-click action buttons
 */
export async function sendTelegramAutoBidNotification(
  chatId: string,
  queueItem: {
    id: string;
    project_title: string;
    platform: string;
    platform_url: string;
    match_score: number;
    generated_proposal: string;
    attachment_title?: string;
  }
) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !chatId) return;

  const escapeHtml = (str: string) =>
    (str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const cleanTitle = escapeHtml(queueItem.project_title.slice(0, 100));
  const snippet = escapeHtml(queueItem.generated_proposal.slice(0, 250));
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://pinglead.vercel.app";

  const messageText =
    `⚡ <b>عرض Auto-Bidding جاهز للإرسال (${queueItem.match_score}% تطابق)</b>\n\n` +
    `📁 <b>المشروع:</b> <a href="${queueItem.platform_url}">${cleanTitle}</a>\n` +
    `🌐 <b>المنصة:</b> ${queueItem.platform.toUpperCase()}\n` +
    (queueItem.attachment_title ? `📎 <b>المرفق:</b> ${escapeHtml(queueItem.attachment_title)}\n` : "") +
    `\n📝 <b>ملخص العرض المقترح:</b>\n<i>"${snippet}..."</i>\n\n` +
    `اضغط على الزر أدناه للموافقة والفتح مع الملء التلقائي بنقرة واحدة!`;

  const inlineKeyboard = {
    inline_keyboard: [
      [
        {
          text: "🚀 الموافقة والفتح مع الملء التلقائي (1-Click)",
          url: `${siteUrl}/auto-bidding?action=approve&id=${queueItem.id}`,
        },
      ],
      [
        {
          text: "🔗 فتح صفحة المشروع الأصلية",
          url: queueItem.platform_url,
        },
      ],
    ],
  };

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: messageText,
        parse_mode: "HTML",
        reply_markup: inlineKeyboard,
      }),
    });
  } catch (err: any) {
    console.error("[Telegram Auto-Bid Alert] Error:", err.message);
  }
}

/**
 * Main Orchestrator: Evaluates project for all active auto-bidding users
 */
export async function evaluateProjectForAutoBidding(project: {
  id?: string;
  lead_id?: string;
  title: string;
  description: string;
  platform: string;
  url: string;
  category?: string;
}) {
  try {
    // 1. Fetch all enabled auto_bidding configs
    const { data: configs, error: cfgErr } = await (supabaseAdmin
      .from("auto_bidding_configs") as any)
      .select("*")
      .eq("is_enabled", true);

    if (cfgErr || !configs || configs.length === 0) {
      return { evaluatedCount: 0, queuedCount: 0 };
    }

    // Fetch freelancer profiles for all active configs
    const userIds = configs.map((c: any) => c.user_id);
    const { data: profiles } = await (supabaseAdmin
      .from("freelancer_profiles") as any)
      .select("user_id, full_name, title, bio, skills, tone_of_voice, timezone, telegram_chat_id, ai_credits")
      .in("user_id", userIds);

    const profileMap = new Map<string, any>();
    if (profiles) {
      for (const p of profiles) {
        profileMap.set(p.user_id, p);
      }
    }

    let queuedCount = 0;

    for (const cfg of configs) {
      const userProfile = profileMap.get(cfg.user_id);
      if (!userProfile) continue;

      // Check remaining AI credits
      if ((userProfile.ai_credits ?? 0) <= 0) {
        continue;
      }

      // Check Schedule
      const userTz = userProfile.timezone || "Africa/Cairo";
      if (!isWithinUserSchedule(cfg, userTz)) {
        continue;
      }

      // Check Daily Limit
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const { count: todayBidsCount } = await (supabaseAdmin
        .from("auto_bid_queue") as any)
        .select("id", { count: "exact", head: true })
        .eq("user_id", cfg.user_id)
        .gte("created_at", todayStart.toISOString());

      if ((todayBidsCount || 0) >= (cfg.daily_limit || 10)) {
        continue;
      }

      // Check Smart Delay (ensure minimum delay has passed)
      const { data: lastBid } = await (supabaseAdmin
        .from("auto_bid_queue") as any)
        .select("created_at")
        .eq("user_id", cfg.user_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lastBid) {
        const diffMinutes =
          (Date.now() - new Date(lastBid.created_at).getTime()) / 60000;
        if (diffMinutes < (cfg.smart_delay_minutes || 5)) {
          continue;
        }
      }

      // Check if project was already queued for this user
      if (project.id) {
        const { data: existing } = await (supabaseAdmin
          .from("auto_bid_queue") as any)
          .select("id")
          .eq("user_id", cfg.user_id)
          .eq("project_id", project.id)
          .maybeSingle();

        if (existing) continue;
      }

      // 2. Score Job against user skills and filters
      const userSkills = Array.isArray(userProfile.skills)
        ? userProfile.skills
        : [];
      const scoreResult = calculateJobMatchScore(
        project.description,
        project.title,
        userSkills
      );

      if (scoreResult.score < (cfg.min_match_score || 80)) {
        continue;
      }

      // 3. A/B Testing Template Selection
      let selectedTemplateId = cfg.template_a_id;
      let templateVariant: "A" | "B" = "A";

      if (cfg.ab_testing_enabled && cfg.template_a_id && cfg.template_b_id) {
        // Simple alternating logic or random 50/50
        templateVariant = Math.random() > 0.5 ? "B" : "A";
        selectedTemplateId =
          templateVariant === "B" ? cfg.template_b_id : cfg.template_a_id;
      }

      // Fetch template body if selected
      let templateBody = "";
      if (selectedTemplateId) {
        const { data: tpl } = await (supabaseAdmin
          .from("proposal_templates") as any)
          .select("template_body")
          .eq("id", selectedTemplateId)
          .maybeSingle();

        if (tpl) templateBody = tpl.template_body || "";
      }

      // 4. Select Smart Attachment
      const selectedAttachment = selectSmartAttachment(
        cfg.smart_attachments || [],
        `${project.title} ${project.description}`
      );

      // 5. Fetch Portfolio items
      const { data: portfolioRows } = await supabaseAdmin
        .from("portfolio_items")
        .select("*")
        .eq("user_id", cfg.user_id);

      const portfolioItems: PortfolioItem[] = (portfolioRows || []).map(
        (item: any) => ({
          id: item.id,
          user_id: item.user_id,
          project_title: item.project_title,
          description: item.description,
          live_url: item.live_url,
          tags: item.tags || [],
          category: item.category,
        })
      );

      // 6. Generate Context-Aware Proposal
      let generatedProposal = "";
      try {
        const aiProposal = await generateContextAwareProposal({
          title: project.title,
          description: project.description,
          category: project.category || "web_dev",
          platform: project.platform,
          freelancerBio: userProfile.bio || userProfile.title || "",
          freelancerSkills: userSkills.join(", "),
          toneOfVoice: userProfile.tone_of_voice || "confident",
          customInstructions: templateBody
            ? `استند إلى هذا القالب في صياغة العرض: ${templateBody}`
            : undefined,
          portfolioItems,
        });
        generatedProposal = aiProposal.proposal;
      } catch (e: any) {
        generatedProposal = `مرحباً بك، قرأت متطلبات مشروعك "${project.title}" بعناية ولدي الخبرة الكاملة لإنجازه بأعلى جودة. يمكنك معاينة سابقة أعمالي ومناقشة تفاصيل التسليم فوراً.`;
      }

      // Append Smart Attachment Link if available
      if (selectedAttachment && selectedAttachment.url_or_file) {
        generatedProposal += `\n\n📌 مرفق ذو صلة بالمشروع: ${selectedAttachment.title} - ${selectedAttachment.url_or_file}`;
      }

      const initialStatus =
        cfg.review_mode === "full_auto" ? "auto_sent" : "pending_review";

      // 7. Insert into auto_bid_queue
      const { data: queueItem, error: qErr } = await (supabaseAdmin
        .from("auto_bid_queue") as any)
        .insert({
          user_id: cfg.user_id,
          project_id: project.id || null,
          lead_id: project.lead_id || null,
          match_score: scoreResult.score,
          status: initialStatus,
          generated_proposal: generatedProposal,
          template_used_id: selectedTemplateId || null,
          template_variant: templateVariant,
          selected_attachment: selectedAttachment,
          platform_url: project.url,
          processed_at: initialStatus === "auto_sent" ? new Date().toISOString() : null,
        })
        .select()
        .single();

      if (!qErr && queueItem) {
        queuedCount++;

        // Deduct credit
        await (supabaseAdmin
          .from("freelancer_profiles") as any)
          .update({
            ai_credits: Math.max(0, (userProfile.ai_credits ?? 25) - 1),
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", cfg.user_id);

        // Send Telegram Notification
        if (userProfile.telegram_chat_id) {
          await sendTelegramAutoBidNotification(userProfile.telegram_chat_id, {
            id: queueItem.id,
            project_title: project.title,
            platform: project.platform,
            platform_url: project.url,
            match_score: scoreResult.score,
            generated_proposal: generatedProposal,
            attachment_title: selectedAttachment?.title,
          });
        }
      }
    }

    return { evaluatedCount: configs.length, queuedCount };
  } catch (err: any) {
    console.error("[Auto-Bidding Engine Error]:", err);
    return { evaluatedCount: 0, queuedCount: 0, error: err.message };
  }
}
