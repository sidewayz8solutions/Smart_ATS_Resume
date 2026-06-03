// Stripe Connect Client Utility
// This file initializes the Stripe client for all Connect operations
// Using the Stripe Client pattern as recommended in the requirements

import Stripe from 'stripe';

// ============================================
// STEP 1: Initialize Stripe Client
// ============================================
// TODO: Replace with your actual Stripe secret key
// The key should start with 'sk_test_' (test mode) or 'sk_live_' (production)
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
  throw new Error(
    'STRIPE_SECRET_KEY is not configured. ' +
    'Please add it to your .env.local file.\n' +
    'Get your key from: https://dashboard.stripe.com/apikeys'
  );
}

// Create Stripe client instance
// The SDK will automatically use the latest API version (2026-05-27.dahlia)
// No need to manually set apiVersion unless you want to pin a specific version
export const stripeClient = new Stripe(stripeSecretKey);

// ============================================
// STEP 2: Type Definitions
// ============================================
// These types help document the expected structure for Connect operations

export interface CreateAccountParams {
  displayName: string;    // Business or account name (from user)
  contactEmail: string;    // Contact email (from user)
  country?: string;         // Country code (default: 'us')
}

export interface CreateProductParams {
  accountId: string;       // Connected account ID (starts with 'acct_')
  name: string;            // Product name
  description?: string;    // Product description (optional)
  priceInCents: number;    // Price in cents (e.g., 2000 for $20.00)
  currency?: string;        // Currency code (default: 'usd')
}

export interface CreateCheckoutSessionParams {
  accountId: string;       // Connected account ID (for Stripe-Account header)
  priceId?: string;        // Existing Stripe price ID (alternative to priceData)
  priceData?: {            // Inline price data (alternative to priceId)
    unitAmount: number;     // Price in cents
    currency: string;       // Currency code
    productName: string;    // Product name (for price_data.product_data)
  };
  quantity?: number;        // Quantity (default: 1)
  applicationFeeAmount?: number; // Platform fee in cents (optional)
  successUrl: string;      // Redirect URL after successful payment
  cancelUrl: string;      // Redirect URL if payment cancelled
}

export interface CreateSubscriptionParams {
  accountId: string;       // Connected account ID (used as customer_account)
  priceId: string;         // Stripe price ID for the subscription
  successUrl: string;      // Redirect URL after successful subscription
  cancelUrl: string;       // Redirect URL if subscription cancelled
}

export interface AccountStatus {
  accountId: string;
  readyToProcessPayments: boolean;
  onboardingComplete: boolean;
  requirementsStatus: string | null;
  account: any; // Full account object from Stripe
}

// ============================================
// STEP 3: Helper Functions
// ============================================

/**
 * Validates that an account ID has the correct format
 * V2 accounts start with 'acct_'
 */
export function validateAccountId(accountId: string): boolean {
  if (!accountId || !accountId.startsWith('acct_')) {
    throw new Error(
      `Invalid accountId format: ${accountId}\n` +
      'Account ID must start with "acct_"'
    );
  }
  return true;
}

/**
 * Validates that a price ID has the correct format
 * Price IDs start with 'price_'
 */
export function validatePriceId(priceId: string): boolean {
  if (!priceId || !priceId.startsWith('price_')) {
    throw new Error(
      `Invalid priceId format: ${priceId}\n` +
      'Price ID must start with "price_"'
    );
  }
  return true;
}

// Export the Stripe client for use in all Connect routes
export default stripeClient;
