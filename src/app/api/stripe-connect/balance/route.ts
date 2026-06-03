// @ts-nocheck
// Disable TypeScript checking - Stripe SDK types are complex

import { NextRequest, NextResponse } from 'next/server';
import stripeClient, { validateAccountId } from '@/lib/stripe-connect';

/**
 * GET /api/stripe-connect/balance?accountId=acct_xxx
 * 
 * PURPOSE: Retrieves the connected account's balance with instant_available.net_available
 * The net_available field shows the balance minus platform fees
 * 
 * STEP-BY-STEP PROCESS:
 * 1. Get accountId from query parameters
 * 2. Validate accountId format (must start with 'acct_')
 * 3. Call Stripe balance.retrieve with expanded instant_available.net_available
 * 4. Return balance information including instant available amounts
 * 
 * QUERY PARAMETERS:
 * - accountId: The connected account ID (starts with 'acct_')
 * 
 * RETURNS:
 * - balance: The balance object with available and instant_available amounts
 * - instantAvailable: Array of instant available balances per currency/destination
 * 
 * NOTE: net_available only appears when expanded and for connected accounts
 * See: https://docs.stripe.com/api/balance/balance_object.md#balance_object-instant_available-net_available
 */
export async function GET(req: NextRequest) {
  console.log('[Balance] Endpoint called');
  
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
    
    console.log('[Balance] Retrieving balance for account:', accountId);
    
    // ============================================
    // STEP 3: Call Stripe balance.retrieve with expanded instant_available
    // ============================================
    // Expand instant_available.net_available to get the balance minus platform fees
    // This is important for monetization with Application Fees
    
    const balance = await stripeClient.balance.retrieve(
      {
        expand: ['instant_available.net_available'],
      },
      {
        stripeAccount: accountId, // This sets the Stripe-Account header
      }
    );
    
    console.log('[Balance] ✓ Balance retrieved');
    console.log('[Balance]   Available:', balance.available);
    console.log('[Balance]   Instant Available:', balance.instant_available);
    
    // ============================================
    // STEP 4: Format and return balance information
    // ============================================
    // Extract instant available balances
    const instantAvailable = balance.instant_available || [];
    
    // Calculate total instant available (sum across all currencies/destinations)
    let totalInstantAvailable = 0;
    instantAvailable.forEach((item: any) => {
      if (item.net_available) {
        item.net_available.forEach((net: any) => {
          totalInstantAvailable += net.amount || 0;
        });
      }
    });
    
    return NextResponse.json({
      success: true,
      message: 'Balance retrieved successfully',
      balance: {
        available: balance.available,
        instant_available: instantAvailable,
        pending: balance.pending,
      },
      instantAvailable: {
        items: instantAvailable,
        totalNetAvailable: totalInstantAvailable,
        currency: instantAvailable[0]?.net_available?.[0]?.destination ? 'usd' : 'unknown', // Simplified
      },
      accountId: accountId,
    });
    
  } catch (error: any) {
    console.error('[Balance] Error:', error);
    
    // Provide helpful error messages
    let errorMessage = error.message || 'Failed to retrieve balance';
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
