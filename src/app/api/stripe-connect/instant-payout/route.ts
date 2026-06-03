// @ts-nocheck
// Disable TypeScript checking - Stripe SDK types are complex

import { NextRequest, NextResponse } from 'next/server';
import stripeClient, { validateAccountId } from '@/lib/stripe-connect';

/**
 * POST /api/stripe-connect/instant-payout
 * 
 * PURPOSE: Creates an Instant Payout to a connected account's external account
 * Uses method: 'instant' to request immediate payout
 * 
 * STEP-BY-STEP PROCESS:
 * 1. Parse and validate request body
 * 2. Validate accountId and amount
 * 3. Retrieve balance to check available amount
 * 4. Create payout with method: 'instant'
 * 5. Return payout details
 * 
 * REQUEST BODY:
 * - accountId: The connected account ID (starts with 'acct_')
 * - amount: Amount to pay out in cents (must be within min/max limits)
 * - currency: Currency code (default: 'usd')
 * - destination: External account ID (bank_account_xxx or card_xxx)
 *   If not provided, uses the default external account for the currency
 * 
 * RETURNS:
 * - payout: The created payout object
 * - applicationFee: The application fee if collected
 * 
 * PRICING:
 * - Stripe charges 1% fee for Instant Payouts
 * - Platform can monetize with Application Fees
 * - Min/max limits vary by country (see docs)
 * 
 * NOTE: Instant payouts to ineligible external accounts will fail
 * Always check eligibility first via /api/stripe-connect/external-accounts
 */
export async function POST(req: NextRequest) {
  console.log('[Instant Payout] Endpoint called');
  
  try {
    // ============================================
    // STEP 1: Parse and validate request body
    // ============================================
    const body = await req.json();
    const { accountId, amount, currency = 'usd', destination } = body;
    
    // Validate required fields
    if (!accountId || !amount) {
      return NextResponse.json(
        { 
          error: 'Missing required fields',
          details: 'accountId and amount are required'
        },
        { status: 400 }
      );
    }
    
    // ============================================
    // STEP 2: Validate accountId and amount
    // ============================================
    validateAccountId(accountId);
    
    // Validate amount (must be positive)
    const amountInCents = parseInt(amount);
    if (isNaN(amountInCents) || amountInCents <= 0) {
      return NextResponse.json(
        { 
          error: 'Invalid amount',
          details: 'amount must be a positive number in cents'
        },
        { status: 400 }
      );
    }
    
    // Check minimum amount (e.g., $0.50 USD)
    const minAmounts: { [key: string]: number } = {
      'usd': 50, // $0.50
      'cad': 60, // $0.60 CAD
      'gbp': 40, // £0.40
      'eur': 40, // €0.40
      'aud': 50, // $0.50 AUD
      // Add more currencies as needed
    };
    
    const minAmount = minAmounts[currency.toLowerCase()] || 50;
    if (amountInCents < minAmount) {
      return NextResponse.json(
        { 
          error: 'Amount below minimum',
          details: `Minimum amount for ${currency.toUpperCase()} is ${minAmount / 100} ${currency.toUpperCase()}`
        },
        { status: 400 }
      );
    }
    
    console.log('[Instant Payout] Creating payout for account:', accountId, { amountInCents, currency, destination });
    
    // ============================================
    // STEP 3: Retrieve balance to check available amount
    // ============================================
    // Optional: Check if the account has enough balance
    // This is a safety check, Stripe will also validate
    
    const balance = await stripeClient.balance.retrieve(
      {
        expand: ['instant_available.net_available'],
      },
      {
        stripeAccount: accountId,
      }
    );
    
    // Get the net available amount (balance minus platform fees)
    let netAvailable = 0;
    if (balance.instant_available) {
      balance.instant_available.forEach((item: any) => {
        if (item.net_available) {
          item.net_available.forEach((net: any) => {
            if (net.destination === destination || !destination) {
              netAvailable += net.amount || 0;
            }
          });
        }
      });
    }
    
    console.log('[Instant Payout]   Net available for payout:', netAvailable);
    
    if (amountInCents > netAvailable) {
      return NextResponse.json(
        { 
          error: 'Insufficient balance',
          details: `Requested ${amountInCents / 100} but only ${netAvailable / 100} available for instant payout`
        },
        { status: 400 }
      );
    }
    
    // ============================================
    // STEP 4: Create payout with method: 'instant'
    // ============================================
    // This initiates an Instant Payout to the specified destination
    // Funds typically arrive within 30 minutes
    
    const payoutParams: any = {
      amount: amountInCents,
      currency: currency,
      method: 'instant', // This specifies Instant Payout
    };
    
    // Add destination if specified
    if (destination) {
      payoutParams.destination = destination;
    }
    
    const payout = await stripeClient.payouts.create(
      payoutParams,
      {
        stripeAccount: accountId, // This sets the Stripe-Account header
      }
    );
    
    console.log('[Instant Payout] ✓ Payout created:', payout.id);
    console.log('[Instant Payout]   Status:', payout.status);
    console.log('[Instant Payout]   Amount:', payout.amount);
    
    // ============================================
    // STEP 5: Return payout details
    // ============================================
    return NextResponse.json({
      success: true,
      message: 'Instant payout initiated successfully',
      payout: {
        id: payout.id,
        amount: payout.amount,
        currency: payout.currency,
        status: payout.status,
        method: payout.method,
        destination: payout.destination,
        arrival_date: payout.arrival_date,
        created: payout.created,
      },
      accountId: accountId,
      note: 'Funds typically arrive within 30 minutes',
    });
    
  } catch (error: any) {
    console.error('[Instant Payout] Error:', error);
    
    // Provide helpful error messages
    let errorMessage = error.message || 'Failed to create instant payout';
    let errorDetails = null;
    
    // Check if it's an eligibility error
    if (error.message?.includes('not eligible') || error.message?.includes('instant')) {
      errorMessage = 'This external account is not eligible for Instant Payouts. Please check eligibility first.';
    }
    
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
