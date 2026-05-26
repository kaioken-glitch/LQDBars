import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

export function useBehaviorTracker(currentSong, isPlaying) {
  const listenStartRef = useRef(null);
  const durationTrackedRef = useRef(0);

  useEffect(() => {
    // When a song starts or changes, reset tracker
    if (currentSong && isPlaying) {
      listenStartRef.current = Date.now();
      durationTrackedRef.current = 0;
    }

    // Clean up function logs behavior when song changes or unmounts
    return () => {
      if (listenStartRef.current && currentSong) {
        const timeSpent = Math.floor((Date.now() - listenStartRef.current) / 1000);
        durationTrackedRef.current += timeSpent;

        // Ensure track has physical length metadata
        const totalLength = currentSong.duration || 180; 
        const wasSkipped = durationTrackedRef.current < 30; // Skipped if under 30 seconds
        const completedTrack = durationTrackedRef.current >= totalLength;

        logBehavior(currentSong.id, durationTrackedRef.current, totalLength, wasSkipped, completedTrack);
      }
    };
  }, [currentSong?.id, isPlaying]);

  const logBehavior = async (trackId, duration, totalLength, skipped, completed) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from('user_listening_behavior').insert([{
      user_id: user.id,
      track_id: trackId,
      listen_duration_seconds: duration,
      total_track_length_seconds: totalLength,
      was_skipped: skipped,
      was_looped: completed // simplify logic for base clustering
    }]);
  };
}
