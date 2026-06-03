// @ts-nocheck
// Disable TypeScript checking - Stripe SDK types are complex

import { NextRequest, NextResponse } from 'next/server';
import stripeClient, { validateAccountId } from '@/lib/stripe-connect';

/**
 * GET /api/stripe-connect/external-accounts?accountId=acct_xxx
 * 
 * PURPOSE: Lists external accounts (bank accounts/cards) for a connected account
 * Checks if each account is eligible for Instant Payouts
 * 
 * STEP-BY-STEP PROCESS:
 * 1. Get accountId from query parameters
 * 2. Validate accountId format (must start with 'acct_')
 * 3. Call Stripe accounts.listExternalAccounts with the connected account
 * 4. Check available_payout_methods for 'instant'
 * 5. Return external accounts with eligibility status
 * 
 * QUERY PARAMETERS:
 * - accountId: The connected account ID (starts with 'acct_')
 * 
 * RETURNS:
 * - externalAccounts: Array of external accounts with eligibility status
 * - eligibleAccounts: Array of accounts eligible for Instant Payouts
 * 
 * ELIGIBILITY:
 * - An external account is eligible if 'instant' is in available_payout_methods
 * - See: https://docs.stripe.com/connect/instant-payouts.md#external-account-eligibility
 */
export async function GET(req: NextRequest) {
  console.log('[External Accounts] Endpoint called');
  
  try {
    // ============================================
    // STEP 1: Get accountId from query parameters
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
    
    // ============================================
    // STEP 2: Validate accountId format
    // ============================================
    validateAccountId(accountId);
    
    console.log('[External Accounts] Listing external accounts for:', accountId);
    
    // ============================================
    // STEP 3: Call Stripe API to list external accounts
    // ============================================
    // Use stripeAccount option to access the connected account
    // This returns the 10 most recently active external accounts by default
    
    const externalAccounts = await stripeClient.accounts.listExternalAccounts(
      accountId,
      {
        stripeAccount: accountId, // This sets the Stripe-Account header
      }
    );
    
    console.log(`[External Accounts] ✓ Found ${externalAccounts.data.length} external accounts`);
    
    // ============================================
    // STEP 4: Check Instant Payouts eligibility
    // ============================================
    // An account is eligible if 'instant' is in available_payout_methods
    
    const accountsWithEligibility = externalAccounts.data.map((account: any) => {
      const isEligible = account.available_payout_methods?.includes('instant') || false;
      
      return {
        id: account.id,
        object: account.object, // 'bank_account' or 'card'
        last4: account.last4,
        bank_name: account.bank_name || null,
        country: account.country,
        currency: account.currency,
        default_for_currency: account.default_for_currency || false,
        available_payout_methods: account.available_payout_methods || [],
        isEligibleForInstantPayouts: isEligible,
        status: account.status, // 'new', 'validated', 'verified', 'verification_failed'
      };
    });
    
    // Filter eligible accounts
    const eligibleAccounts = accountsWithEligibility.filter(acc => acc.isEligibleForInstantPayouts);
    
    console.log(`[External Accounts]   Eligible for Instant Payouts: ${eligibleAccounts.length}`);
    
    // ============================================
    // STEP 5: Return the results
    // ============================================
    return NextResponse.json({
      success: true,
      message: 'External accounts retrieved successfully',
      externalAccounts: accountsWithEligibility,
      eligibleAccounts: eligibleAccounts,
      hasEligibleAccount: eligibleAccounts.length > 0,
      accountId: accountId,
    });
    
  } catch (error: any) {
    console.error('[External Accounts] Error:', error);
    
    // Provide helpful error messages
    let errorMessage = error.message || 'Failed to list external accounts';
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
