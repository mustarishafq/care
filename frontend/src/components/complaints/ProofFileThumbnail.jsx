import { FileText, Play } from 'lucide-react';
import { getProofFileKind } from '@/lib/proofFiles';
import { cn } from '@/lib/utils';

export default function ProofFileThumbnail({ url, name, className, kind: kindProp, isImage, isVideo }) {
  const kind = kindProp || getProofFileKind(url || name, { isImage, isVideo });

  if (kind === 'image') {
    return (
      <img
        src={url}
        alt={name || 'Proof file'}
        className={cn('w-full h-full object-cover', className)}
        referrerPolicy="no-referrer"
      />
    );
  }

  if (kind === 'video') {
    return (
      <div className={cn('relative w-full h-full bg-black', className)}>
        <video
          src={url}
          className="w-full h-full object-cover"
          muted
          playsInline
          preload="metadata"
        />
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-black/20">
          <div className="rounded-full bg-black/50 p-1.5">
            <Play className="w-4 h-4 text-white fill-white" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col items-center justify-center w-full h-full p-1 gap-1', className)}>
      <FileText className="w-5 h-5 text-muted-foreground shrink-0" />
      {name && (
        <span className="text-[10px] text-muted-foreground truncate w-full text-center px-0.5" title={name}>
          {name}
        </span>
      )}
    </div>
  );
}
