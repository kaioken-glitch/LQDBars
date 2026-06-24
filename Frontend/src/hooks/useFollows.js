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

  const fetchSuggested = useCallback(async (limit = 12) => {
    if (!user) { setSuggested([]); return; }
    setLoadingSuggested(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url, bio')
        .neq('id', user.id)
        .limit(limit);
      if (error) throw error;
      setSuggested(data || []);
    } catch (e) {
      console.warn('[useFollows] fetchSuggested failed:', e.message);
      setSuggested([]);
    } finally {
      setLoadingSuggested(false);
    }
  }, [user?.id]);

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
    if (error) console.warn('[useFollows] follow failed:', error.message);
  }, [user]);

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
    if (error) console.warn('[useFollows] unfollow failed:', error.message);
  }, [user]);

  const toggleFollow = useCallback((targetId) => {
    if (isFollowing(targetId)) unfollow(targetId);
    else follow(targetId);
  }, [isFollowing, follow, unfollow]);

  // Follower / following counts for any profile (used on the detail page)
  const getCounts = useCallback(async (profileId) => {
    const [{ count: followers }, { count: following }] = await Promise.all([
      supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', profileId),
      supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', profileId),
    ]);
    return { followers: followers || 0, following: following || 0 };
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