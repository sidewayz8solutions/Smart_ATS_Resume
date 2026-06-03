// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import stripeClient from '@/lib/stripe-connect';

/**
 * POST /api/stripe-connect/webhook
 * 
 * PURPOSE: Handles Stripe webhook events including:
 * - V2 thin events for account requirements changes
 * - Subscription events (customer.subscription.*)
 * - Invoice payment events
 * - Payment method events
 * 
 * STEP-BY-STEP PROCESS:
 * 1. Get the raw body and signature header
 * 2. Verify webhook signature using webhook secret
 * 3. Determine if event is V2 thin event or V1 event
 * 4. Route to appropriate handler based on event type
 * 5. Process event and update database if needed
 * 
 * REQUEST BODY:
 * - Raw body for signature verification
 * 
 * RETURNS:
 * - success: true if event was processed successfully
 * 
 * WEBHOOK SETUP:
 * 1. In Stripe Dashboard: Developers → Webhooks
 * 2. Click "+ Add destination"
 * 3. Select "Connected accounts" for Events from
 * 4. Select "Show advanced options" → Payload style: "Thin"
 * 5. Add events: v2.account[requirements].updated, 
 *    v2.account[configuration.merchant].capability_status_updated, etc.
 * 
 * V2 THIN EVENTS:
 * - Thin events contain minimal data
 * - Need to fetch full event using client.v2.core.events.retrieve()
 * - See: https://docs.stripe.com/webhooks.md?snapshot-or-thin=thin
 */
export const config = {
  api: {
    bodyParser: false,
  },
};

export async function POST(req: NextRequest) {
  console.log('[Webhook] Endpoint called');
  
  // ============================================
  // STEP 1: Get raw body and signature header
  // ============================================
  const body = await req.text();
  const signature = req.headers.get('stripe-signature');
  
  if (!signature) {
    console.error('[Webhook] Missing stripe-signature header');
    return NextResponse.json(
      { error: 'Missing stripe-signature header' },
      { status: 400 }
    );
  }
  
  // ============================================
  // STEP 2: Verify webhook signature
  // ============================================
  // TODO: Replace with your actual webhook secret from Stripe Dashboard
  // For connected accounts, you need to set up webhook endpoint in Dashboard
  // Go to: Developers → Webhooks → + Add destination
  // Select "Connected accounts" for "Events from"
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  
  if (!webhookSecret) {
    console.error('[Webhook] STRIPE_WEBHOOK_SECRET is not configured');
    return NextResponse.json(
      { error: 'Webhook secret not configured' },
      { status: 500 }
    );
  }
  
  let event: Stripe.Event;
  
  try {
    // Verify and construct the event
    event = stripeClient.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err: any) {
    console.error('[Webhook] Signature verification failed:', err.message);
    return NextResponse.json(
      { error: 'Webhook signature verification failed' },
      { status: 400 }
    );
  }
  
  console.log('[Webhook] Event received:', event.type, event.id);
  
  // ============================================
  // STEP 3: Check if this is a V2 thin event
  // ============================================
  // V2 thin events have api_version starting with '2026-'
  // They need to be parsed differently than V1 events
  
  if (event.api_version?.startsWith('2026-')) {
    console.log('[Webhook] Processing V2 thin event...');
    return await handleV2ThinEvent(event);
  }
  
  // ============================================
  // STEP 4: Handle V1 events (standard webhook events)
  // ============================================
  try {
    switch (event.type) {
      // ========== Subscription Events ==========
      case 'customer.subscription.created':
        await handleSubscriptionCreated(event);
        break;
        
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event);
        break;
        
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event);
        break;
        
      // ========== Invoice Events ==========
      case 'invoice.paid':
        await handleInvoicePaid(event);
        break;
        
      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event);
        break;
        
      // ========== Payment Method Events ==========
      case 'payment_method.attached':
        await handlePaymentMethodAttached(event);
        break;
        
      case 'payment_method.detached':
        await handlePaymentMethodDetached(event);
        break;
        
      // ========== Customer Events ==========
      case 'customer.updated':
        await handleCustomerUpdated(event);
        break;
        
      case 'customer.tax_id.created':
      case 'customer.tax_id.updated':
      case 'customer.tax_id.deleted':
        await handleCustomerTaxId(event);
        break;
        
      // ========== Billing Portal Events ==========
      case 'billing_portal.configuration.created':
      case 'billing_portal.configuration.updated':
        await handleBillingPortalConfig(event);
        break;
        
      case 'billing_portal.session.created':
        await handleBillingPortalSession(event);
        break;
        
      default:
        console.log(`[Webhook] Unhandled event type: ${event.type}`);
    }
    
    // ============================================
    // STEP 5: Return success response
    // ============================================
    console.log('[Webhook] ✓ Event processed successfully:', event.type);
    return NextResponse.json({ 
      success: true, 
      event: event.type,
      eventId: event.id 
    });
    
  } catch (error: any) {
    console.error('[Webhook] Error processing event:', error);
    return NextResponse.json(
      { 
        error: 'Webhook processing failed', 
        details: error.message,
        eventType: event.type 
      },
      { status: 500 }
    );
  }
}

