import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

function initialsFrom(name, email) {
  const source = (name || '').trim() || (email || '').trim();
  if (!source) return '??';
  if (source.includes('@')) {
    return source.slice(0, 2).toUpperCase();
  }
  return source
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Shared user avatar: image from `avatar_url` with initials fallback.
 * @param {object} props
 * @param {object} [props.user] - user-like object (`full_name`, `email`, `avatar_url`)
 * @param {string} [props.avatarUrl] - override image URL
 * @param {string} [props.name] - override display name for initials
 * @param {string} [props.email] - override email for initials
 * @param {string} [props.className] - Avatar root classes
 * @param {string} [props.fallbackClassName] - AvatarFallback classes
 * @param {string} [props.imageClassName] - AvatarImage classes
 */
export default function UserAvatar({
  user,
  avatarUrl,
  name,
  email,
  className,
  fallbackClassName,
  imageClassName,
}) {
  const src = avatarUrl ?? user?.avatar_url ?? user?.author_avatar_url ?? null;
  const displayName = name ?? user?.full_name ?? user?.name ?? user?.author_name;
  const displayEmail = email ?? user?.email ?? user?.author_email;
  const initials = initialsFrom(displayName, displayEmail);

  return (
    <Avatar className={cn(className)}>
      {src ? <AvatarImage src={src} alt={displayName || 'User'} className={imageClassName} /> : null}
      <AvatarFallback className={cn(fallbackClassName)}>{initials}</AvatarFallback>
    </Avatar>
  );
}
