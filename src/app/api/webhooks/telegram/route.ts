// ==============================================================================
// src/app/api/webhooks/telegram/route.ts
// Phase 5: Interactive Telegram Webhook & Callback Engine (Vollna Architecture)
// Manages:
// 1. Account linking via /start <connect_token>
// 2. Instant AI proposal generation callback (gen_prop:<id> / gen_reply:<id>)
// 3. One-click status update callback (mark_app:<id>)
// ==============================================================================

import { randomBytes } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import {
  sendTelegramTextMessage,
  answerTelegramCallback,
  updateTelegramMessageKeyboard,
  escapeHtml,
} from '@/lib/notifications/telegram';
import { generateContextAwareProposal } from '@/lib/ai/proposal-generator';
import { getProjectPricing, pricingPromptHint } from '@/lib/insights/pricing';
import { PortfolioItem, extractTitleFromPostText, extractDetailsFromPostText } from '@/lib/scrapers/types';

export const dynamic = 'force-dynamic';
// AI proposal generation can take several seconds; give serverless room to finish
export const maxDuration = 60;

/**
 * Resolves the PingLead user linked to a Telegram chat (freelancer_profiles first, legacy profiles second).
 */
async function findUserIdByChatId(chatId: string | number | undefined): Promise<string | null> {
  if (chatId === undefined || chatId === null) return null;
  const chat = String(chatId);

  const { data: fp } = await supabaseAdmin
    .from('freelancer_profiles')
    .select('user_id')
    .eq('telegram_chat_id', chat)
    .maybeSingle();
  if (fp?.user_id) return fp.user_id;

  const { data: legacy } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('telegram_chat_id', chat)
    .maybeSingle();
  return legacy?.id ?? null;
}

