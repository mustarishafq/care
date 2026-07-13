import { db } from '@/api/db';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Upload, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { getUserFacingError } from '@/lib/userFacingError';
import { toastApiError } from '@/lib/toastApi';
import { MAX_PROOF_FILE_BYTES, formatProofFileSize } from '@/lib/proofFiles';
import ProofImageGallery from '@/components/complaints/ProofImageGallery';

const storageUrl = (path) => {
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return `/storage/${path.replace(/^\//, '')}`;
};

function mapProofFiles(files = []) {
  return files.map((file) => ({
    path: file.path,
    url: file.url,
    name: file.name,
    isImage: true,
  }));
}

export default function ClosureProofEditor({
  complaint,
  complaintId,
  user,
  readOnly = false,
  onSaved,
}) {
  const [notes, setNotes] = useState('');
  const [proofFiles, setProofFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!complaint) return;
    setNotes(complaint.closure_proof_notes || '');
    setProofFiles(mapProofFiles(complaint.closure_proof_files));
    setUploadError('');
    setDirty(false);
  }, [complaint]);

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    setUploading(true);
    setUploadError('');
    const uploaded = [];
    const errors = [];

    try {
      for (const file of files) {
        if (!file.type.startsWith('image/')) {
          const message = `"${file.name}" must be an image file.`;
          errors.push(message);
          toast.error(message);
          continue;
        }

        if (file.size > MAX_PROOF_FILE_BYTES) {
          const message = `"${file.name}" is too large (${formatProofFileSize(file.size)}). Maximum size is 10 MB.`;
          errors.push(message);
          toast.error(message);
          continue;
        }

        try {
          const { path, url } = await db.integrations.Core.UploadFile({ file });
          uploaded.push({
            path,
            url: url || storageUrl(path),
            name: file.name,
            isImage: true,
          });
        } catch (err) {
          const message = getUserFacingError(err, `Failed to upload "${file.name}"`);
          errors.push(message);
          toast.error(message);
        }
      }

      if (uploaded.length) {
        setProofFiles((prev) => [...prev, ...uploaded]);
        setDirty(true);
      }
      if (errors.length) {
        setUploadError(errors.join(' '));
      }
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const removeProofFile = (index) => {
    setProofFiles((prev) => prev.filter((_, i) => i !== index));
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await db.entities.Complaint.update(complaintId, {
        closure_proof_files: proofFiles.map((file) => ({
          path: file.path,
          name: file.name,
        })),
        closure_proof_notes: notes.trim() || null,
      });

      await db.entities.TicketActivity.create({
        complaint_id: complaintId,
        action_type: 'attachment_uploaded',
        description: proofFiles.length
          ? `Closure proof updated (${proofFiles.length} file${proofFiles.length === 1 ? '' : 's'})`
          : 'Closure proof cleared',
        user_id: user?.id,
      });

      toast.success('Closure proof saved');
      setDirty(false);
      onSaved?.();
    } catch (err) {
      toastApiError(err, 'Failed to save closure proof');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-primary" />
          Closure Proof
        </CardTitle>
        <CardDescription>
          Upload proof images anytime (e.g. delivery photo, customer chat, vendor screenshot).
          At least one saved image is required before this ticket can be closed.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!readOnly && (
          <>
            <label className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/30 px-4 py-6 text-sm text-muted-foreground cursor-pointer hover:bg-muted/50 transition-colors">
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              <span>{uploading ? 'Uploading…' : 'Upload proof images'}</span>
              <input
                type="file"
                multiple
                accept="image/*"
                className="hidden"
                onChange={handleFileUpload}
                disabled={uploading || saving}
              />
            </label>
            {uploadError && (
              <p className="text-xs text-destructive" role="alert">{uploadError}</p>
            )}
          </>
        )}

        <ProofImageGallery
          items={proofFiles}
          onRemove={readOnly ? undefined : removeProofFile}
          emptyMessage="No closure proof uploaded yet."
        />

        <div className="space-y-2">
          <Label htmlFor="closure-notes">Notes {readOnly ? '' : '(optional)'}</Label>
          {readOnly ? (
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {notes || '—'}
            </p>
          ) : (
            <Textarea
              id="closure-notes"
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
                setDirty(true);
              }}
              placeholder="Brief reason or context for closing this ticket…"
              rows={3}
            />
          )}
        </div>

        {!readOnly && (
          <Button
            type="button"
            onClick={handleSave}
            disabled={saving || uploading || !dirty}
            className="w-full sm:w-auto"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
            Save closure proof
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