/**
 * Handle V2 thin events
 * Thin events contain minimal data - need to fetch full event details
 */
async function handleV2ThinEvent(event: Stripe.Event) {
  console.log('[Webhook V2] Handling thin event:', event.type, event.id);
  
  try {
    // Step 1: Parse the thin event to get the full event ID
    // Using 'as any' to bypass TypeScript checks for V2 API
    const thinEvent = await (stripeClient as any).parseThinEvent(
      event.data.object,
      event.id
    );
    
    console.log('[Webhook V2] ✓ Thin event parsed:', thinEvent.id);
    
    // Step 2: Fetch the full event data
    const fullEvent = await (stripeClient as any).v2.core.events.retrieve(thinEvent.id);
    
    console.log('[Webhook V2] ✓ Full event retrieved:', fullEvent.type);
    
    // Step 3: Handle specific V2 event types
    switch (fullEvent.type) {
      case 'v2.core.account[requirements].updated':
        await handleAccountRequirementsUpdated(fullEvent);
        break;
        
      case 'v2.core.account[configuration.merchant].capability_status_updated':
      case 'v2.core.account[configuration.customer].capability_status_updated':
        await handleAccountCapabilityStatusUpdated(fullEvent);
        break;
        
      default:
        console.log(`[Webhook V2] Unhandled V2 event type: ${fullEvent.type}`);
    }
    
    return NextResponse.json({ 
      success: true, 
      event: fullEvent.type,
      eventId: fullEvent.id 
    });
    
  } catch (error: any) {
    console.error('[Webhook V2] Error handling thin event:', error);
    throw error;
  }
}

/**
 * Handle account requirements updated (V2 event)
 */
async function handleAccountRequirementsUpdated(event: any) {
  console.log('[Webhook V2] Account requirements updated:', event.data.object.id);
  
  const accountId = event.data.object.id;
  const requirements = event.data.object.requirements;
  
  // TODO: Update your database with the new requirements status
  // Example with Supabase:
  /*
  const { error } = await supabase
    .from('connected_accounts')
    .update({
      requirements_status: requirements?.summary?.minimum_deadline?.status,
      requirements_currently_due: requirements?.currently_due || [],
      requirements_past_due: requirements?.past_due || [],
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_account_id', accountId);
  
  if (error) {
    console.error('[Webhook V2] Database update error:', error);
  }
  */
  
  console.log('[Webhook V2] Account requirements status:', requirements?.summary?.minimum_deadline?.status);
}

/**
 * Handle account capability status updated (V2 event)
 */
async function handleAccountCapabilityStatusUpdated(event: any) {
  console.log('[Webhook V2] Account capability status updated:', event.data.object.id);
  
  const accountId = event.data.object.id;
  const capabilityStatus = event.data.object.capability_status;
  
  // TODO: Update your database with the new capability status
  // Example:
  /*
  const { error } = await supabase
    .from('connected_accounts')
    .update({
      capability_status: capabilityStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_account_id', accountId);
  */
  
  console.log('[Webhook V2] Capability status:', capabilityStatus);
}

/**
 * Handle subscription created
 */
