'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import toast from 'react-hot-toast';

/**
 * Stripe Connect Storefront
 * 
 * PURPOSE: Displays products for a connected account and allows customers to make purchases
 * 
 * STEP-BY-STEP PROCESS:
 * 1. Load account status to verify the account can process payments
 * 2. Load products from the connected account
 * 3. Display products in a grid layout
 * 4. Handle purchasing a product (redirect to Stripe Checkout)
 * 5. Allow account owner to create new products
 * 
 * URL: /stripe-connect/storefront/[accountId]
 * NOTE: In production, use a friendlier identifier like store slug
 * 
 * FEATURES:
 * - List products from the connected account
 * - Create checkout sessions for direct charges
 * - Support for one-time payments
 * - Product creation form (for account owner)
 * 
 * STRIPE-ACCOUNT HEADER:
 * - All product operations use { stripeAccount: accountId }
 * - This sets the Stripe-Account header in requests
 */
export default function Storefront() {
  const router = useRouter();
  const params = useParams();
  const accountId = params.accountId as string;
  
  // ============================================
  // STATE MANAGEMENT
  // ============================================
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<any[]>([]);
  const [accountStatus, setAccountStatus] = useState<any>(null);
  const [purchasingProduct, setPurchasingProduct] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newProduct, setNewProduct] = useState({
    name: '',
    description: '',
    priceInCents: 0,
  });
  
  // ============================================
  // STEP 1: Load account status and products on mount
  // ============================================
  useEffect(() => {
    if (accountId) {
      console.log('[Storefront] Loading data for account:', accountId);
      loadAccountStatus();
      loadProducts();
    }
  }, [accountId]);
  
  /**
   * Load account status to verify the account can process payments
   */
  const loadAccountStatus = async () => {
    try {
      console.log('[Storefront] Loading account status...');
      
      const response = await fetch(`/api/stripe-connect/account-status?accountId=${accountId}`);
      const data = await response.json();
      
      if (response.ok) {
        setAccountStatus(data);
        console.log('[Storefront] ✓ Account status loaded:', data.readyToProcessPayments);
      } else {
        console.error('[Storefront] Error loading account status:', data.error);
      }
    } catch (error) {
      console.error('[Storefront] Error loading account status:', error);
    }
  };
  
  /**
   * Load products from the connected account
   * Uses GET /api/stripe-connect/products?accountId=xxx
   */
  const loadProducts = async () => {
    setLoading(true);
    try {
      console.log('[Storefront] Loading products...');
      
      // Call the products API with accountId
      const response = await fetch(`/api/stripe-connect/products?accountId=${accountId}`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to load products');
      }
      
      console.log(`[Storefront] ✓ Loaded ${data.products?.length || 0} products`);
      setProducts(data.products || []);
      
    } catch (error: any) {
      console.error('[Storefront] Error loading products:', error);
      toast.error(error.message || 'Failed to load products');
    } finally {
      setLoading(false);
    }
  };
  
  // ============================================
  // STEP 2: Handle purchasing a product
  // ============================================
  /**
   * Creates a checkout session and redirects to Stripe Checkout
   * Uses POST /api/stripe-connect/create-checkout
   */
  const handlePurchase = async (product: any) => {
    // Check if account can process payments
    if (!accountStatus?.readyToProcessPayments) {
      toast.error('This store is not ready to process payments yet');
      return;
    }
    
    setPurchasingProduct(product.id);
    try {
      console.log('[Storefront] Creating checkout for product:', product.name);
      
      // TODO: Replace with your actual success/cancel URLs
      const baseUrl = window.location.origin;
      const successUrl = `${baseUrl}/stripe-connect/storefront/${accountId}/success`;
      const cancelUrl = `${baseUrl}/stripe-connect/storefront/${accountId}`;
      
      // Call the create-checkout API
      const response = await fetch('/api/stripe-connect/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId,
          priceId: product.default_price?.id,
          // Alternatively, use priceData for dynamic pricing:
          // priceData: {
          //   unitAmount: product.default_price?.unit_amount,
          //   currency: product.default_price?.currency || 'usd',
          //   productName: product.name,
          // },
          applicationFeeAmount: Math.round(product.default_price?.unit_amount * 0.1), // 10% platform fee
          successUrl,
          cancelUrl,
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create checkout session');
      }
      
      toast.success('Redirecting to checkout...');
      
      // Redirect to Stripe Checkout
      window.location.href = data.url;
      
    } catch (error: any) {
      console.error('[Storefront] Error creating checkout:', error);
      toast.error(error.message || 'Failed to create checkout session');
    } finally {
      setPurchasingProduct(null);
    }
  };
  
  // ============================================
  // STEP 3: Handle creating a new product (for account owner)
  // ============================================
  /**
   * Creates a new product on the connected account
   * Uses POST /api/stripe-connect/products
   */
  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newProduct.name || !newProduct.priceInCents) {
      toast.error('Please fill in all required fields');
      return;
    }
    
    try {
      console.log('[Storefront] Creating product:', newProduct.name);
      
      const response = await fetch('/api/stripe-connect/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId,
          name: newProduct.name,
          description: newProduct.description,
          priceInCents: newProduct.priceInCents,
          currency: 'usd',
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create product');
      }
      
      toast.success('✓ Product created successfully!');
      setShowCreateForm(false);
      setNewProduct({ name: '', description: '', priceInCents: 0 });
      
      // Reload products
      await loadProducts();
      
    } catch (error: any) {
      console.error('[Storefront] Error creating product:', error);
      toast.error(error.message || 'Failed to create product');
    }
  };
  
  // ============================================
  // RENDER: Error state - no accountId
  // ============================================
  if (!accountId) {
    return (
      <div style={styles.container}>
        <div style={styles.errorCard}>
          <h1 style={styles.errorTitle}>Invalid Store</h1>
          <p style={styles.errorText}>No account ID provided in the URL</p>
          <p style={styles.hint}>
            NOTE: In production, use a friendlier URL like /store/your-store-name
          </p>
        </div>
      </div>
    );
  }
  
  // ============================================
  // RENDER: Main UI
  // ============================================
  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.title}>Storefront</h1>
        <p style={styles.subtitle}>
          Account: {accountId}
        </p>
        {accountStatus && (
          <div style={{
            ...styles.statusBadge,
            backgroundColor: accountStatus.readyToProcessPayments ? '#065f46' : '#78350f',
          }}>
            {accountStatus.readyToProcessPayments ? '✓ Ready to Process Payments' : '⚠ Payment Processing Not Ready'}
          </div>
        )}
      </div>
      
      {/* Main Content */}
      <div style={styles.content}>
        {/* Create Product Section (for account owner) */}
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <h2 style={styles.cardTitle}>Manage Products</h2>
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              style={styles.buttonSecondary}
            >
              {showCreateForm ? 'Cancel' : '+ Add Product'}
            </button>
          </div>
          
          {showCreateForm && (
            <form onSubmit={handleCreateProduct} style={styles.form}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Product Name *</label>
                <input
                  type="text"
                  value={newProduct.name}
                  onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                  placeholder="Premium Service"
                  style={styles.input}
                  required
                />
              </div>
              
              <div style={styles.formGroup}>
                <label style={styles.label}>Description</label>
                <textarea
                  value={newProduct.description}
                  onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                  placeholder="Describe your product or service..."
                  style={{ ...styles.input, minHeight: '100px', resize: 'vertical' }}
                />
              </div>
              
              <div style={styles.formGroup}>
                <label style={styles.label}>Price (in cents) *</label>
                <input
                  type="number"
                  value={newProduct.priceInCents || ''}
                  onChange={(e) => setNewProduct({ ...newProduct, priceInCents: parseInt(e.target.value) || 0 })}
                  placeholder="2000 (for $20.00)"
                  style={styles.input}
                  min="1"
                  required
                />
                <span style={styles.formHint}>Enter price in cents (e.g., 2000 = $20.00)</span>
              </div>
              
              <button type="submit" style={styles.buttonPrimary}>
                Create Product
              </button>
            </form>
          )}
        </div>
        
        {/* Products List */}
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <h2 style={styles.cardTitle}>Products</h2>
            <button
              onClick={loadProducts}
              style={styles.buttonSmall}
              disabled={loading}
            >
              {loading ? 'Loading...' : 'Refresh'}
            </button>
          </div>
          
          {loading ? (
            <div style={styles.loading}>Loading products...</div>
          ) : products.length === 0 ? (
            <div style={styles.empty}>
              <p style={styles.emptyText}>No products yet</p>
              <p style={styles.emptyHint}>Create your first product to start selling</p>
            </div>
          ) : (
            <div style={styles.productGrid}>
              {products.map((product) => (
                <div key={product.id} style={styles.productCard}>
                  {product.images && product.images.length > 0 && (
                    <img 
                      src={product.images[0]} 
                      alt={product.name}
                      style={styles.productImage}
                    />
                  )}
                  <div style={styles.productContent}>
                    <h3 style={styles.productName}>{product.name}</h3>
                    {product.description && (
                      <p style={styles.productDescription}>{product.description}</p>
                    )}
                    {product.default_price && (
                      <div style={styles.productPrice}>
                        ${(product.default_price.unit_amount / 100).toFixed(2)} {product.default_price.currency.toUpperCase()}
                      </div>
                    )}
                    <button
                      onClick={() => handlePurchase(product)}
                      disabled={purchasingProduct === product.id || !accountStatus?.readyToProcessPayments}
                      style={{
                        ...styles.buttonPrimary,
                        ...(purchasingProduct === product.id ? styles.buttonDisabled : {}),
                      }}
                    >
                      {purchasingProduct === product.id ? 'Processing...' : 'Buy Now'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Info Section */}
        <div style={styles.infoCard}>
          <h3 style={styles.infoTitle}>How It Works</h3>
          <ul style={styles.infoList}>
            <li>Customers click "Buy Now" on any product</li>
            <li>They are redirected to Stripe Checkout (hosted by the connected account)</li>
            <li>Payment is processed directly to the connected account</li>
            <li>Platform collects an application fee (10% in this demo)</li>
          </ul>
          <p style={styles.infoNote}>
            <strong>Note:</strong> This demo uses the connected account ID in the URL.
            In production, use a friendlier identifier like a store slug or custom domain.
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * STYLES matching your application's theme
 * Dark gradient background with glassmorphism cards
 */
const styles = {
  container: {
    minHeight: '100vh',
    background: 'linear-gradient(to br, #1f2937, #111827)',
    padding: '2rem',
  },
  header: {
    textAlign: 'center' as const,
    marginBottom: '3rem',
  },
  title: {
    fontSize: '2.5rem',
    fontWeight: 'bold',
    color: '#60a5fa',
    marginBottom: '0.5rem',
  },
  subtitle: {
    fontSize: '1.125rem',
    color: '#9ca3af',
    marginBottom: '1rem',
  },
  statusBadge: {
    display: 'inline-block',
    padding: '0.5rem 1rem',
    borderRadius: '9999px',
    color: 'white',
    fontSize: '0.875rem',
    fontWeight: '600',
  },
  content: {
    maxWidth: '1200px',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '2rem',
  },
  card: {
    background: '#1f2937',
    border: '1px solid #374151',
    borderRadius: '1rem',
    padding: '2rem',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between' as const,
    alignItems: 'center',
    marginBottom: '1.5rem',
  },
  cardTitle: {
    fontSize: '1.5rem',
    fontWeight: 'bold',
    color: '#93c5fd',
    margin: 0,
  },
  buttonPrimary: {
    padding: '0.75rem 1.5rem',
    background: 'linear-gradient(to right, #3b82f6, #8b5cf6)',
    color: 'white',
    border: 'none',
    borderRadius: '0.5rem',
    fontWeight: '600',
    cursor: 'pointer',
    fontSize: '1rem',
  },
  buttonSecondary: {
    padding: '0.5rem 1rem',
    background: '#374151',
    color: 'white',
    border: '1px solid #4b5563',
    borderRadius: '0.5rem',
    fontWeight: '600',
    cursor: 'pointer',
    fontSize: '0.875rem',
  },
  buttonSmall: {
    padding: '0.25rem 0.75rem',
    background: '#374151',
    color: 'white',
    border: '1px solid #4b5563',
    borderRadius: '0.25rem',
    cursor: 'pointer',
    fontSize: '0.75rem',
  },
  buttonDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  form: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '1.5rem',
    marginTop: '1.5rem',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.5rem',
  },
  label: {
    color: '#d1d5db',
    fontSize: '0.875rem',
    fontWeight: '500',
  },
  input: {
    padding: '0.75rem',
    background: '#374151',
    border: '1px solid #4b5563',
    borderRadius: '0.5rem',
    color: 'white',
    fontSize: '1rem',
  },
  formHint: {
    color: '#9ca3af',
    fontSize: '0.75rem',
  },
  loading: {
    textAlign: 'center' as const,
    padding: '3rem',
    color: '#9ca3af',
    fontSize: '1.125rem',
  },
  empty: {
    textAlign: 'center' as const,
    padding: '3rem',
  },
  emptyText: {
    color: '#d1d5db',
    fontSize: '1.25rem',
    marginBottom: '0.5rem',
  },
  emptyHint: {
    color: '#9ca3af',
    fontSize: '0.875rem',
  },
  productGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: '1.5rem',
  },
  productCard: {
    background: '#111827',
    border: '1px solid #374151',
    borderRadius: '0.75rem',
    overflow: 'hidden',
  },
  productImage: {
    width: '100%',
    height: '200px',
    objectFit: 'cover' as const,
  },
  productContent: {
    padding: '1.5rem',
  },
  productName: {
    fontSize: '1.25rem',
    fontWeight: 'bold',
    color: 'white',
    marginBottom: '0.5rem',
  },
  productDescription: {
    color: '#9ca3af',
    fontSize: '0.875rem',
    marginBottom: '1rem',
  },
  productPrice: {
    fontSize: '1.5rem',
    fontWeight: 'bold',
    color: '#60a5fa',
    marginBottom: '1rem',
  },
  infoCard: {
    background: '#1e3a5f',
    border: '1px solid #1e40af',
    borderRadius: '1rem',
    padding: '2rem',
  },
  infoTitle: {
    fontSize: '1.25rem',
    fontWeight: 'bold',
    color: '#93c5fd',
    marginBottom: '1rem',
  },
  infoList: {
    color: '#bfdbfe',
    marginBottom: '1rem',
    paddingLeft: '1.5rem',
  },
  infoNote: {
    color: '#dbeafe',
    fontSize: '0.875rem',
    borderTop: '1px solid #1e40af',
    paddingTop: '1rem',
    marginTop: '1rem',
  },
  errorCard: {
    background: '#1f2937',
    border: '1px solid #ef4444',
    borderRadius: '1rem',
    padding: '3rem',
    textAlign: 'center' as const,
    maxWidth: '600px',
    margin: '0 auto',
  },
  errorTitle: {
    fontSize: '2rem',
    fontWeight: 'bold',
    color: '#ef4444',
    marginBottom: '1rem',
  },
  errorText: {
    color: '#d1d5db',
    fontSize: '1.125rem',
    marginBottom: '1rem',
  },
  hint: {
    color: '#9ca3af',
    fontSize: '0.75rem',
  },
};
