import { loadStripe, type Stripe } from "@stripe/stripe-js";

let stripePromise: Promise<Stripe | null> | null = null;

export function getStripePromise(
  publishableKey: string,
): Promise<Stripe | null> {
  stripePromise ??= loadStripe(publishableKey);
  return stripePromise;
}