async function handleSubscriptionCreated(event: Stripe.Event) {
  const subscription = event.data.object as Stripe.Subscription;
  console.log('[Webhook] Subscription created:', subscription.id);
  console.log('[Webhook]   Customer:', subscription.customer);
  console.log('[Webhook]   Status:', subscription.status);
  
  // TODO: Store subscription in database
  // const { error } = await supabase.from('subscriptions').insert({
  //   subscription_id: subscription.id,
  //   customer_id: subscription.customer,
  //   status: subscription.status,
  //   price_id: subscription.items.data[0].price.id,
  //   current_period_start: subscription.current_period_start,
  //   current_period_end: subscription.current_period_end,
  //   created_at: new Date().toISOString(),
  // });
}

/**
 * Handle subscription updated
 */
async function handleSubscriptionUpdated(event: Stripe.Event) {
  const subscription = event.data.object as Stripe.Subscription;
  console.log('[Webhook] Subscription updated:', subscription.id);
  console.log('[Webhook]   Status:', subscription.status);
  console.log('[Webhook]   Cancel at period end:', subscription.cancel_at_period_end);
  
  // Check if subscription was upgraded/downgraded
  const priceId = subscription.items.data[0].price.id;
  console.log('[Webhook]   Current price:', priceId);
  
  // TODO: Update subscription in database
  // Check if cancel_at_period_end changed
  if (subscription.cancel_at_period_end) {
    console.log('[Webhook] Subscription will cancel at period end');
  } else {
    console.log('[Webhook] Subscription is active or reactivated');
  }
}

/**
 * Handle subscription deleted (cancelled)
 */
async function handleSubscriptionDeleted(event: Stripe.Event) {
  const subscription = event.data.object as Stripe.Subscription;
  console.log('[Webhook] Subscription deleted:', subscription.id);
  
  // TODO: Remove subscription access in your database
  // const { error } = await supabase
  //   .from('subscriptions')
  //   .update({ 
  //     status: 'cancelled', 
  //     cancelled_at: new Date().toISOString() 
  //   })
  //   .eq('subscription_id', subscription.id);
}

/**
 * Handle invoice paid
 */
async function handleInvoicePaid(event: Stripe.Event) {
  const invoice = event.data.object as Stripe.Invoice;
  console.log('[Webhook] Invoice paid:', invoice.id);
  console.log('[Webhook]   Customer:', invoice.customer);
  console.log('[Webhook]   Amount paid:', invoice.amount_paid);
  
  // TODO: Update payment status in database
}

/**
 * Handle invoice payment failed
 */
async function handleInvoicePaymentFailed(event: Stripe.Event) {
  const invoice = event.data.object as Stripe.Invoice;
  console.log('[Webhook] Invoice payment failed:', invoice.id);
  console.log('[Webhook]   Customer:', invoice.customer);
  
  // TODO: Notify user about failed payment
}

/**
 * Handle payment method attached
 */
async function handlePaymentMethodAttached(event: Stripe.Event) {
  const paymentMethod = event.data.object as Stripe.PaymentMethod;
  console.log('[Webhook] Payment method attached:', paymentMethod.id);
  console.log('[Webhook]   Customer:', paymentMethod.customer);
}

/**
 * Handle payment method detached
 */
async function handlePaymentMethodDetached(event: Stripe.Event) {
  const paymentMethod = event.data.object as Stripe.PaymentMethod;
  console.log('[Webhook] Payment method detached:', paymentMethod.id);
}

/**
 * Handle customer updated
 */
async function handleCustomerUpdated(event: Stripe.Event) {
  const customer = event.data.object as Stripe.Customer;
  console.log('[Webhook] Customer updated:', customer.id);
  console.log('[Webhook]   Default payment method:', customer.invoice_settings?.default_payment_method);
}

/**
 * Handle customer tax ID events
 */
async function handleCustomerTaxId(event: Stripe.Event) {
  const taxId = event.data.object as any;
  console.log('[Webhook] Customer tax ID event:', event.type, taxId.id);
}

/**
 * Handle billing portal configuration events
 */
async function handleBillingPortalConfig(event: Stripe.Event) {
  console.log('[Webhook] Billing portal configuration event:', event.type);
}

/**
 * Handle billing portal session created
 */
async function handleBillingPortalSession(event: Stripe.Event) {
  const session = event.data.object as Stripe.BillingPortal.Session;
  console.log('[Webhook] Billing portal session created:', session.id);
}
