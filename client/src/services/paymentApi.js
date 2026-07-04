/**
 * paymentApi.js — client for the subscription checkout flow.
 */
import { httpClient } from './httpClient';

const { request, buildHeaders } = httpClient;

/**
 * Create an SSLCommerz checkout session for a plan and return the gateway URL.
 * @param {'pro'|'pro_plus'} plan
 * @returns {Promise<{ url: string, tranId: string }>}
 */
export function initPayment(plan) {
  return request('/payments/init', {
    method: 'POST',
    headers: buildHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ plan })
  });
}

export default { initPayment };
