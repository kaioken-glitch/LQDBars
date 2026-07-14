// src/hooks/useMessages.js
//
// Live message list for a single conversation. Subscribes to Postgres
// changes scoped to that conversation_id, so this is cheap to mount
// per-thread without the broad-reload pattern useConversations.js uses
// for the list view.
//
// Typing indicator: broadcast (not a DB write) over the same
// `dm-thread:${conversationId}` channel already used for message
// inserts/updates. `sendTyping(bool)` is what YOU call as you type;
// `otherTyping` is what the OTHER participant is doing — that's the
// value the UI should render.

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export function useMessages(conversationId) {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [otherTyping, setOtherTyping] = useState(false);

  const channelRef = useRef(null);
  const typingClearRef = useRef(null);

  useEffect(() => {
    if (!conversationId || !user) { setMessages([]); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    setOtherTyping(false);

    (async () => {
      const [{ data: rows, error: rowsErr }, { data: hidden, error: hiddenErr }] = await Promise.all([
        supabase
          .from('messages')
          .select('*')
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: true }),
        supabase
          .from('message_hidden_for')
          .select('message_id')
          .eq('user_id', user.id),
      ]);
      if (cancelled) return;
      if (rowsErr) console.warn('[useMessages] load failed', rowsErr.message);
      if (hiddenErr) console.warn('[useMessages] hidden load failed', hiddenErr.message);

      const hiddenSet = new Set((hidden || []).map(h => h.message_id));
      setMessages((rows || []).filter(m => !hiddenSet.has(m.id)));
      setLoading(false);
    })();

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
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if (!payload || payload.userId === user.id) return; // ignore our own echo
        setOtherTyping(!!payload.typing);
        clearTimeout(typingClearRef.current);
        if (payload.typing) {
          // safety net in case a "stopped typing" broadcast gets dropped
          typingClearRef.current = setTimeout(() => setOtherTyping(false), 3000);
        }
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      cancelled = true;
      clearTimeout(typingClearRef.current);
      channelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [conversationId, user]);

  const sendTyping = useCallback((isTyping) => {
    const channel = channelRef.current;
    if (!channel || !user) return;
    channel.send({ type: 'broadcast', event: 'typing', payload: { userId: user.id, typing: isTyping } });
  }, [user]);

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

  const editMessage = useCallback(async (messageId, newBody) => {
    const text = newBody.trim();
    if (!text || !user) return { error: new Error('Nothing to save') };
    const edited_at = new Date().toISOString();
    setMessages(prev => prev.map(m => (m.id === messageId ? { ...m, body: text, edited_at } : m)));
    const { error } = await supabase
      .from('messages')
      .update({ body: text, edited_at })
      .eq('id', messageId)
      .eq('sender_id', user.id);
    if (error) console.warn('[useMessages] edit failed', error.message);
    return { error };
  }, [user]);

  const deleteForEveryone = useCallback(async (messageId) => {
    if (!user) return { error: new Error('Not signed in') };
    const deleted_at = new Date().toISOString();
    setMessages(prev => prev.map(m => (m.id === messageId ? { ...m, deleted_at, body: '' } : m)));
    const { error } = await supabase
      .from('messages')
      .update({ deleted_at, body: '' })
      .eq('id', messageId)
      .eq('sender_id', user.id);
    if (error) console.warn('[useMessages] deleteForEveryone failed', error.message);
    return { error };
  }, [user]);

  const deleteForMe = useCallback(async (messageId) => {
    if (!user) return { error: new Error('Not signed in') };
    setMessages(prev => prev.filter(m => m.id !== messageId));
    const { error } = await supabase
      .from('message_hidden_for')
      .upsert({ message_id: messageId, user_id: user.id }, { onConflict: 'message_id,user_id' });
    if (error) console.warn('[useMessages] deleteForMe failed', error.message);
    return { error };
  }, [user]);

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

  return {
    messages, loading, sendMessage, markRead,
    otherTyping, sendTyping,
    editMessage, deleteForMe, deleteForEveryone,
  };
}