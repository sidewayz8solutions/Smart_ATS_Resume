// @ts-nocheck
// @ts-nocheck
// Disable TypeScript checking for V2 API usage

import { NextRequest, NextResponse } from 'next/server';
import stripeClient from '@/lib/stripe-connect';

/**
 * GET /api/stripe-connect/account-status?accountId=acct_xxx
 * 
 * PURPOSE: Retrieves the current status of a connected account
 * Uses V2 API to get detailed account status
 * 
 * STEP-BY-STEP PROCESS:
 * 1. Get account ID from query parameters
 * 2. Retrieve account details using V2 API with expanded fields
 * 3. Check if account can process payments (capability status)
 * 4. Check if onboarding is complete (requirements status)
 * 5. Return status information to client
 * 
 * QUERY PARAMETERS:
 * - accountId: The Stripe account ID (starts with 'acct_')
 * 
 * RETURNS:
 * - account: Account details including configuration and requirements
 * - readyToProcessPayments: Boolean indicating if account can charge customers
 * - onboardingComplete: Boolean indicating if onboarding is finished
 * - requirementsStatus: Status of account requirements
 * 
 * V2 API NOTES:
 * - Use include parameter to expand configuration.merchant and requirements
 * - Check account.configuration.merchant.capabilities.card_payments.status
 * - Check account.requirements.summary.minimum_deadline.status
 */
export async function GET(req: NextRequest) {
  console.log('[Account Status] Endpoint called');
  
  try {
    // ============================================
    // STEP 1: Get account ID from query parameters
    // ============================================
    const url = new URL(req.url);
    const accountId = url.searchParams.get('accountId');
    
    // Validate accountId presence
    if (!accountId) {
      return NextResponse.json(
        { 
          error: 'Missing required parameter',
          details: 'accountId is required in query string'
        },
        { status: 400 }
      );
    }
    
    // Validate accountId format (V2 accounts start with 'acct_')
    if (!accountId.startsWith('acct_')) {
      return NextResponse.json(
        { 
          error: 'Invalid accountId format',
          details: 'Account ID must start with "acct_"'
        },
        { status: 400 }
      );
    }
    
    console.log('[Account Status] Checking account:', accountId);
    
    // ============================================
    // STEP 2: Retrieve account details using V2 API
    // ============================================
    // Use V2 API to get full account details
    // Include configuration.merchant to check capability status
    // Include requirements to check onboarding status
    const account = await (stripeClient as any).v2.core.accounts.retrieve(
      accountId,
      {
        include: ['configuration.merchant', 'requirements'],
      }
    );
    
    console.log('[Account Status] ✓ Account retrieved:', account.id);
    
    // ============================================
    // STEP 3: Check if account can process payments
    // ============================================
    // Look at the merchant configuration's card_payments capability status
    // Status can be: 'active', 'inactive', 'pending'
    const readyToProcessPayments = 
      account?.configuration?.merchant?.capabilities?.card_payments?.status === 'active';
    
    // ============================================
    // STEP 4: Check if onboarding is complete
    // ============================================
    // Onboarding is complete when there are no currently_due or past_due requirements
    // V2 API uses requirements.summary.minimum_deadline.status
    const requirementsStatus = 
      account.requirements?.summary?.minimum_deadline?.status;
    
    const onboardingComplete = 
      requirementsStatus !== 'currently_due' && requirementsStatus !== 'past_due';
    
    // ============================================
    // STEP 5: Get additional helpful information
    // ============================================
    const accountDetails = {
      id: account.id,
      created: account.created,
      email: account.contact_email,
      
      // Dashboard status
      dashboard_access: account.dashboard,
      
      // Capabilities status
      capabilities: {
        card_payments: account?.configuration?.merchant?.capabilities?.card_payments?.status || 'inactive',
      },
      
      // Requirements information
      requirements: {
        status: requirementsStatus,
        currently_due: account.requirements?.currently_due || [],
        past_due: account.requirements?.past_due || [],
        pending_verification: account.requirements?.pending_verification || [],
      },
    };
    
    console.log('[Account Status] Status check:', {
      readyToProcessPayments,
      onboardingComplete,
      requirementsStatus,
    });
    
    // ============================================
    // STEP 6: Return status information
    // ============================================
    return NextResponse.json({
      success: true,
      account: accountDetails,
      readyToProcessPayments,
      onboardingComplete,
      requirementsStatus,
      message: readyToProcessPayments 
        ? 'Account is ready to process payments!' 
        : 'Account is not yet ready to process payments.',
    });
    
  } catch (error: any) {
    console.error('[Account Status] Error:', error);
    
    // Provide helpful error messages
    let errorMessage = error.message || 'Failed to check account status';
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
