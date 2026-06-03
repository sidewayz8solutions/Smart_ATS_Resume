// @ts-nocheck
// @ts-nocheck
// Disable TypeScript checking for V2 API usage

import { NextRequest, NextResponse } from 'next/server';
import stripeClient from '@/lib/stripe-connect';

/**
 * POST /api/stripe-connect/account-link
 * 
 * PURPOSE: Creates an account link for onboarding a connected account
 * Uses V2 API for account links
 * 
 * STEP-BY-STEP PROCESS:
 * 1. Parse and validate request body (accountId, refreshUrl, returnUrl)
 * 2. Validate accountId format (must start with 'acct_')
 * 3. Set up URLs for onboarding flow
 * 4. Create account link using V2 API
 * 5. Return the onboarding URL to client
 * 
 * REQUEST BODY:
 * - accountId: The Stripe account ID (starts with 'acct_')
 * - refreshUrl: URL to redirect to if the link expires (optional)
 * - returnUrl: URL to redirect to after onboarding (optional)
 * 
 * RETURNS:
 * - url: The account link URL for onboarding
 * - accountId: The account ID (for reference)
 * 
 * V2 API NOTES:
 * - use_case.type must be 'account_onboarding'
 * - use_case.account_onboarding.configurations: Array of config types
 * - configurations can include 'merchant' and 'customer'
 * - See: https://docs.stripe.com/api/v2/core/account_links/create
 */
export async function POST(req: NextRequest) {
  console.log('[Account Link] Endpoint called');
  
  try {
    // ============================================
    // STEP 1: Parse and validate request body
    // ============================================
    const body = await req.json();
    const { accountId, refreshUrl, returnUrl } = body;
    
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
    if (!accountId.startsWith('acct_')) {
      return NextResponse.json(
        { 
          error: 'Invalid accountId format',
          details: 'Account ID must start with "acct_"'
        },
        { status: 400 }
      );
    }
    
    console.log('[Account Link] Creating link for account:', accountId);
    
    // ============================================
    // STEP 3: Set up URLs for onboarding flow
    // ============================================
    // TODO: Replace with your actual domain
    // These URLs should point to your application
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://smartatsresume.com';
    const defaultRefreshUrl = refreshUrl || `${baseUrl}/stripe-connect/dashboard?refresh=true`;
    const defaultReturnUrl = returnUrl || `${baseUrl}/stripe-connect/dashboard?accountId=${accountId}`;
    
    // ============================================
    // STEP 4: Create account link using V2 API
    // ============================================
    // This generates a URL where the connected account can complete onboarding
    // The link is valid for 15 minutes
    // 
    // Key properties:
    // - account: The connected account ID
    // - use_case.type: Must be 'account_onboarding'
    // - use_case.account_onboarding.configurations: Which configs to onboard
    // - use_case.account_onboarding.refresh_url: Where to go if link expires
    // - use_case.account_onboarding.return_url: Where to go after onboarding
    
    const accountLink = await (stripeClient as any).v2.core.accountLinks.create({
      account: accountId,
      use_case: {
        type: 'account_onboarding',
        account_onboarding: {
          // Specify which configurations to onboard
          // 'merchant' allows them to charge customers
          // 'customer' allows them to make payments
          configurations: ['merchant', 'customer'],
          refresh_url: defaultRefreshUrl,
          return_url: defaultReturnUrl,
        },
      },
    });
    
    console.log('[Account Link] ✓ Link created:', accountLink.url);
    
    // ============================================
    // STEP 5: Return the onboarding URL
    // ============================================
    return NextResponse.json({
      success: true,
      message: 'Account link created successfully',
      url: accountLink.url,
      accountId: accountId,
      expires_at: accountLink.expires_at, // Link expiration timestamp
    });
    
  } catch (error: any) {
    console.error('[Account Link] Error:', error);
    
    // Provide helpful error messages
    let errorMessage = error.message || 'Failed to create account link';
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
