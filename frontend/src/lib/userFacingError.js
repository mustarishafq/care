/**
 * Map API / runtime errors to short, non-technical copy for toasts.
 * @see docs/TOAST_DESIGN.md
 */

const STATUS_FALLBACKS = {
  400: 'Something was wrong with that request. Please check and try again.',
  401: 'Please sign in again to continue.',
  403: "You don't have permission to do that.",
  404: "We couldn't find what you were looking for.",
  408: 'The request took too long. Please try again.',
  409: 'This conflicts with existing data. Please refresh and try again.',
  413: 'The file is too large. Maximum size is 10 MB.',
  419: 'Your session expired. Please sign in again.',
  422: "We couldn't complete that request. Please check your details and try again.",
  429: 'Too many requests. Please wait a moment and try again.',
  500: 'Something went wrong on the server. Please try again.',
  502: 'The service is temporarily unavailable. Please try again.',
  503: 'The service is temporarily unavailable. Please try again.',
  504: 'The request timed out. Please try again.',
};

const GENERIC_INVALID = 'The given data was invalid.';

/** @type {Array<{ test: RegExp, message: string }>} */
const MESSAGE_REWRITES = [
  {
    test: /cookie expired|cookie is invalid|cookie.*invalid|invalid.*cookie/i,
    message:
      'Your shop cookie expired or is invalid. Paste a fresh Seller Center cookie and try again.',
  },
  {
    test: /no .+ cookie|cookie (is )?not configured|cookie saved|seller center cookie is required/i,
    message:
      'No Seller Center cookie is saved for this shop. Add or update the cookie under Marketplace, then try again.',
  },
  {
    test: /could not find seller id|could not detect .+ shop id/i,
    message:
      "We couldn't identify the shop from this cookie. Open the correct shop in Seller Center, then copy a fresh Cookie header.",
  },
  {
    test: /invalid .+ seller review response|invalid .+ response \(http/i,
    message:
      "We couldn't reach Seller Center. Check your shop cookie and try syncing again.",
  },
  {
    test: /seller center rejected the request parameters/i,
    message: 'Seller Center rejected that request. Refresh the cookie and try again.',
  },
  {
    test: /request failed\s*\(\s*\d+\s*\)/i,
    message: null, // resolved via status fallback
  },
];

function isTechnicalMessage(message) {
  if (!message || typeof message !== 'string') return true;

  const trimmed = message.trim();
  if (!trimmed || trimmed === GENERIC_INVALID) return true;

  return (
    /request failed\s*\(\s*\d+\s*\)/i.test(trimmed)
    || /\bHTTP\s*\d{3}\b/i.test(trimmed)
    || /\bstatus\s*[:=]?\s*\d{3}\b/i.test(trimmed)
    || /\bECONNREFUSED\b|\bETIMEDOUT\b|\bENOTFOUND\b/i.test(trimmed)
    || /stack trace|exception|sqlstate|pdoexception/i.test(trimmed)
    || /^\s*\{[\s\S]*\}\s*$/.test(trimmed)
    || /<\/?[a-z][\s\S]*>/i.test(trimmed)
    || trimmed.length > 280
  );
}

function stripVendorNoise(message) {
  // "Friendly copy. (raw vendor message)" → keep the friendly part
  return message.replace(/\s*\([^)]{0,200}\)\s*$/, '').trim();
}

function rewriteKnownMessage(message) {
  const cleaned = stripVendorNoise(message);

  for (const rule of MESSAGE_REWRITES) {
    if (!rule.test.test(cleaned) && !rule.test.test(message)) continue;
    if (rule.message === null) return null;
    return rule.message;
  }

  return cleaned;
}

export function statusFallbackMessage(status) {
  if (!status || typeof status !== 'number') {
    return 'Something went wrong. Please try again.';
  }

  if (STATUS_FALLBACKS[status]) return STATUS_FALLBACKS[status];
  if (status >= 500) return STATUS_FALLBACKS[500];
  if (status >= 400) return STATUS_FALLBACKS[422];

  return 'Something went wrong. Please try again.';
}

/**
 * Normalize any thrown value / API message into user-facing toast copy.
 * @param {unknown} error
 * @param {string} [fallback]
 */
export function getUserFacingError(error, fallback = 'Something went wrong. Please try again.') {
  const status = typeof error?.status === 'number' ? error.status : null;
  const raw =
    typeof error === 'string'
      ? error
      : (error?.message || error?.data?.message || '');

  if (raw && typeof raw === 'string') {
    const rewritten = rewriteKnownMessage(raw);
    if (rewritten && !isTechnicalMessage(rewritten)) {
      return rewritten;
    }
  }

  if (status) return statusFallbackMessage(status);

  return fallback;
}
