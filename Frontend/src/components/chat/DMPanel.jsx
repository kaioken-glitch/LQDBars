// src/components/chat/DMPanel.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { FaComments } from 'react-icons/fa';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { useConversations } from '../../hooks/useConversations';
import { useMessages } from '../../hooks/useMessages';
import { useDMTarget, clearDMTarget } from '../../hooks/dmNavigationStore';
import ConversationList from './ConversationList';
import ProfileBanner from './Profilebanner';
import MessageThread from './MessageThread';
import Composer from './Composer';

export default function DMPanel() {
  const { user } = useAuth();
  const { conversations, getOrCreateConversation } = useConversations();
  const [activeId, setActiveId] = useState(null);
  const [activeOther, setActiveOther] = useState(null);
  const [mobileShowThread, setMobileShowThread] = useState(false);

  const { messages, loading: messagesLoading, sendMessage, markRead } = useMessages(activeId);

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
            <div className="dm-panel-empty-glow" />
            <div className="dm-panel-empty-icon"><FaComments /></div>
            <h3>Your Messages</h3>
            <p>Select a conversation on the left, or start a new one from someone's profile.</p>
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
  font-family: 'DM Sans', sans-serif;
}
.dm-panel-list-slot { display: flex; flex-shrink: 0; }
.dm-panel-thread-slot { flex: 1; min-width: 0; display: flex; flex-direction: column; overflow: hidden; position: relative; }

.dm-panel-empty {
  flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 10px; text-align: center; position: relative; padding: 20px;
}
.dm-panel-empty-glow {
  position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%);
  width: 340px; height: 340px; border-radius: 50%;
  background: radial-gradient(circle, rgba(29,185,84,0.08) 0%, transparent 70%);
  pointer-events: none;
}
.dm-panel-empty-icon {
  position: relative; width: 68px; height: 68px; border-radius: 50%;
  background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
  display: flex; align-items: center; justify-content: center;
  font-size: 26px; color: rgba(29,185,84,0.55); margin-bottom: 4px;
}
.dm-panel-empty h3 {
  position: relative; font-family: 'Syne', sans-serif; font-size: 20px; font-weight: 800;
  color: #fff; letter-spacing: -0.02em;
}
.dm-panel-empty p {
  position: relative; font-size: 13px; color: rgba(255,255,255,0.35);
  max-width: 280px; line-height: 1.6;
}

@media (max-width: 767px) {
  .dm-panel-list-slot.hide-mobile,
  .dm-panel-thread-slot.hide-mobile { display: none; }
  .dm-panel-list-slot { width: 100%; }
}
`;