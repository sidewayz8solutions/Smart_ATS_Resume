import { Suspense } from 'react';
import { stripeClient } from '@/lib/stripe-connect';

/**
 * Checkout Success Page
 * 
 * This page is displayed after a successful payment or subscription
 * Uses Suspense for client-side data fetching
 */
export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <SuccessContent />
    </Suspense>
  );
}

function LoadingState() {
  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.spinner}></div>
        <p style={styles.loadingText}>Verifying your payment...</p>
      </div>
    </div>
  );
}

async function SuccessContent() {
  // Get session ID from URL
  const searchParams = new URLSearchParams(window.location.search);
  const sessionId = searchParams.get('session_id');
  
  if (!sessionId) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <h1 style={styles.errorTitle}>Missing Session ID</h1>
          <p style={styles.errorText}>No session ID found in the URL</p>
        </div>
      </div>
    );
  }
  
  try {
    // Retrieve the checkout session to display details
    // Note: This requires server-side API call or use the session ID from URL params
    // For demo purposes, we'll show a generic success message
    
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.successIcon}>✓</div>
          <h1 style={styles.successTitle}>Payment Successful!</h1>
          <p style={styles.successText}>
            Thank you for your purchase. Your payment has been processed successfully.
          </p>
          
          <div style={styles.details}>
            <p style={styles.detailItem}>
              <strong>Session ID:</strong> {sessionId}
            </p>
            <p style={styles.detailHint}>
              You should receive a confirmation email shortly.
            </p>
          </div>
          
          <div style={styles.actions}>
            <button
              onClick={() => window.location.href = '/stripe-connect/dashboard'}
              style={styles.buttonPrimary}
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
    
  } catch (error: any) {
    console.error('Error loading session:', error);
    
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <h1 style={styles.errorTitle}>Error Loading Session</h1>
          <p style={styles.errorText}>{error.message || 'Failed to load session details'}</p>
          <button
            onClick={() => window.location.href = '/stripe-connect/dashboard'}
            style={styles.buttonSecondary}
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }
}

const styles = {
  container: {
    minHeight: '100vh',
    background: 'linear-gradient(to br, #1f2937, #111827)',
    padding: '2rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    background: '#1f2937',
    border: '1px solid #374151',
    borderRadius: '1rem',
    padding: '3rem',
    maxWidth: '600px',
    width: '100%',
    textAlign: 'center' as const,
  },
  spinner: {
    width: '50px',
    height: '50px',
    border: '5px solid #374151',
    borderTop: '5px solid #3b82f6',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    margin: '0 auto 2rem',
  },
  loadingText: {
    color: '#9ca3af',
    fontSize: '1.125rem',
  },
  successIcon: {
    fontSize: '4rem',
    marginBottom: '1rem',
  },
  successTitle: {
    fontSize: '2rem',
    fontWeight: 'bold',
    color: '#10b981',
    marginBottom: '1rem',
  },
  successText: {
    color: '#d1d5db',
    fontSize: '1.125rem',
    marginBottom: '2rem',
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
    marginBottom: '2rem',
  },
  details: {
    background: '#111827',
    border: '1px solid #374151',
    borderRadius: '0.5rem',
    padding: '1.5rem',
    marginBottom: '2rem',
    textAlign: 'left' as const,
  },
  detailItem: {
    color: '#9ca3af',
    fontSize: '0.875rem',
    marginBottom: '0.5rem',
  },
  detailHint: {
    color: '#6b7280',
    fontSize: '0.75rem',
  },
  actions: {
    display: 'flex',
    gap: '1rem',
    justifyContent: 'center',
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
};
