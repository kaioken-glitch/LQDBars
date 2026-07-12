// src/hooks/useMessages.js
//
// Live message list for a single conversation. Subscribes to Postgres
// changes scoped to that conversation_id, so this is cheap to mount
// per-thread without the broad-reload pattern useConversations.js uses
// for the list view.

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export function useMessages(conversationId) {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!conversationId) { setMessages([]); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);

    supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) console.warn('[useMessages] load failed', error.message);
        setMessages(data || []);
        setLoading(false);
      });

    const channel = supabase
      .channel(`dm-thread:${conversationId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
        payload => setMessages(prev => (prev.some(m => m.id === payload.new.id) ? prev : [...prev, payload.new]))
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
        payload => setMessages(prev => prev.map(m => (m.id === payload.new.id ? payload.new : m)))
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  const sendMessage = useCallback(async (body) => {
    const text = body.trim();
    if (!text || !conversationId || !user) return { error: new Error('Nothing to send') };
    const { error } = await supabase.from('messages').insert({
      conversation_id: conversationId,
      sender_id: user.id,
      body: text,
    });
    if (error) console.warn('[useMessages] send failed', error.message);
    return { error };
  }, [conversationId, user]);

  // Marks every message NOT sent by the current user as read. Call this
  // when the thread is open/visible — the ProfileBanner/DMPanel wiring
  // below calls it on mount and whenever a new inbound message arrives.
  const markRead = useCallback(async () => {
    if (!conversationId || !user) return;
    await supabase
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .eq('conversation_id', conversationId)
      .neq('sender_id', user.id)
      .is('read_at', null);
  }, [conversationId, user]);

  return { messages, loading, sendMessage, markRead };
}