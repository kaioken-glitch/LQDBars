import React, { useState, useEffect, useRef } from 'react';
import '../index.css';
import Splashlogo from '../assets/logo.svg';

// Create audio context outside component to ensure single instance
let audioContextInstance = null;
let hasPlayedGlobally = false;

export function SplashScreen({ onComplete }) {
  const [phase, setPhase] = useState('zoom');
  const isMountedRef = useRef(false);

  useEffect(() => {
    // Prevent double execution in Strict Mode

    // Play chime only once globally
    playWebAudioChime();

    // Phase 1: Zoom in and hold (1.8s)
    const zoomTimer = setTimeout(() => {
      setPhase('hold');
    }, 1800);

    // Phase 2: Hold for brief moment (0.5s)
    const holdTimer = setTimeout(() => {
      setPhase('fadeOut');
    }, 2300);

    // Phase 3: Fade out and complete (0.7s)
    const completeTimer = setTimeout(() => {
      if (onComplete) onComplete();
    }, 3000);

    return () => {
      clearTimeout(zoomTimer);
      clearTimeout(holdTimer);
      clearTimeout(completeTimer);
    };
  }, []); // Empty dependency array - only run once

  // Web Audio API - Generates chime sound programmatically
  const playWebAudioChime = () => {
    try {
      // Reuse existing audio context or create new one
      if (!audioContextInstance) {
        audioContextInstance = new (window.AudioContext || window.webkitAudioContext)();
      }

      const audioContext = audioContextInstance;
      
      // Helper function to play a note
      const playNote = (frequency, startTime, duration, volume = 0.3) => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        // Connect nodes: Oscillator -> Gain -> Output
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        // Set frequency (musical note)
        oscillator.frequency.value = frequency;
        
        // Use sine wave for smooth, pleasant tone
        oscillator.type = 'sine';
        
        // Create envelope (fade in/out)
        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(volume, startTime + 0.05);
        gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
        
        // Start and stop
        oscillator.start(startTime);
        oscillator.stop(startTime + duration);
      };

      const now = audioContext.currentTime;
      
      // Play a pleasant C major chord (like a bell chime)
      // Notes: C5, E5, G5 (creates harmony)
      playNote(523.25, now, 0.8, 0.3);        // C5 - Root note
      playNote(659.25, now + 0.05, 0.7, 0.25); // E5 - Third
      playNote(783.99, now + 0.1, 0.6, 0.2);   // G5 - Fifth

    } catch (error) {
      console.log('Web Audio API not supported:', error);
    }
  };

  return (
    <div className={`splash-screen splash-${phase}`}>
      <div className="splash-content">
        {/* Your App Logo */}
        <div className="splash-logo">
          <img 
            src={Splashlogo} 
            alt="Liquid Bars Logo" 
            className="logo-svg"
            style={{ width: '160px', height: '160px' }}
          />
        </div>

        {/* App Name */}
        <h1 className="splash-app-name">Liquid Bars</h1>
      </div>

      {/* Subtle background gradient animation */}
      <div className="splash-bg-gradient"></div>
    </div>
  );
}

export default SplashScreen;
export { SplashScreen as VinylLoaderCSS };