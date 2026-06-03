// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import stripeClient, { validateAccountId } from '@/lib/stripe-connect';

/**
 * POST /api/stripe-connect/billing-portal
 * 
 * PURPOSE: Creates a billing portal session for a connected account
 * Uses customer_account parameter (V2 accounts can be used as customer)
 * 
 * STEP-BY-STEP PROCESS:
 * 1. Parse and validate request body
 * 2. Validate accountId format (must start with 'acct_')
 * 3. Set up return URL
 * 4. Create billing portal session
 * 5. Return the billing portal URL to client
 * 
 * REQUEST BODY:
 * - accountId: The connected account ID (starts with 'acct_')
 * - returnUrl: URL to return to after managing subscription (optional)
 * 
 * RETURNS:
 * - url: The billing portal URL
 * - sessionId: The billing portal session ID
 * 
 * V2 ACCOUNT NOTES:
 * - Use customer_account parameter (not customer)
 * - This allows the connected account to manage their own subscription
 * - See: https://docs.stripe.com/api/billing_portal/sessions/create#create_billing_portal_session-customer_account
 */
export async function POST(req: NextRequest) {
  console.log('[Billing Portal] Endpoint called');
  
  try {
    // ============================================
    // STEP 1: Parse and validate request body
    // ============================================
    const body = await req.json();
    const { accountId, returnUrl } = body;
    
    // Validate required fields
    if (!accountId) {
      return NextResponse.json(
        { 
          error: 'Missing required field',
          details: 'accountId is required'
        },
        { status: 400 }
      );
    }
    
    // ============================================
    // STEP 2: Validate accountId format
    // ============================================
    // V2 accounts start with 'acct_'
    validateAccountId(accountId);
    
    // ============================================
    // STEP 3: Set up return URL
    // ============================================
    // TODO: Replace with your actual dashboard URL
    const defaultReturnUrl = returnUrl || 
      `${process.env.NEXT_PUBLIC_APP_URL || 'https://smartatsresume.com'}/stripe-connect/dashboard`;
    
    console.log('[Billing Portal] Creating session for account:', accountId);
    
    // ============================================
    // STEP 4: Create billing portal session
    // ============================================
    // For V2 accounts, use customer_account parameter
    // This allows the connected account to manage their own subscription
    
    const session = await stripeClient.billingPortal.sessions.create(
      {
        // Use customer_account for V2 accounts
        customer_account: accountId,
        
        return_url: defaultReturnUrl,
        
        // Optional: Set configuration if you have a custom portal config
        // configuration: 'bpc_xxx',
      },
      {
        stripeAccount: accountId // This sets the Stripe-Account header
      }
    );
    
    console.log('[Billing Portal] ✓ Session created:', session.id);
    console.log('[Billing Portal]   URL:', session.url);
    
    // ============================================
    // STEP 5: Return the billing portal URL
    // ============================================
    // The connected account will be redirected to this URL to manage their subscription
    return NextResponse.json({
      success: true,
      message: 'Billing portal session created successfully',
      url: session.url,
      sessionId: session.id,
      accountId: accountId,
    });
    
  } catch (error: any) {
    console.error('[Billing Portal] Error:', error);
    
    // Provide helpful error messages
    let errorMessage = error.message || 'Failed to create billing portal session';
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
