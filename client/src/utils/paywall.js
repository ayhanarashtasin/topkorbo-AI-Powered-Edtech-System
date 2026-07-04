/**
 * paywall.js — shared handling for server "you hit a plan limit / need to
 * upgrade" responses.
 *
 * The server tags these with a machine-readable `code` (see
 * server/services/planService.js): 'LIMIT_REACHED' | 'UPGRADE_REQUIRED'.
 * `notifyPaywall` shows a toast and dispatches a `topkorbo:paywall` window
 * event; a listener mounted in App.jsx routes the user to /pricing.
 */
import toast from 'react-hot-toast';

const PAYWALL_CODES = ['LIMIT_REACHED', 'UPGRADE_REQUIRED'];

export function isPaywallPayload(payload) {
  return !!(payload && PAYWALL_CODES.includes(payload.code));
}

/**
 * If `payload` is a paywall response, toast + broadcast it and return true.
 * Safe to call with any payload; returns false when it isn't a paywall.
 */
export function notifyPaywall(payload) {
  if (!isPaywallPayload(payload)) return false;
  const message =
    payload.message ||
    (payload.code === 'UPGRADE_REQUIRED'
      ? 'This feature requires an upgraded plan.'
      : "You've reached your free-plan limit. Upgrade to continue.");
  toast.error(message);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('topkorbo:paywall', { detail: payload }));
  }
  return true;
}

export default { isPaywallPayload, notifyPaywall };
