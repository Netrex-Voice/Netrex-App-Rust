// src/hooks/useWatchPartyVote.js
import { useCallback } from 'react';
import { useWatchPartyStore } from '@/src/store/watchPartyStore';
import { useAuthStore } from '@/src/store/authStore';
import { voteTrack } from '@/src/services/watchPartyService';
import { VOTE_UP, VOTE_DOWN, VOTE_NONE } from '@/src/constants/watchPartyConstants';

export function useWatchPartyVote(serverId, channelId) {
  const user = useAuthStore((s) => s.user);

  // Store'daki hesaplama metodlarını kullan
  const getScore  = useCallback((trackId) => {
    return useWatchPartyStore.getState().getTrackVoteScore(trackId);
  }, []);

  const getMyVote = useCallback((trackId) => {
    if (!user?.uid) return VOTE_NONE;
    return useWatchPartyStore.getState().getUserVote(trackId, user.uid);
  }, [user?.uid]);

  const toggleUpvote = useCallback(async (trackId) => {
    if (!user?.uid) return;
    const current = useWatchPartyStore.getState().getUserVote(trackId, user.uid);
    // Zaten upvote varsa kaldır, yoksa ekle
    const next = current === VOTE_UP ? VOTE_NONE : VOTE_UP;
    await voteTrack(serverId, channelId, trackId, user.uid, next);
  }, [user?.uid, serverId, channelId]);

  const toggleDownvote = useCallback(async (trackId) => {
    if (!user?.uid) return;
    const current = useWatchPartyStore.getState().getUserVote(trackId, user.uid);
    const next = current === VOTE_DOWN ? VOTE_NONE : VOTE_DOWN;
    await voteTrack(serverId, channelId, trackId, user.uid, next);
  }, [user?.uid, serverId, channelId]);

  return { getScore, getMyVote, toggleUpvote, toggleDownvote };
}