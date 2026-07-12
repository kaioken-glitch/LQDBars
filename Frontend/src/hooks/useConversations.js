// src/hooks/useConversations.js
//
// Lists the current user's 1:1 conversations (ordered by most recent
// activity), with unread counts, kept live via Supabase Realtime.
// Also exposes getOrCreateConversation(otherUserId) — the canonical
// user_a < user_b ordering means there's exactly one conversation row
// per pair, so this never creates duplicates.

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export function useConversations() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) { setConversations([]); setLoading(false); return; }
    setLoading(true);

    const { data, error } = await supabase
      .from('conversations')
      .select(`
        id, user_a, user_b, last_message_at, created_at,
        messages ( id, body, sender_id, created_at, read_at )
      `)
      .or(`user_a.eq.${user.id},user_b.eq.${user.id}`);

    if (error) {
      console.warn('[useConversations] load failed', error.message);
      setLoading(false);
      return;
    }

    const mapped = (data || []).map(c => {
      const otherId = c.user_a === user.id ? c.user_b : c.user_a;
      const msgs = [...(c.messages || [])].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      const lastMessage = msgs[msgs.length - 1] || null;
      const unreadCount = msgs.filter(m => m.sender_id !== user.id && !m.read_at).length;
      return {
        id: c.id,
        otherId,
        lastMessage,
        unreadCount,
        lastMessageAt: c.last_message_at || c.created_at,
      };
    });

    mapped.sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt));
    setConversations(mapped);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  // Any message insert/update anywhere the current user participates in
  // should refresh the list (new conversation, new message, read state).
  // Filtering by conversation_id isn't possible here (we don't know the
  // set up front), so this listens broadly and reloads — cheap relative
  // to how infrequently it fires for a single user's DM activity.
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`dm-list:${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, load)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, load)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'conversations' }, load)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, load]);

  const getOrCreateConversation = useCallback(async (otherUserId) => {
    if (!user || !otherUserId || otherUserId === user.id) return null;
    const [a, b] = [user.id, otherUserId].sort();

    const { data: existing } = await supabase
      .from('conversations')
      .select('id')
      .eq('user_a', a)
      .eq('user_b', b)
      .maybeSingle();
    if (existing) return existing.id;

    const { data: created, error } = await supabase
      .from('conversations')
      .insert({ user_a: a, user_b: b })
      .select('id')
      .single();

    if (error) {
      // Unique-violation race (both users opened the DM at once) — the
      // row exists now, just fetch it instead of treating this as fatal.
      if (error.code === '23505') {
        const { data: raced } = await supabase
          .from('conversations').select('id').eq('user_a', a).eq('user_b', b).maybeSingle();
        return raced?.id || null;
      }
      console.warn('[useConversations] create failed', error.message);
      return null;
    }
    return created.id;
  }, [user]);

  return { conversations, loading, refresh: load, getOrCreateConversation };
}