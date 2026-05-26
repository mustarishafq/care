import { db } from '@/api/db';

import React, { useState, useRef } from 'react';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getUserDepartmentIds } from '@/lib/useDepartments';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { format } from 'date-fns';
import { Send, Loader2, AtSign } from 'lucide-react';
import { toast } from 'sonner';
import { findMentionedUsers, sendNotification, invalidateNotificationQueries } from '@/lib/notifications';

function initials(name) {
  if (!name) return '??';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

/** Render note content with @mentions highlighted */
function NoteContent({ content }) {
  const parts = content.split(/(@\w[\w\s]*?\b)(?=\s|$|[,.])/g);
  return (
    <p className="text-sm mt-1 whitespace-pre-wrap leading-relaxed">
      {parts.map((part, i) =>
        part.startsWith('@') ? (
          <span key={i} className="inline-flex items-center gap-0.5 bg-primary/10 text-primary rounded px-1 font-medium text-xs py-0.5">
            <AtSign className="w-2.5 h-2.5" />{part.slice(1)}
          </span>
        ) : part
      )}
    </p>
  );
}

export default function InternalNotes({ notes, complaintId, canAddNotes = false }) {
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const [mentionQuery, setMentionQuery] = useState(null); // null | string
  const [mentionPos, setMentionPos] = useState(0); // cursor index of @
  const textareaRef = useRef(null);

  const { data: users = [] } = useQuery({
    queryKey: ['users-list'],
    queryFn: () => db.entities.User.list().catch(() => []),
    staleTime: 60_000,
  });

  // Detect @mention trigger on every keystroke
  const handleChange = (e) => {
    const val = e.target.value;
    setContent(val);
    const cursor = e.target.selectionStart;
    // find last @ before cursor
    const before = val.slice(0, cursor);
    const match = before.match(/@([\w ]*)$/);
    if (match) {
      setMentionQuery(match[1]);
      setMentionPos(before.lastIndexOf('@'));
    } else {
      setMentionQuery(null);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === 'Escape') setMentionQuery(null);
  };

  const filteredUsers = mentionQuery !== null
    ? users.filter(u =>
        u.id !== user?.id &&
        u.full_name?.toLowerCase().includes(mentionQuery.toLowerCase())
      ).slice(0, 6)
    : [];

  const insertMention = (u) => {
    const before = content.slice(0, mentionPos);
    const after = content.slice(mentionPos + 1 + (mentionQuery?.length || 0));
    const newContent = `${before}@${u.full_name} ${after}`;
    setContent(newContent);
    setMentionQuery(null);
    textareaRef.current?.focus();
  };

  const handleSubmit = async () => {
    if (!content.trim()) return;
    setSending(true);

    const trimmed = content.trim();
    const mentionedUsers = findMentionedUsers(trimmed, users, user?.email);

    try {
      await db.entities.InternalNote.create({
        complaint_id: complaintId,
        content: trimmed,
        author_email: user?.email,
        author_name: user?.full_name,
        department_id: getUserDepartmentIds(user)[0] || null,
      });

      await db.entities.TicketActivity.create({
        complaint_id: complaintId,
        action_type: 'note_added',
        description: `Note added by ${user?.full_name}${mentionedUsers.length ? ` (mentioned: ${mentionedUsers.map(u => u.full_name).join(', ')})` : ''}`,
        user_email: user?.email,
        user_name: user?.full_name,
      });

      await Promise.all(mentionedUsers.map(mu =>
        sendNotification({
          recipient_email: mu.email,
          title: 'You were mentioned in a note',
          message: `${user?.full_name} mentioned you on ticket. Note: "${trimmed.slice(0, 100)}${trimmed.length > 100 ? '…' : ''}"`,
          type: 'mention',
          complaint_id: complaintId,
        })
      ));

      queryClient.invalidateQueries({ queryKey: ['notes', complaintId] });
      queryClient.invalidateQueries({ queryKey: ['activities', complaintId] });
      invalidateNotificationQueries(queryClient);
      setContent('');
      toast.success(
        mentionedUsers.length
          ? `Note added · ${mentionedUsers.length} user(s) notified`
          : 'Note added',
      );
    } catch {
      toast.error('Failed to add note');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4">
      {canAddNotes && (
        <div className="relative">
          <div className="flex gap-3 items-start">
            <div className="flex-1 relative">
              <textarea
                ref={textareaRef}
                value={content}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                placeholder="Add an internal note… Use @ to mention a teammate"
                rows={3}
                className="w-full resize-none rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
              />
              <span className="absolute bottom-2 right-3 text-[10px] text-muted-foreground select-none">Ctrl+Enter to send</span>

              {mentionQuery !== null && filteredUsers.length > 0 && (
                <div className="absolute z-50 left-0 bottom-full mb-1 w-64 bg-popover border rounded-lg shadow-lg overflow-hidden">
                  {filteredUsers.map(u => (
                    <button
                      key={u.id}
                      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted text-left transition-colors"
                      onMouseDown={e => { e.preventDefault(); insertMention(u); }}
                    >
                      <Avatar className="w-6 h-6 shrink-0">
                        <AvatarFallback className="text-[9px] font-bold">{initials(u.full_name)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{u.full_name}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{u.email}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <Button onClick={handleSubmit} disabled={sending || !content.trim()} size="icon" className="shrink-0 mt-0.5">
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      )}

      {/* Notes list — chronological (oldest first, newest at bottom) */}
      <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
        {[...notes].reverse().map(note => (
          <div key={note.id} className="flex gap-3 p-3 rounded-lg bg-muted/50 border border-transparent hover:border-border transition-colors">
            <Avatar className="w-8 h-8 shrink-0 mt-0.5">
              <AvatarFallback className="text-[10px] font-bold">{initials(note.author_name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium">{note.author_name || 'Unknown'}</span>
                {note.department && (
                  <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded border">{note.department}</span>
                )}
                <span className="text-xs text-muted-foreground ml-auto">
                  {format(new Date(note.created_date), 'MMM dd, HH:mm')}
                </span>
              </div>
              <NoteContent content={note.content} />
            </div>
          </div>
        ))}
        {notes.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">
            {canAddNotes ? 'No notes yet. Be the first to add one!' : 'No notes yet.'}
          </p>
        )}
      </div>
    </div>
  );
}