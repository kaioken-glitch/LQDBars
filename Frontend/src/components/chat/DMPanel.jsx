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

export default function DMPanel({ onThreadChange }) {
  const { user } = useAuth();
  const { conversations, getOrCreateConversation } = useConversations();
  const [activeId, setActiveId] = useState(null);
  const [activeOther, setActiveOther] = useState(null);
  const [mobileShowThread, setMobileShowThread] = useState(false);

  const {
    messages,
    loading: messagesLoading,
    sendMessage,
    markRead,
    sendTyping,
    otherTyping,
    editMessage,
    deleteForMe,
    deleteForEveryone,
  } = useMessages(activeId);

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

  const handleBack = useCallback(() => {
    setMobileShowThread(false);
    if (onThreadChange) onThreadChange(false);
  }, [onThreadChange]);

  useEffect(() => { if (activeId) markRead(); }, [activeId, markRead]);
  useEffect(() => {
    if (activeId && messages.length) markRead();
  }, [messages.length]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!onThreadChange) return;
    const isDesktop = window.innerWidth > 767;
    const isThreadVisible = isDesktop ? !!activeId : !!mobileShowThread;
    onThreadChange(isThreadVisible);
    return () => onThreadChange(false);
  }, [activeId, mobileShowThread, onThreadChange]);

  return (
    <div className="dm-panel">
      <style>{CSS}</style>
      <div className={`dm-panel-list-slot${mobileShowThread ? ' hide-mobile' : ''}`}>
        <ConversationList conversations={conversations} activeId={activeId} onSelect={handleSelect} />
      </div>

      <div className={`dm-panel-thread-slot${!mobileShowThread ? ' hide-mobile' : ''}`}>
        {activeId && activeOther ? (
          <>
            <ProfileBanner user={activeOther} onBack={handleBack} />
            <MessageThread
              messages={messages}
              currentUserId={user?.id}
              otherUser={activeOther}
              loading={messagesLoading}
              typing={otherTyping}
              onEdit={editMessage}
              onDeleteForMe={deleteForMe}
              onDeleteForEveryone={deleteForEveryone}
            />
            <Composer onSend={sendMessage} disabled={!activeId} sendTyping={sendTyping} />
          </>
        ) : (
          <div className="dm-panel-empty">
            <div className="dm-panel-empty-glow" />
            <div className="dm-panel-empty-orb dm-orb1" />
            <div className="dm-panel-empty-orb dm-orb2" />
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
.dm-panel-thread-slot {
  flex: 1; min-width: 0; display: flex; flex-direction: column; overflow: hidden; position: relative;
  padding-bottom: var(--lb-player-h, 88px);
}

.dm-panel-empty {
  flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 10px; text-align: center; position: relative; padding: 20px; overflow: hidden;
}
.dm-panel-empty-glow {
  position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%);
  width: 360px; height: 360px; border-radius: 50%;
  background: radial-gradient(circle, rgba(29,185,84,0.09) 0%, transparent 70%);
  pointer-events: none;
}
.dm-panel-empty-orb {
  position: absolute; border-radius: 50%; filter: blur(60px); opacity: 0.16; pointer-events: none;
  animation: dmOrbFloat 8s ease-in-out infinite;
}
.dm-orb1 { width: 260px; height: 260px; background: #1DB954; top: 10%; left: 12%; }
.dm-orb2 { width: 200px; height: 200px; background: #23E065; bottom: 12%; right: 15%; animation-delay: 3s; }
@keyframes dmOrbFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-24px)} }

.dm-panel-empty-icon {
  position: relative; width: 72px; height: 72px; border-radius: 50%;
  background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
  display: flex; align-items: center; justify-content: center;
  font-size: 28px; color: rgba(29,185,84,0.6); margin-bottom: 4px;
  box-shadow: 0 0 0 1px rgba(255,255,255,0.03) inset, 0 20px 50px rgba(0,0,0,0.4);
}
.dm-panel-empty h3 {
  position: relative; font-family: 'Syne', sans-serif; font-size: 22px; font-weight: 800;
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
  .dm-panel-thread-slot {
    padding-bottom: 0 !important;
  }
}
`;