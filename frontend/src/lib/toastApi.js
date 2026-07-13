import { toast } from 'sonner';
import { getUserFacingError } from '@/lib/userFacingError';

/**
 * Show an error toast with non-technical copy.
 * Prefer this over `toast.error(err.message)` in catch blocks.
 *
 * @param {unknown} error
 * @param {string} [fallback]
 * @param {import('sonner').ExternalToast} [options]
 */
export function toastApiError(error, fallback = 'Something went wrong. Please try again.', options) {
  return toast.error(getUserFacingError(error, fallback), options);
}
