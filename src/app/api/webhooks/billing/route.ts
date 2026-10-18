// ==============================================================================
// src/app/api/webhooks/billing/route.ts
// Phase 5: Billing Webhook Handler for LemonSqueezy & Paymob
// Processes automated subscription upgrades, extends access, and updates tier
// ==============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const event = JSON.parse(rawBody || '{}');

    // 1. Check LemonSqueezy webhook format
    if (event.meta?.event_name) {
      const eventName = event.meta.event_name;
      const customData = event.meta.custom_data || {};
      const attributes = event.data?.attributes || {};
      const customerEmail = attributes.user_email || customData.user_email;
      const userId = customData.user_id;

      if (eventName === 'subscription_created' || eventName === 'order_created') {
        const variantName = (attributes.variant_name || '').toLowerCase();
        const tier = variantName.includes('agency') ? 'agency' : 'freelancer';

        let targetUserId = userId;
        if (!targetUserId && customerEmail) {
          const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('id')
            .eq('email', customerEmail)
            .single();
          targetUserId = profile?.id;
        }

        if (targetUserId) {
          await supabaseAdmin
            .from('profiles')
            .update({
              subscription_tier: tier,
              subscription_ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            })
            .eq('id', targetUserId);

          console.log(`[Billing Webhook] Upgraded user ${targetUserId} to tier ${tier}`);
        }
      }
      return NextResponse.json({ received: true, provider: 'lemonsqueezy' });
    }

    // 2. Check Paymob webhook format
    if (event.type === 'TRANSACTION' || event.obj?.success !== undefined) {
      const isSuccess = event.obj?.success === true;
      const customerEmail = event.obj?.order?.shipping_data?.email;
      const orderAmountCents = event.obj?.amount_cents;

      if (isSuccess && customerEmail) {
        const tier = orderAmountCents > 150000 ? 'agency' : 'freelancer';

        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .eq('email', customerEmail)
          .single();

        if (profile) {
          await supabaseAdmin
            .from('profiles')
            .update({
              subscription_tier: tier,
              subscription_ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            })
            .eq('id', profile.id);

          console.log(`[Billing Webhook] Paymob upgraded user ${profile.id} to tier ${tier}`);
        }
      }
      return NextResponse.json({ received: true, provider: 'paymob' });
    }

    return NextResponse.json({ received: true, notice: 'unhandled_event' });
  } catch (err: any) {
    console.error('[Billing Webhook] Error processing billing event:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
