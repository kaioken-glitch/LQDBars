import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

const LS_KEY = 'lb:follows';

function loadLocal() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); }
  catch { return {}; }
}
function saveLocal(ids) {
  try { localStorage.setItem(LS_KEY, JSON.stringify({ followingIds: ids })); }
  catch (_) {}
}

export function useFollows() {
  const { user } = useAuth();
  const [followingIds, setFollowingIds] = useState(
    () => new Set(loadLocal().followingIds || [])
  );
  const [suggested, setSuggested] = useState([]);
  const [loadingSuggested, setLoadingSuggested] = useState(false);

  // Load this user's real follow list from Supabase (overrides local cache once it lands)
  useEffect(() => {
    if (!user) return;
    supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', user.id)
      .then(({ data, error }) => {
        if (error || !data) return;
        const ids = data.map(r => r.following_id);
        setFollowingIds(new Set(ids));
        saveLocal(ids);
      });
  }, [user?.id]);

  const ensureMutualConversation = useCallback(async (targetId) => {
    if (!user || !targetId || targetId === user.id) return;

    const { data: reverseFollow, error: reverseError } = await supabase
      .from('follows')
      .select('follower_id')
      .eq('follower_id', targetId)
      .eq('following_id', user.id)
      .maybeSingle();

    if (reverseError) {
      console.warn('[useFollows] mutual conversation check failed:', reverseError.message);
      return;
    }

    if (!reverseFollow) return;

    const [a, b] = [user.id, targetId].sort();
    const { error: conversationError } = await supabase
      .from('conversations')
      .insert({ user_a: a, user_b: b });

    if (conversationError && conversationError.code !== '23505') {
      console.warn('[useFollows] mutual conversation create failed:', conversationError.message);
    }
  }, [user?.id]);

  const fetchSuggested = useCallback(async () => {
    if (!user) {
      setSuggested([]);
      return;
    }

    setLoadingSuggested(true);
    try {
      const [{ data: followingRows, error: followingError }, { data: followerRows, error: followerError }] = await Promise.all([
        supabase.from('follows').select('following_id').eq('follower_id', user.id),
        supabase.from('follows').select('follower_id').eq('following_id', user.id),
      ]);

      if (followingError) throw followingError;
      if (followerError) throw followerError;

      const followingIdsSet = new Set((followingRows || []).map(r => r.following_id));
      const followerIdsSet = new Set((followerRows || []).map(r => r.follower_id));
      const mutualIdsSet = new Set([...followingIdsSet].filter(id => followerIdsSet.has(id)));

      await Promise.allSettled([...mutualIdsSet].map(id => ensureMutualConversation(id)));

      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url')
        .neq('id', user.id)
        .order('display_name', { ascending: true });

      if (error) throw error;

      const filtered = (data || []).filter(person => !mutualIdsSet.has(person.id));
      setSuggested(filtered);
    } catch (e) {
      console.warn('[useFollows] fetchSuggested failed:', e.message);
      setSuggested([]);
    } finally {
      setLoadingSuggested(false);
    }
  }, [user?.id, ensureMutualConversation]);

  useEffect(() => { fetchSuggested(); }, [fetchSuggested]);

  const isFollowing = useCallback((id) => followingIds.has(id), [followingIds]);

  const follow = useCallback(async (targetId) => {
    if (!user || !targetId || targetId === user.id) return;
    setFollowingIds(prev => {
      const next = new Set(prev);
      next.add(targetId);
      saveLocal([...next]);
      return next;
    });
    const { error } = await supabase
      .from('follows')
      .insert({ follower_id: user.id, following_id: targetId });
    if (error) {
      console.warn('[useFollows] follow failed:', error.message);
      return;
    }
    await ensureMutualConversation(targetId);
    await fetchSuggested();
  }, [user, ensureMutualConversation, fetchSuggested]);

  const unfollow = useCallback(async (targetId) => {
    if (!user || !targetId) return;
    setFollowingIds(prev => {
      const next = new Set(prev);
      next.delete(targetId);
      saveLocal([...next]);
      return next;
    });
    const { error } = await supabase
      .from('follows')
      .delete()
      .eq('follower_id', user.id)
      .eq('following_id', targetId);
    if (error) {
      console.warn('[useFollows] unfollow failed:', error.message);
      return;
    }
    await fetchSuggested();
  }, [user, fetchSuggested]);

  const toggleFollow = useCallback((targetId) => {
    if (isFollowing(targetId)) unfollow(targetId);
    else follow(targetId);
  }, [isFollowing, follow, unfollow]);

  // Follower / following counts for any profile, based on mutual follow relationships
  const getCounts = useCallback(async (profileId) => {
    if (!profileId) return { followers: 0, following: 0 };

    const [{ data: followingRows, error: followingError }, { data: followerRows, error: followerError }] = await Promise.all([
      supabase.from('follows').select('following_id').eq('follower_id', profileId),
      supabase.from('follows').select('follower_id').eq('following_id', profileId),
    ]);

    if (followingError || followerError) return { followers: 0, following: 0 };

    const followingIds = new Set((followingRows || []).map(r => r.following_id));
    const followerIds = new Set((followerRows || []).map(r => r.follower_id));
    const mutualIds = [...followerIds].filter(id => followingIds.has(id));

    return {
      followers: mutualIds.length,
      following: mutualIds.length,
    };
  }, []);

  return {
    suggested,
    loadingSuggested,
    isFollowing,
    follow,
    unfollow,
    toggleFollow,
    getCounts,
    refreshSuggested: fetchSuggested,
  };
}