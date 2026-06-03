// @ts-nocheck
// Disable TypeScript checking for styles

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

/**
 * Stripe Connect Dashboard
 * 
 * PURPOSE: Allows users to:
 * 1. Create a connected account
 * 2. Check account status and onboarding progress
 * 3. Generate account links to continue onboarding
 * 4. Access billing portal (for subscriptions)
 * 
 * STEP-BY-STEP PROCESS:
 * 1. Check URL for accountId (from redirect after onboarding)
 * 2. Allow user to create a new connected account
 * 3. Check account status using V2 API
 * 4. Generate account link for onboarding
 * 5. Open billing portal for subscription management
 * 
 * Uses clean, simple HTML with styling matching your application
 */
export default function StripeConnectDashboard() {
  const router = useRouter();
  
  // ============================================
  // STATE MANAGEMENT
  // ============================================
  const [loading, setLoading] = useState(false);
  const [accountId, setAccountId] = useState('');
  const [accountStatus, setAccountStatus] = useState<any>(null);
  const [displayName, setDisplayName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  
  // ============================================
  // Instant Payouts STATE MANAGEMENT
  // ============================================
  const [balance, setBalance] = useState<any>(null);
  const [externalAccounts, setExternalAccounts] = useState<any[]>([]);
  const [payoutAmount, setPayoutAmount] = useState('');
  const [selectedDestination, setSelectedDestination] = useState('');
  const [loadingPayout, setLoadingPayout] = useState(false);
  
  // ============================================
  // STEP 1: Check URL for accountId on load
  // ============================================
  useEffect(() => {
    // Check if we have an accountId in the URL
    // This happens after redirect from Stripe onboarding
    const url = new URL(window.location.href);
    const accountIdFromUrl = url.searchParams.get('accountId');
    const refresh = url.searchParams.get('refresh');
    
    if (accountIdFromUrl) {
      console.log('[Dashboard] Found accountId in URL:', accountIdFromUrl);
      setAccountId(accountIdFromUrl);
      
      // Auto-check status after onboarding redirect
      checkAccountStatus(accountIdFromUrl);
    }
    
    if (refresh) {
    toast('Refreshing account status...');
    }
  }, []);
  
  // ============================================
  // STEP 2: Create a connected account
  // ============================================
  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate required fields
    if (!displayName || !contactEmail) {
      toast.error('Please fill in all required fields');
      return;
    }
    
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(contactEmail)) {
      toast.error('Please enter a valid email address');
      return;
    }
    
    setLoading(true);
    try {
      console.log('[Dashboard] Creating account...');
      
      // Call the create-account API endpoint
      const response = await fetch('/api/stripe-connect/create-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName,
          contactEmail,
          country: 'us', // TODO: Make this configurable
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create account');
      }
      
      toast.success('✓ Account created successfully!');
      setAccountId(data.accountId);
      
      // Auto-check status after creation
      await checkAccountStatus(data.accountId);
      
    } catch (error: any) {
      console.error('[Dashboard] Error creating account:', error);
      toast.error(error.message || 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };
  
  // ============================================
  // STEP 3: Check account status
  // ============================================
  const checkAccountStatus = async (acctId: string) => {
    if (!acctId) return;
    
    setLoading(true);
    try {
      console.log('[Dashboard] Checking account status...');
      
      // Call the account-status API endpoint
      const response = await fetch(`/api/stripe-connect/account-status?accountId=${acctId}`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to check account status');
      }
      
      setAccountStatus(data);
      
      // Show appropriate message based on status
      if (data.readyToProcessPayments) {
        toast.success('✓ Account is ready to process payments!');
      } else if (data.onboardingComplete) {
        toast.success('✓ Onboarding complete! Waiting for capability activation...');
      } else {
        toast('Onboarding in progress...');
      }
      
    } catch (error: any) {
      console.error('[Dashboard] Error checking account status:', error);
      toast.error(error.message || 'Failed to check account status');
    } finally {
      setLoading(false);
    }
  };
  
  // ============================================
  // STEP 4: Generate account link for onboarding
  // ============================================
  const handleGenerateAccountLink = async () => {
    if (!accountId) {
      toast.error('No account ID found');
      return;
    }
    
    setLoading(true);
    try {
      console.log('[Dashboard] Generating account link...');
      
      // Call the account-link API endpoint
      const response = await fetch('/api/stripe-connect/account-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId,
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create account link');
      }
      
      toast.success('✓ Redirecting to onboarding...');
      
      // Redirect to Stripe onboarding
      window.location.href = data.url;
      
    } catch (error: any) {
      console.error('[Dashboard] Error generating account link:', error);
      toast.error(error.message || 'Failed to generate account link');
    } finally {
      setLoading(false);
    }
  };
  
  // ============================================
  // STEP 5: Open billing portal
  // ============================================
  const handleOpenBillingPortal = async () => {
    if (!accountId) {
      toast.error('No account ID found');
      return;
    }
    
    setLoading(true);
    try {
      console.log('[Dashboard] Opening billing portal...');
      
      // Call the billing-portal API endpoint
      const response = await fetch('/api/stripe-connect/billing-portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId,
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create billing portal session');
      }
      
      toast.success('✓ Opening billing portal...');
      
      // Redirect to billing portal
      window.location.href = data.url;
      
    } catch (error: any) {
      console.error('[Dashboard] Error opening billing portal:', error);
      toast.error(error.message || 'Failed to open billing portal');
    } finally {
      setLoading(false);
    }
  };
  
  // ============================================
  // Instant Payouts FUNCTIONS
  // ============================================
  
  /**
   * Load balance with instant_available
   */
  const loadBalance = async () => {
    if (!accountId) return;
    
    try {
      console.log('[Dashboard] Loading balance...');
      
      const response = await fetch(`/api/stripe-connect/balance?accountId=${accountId}`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to load balance');
      }
      
      setBalance(data);
      console.log('[Dashboard] ✓ Balance loaded');
      
    } catch (error: any) {
      console.error('[Dashboard] Error loading balance:', error);
      toast.error(error.message || 'Failed to load balance');
    }
  };
  
  /**
   * Load external accounts and check eligibility
   */
  const loadExternalAccounts = async () => {
    if (!accountId) return;
    
    try {
      console.log('[Dashboard] Loading external accounts...');
      
      const response = await fetch(`/api/stripe-connect/external-accounts?accountId=${accountId}`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to load external accounts');
      }
      
      setExternalAccounts(data.externalAccounts || []);
      console.log(`[Dashboard] ✓ Loaded ${data.externalAccounts?.length || 0} external accounts`);
      
    } catch (error: any) {
      console.error('[Dashboard] Error loading external accounts:', error);
      toast.error(error.message || 'Failed to load external accounts');
    }
  };
  
  /**
   * Create an instant payout
   */
  const handleCreateInstantPayout = async () => {
    if (!accountId || !payoutAmount) {
      toast.error('Please enter a payout amount');
      return;
    }
    
    const amountInCents = parseInt(payoutAmount) * 100; // Convert dollars to cents
    
    if (isNaN(amountInCents) || amountInCents <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    
    setLoadingPayout(true);
    try {
      console.log('[Dashboard] Creating instant payout...');
      
      const response = await fetch('/api/stripe-connect/instant-payout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId,
          amount: amountInCents,
          currency: 'usd', // TODO: Make dynamic based on account
          destination: selectedDestination || undefined,
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create instant payout');
      }
      
      toast.success('✓ Instant payout initiated! Funds typically arrive within 30 minutes.');
      setPayoutAmount('');
      setSelectedDestination('');
      
      // Reload balance
      await loadBalance();
      
    } catch (error: any) {
      console.error('[Dashboard] Error creating payout:', error);
      toast.error(error.message || 'Failed to create instant payout');
    } finally {
      setLoadingPayout(false);
    }
  };
  
  // ============================================
  // Auto-load balance and external accounts when accountId changes
  // ============================================
  useEffect(() => {
    if (accountId && accountStatus?.readyToProcessPayments) {
      loadBalance();
      loadExternalAccounts();
    }
  }, [accountId, accountStatus?.readyToProcessPayments]);
  
  // ============================================
  // RENDER UI
  // ============================================
  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.title}>Stripe Connect Dashboard</h1>
        <p style={styles.subtitle}>
          Manage your connected account, onboarding, and payments
        </p>
      </div>
      
      {/* Main Content */}
      <div style={styles.content}>
        {/* Create Account Section */}
        {!accountId && (
          <div style={styles.card}>
            <h2 style={styles.cardTitle}>Get Started</h2>
            <p style={styles.cardDescription}>
              Create a Stripe Connect account to start accepting payments
            </p>
            
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              style={styles.buttonPrimary}
            >
              {showCreateForm ? 'Cancel' : 'Create Connected Account'}
            </button>
            
            {showCreateForm && (
              <form onSubmit={handleCreateAccount} style={styles.form}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Display Name *</label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Your Business Name"
                    style={styles.input}
                    required
                  />
                </div>
                
                <div style={styles.formGroup}>
                  <label style={styles.label}>Contact Email *</label>
                  <input
                    type="email"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="email@business.com"
                    style={styles.input}
                    required
                  />
                </div>
                
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    ...styles.buttonPrimary,
                    ...(loading ? styles.buttonDisabled : {}),
                  }}
                >
                  {loading ? 'Creating...' : 'Create Account'}
                </button>
              </form>
            )}
          </div>
        )}
        
        {/* Account Status Section */}
        {accountId && (
          <div style={styles.card}>
            <h2 style={styles.cardTitle}>Account Status</h2>
            
            <div style={styles.statusGrid}>
              <div style={styles.statusItem}>
                <span style={styles.statusLabel}>Account ID:</span>
                <span style={styles.statusValue}>{accountId}</span>
              </div>
              
              {accountStatus && (
                <>
                  <div style={styles.statusItem}>
                    <span style={styles.statusLabel}>Ready to Process Payments:</span>
                    <span style={{
                      ...styles.statusValue,
                      color: accountStatus.readyToProcessPayments ? '#10b981' : '#ef4444',
                    }}>
                      {accountStatus.readyToProcessPayments ? 'Yes' : 'No'}
                    </span>
                  </div>
                  
                  <div style={styles.statusItem}>
                    <span style={styles.statusLabel}>Onboarding Complete:</span>
                    <span style={{
                      ...styles.statusValue,
                      color: accountStatus.onboardingComplete ? '#10b981' : '#f59e0b',
                    }}>
                      {accountStatus.onboardingComplete ? 'Yes' : 'In Progress'}
                    </span>
                  </div>
                  
                  <div style={styles.statusItem}>
                    <span style={styles.statusLabel}>Requirements Status:</span>
                    <span style={styles.statusValue}>
                      {accountStatus.requirementsStatus || 'N/A'}
                    </span>
                  </div>
                </>
              )}
            </div>
            
            <div style={styles.buttonGroup}>
              <button
                onClick={() => checkAccountStatus(accountId)}
                disabled={loading}
                style={styles.buttonSecondary}
              >
                {loading ? 'Checking...' : 'Refresh Status'}
              </button>
              
              <button
                onClick={handleGenerateAccountLink}
                disabled={loading}
                style={styles.buttonPrimary}
              >
                {loading ? 'Generating...' : 'Continue Onboarding'}
              </button>
              
              <button
                onClick={handleOpenBillingPortal}
                disabled={loading}
                style={styles.buttonSecondary}
              >
                {loading ? 'Opening...' : 'Billing Portal'}
              </button>
            </div>
          </div>
        )}
        
        {/* Quick Actions */}
        {accountId && accountStatus?.readyToProcessPayments && (
          <div style={styles.card}>
            <h2 style={styles.cardTitle}>Quick Actions</h2>
            <div style={styles.buttonGroup}>
              <button
                onClick={() => router.push(`/stripe-connect/storefront/${accountId}`)}
                style={styles.buttonPrimary}
              >
                View Storefront
              </button>
              
              <button
                onClick={() => router.push(`/stripe-connect/storefront/${accountId}#create-product`)}
                style={styles.buttonSecondary}
              >
                Create Product
              </button>
            </div>
          </div>
        )}
      </div>
      
      {/* Instant Payouts Section */}
      {accountId && accountStatus?.readyToProcessPayments && (
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Instant Payouts</h2>
          <p style={styles.cardDescription}>
            Request immediate access to your funds. Payouts typically arrive within 30 minutes.
          </p>
          
          {/* Balance Display */}
          {balance && (
            <div style={styles.balanceGrid}>
              <div style={styles.balanceItem}>
                <span style={styles.balanceLabel}>Available Balance:</span>
                <span style={styles.balanceValue}>
                  ${((balance.balance?.available?.[0]?.amount || 0) / 100).toFixed(2)} {balance.balance?.available?.[0]?.currency?.toUpperCase() || 'USD'}
                </span>
              </div>
              <div style={styles.balanceItem}>
                <span style={styles.balanceLabel}>Instant Available (Net):</span>
                <span style={styles.balanceValueGreen}>
                  ${((balance.instantAvailable?.totalNetAvailable || 0) / 100).toFixed(2)}
                </span>
              </div>
            </div>
          )}
          
          {/* External Accounts */}
          {externalAccounts.length > 0 && (
            <div style={styles.formGroup}>
              <label style={styles.label}>Select Destination:</label>
              <select
                value={selectedDestination}
                onChange={(e) => setSelectedDestination(e.target.value)}
                style={styles.select}
              >
                <option value="">Select an account...</option>
                {externalAccounts.map((acc: any) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.object === 'bank_account' ? '🏦' : '💳'} 
                    {acc.bank_name || acc.last4} - {acc.currency.toUpperCase()}
                    {acc.isEligibleForInstantPayouts ? ' ✓ Eligible' : ' ✗ Not eligible'}
                  </option>
                ))}
              </select>
            </div>
          )}
          
          {/* Payout Amount */}
          <div style={styles.formGroup}>
            <label style={styles.label}>Payout Amount ($):</label>
            <input
              type="number"
              value={payoutAmount}
              onChange={(e) => setPayoutAmount(e.target.value)}
              placeholder="0.00"
              style={styles.input}
              min="0.50"
              step="0.01"
            />
            <span style={styles.formHint}>Minimum: $0.50 USD. Maximum: $9,999 USD.</span>
          </div>
          
          {/* Create Payout Button */}
          <button
            onClick={handleCreateInstantPayout}
            disabled={loadingPayout || !payoutAmount || !selectedDestination}
            style={{
              ...styles.buttonPrimary,
              ...(loadingPayout ? styles.buttonDisabled : {}),
            }}
          >
            {loadingPayout ? 'Processing...' : 'Request Instant Payout'}
          </button>
          
          {/* Payout Limits Info */}
          <div style={styles.infoCard}>
            <h3 style={styles.infoTitle}>Pricing & Limits</h3>
            <ul style={styles.infoList}>
              <li>Stripe charges 1% fee for Instant Payouts</li>
              <li>Platform fees may also apply (see Application Fees)</li>
              <li>Min: $0.50 USD | Max: $9,999 USD</li>
              <li>Funds typically arrive within 30 minutes</li>
            </ul>
          </div>
        </div>
      )}
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
  },
  content: {
    maxWidth: '800px',
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
  cardTitle: {
    fontSize: '1.5rem',
    fontWeight: 'bold',
    color: '#93c5fd',
    marginBottom: '1rem',
  },
  cardDescription: {
    color: '#9ca3af',
    marginBottom: '1.5rem',
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
    padding: '0.75rem 1.5rem',
    background: '#374151',
    color: 'white',
    border: '1px solid #4b5563',
    borderRadius: '0.5rem',
    fontWeight: '600',
    cursor: 'pointer',
    fontSize: '1rem',
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
  statusGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '1rem',
    marginBottom: '2rem',
  },
  statusItem: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.25rem',
  },
  statusLabel: {
    color: '#9ca3af',
    fontSize: '0.875rem',
  },
  statusValue: {
    color: 'white',
    fontSize: '1rem',
    fontWeight: '600',
  },
  balanceGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '1rem',
    marginBottom: '1.5rem',
    padding: '1rem',
    background: '#111827',
    borderRadius: '0.5rem',
  },
  balanceItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
  },
  balanceLabel: {
    color: '#9ca3af',
    fontSize: '0.875rem',
  },
  balanceValue: {
    color: 'white',
    fontSize: '1.25rem',
    fontWeight: '600',
  },
  balanceValueGreen: {
    color: '#10b981',
    fontSize: '1.25rem',
    fontWeight: '600',
  },
  select: {
    padding: '0.75rem',
    background: '#374151',
    border: '1px solid #4b5563',
    borderRadius: '0.5rem',
    color: 'white',
    fontSize: '1rem',
    cursor: 'pointer',
  },
  infoCard: {
    background: '#1e3a5f',
    border: '1px solid #1e40af',
    borderRadius: '1rem',
    padding: '1.5rem',
    marginTop: '1.5rem',
  },
  infoTitle: {
    fontSize: '1.125rem',
    fontWeight: 'bold',
    color: '#93c5fd',
    marginBottom: '0.75rem',
  },
  infoList: {
    color: '#bfdbfe',
    marginBottom: '0',
    paddingLeft: '1.5rem',
  },
  buttonGroup: {
    display: 'flex',
    gap: '1rem',
    flexWrap: 'wrap' as const,
  },
};
