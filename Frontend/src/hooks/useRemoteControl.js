/**
 * useRemoteControl.js
 *
 * Cross-device transport control ("Remote control" setting in Settings).
 *
 * Design:
 *   - Every signed-in device with the setting ON joins a Supabase Realtime
 *     channel scoped to the account: `remote:{userId}`.
 *   - Presence tracks each device's id/label/now-playing metadata — this
 *     is ephemeral (no DB writes), so it costs nothing and disappears
 *     automatically when a tab closes.
 *   - Broadcast is used for one-off transport COMMANDS targeted at a
 *     specific device id (play/pause/toggle/next/prev/seek/volume).
 *
 * Deliberately does NOT transfer the queue/song/position between devices —
 * that's a distinct, riskier feature (local-file blob URLs don't survive
 * a device hop, and YouTube seek-on-load has real latency). This hook only
 * nudges the *existing* player on the target device.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { getDeviceId, getDeviceLabel, getDeviceType, LABEL_EVENT } from '../utils/deviceId';

const SETTING_KEY   = 'lb:allowRemoteControl';
const SETTING_EVENT = 'lb:remoteControlChanged';

/** Call this instead of writing localStorage directly so the hook
 *  reacts immediately in the same tab (storage events only fire cross-tab). */
export function setRemoteControlSetting(value) {
  try { localStorage.setItem(SETTING_KEY, String(!!value)); } catch (_) {}
  window.dispatchEvent(new CustomEvent(SETTING_EVENT, { detail: !!value }));
}

export function useRemoteControl(userId, state, actions) {
  const [enabled, setEnabled] = useState(() => {
    try { return localStorage.getItem(SETTING_KEY) === 'true'; } catch { return false; }
  });
  const [devices, setDevices] = useState([]); // [{ id, label, song, isPlaying, isSelf }]

  const channelRef  = useRef(null);
  const deviceId     = useRef(getDeviceId()).current;
  const deviceType   = useRef(getDeviceType()).current;
  const [deviceLabel, setDeviceLabelState] = useState(() => getDeviceLabel());

  // Keep latest state/actions in refs so the channel callbacks (set up once)
  // always see current values without needing to resubscribe.
  const stateRef  = useRef(state);
  const actionsRef = useRef(actions);
  stateRef.current   = state;
  actionsRef.current = actions;

  /* React live to the Settings toggle, even from within the same tab */
  useEffect(() => {
    const onChange = (e) => setEnabled(!!e.detail);
    window.addEventListener(SETTING_EVENT, onChange);
    return () => window.removeEventListener(SETTING_EVENT, onChange);
  }, []);

  /* React live to a device rename — no need to leave/rejoin the channel,
     just re-track with the new label so other devices see it instantly. */
  useEffect(() => {
    const onRename = (e) => setDeviceLabelState(e.detail);
    window.addEventListener(LABEL_EVENT, onRename);
    return () => window.removeEventListener(LABEL_EVENT, onRename);
  }, []);

  const rebuildDeviceList = useCallback((ch) => {
    const presenceState = ch.presenceState();
    const list = Object.values(presenceState)
      .flat()
      .map(p => ({
        id:        p.id,
        label:     p.label,
        type:      p.type || 'desktop',
        song:      p.song || null,
        isPlaying: !!p.isPlaying,
        isSelf:    p.id === deviceId,
      }));
    setDevices(list);
  }, [deviceId]);

  const applyCommand = useCallback(({ action, value }) => {
    const a = actionsRef.current;
    switch (action) {
      case 'play':   a.setIsPlaying(true); break;
      case 'pause':  a.setIsPlaying(false); break;
      case 'toggle': a.setIsPlaying(p => !p); break;
      case 'next':   a.playNext(); break;
      case 'prev':   a.playPrev(); break;
      case 'seek':   a.seekTo(value); break;
      case 'volume': a.setVolume(value); break;
      default: break;
    }
  }, []);

  /* Join / leave the channel whenever the setting or user changes */
  useEffect(() => {
    if (!enabled || !userId) {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      setDevices([]);
      return;
    }

    const ch = supabase.channel(`remote:${userId}`, {
      config: { presence: { key: deviceId } },
    });

    ch.on('presence', { event: 'sync' },   () => rebuildDeviceList(ch));
    ch.on('presence', { event: 'join' },   () => rebuildDeviceList(ch));
    ch.on('presence', { event: 'leave' },  () => rebuildDeviceList(ch));

    ch.on('broadcast', { event: 'command' }, ({ payload }) => {
      if (!payload || payload.target !== deviceId) return;
      applyCommand(payload);
    });

    ch.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        const s = stateRef.current;
        await ch.track({
          id:        deviceId,
          label:     deviceLabel,
          type:      deviceType,
          song:      s.currentSong ? { name: s.currentSong.name, artist: s.currentSong.artist } : null,
          isPlaying: !!s.isPlaying,
        });
      }
    });

    channelRef.current = ch;

    return () => {
      supabase.removeChannel(ch);
      if (channelRef.current === ch) channelRef.current = null;
      setDevices([]);
    };
  }, [enabled, userId, deviceId, rebuildDeviceList, applyCommand]);

  /* Keep this device's presence metadata (now-playing info) fresh */
  useEffect(() => {
    const ch = channelRef.current;
    if (!ch) return;
    ch.track({
      id:        deviceId,
      label:     deviceLabel,
      type:      deviceType,
      song:      state.currentSong ? { name: state.currentSong.name, artist: state.currentSong.artist } : null,
      isPlaying: !!state.isPlaying,
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.currentSong?.id, state.isPlaying, enabled, deviceLabel]);

  const controlDevice = useCallback((targetId, action, value) => {
    const ch = channelRef.current;
    if (!ch) return;
    ch.send({
      type: 'broadcast',
      event: 'command',
      payload: { target: targetId, action, value, from: deviceId },
    });
  }, [deviceId]);

  return { enabled, devices, controlDevice, deviceId, deviceLabel };
}