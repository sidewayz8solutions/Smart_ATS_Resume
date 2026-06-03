// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import stripeClient, { validateAccountId, validatePriceId } from '@/lib/stripe-connect';

/**
 * POST /api/stripe-connect/create-subscription
 * 
 * PURPOSE: Creates a subscription checkout session for a connected account
 * Uses customer_account parameter (V2 accounts can be used as customer)
 * 
 * STEP-BY-STEP PROCESS:
 * 1. Parse and validate request body
 * 2. Validate accountId and priceId format
 * 3. Create checkout session for subscription
 * 4. Return the checkout URL to client
 * 
 * REQUEST BODY:
 * - accountId: The connected account ID (starts with 'acct_')
 * - priceId: The Stripe price ID for the subscription
 * - successUrl: URL to redirect after successful subscription
 * - cancelUrl: URL to redirect if subscription is cancelled
 * 
 * RETURNS:
 * - url: The Stripe Checkout URL
 * - sessionId: The checkout session ID
 * 
 * V2 ACCOUNT NOTES:
 * - Use customer_account parameter (not customer)
 * - This allows the connected account to be the customer
 * - The platform will bill the connected account
 * - See: https://docs.stripe.com/api/checkout/sessions/create#create_checkout_session-customer_account
 */
export async function POST(req: NextRequest) {
  console.log('[Create Subscription] Endpoint called');
  
  try {
    // ============================================
    // STEP 1: Parse and validate request body
    // ============================================
    const body = await req.json();
    const { accountId, priceId, successUrl, cancelUrl } = body;
    
    // Validate required fields
    if (!accountId || !priceId || !successUrl || !cancelUrl) {
      return NextResponse.json(
        { 
          error: 'Missing required fields',
          details: 'accountId, priceId, successUrl, and cancelUrl are required'
        },
        { status: 400 }
      );
    }
    
    // ============================================
    // STEP 2: Validate accountId and priceId format
    // ============================================
    // Validate accountId format (V2 accounts start with 'acct_')
    validateAccountId(accountId);
    
    // Validate priceId format (starts with 'price_')
    validatePriceId(priceId);
    
    console.log('[Create Subscription] Creating session for account:', accountId, { priceId });
    
    // ============================================
    // STEP 3: Create checkout session for subscription
    // ============================================
    // For V2 accounts, use customer_account parameter
    // This allows the connected account to be the customer
    // The platform will bill the connected account
    
    const session = await stripeClient.checkout.sessions.create(
      {
        // Use customer_account for V2 accounts
        // This is the connected account ID (acct_xxx)
        customer_account: accountId,
        
        mode: 'subscription',
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        
        // Success and cancel URLs
        success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: cancelUrl,
        
        // Optional: Add subscription metadata
        subscription_data: {
          metadata: {
            platform: 'smart_ats_resume',
            created_via: 'connect_integration',
          },
        },
      },
      {
        stripeAccount: accountId, // This sets the Stripe-Account header
      }
    );
    
    console.log('[Create Subscription] ✓ Session created:', session.id);
    console.log('[Create Subscription]   URL:', session.url);
    
    // ============================================
    // STEP 4: Return the checkout URL
    // ============================================
    // The connected account will be redirected to this URL to complete subscription
    return NextResponse.json({
      success: true,
      message: 'Subscription checkout session created successfully',
      url: session.url,
      sessionId: session.id,
      accountId: accountId,
    });
    
  } catch (error: any) {
    console.error('[Create Subscription] Error:', error);
    
    // Provide helpful error messages
    let errorMessage = error.message || 'Failed to create subscription checkout';
    let errorDetails = null;
    
    if (error.type === 'StripeInvalidRequestError') {
      errorMessage = `Stripe error: ${error.message}`;
      errorDetails = error.raw?.message || null;
    }
    
    return NextResponse.json(
      { 
        error: errorMessage,
        details: errorDetails,
        type: error.type || 'unknown'
      },
      { status: 500 }
    );
  }
}
