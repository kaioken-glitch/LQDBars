// src/hooks/dmNavigationStore.js
//
// App.jsx's page switching is local `active` state, not React Router
// (Sidebar.jsx falls back to it when no Router is present). To let a
// "Message" button anywhere in the app (e.g. UserProfileCard) open the
// DM view without routing, this is a tiny module-singleton pub/sub store
// — same pattern as usePlaylists.js's _cache/listeners.
//
// Usage:
//   openDirectMessage(otherUserId)   // call from a "Message" button
//   useDMTarget()                     // App.jsx watches this to switch
//                                      // its `active` tab to 'Messages'
//   clearDMTarget()                   // DMPanel calls this once it has
//                                      // consumed the target, so simply
//                                      // revisiting the Messages tab
//                                      // later doesn't keep re-forcing
//                                      // the same conversation open

import { useState, useEffect } from 'react';

let _target = null;
const _listeners = new Set();

export function openDirectMessage(otherUserId) {
  _target = otherUserId || null;
  _listeners.forEach(fn => { try { fn(_target); } catch (_) { /* noop */ } });
}

export function clearDMTarget() {
  _target = null;
}

export function useDMTarget() {
  const [target, setTarget] = useState(_target);
  useEffect(() => {
    _listeners.add(setTarget);
    return () => { _listeners.delete(setTarget); };
  }, []);
  return target;
}