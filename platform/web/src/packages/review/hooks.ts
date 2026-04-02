"use client";

import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { approveDiff, rejectDiff } from '@/packages/git-client/api';
import type { InlineComment } from './types';
import { getComments, saveComments } from './store';

export function useReviewComments(key: string) {
  const [comments, setComments] = useState<InlineComment[]>(() => getComments(key));

  const addComment = useCallback(
    (comment: Omit<InlineComment, 'id' | 'timestamp'>) => {
      const newComment: InlineComment = {
        ...comment,
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        timestamp: new Date().toISOString(),
      };
      const updated = [...comments, newComment];
      setComments(updated);
      saveComments(key, updated);
      return newComment;
    },
    [comments, key]
  );

  const removeComment = useCallback(
    (id: string) => {
      const updated = comments.filter((c) => c.id !== id);
      setComments(updated);
      saveComments(key, updated);
    },
    [comments, key]
  );

  return { comments, addComment, removeComment };
}

export function useReviewActions(slug: string, position: number) {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState<'approve' | 'reject' | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleApprove = useCallback(async () => {
    setLoading('approve');
    try {
      await approveDiff(slug, position);
      setFeedback('Approved');
      queryClient.invalidateQueries({ queryKey: ['diffs'] });
    } catch {
      setFeedback('Failed');
    }
    setLoading(null);
    setTimeout(() => setFeedback(null), 2000);
  }, [slug, position, queryClient]);

  const handleReject = useCallback(
    async (comment?: string) => {
      setLoading('reject');
      try {
        await rejectDiff(slug, position, comment);
        setFeedback('Changes requested');
        queryClient.invalidateQueries({ queryKey: ['diffs'] });
      } catch {
        setFeedback('Failed');
      }
      setLoading(null);
      setTimeout(() => setFeedback(null), 2000);
    },
    [slug, position, queryClient]
  );

  return { loading, feedback, handleApprove, handleReject };
}
