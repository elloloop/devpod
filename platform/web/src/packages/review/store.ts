import type { InlineComment } from './types';

export function getComments(key: string): InlineComment[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(`diff-comments-${key}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveComments(key: string, comments: InlineComment[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(`diff-comments-${key}`, JSON.stringify(comments));
}

export function addComment(
  key: string,
  comment: Omit<InlineComment, 'id' | 'timestamp'>
): InlineComment {
  const newComment: InlineComment = {
    ...comment,
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    timestamp: new Date().toISOString(),
  };
  const existing = getComments(key);
  saveComments(key, [...existing, newComment]);
  return newComment;
}

export function removeComment(key: string, commentId: string): void {
  const existing = getComments(key);
  saveComments(
    key,
    existing.filter((c) => c.id !== commentId)
  );
}
