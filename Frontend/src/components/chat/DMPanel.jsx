// src/components/chat/DMPanel.jsx
//
// Full DM page — wire this into App.jsx's page switch as the 'Messages'
// tab. Handles: picking up a target conversation opened elsewhere in the
// app (via dmNavigationStore), listing conversations, and rendering the
// active thread with the Discord-style banner up top.

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { useConversations } from '../../hooks/useConversations';
import { useMessages } from '../../hooks/useMessages';
import { useDMTarget, clearDMTarget } from '../../hooks/dmNavigationStore';
import ConversationList from './ConversationList';
import ProfileBanner from './ProfileBanner';
import MessageThread from './MessageThread';
import Composer from './Composer';

export default function DMPanel() {
  const { user } = useAuth();
  const { conversations, getOrCreateConversation } = useConversations();
  const [activeId, setActiveId] = useState(null);
  const [activeOther, setActiveOther] = useState(null); // { id, name, avatar }
  const [mobileShowThread, setMobileShowThread] = useState(false);

  const { messages, loading: messagesLoading, sendMessage, markRead } = useMessages(activeId);

  // Pick up a "open DM with this user" request from anywhere in the app
  // (e.g. UserProfileCard's Message button) exactly once.
  const dmTarget = useDMTarget();
  useEffect(() => {
    if (!dmTarget) return;
    let cancelled = false;
    (async () => {
      const convId = await getOrCreateConversation(dmTarget);
      if (cancelled || !convId) return;
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, display_name, username, avatar_url')
        .eq('id', dmTarget)
        .maybeSingle();
      setActiveId(convId);
      setActiveOther({
        id: dmTarget,
        name: profile?.display_name || profile?.username || 'Unknown',
        avatar: profile?.avatar_url || '',
      });
      setMobileShowThread(true);
      clearDMTarget();
    })();
    return () => { cancelled = true; };
  }, [dmTarget, getOrCreateConversation]);

  // Selecting from the list — resolve the other participant's profile too.
  const handleSelect = useCallback(async (conv) => {
    setActiveId(conv.id);
    setMobileShowThread(true);
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, display_name, username, avatar_url')
      .eq('id', conv.otherId)
      .maybeSingle();
    setActiveOther({
      id: conv.otherId,
      name: profile?.display_name || profile?.username || 'Unknown',
      avatar: profile?.avatar_url || '',
    });
  }, []);

  useEffect(() => { if (activeId) markRead(); }, [activeId, markRead]);
  useEffect(() => {
    // New inbound message while the thread is already open -> mark it read too.
    if (activeId && messages.length) markRead();
  }, [messages.length]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="dm-panel">
      <style>{CSS}</style>
      <div className={`dm-panel-list-slot${mobileShowThread ? ' hide-mobile' : ''}`}>
        <ConversationList conversations={conversations} activeId={activeId} onSelect={handleSelect} />
      </div>

      <div className={`dm-panel-thread-slot${!mobileShowThread ? ' hide-mobile' : ''}`}>
        {activeId && activeOther ? (
          <>
            <ProfileBanner user={activeOther} onBack={() => setMobileShowThread(false)} />
            <MessageThread messages={messages} currentUserId={user?.id} loading={messagesLoading} />
            <Composer onSend={sendMessage} disabled={!activeId} />
          </>
        ) : (
          <div className="dm-panel-empty">
            <div className="dm-panel-empty-icon">💬</div>
            <p>Select a conversation to start messaging</p>
          </div>
        )}
      </div>
    </div>
  );
}

const CSS = `
.dm-panel {
  width: 100%; height: 100%; display: flex; overflow: hidden;
  background: var(--lb-bg-base, #07080A);
}
.dm-panel-list-slot { display: flex; flex-shrink: 0; }
.dm-panel-thread-slot { flex: 1; min-width: 0; display: flex; flex-direction: column; overflow: hidden; }
.dm-panel-empty {
  flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 10px; color: var(--lb-text-3, rgba(255,255,255,0.28)); font-size: 13px; text-align: center;
}
.dm-panel-empty-icon { font-size: 30px; opacity: 0.5; }

@media (max-width: 767px) {
  .dm-panel-list-slot.hide-mobile,
  .dm-panel-thread-slot.hide-mobile { display: none; }
  .dm-panel-list-slot { width: 100%; }
}
`;