export async function POST(req: NextRequest) {
  try {
    // Verify the request really comes from Telegram (secret_token set via setWebhook)
    const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (webhookSecret) {
      if (req.headers.get('x-telegram-bot-api-secret-token') !== webhookSecret) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    } else if (process.env.NODE_ENV === 'production') {
      console.warn('[Telegram Webhook] TELEGRAM_WEBHOOK_SECRET is not set - webhook requests are not verified.');
    }

    const update = await req.json();

    // --------------------------------------------------------------------------
    // 1. Handle incoming text commands (/start or /start <token>)
    // --------------------------------------------------------------------------
    if (update.message && update.message.text) {
      const chatId = update.message.chat.id;
      const text = update.message.text.trim();

      if (text.startsWith('/start')) {
        const parts = text.split(' ');
        const connectToken = parts.length > 1 ? parts[1].trim() : null;

        if (connectToken) {
          // Look up the account by connect token (freelancer_profiles is what the Settings page uses;
          // legacy profiles kept as a fallback for older links)
          let linkedUserId: string | null = null;
          let linkedName: string | null = null;

          const { data: fp } = await (supabaseAdmin.from('freelancer_profiles') as any)
            .select('user_id, full_name')
            .eq('telegram_connect_token', connectToken)
            .maybeSingle();

          if (fp) {
            linkedUserId = fp.user_id;
            linkedName = fp.full_name;
          } else {
            const { data: legacy } = await supabaseAdmin
              .from('profiles')
              .select('id, full_name')
              .eq('telegram_connect_token', connectToken)
              .maybeSingle();
            if (legacy) {
              linkedUserId = legacy.id;
              linkedName = legacy.full_name;
            }
          }

          if (linkedUserId) {
            const chat = String(chatId);

            // A Telegram chat belongs to one account: detach it from any other account first
            await (supabaseAdmin.from('freelancer_profiles') as any)
              .update({ telegram_chat_id: null })
              .eq('telegram_chat_id', chat)
              .neq('user_id', linkedUserId);
            await (supabaseAdmin.from('profiles') as any)
              .update({ telegram_chat_id: null })
              .eq('telegram_chat_id', chat)
              .neq('id', linkedUserId);

            // Link, and rotate the token so a leaked /start link can't be reused
            await (supabaseAdmin.from('freelancer_profiles') as any)
              .update({
                telegram_chat_id: chat,
                telegram_connect_token: randomBytes(16).toString('hex'),
              })
              .eq('user_id', linkedUserId);
            await (supabaseAdmin.from('profiles') as any)
              .update({ telegram_chat_id: chat })
              .eq('id', linkedUserId);

            const welcomeMsg =
              `🎉 <b>أهلاً بك يا ${escapeHtml(linkedName || 'عزيزي المحترف')} في رادار PingLead!</b>\n\n` +
              `✅ <b>تم ربط حسابك في المنصة بنجاح!</b>\n` +
              `📡 رادارك متصل الآن لمراقبة <b>9 منصات عمل حر عالمية وعربية</b> على مدار الساعة:\n` +
              `• مستقل (Mostaql)\n` +
              `• نفذلي (Nafezly)\n` +
              `• خمسات (Khamsat)\n` +
              `• كفيل (Kafiil)\n` +
              `• بعيد (Baeed)\n` +
              `• Freelancer.com\n` +
              `• WeWorkRemotely\n` +
              `• RemoteOK\n` +
              `• PeoplePerHour\n\n` +
              `⚡ بمجرد نزول أي مشروع يطابق فلاترك الذكية، ستصلك بطاقة المشروع هنا فوراً مع زر <b>كتابة عرض AI</b> المخصص بضغطة زر واحدة.`;

            await sendTelegramTextMessage(chatId, welcomeMsg);
            return NextResponse.json({ ok: true, action: 'account_linked' });
          }
        }

        // Default /start welcome message if no token or token not found
        const genericWelcome =
          `🎯 <b>أهلاً بك في رادار PingLead للعمل الحر!</b>\n\n` +
          `يجمع هذا البوت أحدث مشاريع وفرص العمل الحر من 9 منصات عربية وعالمية ويرسلها لك فور نشرها بناءً على فلاترك المخصصة.\n\n` +
          `🔗 لربط البوت بحسابك، ادخل على <b>الإعدادات ← الإشعارات</b> في الموقع واضغط <b>ربط تليجرام</b>.\n\n` +
          `💡 لو بتستخدم تليجرام ويب ومحصلش ربط، انسخ رسالة الربط من نفس الصفحة وابعتها هنا.`;

        await sendTelegramTextMessage(chatId, genericWelcome);
        return NextResponse.json({ ok: true, action: 'welcome_sent' });
      }
    }

    // --------------------------------------------------------------------------
    // 2. Handle interactive inline button clicks (Callback Queries)
    // --------------------------------------------------------------------------
    if (update.callback_query) {
      const callback = update.callback_query;
      const callbackId = callback.id;
      const chatId = callback.message?.chat?.id;
      const messageId = callback.message?.message_id;
      const data = callback.data || '';

      // ------------------------------------------------------------------------
      // Action A: On-Demand Proposal Generation (gen_prop:<id> / gen_reply:<id>)
      // ------------------------------------------------------------------------
      if (data.startsWith('gen_prop:') || data.startsWith('gen_reply:')) {
        const actionId = data.replace(/^(gen_prop:|gen_reply:)/, '').trim();

        // 1. Immediately acknowledge Telegram to remove spinner
        await answerTelegramCallback(
          callbackId,
          '⏳ جاري تجهيز عرض مخصص بالذكاء الاصطناعي مع سابقة أعمالك...'
        );

        let projectTitle = '';
        let projectDesc = '';
        let projectUrl = '';
        let projectPlatform = '';
        let projectCategory = 'web_dev';
        let effectiveUserId = '';
        let proposalText = '';
        let projectRow: any = null;

        // 2. Try fetching from user_project_actions first
        try {
          const { data: action } = await supabaseAdmin
            .from('user_project_actions')
            .select(`
              id,
              user_id,
              project_id,
              status,
              generated_proposal,
              projects (
                id,
                title,
                description,
                url,
                platform,
                category,
                budget,
                budget_usd_estimate,
                budget_min,
                budget_max,
                currency,
                bids_count,
                bids_avg,
                duration_text
              )
            `)
            .eq('id', actionId)
            .maybeSingle();

          if (action && (action as any).projects) {
            const p = (action as any).projects;
            projectRow = p;
            projectTitle = p.title;
            projectDesc = p.description;
            projectUrl = p.url;
            projectPlatform = p.platform;
            projectCategory = p.category;
            effectiveUserId = (action as any).user_id;
            proposalText = (action as any).generated_proposal || '';
          }
        } catch (e) {
          // user_project_actions may not exist in current schema
        }

        // 3. Fallback: Try fetching from user_lead_deliveries / leads_pool
        if (!projectTitle) {
          try {
            const { data: delivery } = await supabaseAdmin
              .from('user_lead_deliveries')
              .select(`
                id,
                user_id,
                lead_id,
                smart_reply_generated,
                leads_pool (
                  id,
                  platform,
                  post_text,
                  post_url,
                  category_slug
                )
              `)
              .eq('id', actionId)
              .maybeSingle();

            if (delivery && (delivery as any).leads_pool) {
              const lp = (delivery as any).leads_pool;
              projectDesc = extractDetailsFromPostText(lp.post_text);
              projectTitle = extractTitleFromPostText(lp.post_text) || 'مشروع عمل حر';
              projectUrl = lp.post_url || '';
              projectPlatform = lp.platform || '';
              projectCategory = lp.category_slug || 'web_dev';
              effectiveUserId = (delivery as any).user_id;
              proposalText = (delivery as any).smart_reply_generated || '';
            }
          } catch (e) {
            // ignore
          }
        }

        // 4. Fallback: If actionId was a direct lead_id from leads_pool
        if (!projectTitle) {
          try {
            const { data: directLead } = await supabaseAdmin
              .from('leads_pool')
              .select('*')
              .eq('id', actionId)
              .maybeSingle();

            if (directLead) {
              projectDesc = extractDetailsFromPostText(directLead.post_text);
              projectTitle = extractTitleFromPostText(directLead.post_text) || 'مشروع عمل حر';
              projectUrl = directLead.post_url || '';
              projectPlatform = directLead.platform || '';
              projectCategory = directLead.category_slug || 'web_dev';
            }
          } catch (e) {
            // ignore
          }
        }

        if (!projectTitle) {
          await sendTelegramTextMessage(chatId, '⚠️ تعذر العثور على تفاصيل هذا المشروع في النظام.');
          return NextResponse.json({ ok: false, error: 'Project not found' });
        }

        // 4b. The chat that pressed the button must own this project record
        const chatOwnerId = await findUserIdByChatId(chatId);
        if (!chatOwnerId || (effectiveUserId && effectiveUserId !== chatOwnerId)) {
          await sendTelegramTextMessage(
            chatId,
            '⚠️ هذا المشروع غير مرتبط بحسابك. اربط تليجرام من لوحة التحكم أولاً.'
          );
          return NextResponse.json({ ok: false, error: 'Chat does not own this record' }, { status: 403 });
        }
        effectiveUserId = chatOwnerId;

        // 5. Fetch freelancer profile context (same source as the Settings page)
        let freelancerBio = '';
        let freelancerSkills: string | string[] = '';
        let toneOfVoice = 'confident';

        const { data: fp } = await supabaseAdmin
          .from('freelancer_profiles')
          .select('bio, title, skills, tone_of_voice, full_name')
          .eq('user_id', effectiveUserId)
          .maybeSingle();

        if (fp) {
          freelancerBio = fp.bio || fp.title || '';
          freelancerSkills = fp.skills || '';
          toneOfVoice = fp.tone_of_voice || 'confident';
        }

        if (!freelancerBio) {
          const { data: prof } = await supabaseAdmin
            .from('profiles')
            .select('*')
            .eq('id', effectiveUserId)
            .maybeSingle();

          if (prof) {
            freelancerBio = prof.bio_context || prof.full_name || '';
          }
        }

        // 6. Fetch portfolio items if table exists
        let portfolioItems: PortfolioItem[] = [];
        if (effectiveUserId) {
          try {
            const { data: portfolioRows } = await supabaseAdmin
              .from('portfolio_items')
              .select('*')
              .eq('user_id', effectiveUserId);

            if (portfolioRows) {
              portfolioItems = portfolioRows.map((row: any) => ({
                id: row.id,
                user_id: row.user_id,
                project_title: row.project_title,
                description: row.description,
                live_url: row.live_url,
                tags: row.tags || [],
                category: row.category,
              }));
            }
          } catch (e) {
            // portfolio_items may not exist
          }
        }

        // 7. Generate context-aware proposal if not already cached
        if (!proposalText) {
          const pricing = projectRow
            ? await getProjectPricing({
                platform: projectRow.platform,
                category: projectRow.category,
                budget_min: projectRow.budget_min,
                budget_max: projectRow.budget_max,
                currency: projectRow.currency,
                bids_count: projectRow.bids_count,
                bids_avg: projectRow.bids_avg,
                duration_text: projectRow.duration_text,
              }).catch(() => null)
            : null;

          const genResult = await generateContextAwareProposal({
            pricingHint: pricing ? pricingPromptHint(pricing) : undefined,
            title: projectTitle,
            description: projectDesc,
            category: projectCategory,
            platform: projectPlatform,
            freelancerBio,
            freelancerSkills,
            toneOfVoice,
            portfolioItems,
          });

          proposalText = genResult.proposal;

          // Save generated proposal to DB
          try {
            await supabaseAdmin
              .from('user_project_actions')
              .update({
                generated_proposal: proposalText,
                updated_at: new Date().toISOString(),
              })
              .eq('id', actionId);
          } catch (e) {
            // ignore
          }

          try {
            await supabaseAdmin
              .from('user_lead_deliveries')
              .update({
                smart_reply_generated: proposalText,
                smart_reply_generated_at: new Date().toISOString(),
              })
              .eq('id', actionId);
          } catch (e) {
            // ignore
          }
        }

        // 8. Send Proposal to User with Action Keyboard
        const proposalMessage =
          `✍️ <b>عرض التقديم المقترح (Winning AI Proposal):</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━\n\n` +
          `${escapeHtml(proposalText)}\n\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `📋 <b>انسخ النص أعلاه والآن قدم على المشروع مباشرة:</b>`;

        const actionKeyboard = {
          inline_keyboard: [
            [
              {
                text: '🔗 فتح المشروع في المنصة والتقديم الآن',
                url: projectUrl || 'https://mostaql.com',
              },
            ],
            [
              {
                text: '✅ تم التقديم (Mark as Applied)',
                callback_data: `mark_app:${actionId}`,
              },
            ],
          ],
        };

        await sendTelegramTextMessage(chatId, proposalMessage, actionKeyboard);
        return NextResponse.json({ ok: true, action: 'proposal_sent', proposal: proposalText });
      }

      // ------------------------------------------------------------------------
      // Action B: Mark Project as Applied (mark_app:<action_id>)
      // ------------------------------------------------------------------------
      if (data.startsWith('mark_app:')) {
        const actionId = data.replace('mark_app:', '').trim();

        const chatOwnerId = await findUserIdByChatId(chatId);
        if (!chatOwnerId) {
          await answerTelegramCallback(callbackId, '⚠️ اربط تليجرام بحسابك من لوحة التحكم أولاً.');
          return NextResponse.json({ ok: false, error: 'Chat not linked' }, { status: 403 });
        }

        // 1. Immediately acknowledge Telegram
        await answerTelegramCallback(callbackId, '✅ تم تسجيل تقديمك على المشروع بنجاح!');

        // 2. Update status in database (only rows owned by this chat's user)
        let updated = false;
        try {
          const { error: actErr } = await supabaseAdmin
            .from('user_project_actions')
            .update({
              status: 'applied',
              updated_at: new Date().toISOString(),
            })
            .eq('id', actionId)
            .eq('user_id', chatOwnerId);
          if (!actErr) updated = true;
        } catch (e) {
          // ignore
        }

        try {
          const { error: delErr } = await supabaseAdmin
            .from('user_lead_deliveries')
            .update({
              smart_reply_generated_at: new Date().toISOString(),
            })
            .eq('id', actionId)
            .eq('user_id', chatOwnerId);
          if (!delErr) updated = true;
        } catch (e) {
          // ignore
        }

        // 3. Update inline keyboard of the original message to reflect applied status
        if (messageId) {
          const updatedKeyboard = {
            inline_keyboard: [
              [
                {
                  text: '✅ تم التقديم بنجاح (Applied)',
                  callback_data: `noop:${actionId}`,
                },
              ],
            ],
          };

          await updateTelegramMessageKeyboard(chatId, messageId, updatedKeyboard);
        }

        return NextResponse.json({ ok: true, action: 'marked_applied' });
      }

      // ------------------------------------------------------------------------
      // Action C: No-op acknowledge
      // ------------------------------------------------------------------------
      if (data.startsWith('noop:')) {
        await answerTelegramCallback(callbackId, 'المشروع مسجل مسبقاً كـ "تم التقديم"');
        return NextResponse.json({ ok: true });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('[Telegram Webhook] Error processing update:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
