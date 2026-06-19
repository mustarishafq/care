import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

import { cn } from '@/lib/utils';
import { getProofFileKind } from '@/lib/proofFiles';
import { Button } from '@/components/ui/button';
import ProofFileThumbnail from '@/components/complaints/ProofFileThumbnail';

function normalizeItem(item, index) {
  if (typeof item === 'string') {
    return { url: item, key: item };
  }

  return {
    url: item.url,
    key: item.path || item.url || String(index),
    isImage: item.isImage,
    isVideo: item.isVideo,
    name: item.name,
  };
}

function ViewerSlide({ item }) {
  const kind = getProofFileKind(item.url || item.name, {
    isImage: item.isImage,
    isVideo: item.isVideo,
  });

  if (kind === 'image') {
    return (
      <img
        src={item.url}
        alt=""
        className="max-h-[85vh] max-w-[min(100vw-2rem,56rem)] object-contain rounded-lg shadow-2xl"
      />
    );
  }

  if (kind === 'video') {
    return (
      <video
        src={item.url}
        controls
        className="max-h-[85vh] max-w-[min(100vw-2rem,56rem)] rounded-lg shadow-2xl"
        playsInline
      />
    );
  }

  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="rounded-lg bg-card px-4 py-3 text-sm text-primary shadow-xl hover:underline"
    >
      Open attachment
    </a>
  );
}

export default function ProofImageGallery({
  items = [],
  onRemove,
  className,
  emptyMessage = null,
}) {
  const [viewerOpen, setViewerOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const normalized = useMemo(
    () => items.map(normalizeItem).filter((item) => item.url),
    [items],
  );

  const openViewer = (index) => {
    setActiveIndex(index);
    setViewerOpen(true);
  };

  const goPrev = () => {
    setActiveIndex((i) => (i <= 0 ? normalized.length - 1 : i - 1));
  };

  const goNext = () => {
    setActiveIndex((i) => (i >= normalized.length - 1 ? 0 : i + 1));
  };

  useEffect(() => {
    if (!viewerOpen) return undefined;

    const onKeyDown = (e) => {
      if (e.key === 'Escape') setViewerOpen(false);
      if (e.key === 'ArrowLeft') {
        setActiveIndex((i) => (i <= 0 ? normalized.length - 1 : i - 1));
      }
      if (e.key === 'ArrowRight') {
        setActiveIndex((i) => (i >= normalized.length - 1 ? 0 : i + 1));
      }
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [viewerOpen, normalized.length]);

  if (!normalized.length) {
    return emptyMessage ? (
      <p className="text-sm text-muted-foreground text-center py-4 rounded-lg border border-dashed border-border">
        {emptyMessage}
      </p>
    ) : null;
  }

  const current = normalized[activeIndex];

  return (
    <>
      <div className={cn('grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2', className)}>
        {normalized.map((item, index) => (
          <div
            key={item.key}
            className="relative aspect-square overflow-hidden rounded-lg border border-border bg-muted group"
          >
            <button
              type="button"
              onClick={() => openViewer(index)}
              className="absolute inset-0 h-full w-full cursor-zoom-in"
              aria-label={`View attachment ${index + 1}`}
            >
              <ProofFileThumbnail
                url={item.url}
                name=""
                isImage={item.isImage}
                isVideo={item.isVideo}
                className="h-full w-full transition-transform duration-200 group-hover:scale-105"
              />
            </button>
            {onRemove && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1 h-6 w-6 rounded-full bg-black/60 text-white hover:bg-black/80 hover:text-white"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(index);
                }}
                aria-label="Remove attachment"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        ))}
      </div>

      {viewerOpen && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8">
          <button
            type="button"
            className="absolute inset-0 bg-background/70 backdrop-blur-xl"
            onClick={() => setViewerOpen(false)}
            aria-label="Close preview"
          />

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-3 top-3 z-20 h-9 w-9 rounded-full bg-background/80 text-foreground shadow-md backdrop-blur-sm hover:bg-background"
            onClick={() => setViewerOpen(false)}
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </Button>

          {normalized.length > 1 && (
            <>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute left-3 top-1/2 z-20 h-10 w-10 -translate-y-1/2 rounded-full bg-background/80 text-foreground shadow-md backdrop-blur-sm hover:bg-background"
                onClick={goPrev}
                aria-label="Previous image"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-3 top-1/2 z-20 h-10 w-10 -translate-y-1/2 rounded-full bg-background/80 text-foreground shadow-md backdrop-blur-sm hover:bg-background sm:right-14"
                onClick={goNext}
                aria-label="Next image"
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
              <p className="pointer-events-none absolute bottom-4 left-1/2 z-20 -translate-x-1/2 rounded-full bg-background/80 px-3 py-1 text-xs font-medium text-foreground shadow-md backdrop-blur-sm">
                {activeIndex + 1} / {normalized.length}
              </p>
            </>
          )}

          <div
            className="relative z-10 flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            {current && <ViewerSlide item={current} />}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
