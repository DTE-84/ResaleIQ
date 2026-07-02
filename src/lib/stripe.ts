/**
 * Stripe / LockboxIQ Integration Scaffolding
 * Handles $19.99/mo premium subscriptions for ResaleIQ Act II.
 */

export const STRIPE_CONFIG = {
  premiumPlanId: 'price_resaleiq_monthly_1999',
  monthlyPrice: 19.99,
};

export interface SubscriptionStatus {
  isActive: boolean;
  customerId?: string;
  currentPeriodEnd?: string;
  plan?: string;
}

/**
 * Initializes a checkout session for the $19.99/mo plan.
 */
export async function createCheckoutSession(userEmail: string, userId: string) {
  // TODO: Connect to backend LockboxIQ / Stripe endpoint
  console.log(`[Stripe] Creating checkout session for ${userEmail} (${userId})...`);
  
  // Mock response
  return {
    url: 'https://checkout.stripe.com/mock-resaleiq-checkout'
  };
}

/**
 * Checks the current user's subscription status.
 */
export async function checkSubscriptionStatus(userId: string): Promise<SubscriptionStatus> {
  // TODO: Fetch from Supabase 'subscriptions' or 'users' table
  console.log(`[Stripe] Checking subscription status for user: ${userId}`);
  
  // Default to inactive for freemium testing
  return {
    isActive: false,
  };
}
