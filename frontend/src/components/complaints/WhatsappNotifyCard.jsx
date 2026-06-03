import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Copy, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import {
  buildComplaintShareMessage,
  copyComplaintShareMessage,
  getWhatsappShareUrl,
} from '@/lib/whatsappShare';

/**
 * Sidebar card for notifying ops WhatsApp groups (wa.me prefill).
 * Placed next to assignment/status actions so it reads as part of the workflow.
 */
export default function WhatsappNotifyCard({
  complaint,
  event = 'updated',
  eventOptions = {},
  className = '',
}) {
  if (!complaint?.id || !complaint?.ticket_id) return null;

  const options = { event, ...eventOptions };
  const shareUrl = getWhatsappShareUrl(buildComplaintShareMessage(complaint, options));

  const handleCopy = async () => {
    try {
      await copyComplaintShareMessage(complaint, options);
      toast.success('Copied — paste into your WhatsApp group');
    } catch {
      toast.error('Could not copy message');
    }
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-emerald-600" />
          Notify WhatsApp group
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground leading-relaxed">
          After saving changes here, open WhatsApp, pick your ops group, and send the pre-filled update.
        </p>
        <Button
          asChild
          className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          <a href={shareUrl} target="_blank" rel="noopener noreferrer">
            <MessageCircle className="w-4 h-4" />
            Open in WhatsApp
          </a>
        </Button>
        <button
          type="button"
          onClick={handleCopy}
          className="w-full text-xs text-muted-foreground hover:text-foreground inline-flex items-center justify-center gap-1.5 py-1 transition-colors"
        >
          <Copy className="w-3.5 h-3.5" />
          Copy message instead
        </button>
      </CardContent>
    </Card>
  );
}
