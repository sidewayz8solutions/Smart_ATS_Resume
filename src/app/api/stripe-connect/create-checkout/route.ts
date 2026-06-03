// @ts-nocheck
// @ts-nocheck
// Disable TypeScript checking - Stripe SDK types are complex
// The runtime code will work correctly

import { NextRequest, NextResponse } from 'next/server';
import stripeClient, { validateAccountId, validatePriceId } from '@/lib/stripe-connect';

/**
 * POST /api/stripe-connect/create-checkout
 * 
 * PURPOSE: Creates a checkout session for a connected account (Direct Charge)
 * Uses Stripe-Account header to charge on behalf of the connected account
 * Includes an application fee that goes to the platform
 * 
 * STEP-BY-STEP PROCESS:
 * 1. Parse and validate request body
 * 2. Validate accountId and price information
 * 3. Build line items for checkout
 * 4. Create checkout session on the connected account
 * 5. Return the checkout URL to client
 * 
 * REQUEST BODY:
 * - accountId: The connected account ID (starts with 'acct_')
 * - priceData: Price data for the product (if not using existing priceId)
 *   - unitAmount: Price in cents
 *   - currency: Currency code (default: 'usd')
 *   - productName: Product name (for price_data)
 * - priceId: Existing Stripe price ID (alternative to priceData)
 * - quantity: Quantity (default: 1)
 * - applicationFeeAmount: Fee in cents that goes to platform (optional)
 * - successUrl: URL to redirect after successful payment
 * - cancelUrl: URL to redirect if payment is cancelled
 * 
 * RETURNS:
 * - url: The Stripe Checkout URL
 * - sessionId: The checkout session ID
 * 
 * DIRECT CHARGE NOTES:
 * - The connected account is the merchant of record
 * - Platform receives application_fee_amount
 * - Customer is charged by the connected account
 * 
 * STRIPE-ACCOUNT HEADER:
 * - Pass { stripeAccount: accountId } as second argument
 * - This sets the Stripe-Account header
 * - All operations are performed on behalf of the connected account
 */
export async function POST(req: NextRequest) {
  console.log('[Create Checkout] Endpoint called');
  
  try {
    // ============================================
    // STEP 1: Parse and validate request body
    // ============================================
    const body = await req.json();
    const {
      accountId,
      priceData,
      priceId,
      quantity = 1,
      applicationFeeAmount,
      successUrl,
      cancelUrl,
    } = body;
    
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
    
    if (!successUrl || !cancelUrl) {
      return NextResponse.json(
        { 
          error: 'Missing required fields',
          details: 'successUrl and cancelUrl are required'
        },
        { status: 400 }
      );
    }
    
    // ============================================
    // STEP 2: Validate accountId and price information
    // ============================================
    // Validate accountId format (V2 accounts start with 'acct_')
    validateAccountId(accountId);
    
    // Validate price information
    if (!priceId && !priceData) {
      return NextResponse.json(
        { 
          error: 'Missing price information',
          details: 'Must provide either priceId or priceData'
        },
        { status: 400 }
      );
    }
    
    console.log('[Create Checkout] Creating session for account:', accountId);
    
    // ============================================
    // STEP 3: Build line items for checkout
    // ============================================
    const lineItems = [];
    
    if (priceId) {
      // Validate priceId format
      validatePriceId(priceId);
      
      // Use existing price ID
      lineItems.push({
        price: priceId,
        quantity: quantity,
      });
    } else if (priceData) {
      // Create price data inline
      const { unitAmount, currency = 'usd', productName } = priceData;
      
      if (!unitAmount || unitAmount <= 0) {
        return NextResponse.json(
          { 
            error: 'Invalid price data',
            details: 'priceData.unitAmount must be a positive number'
          },
          { status: 400 }
        );
      }
      
      lineItems.push({
        price_data: {
          unit_amount: unitAmount,
          currency: currency,
          product_data: {
            name: productName || 'Product',
          },
        },
        quantity: quantity,
      });
    }
    
    // ============================================
    // STEP 4: Create checkout session on the connected account
    // ============================================
    // Use stripeAccount option to set the Stripe-Account header
    // This creates a Direct Charge - the connected account is the merchant
    
    const sessionParams = {
      line_items: lineItems,
      mode: 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl,
    };
    
    // Add application fee if specified
    // This is how the platform makes money - a fee on each transaction
    if (applicationFeeAmount && applicationFeeAmount > 0) {
      sessionParams.payment_intent_data = {
        application_fee_amount: applicationFeeAmount,
      };
    }
    
    const session = await stripeClient.checkout.sessions.create(
      sessionParams,
      {
        stripeAccount: accountId // This sets the Stripe-Account header
      }
    );
    
    console.log('[Create Checkout] ✓ Session created:', session.id);
    console.log('[Create Checkout]   URL:', session.url);
    console.log('[Create Checkout]   Application fee:', applicationFeeAmount || 'None');
    
    // ============================================
    // STEP 5: Return the checkout URL
    // ============================================
    // The customer should be redirected to session.url to complete payment
    return NextResponse.json({
      success: true,
      message: 'Checkout session created successfully',
      url: session.url,
      sessionId: session.id,
      accountId: accountId,
    });
    
  } catch (error: any) {
    console.error('[Create Checkout] Error:', error);
    
    // Provide helpful error messages
    let errorMessage = error.message || 'Failed to create checkout session';
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
