/**
 * useDaylistSchedule.js
 *
 * Manages time-of-day playlist scheduling for Daylist feature.
 * - Morning (5am-12pm): "Morning Mix"
 * - Noon (12pm-5pm): "Noon Peak"
 * - Evening (5pm-11pm): "Evening Vibes"
 * - Lay Hour: Volatile, appears once daily either morning (4-5am) or night (11pm-12am)
 *
 * Lay Hour selection is pseudo-random per day (same seed throughout the day).
 */

import { useState, useEffect, useCallback, useMemo } from 'react';

const CACHE_KEY = 'lb:daylist_schedule';
const LAY_HOUR_CACHE_KEY = 'lb:lay_hour_today';

// Generate deterministic daily seed from today's date
function getDailyLayHourChoice() {
  const today = new Date().toDateString(); // "Wed May 28 2026"
  const cached = localStorage.getItem(LAY_HOUR_CACHE_KEY);
  
  try {
    const { date, choice } = JSON.parse(cached || '{}');
    if (date === today) return choice; // Same day, return cached choice
  } catch {}
  
  // New day — pick random choice and cache it
  const choice = Math.random() > 0.5 ? 'morning' : 'night'; // 'morning' or 'night'
  localStorage.setItem(LAY_HOUR_CACHE_KEY, JSON.stringify({ date: today, choice }));
  return choice;
}

/* ═══════════════════════════════════════════════════════════════════════
   useDaylistSchedule — Get current time slot & all active playlists
═══════════════════════════════════════════════════════════════════════ */
export function useDaylistSchedule() {
  const [schedule, setSchedule] = useState(null);

  // Determine current time of day and active playlists
  const getSchedule = useCallback(() => {
    const now = new Date();
    const hours = now.getHours();
    const dayString = now.toDateString();

    // Determine primary time slot
    let primarySlot;
    if (hours >= 5 && hours < 12) {
      primarySlot = 'morning';
    } else if (hours >= 12 && hours < 17) {
      primarySlot = 'noon';
    } else if (hours >= 17 && hours < 23) {
      primarySlot = 'evening';
    } else {
      // 11pm-5am is "night" — lay hour can appear here
      primarySlot = 'night';
    }

    // Lay hour appears either 4-5am (morning slot) or 11pm-12am (night)
    const layHourChoice = getDailyLayHourChoice();
    const showLayHourNow =
      (layHourChoice === 'morning' && hours >= 4 && hours < 5) ||
      (layHourChoice === 'night' && (hours >= 23 || hours < 1));

    // Active playlists for display
    const activePlaylists = [];
    if (primarySlot === 'morning' || (layHourChoice === 'morning' && hours >= 4 && hours < 12)) {
      activePlaylists.push('morning');
    }
    if (primarySlot === 'noon') {
      activePlaylists.push('noon');
    }
    if (primarySlot === 'evening') {
      activePlaylists.push('evening');
    }
    if (showLayHourNow) {
      activePlaylists.push('lay_hour');
    }

    return {
      now,
      dayString,
      primarySlot, // 'morning' | 'noon' | 'evening' | 'night'
      activePlaylists, // Array of slot names to display
      layHourChoice, // 'morning' or 'night'
      showLayHourNow,
      hours,
    };
  }, []);

  useEffect(() => {
    setSchedule(getSchedule());
    // Update schedule every minute in case we cross time boundaries
    const interval = setInterval(() => setSchedule(getSchedule()), 60000);
    return () => clearInterval(interval);
  }, [getSchedule]);

  return schedule;
}

/* ═══════════════════════════════════════════════════════════════════════
   useDaylistPreferences — Store user mood preferences per time slot
═══════════════════════════════════════════════════════════════════════ */
export function useDaylistPreferences() {
  const [prefs, setPrefs] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('lb:daylist_prefs') || '{}');
    } catch {
      return {};
    }
  });

  const updatePreference = useCallback((slot, mood) => {
    setPrefs(prev => {
      const updated = { ...prev, [slot]: mood };
      localStorage.setItem('lb:daylist_prefs', JSON.stringify(updated));
      return updated;
    });
  }, []);

  const getPreference = useCallback((slot) => {
    return prefs[slot] || null;
  }, [prefs]);

  return { prefs, updatePreference, getPreference };
}

/* ═══════════════════════════════════════════════════════════════════════
   useDaylistCache — Cache generated playlists per day & slot
═══════════════════════════════════════════════════════════════════════ */
export function useDaylistCache() {
  const getCache = useCallback((slot) => {
    try {
      const today = new Date().toDateString();
      const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
      const slotCache = cache[slot] || {};
      
      if (slotCache.date === today && Array.isArray(slotCache.songs)) {
        return slotCache.songs;
      }
      return null;
    } catch {
      return null;
    }
  }, []);

  const setCache = useCallback((slot, songs) => {
    try {
      const today = new Date().toDateString();
      const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
      cache[slot] = { date: today, songs };
      localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    } catch {}
  }, []);

  const clearCache = useCallback((slot) => {
    try {
      const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
      delete cache[slot];
      localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    } catch {}
  }, []);

  return { getCache, setCache, clearCache };
}
