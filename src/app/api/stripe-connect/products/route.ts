// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import stripeClient, { validateAccountId, validatePriceId } from '@/lib/stripe-connect';

/**
 * GET /api/stripe-connect/products?accountId=acct_xxx
 * 
 * PURPOSE: Lists products on a connected account
 * Uses the Stripe-Account header to access the connected account
 * 
 * STEP-BY-STEP PROCESS:
 * 1. Get account ID from query parameters
 * 2. Validate account ID format (must start with 'acct_')
 * 3. List products using stripeAccount option (Stripe-Account header)
 * 4. Expand default_price to get price details
 * 5. Format and return product data
 * 
 * QUERY PARAMETERS:
 * - accountId: The Stripe account ID (starts with 'acct_')
 * 
 * RETURNS:
 * - products: Array of active products with their default price
 * 
 * STRIPE-ACCOUNT HEADER:
 * - Pass { stripeAccount: accountId } as second argument
 * - This sets the Stripe-Account header in the request
 * - All operations are performed on behalf of the connected account
 */
export async function GET(req: NextRequest) {
  console.log('[Products] List endpoint called');
  
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
    
    // ============================================
    // STEP 2: Validate account ID format
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
    
    console.log('[Products] Listing products for account:', accountId);
    
    // ============================================
    // STEP 3: List products on the connected account
    // ============================================
    // Use stripeAccount option to make the request on behalf of the connected account
    // This is how you pass the Stripe-Account header in the Node.js SDK
    // 
    // Key options:
    // - limit: Max number of products to return (default: 10, max: 100)
    // - active: Filter to only active products (true/false)
    // - expand: Expand related objects (e.g., ['data.default_price'])
    
    const products = await stripeClient.products.list(
      {
        limit: 20,
        active: true,
        expand: ['data.default_price'], // Expand to get price details
      },
      {
        stripeAccount: accountId, // This sets the Stripe-Account header
      }
    );
    
    console.log(`[Products] ✓ Found ${products.data.length} products`);
    
    // ============================================
    // STEP 4: Format the response
    // ============================================
    // Extract only the necessary fields to send to the client
    // Avoid sending sensitive or unnecessary data
    
    const formattedProducts = products.data.map(product => ({
      id: product.id,
      name: product.name,
      description: product.description,
      active: product.active,
      images: product.images,
      default_price: product.default_price
        ? {
            id: (product.default_price as Stripe.Price).id,
            unit_amount: (product.default_price as Stripe.Price).unit_amount,
            currency: (product.default_price as Stripe.Price).currency,
            recurring: (product.default_price as Stripe.Price).recurring,
          }
        : null,
      created: product.created,
    }));
    
    // ============================================
    // STEP 5: Return product list
    // ============================================
    return NextResponse.json({
      success: true,
      products: formattedProducts,
      count: formattedProducts.length,
      accountId: accountId,
    });
    
  } catch (error: any) {
    console.error('[Products] List error:', error);
    
    // Provide helpful error messages
    let errorMessage = error.message || 'Failed to list products';
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

/**
 * POST /api/stripe-connect/products
 * 
 * PURPOSE: Creates a new product on a connected account
 * Uses the Stripe-Account header to create the product on the connected account
 * 
 * STEP-BY-STEP PROCESS:
 * 1. Parse and validate request body
 * 2. Validate account ID and price information
 * 3. Create product on the connected account using stripeAccount option
 * 4. Retrieve the product with expanded price
 * 5. Return product details to client
 * 
 * REQUEST BODY:
 * - accountId: The Stripe account ID (starts with 'acct_')
 * - name: Product name (required)
 * - description: Product description (optional)
 * - priceInCents: Price in cents (e.g., 2000 for $20.00) (required)
 * - currency: Currency code (default: 'usd')
 * 
 * RETURNS:
 * - product: The created product object
 * - price: The created price object
 * 
 * STRIPE-ACCOUNT HEADER:
 * - Pass { stripeAccount: accountId } as second argument
 * - Product is created on the connected account, not the platform
 */
export async function POST(req: NextRequest) {
  console.log('[Products] Create endpoint called');
  
  try {
    // ============================================
    // STEP 1: Parse and validate request body
    // ============================================
    const body = await req.json();
    const { accountId, name, description, priceInCents, currency = 'usd' } = body;
    
    // Validate required fields
    if (!accountId || !name || !priceInCents) {
      return NextResponse.json(
        { 
          error: 'Missing required fields',
          details: 'accountId, name, and priceInCents are required'
        },
        { status: 400 }
      );
    }
    
    // ============================================
    // STEP 2: Validate account ID and price
    // ============================================
    // Validate accountId format
    if (!accountId.startsWith('acct_')) {
      return NextResponse.json(
        { 
          error: 'Invalid accountId format',
          details: 'Account ID must start with "acct_"'
        },
        { status: 400 }
      );
    }
    
    // Validate price
    if (typeof priceInCents !== 'number' || priceInCents <= 0) {
      return NextResponse.json(
        { 
          error: 'Invalid price',
          details: 'priceInCents must be a positive number'
        },
        { status: 400 }
      );
    }
    
    console.log('[Products] Creating product for account:', accountId, { name, priceInCents, currency });
    
    // ============================================
    // STEP 3: Create product on the connected account
    // ============================================
    // Use stripeAccount option to make the request on behalf of the connected account
    // 
    // Key properties:
    // - name: Product name (required)
    // - description: Product description (optional)
    // - default_price_data: Create a price inline (alternative to creating price separately)
    //   - unit_amount: Price in cents
    //   - currency: Currency code
    
    const product = await stripeClient.products.create(
      {
        name: name,
        description: description || undefined,
        // Create default price inline
        default_price_data: {
          unit_amount: priceInCents,
          currency: currency,
        },
      },
      {
        stripeAccount: accountId, // This sets the Stripe-Account header
      }
    );
    
    console.log('[Products] ✓ Product created:', product.id);
    
    // ============================================
    // STEP 4: Retrieve the product with expanded price
    // ============================================
    // Fetch the product again to get the full price details
    const productWithPrice = await stripeClient.products.retrieve(
      product.id,
      {
        expand: ['default_price'],
      },
      {
        stripeAccount: accountId,
      }
    );
    
    // ============================================
    // STEP 5: Format and return response
    // ============================================
    const formattedProduct = {
      id: productWithPrice.id,
      name: productWithPrice.name,
      description: productWithPrice.description,
      active: productWithPrice.active,
      default_price: productWithPrice.default_price
        ? {
            id: (productWithPrice.default_price as Stripe.Price).id,
            unit_amount: (productWithPrice.default_price as Stripe.Price).unit_amount,
            currency: (productWithPrice.default_price as Stripe.Price).currency,
          }
        : null,
      created: productWithPrice.created,
    };
    
    return NextResponse.json({
      success: true,
      message: 'Product created successfully',
      product: formattedProduct,
      accountId: accountId,
    });
    
  } catch (error: any) {
    console.error('[Products] Create error:', error);
    
    // Provide helpful error messages
    let errorMessage = error.message || 'Failed to create product';
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
