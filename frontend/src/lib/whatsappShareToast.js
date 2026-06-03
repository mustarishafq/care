import { toast } from 'sonner';
import { openWhatsappShare } from '@/lib/whatsappShare';

/** Prompt to notify WhatsApp group after a meaningful ticket change. */
export function offerWhatsappShareToast(complaint, options = {}) {
  if (!complaint?.id || !complaint?.ticket_id) return;

  toast.success('Ticket saved — notify your WhatsApp group?', {
    description: `${complaint.ticket_id}: open WhatsApp, choose the ops group, then send.`,
    duration: 12000,
    action: {
      label: 'Open in WhatsApp',
      onClick: () => openWhatsappShare(complaint, options),
    },
  });
}
