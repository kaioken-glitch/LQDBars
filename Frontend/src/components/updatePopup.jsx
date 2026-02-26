import React, { useState, useEffect } from 'react';
import { FaTimes } from 'react-icons/fa';
import packageJson from '../../package.json';

const STORAGE_KEY = 'last_seen_version';

const UpdatePopup = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentVersion] = useState(packageJson.version);
  const [latestVersion, setLatestVersion] = useState(null);
  const [loading, setLoading] = useState(false);
  const [manualCheck, setManualCheck] = useState(false);

  const fetchLatestVersion = async () => {
    try {
      const response = await fetch('/version.json');
      const data = await response.json();
      return data.version;
    } catch (error) {
      console.warn('Update check failed:', error);
      return null;
    }
  };

  // Automatic check on mount
  useEffect(() => {
    const checkForUpdate = async () => {
      setLoading(true);
      const version = await fetchLatestVersion();
      if (version && version !== currentVersion) {
        const lastSeen = localStorage.getItem(STORAGE_KEY);
        if (version !== lastSeen) {
          setLatestVersion(version);
          setIsOpen(true);
        }
      }
      setLoading(false);
    };
    checkForUpdate();
  }, [currentVersion]);

  // Manual trigger from settings
  useEffect(() => {
    const handleManualCheck = async () => {
      setManualCheck(true);
      setLoading(true);
      setIsOpen(true); // Open modal immediately with loading message
      const version = await fetchLatestVersion();
      if (version && version !== currentVersion) {
        setLatestVersion(version);
      } else {
        // No update available: close after a short delay or show message
        setTimeout(() => {
          setIsOpen(false);
          setManualCheck(false);
        }, 1500);
      }
      setLoading(false);
    };
    window.addEventListener('open-update-popup', handleManualCheck);
    return () => window.removeEventListener('open-update-popup', handleManualCheck);
  }, [currentVersion]);

  const handleDismiss = () => {
    if (latestVersion && !manualCheck) {
      localStorage.setItem(STORAGE_KEY, latestVersion);
    }
    setIsOpen(false);
    setManualCheck(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={handleDismiss} />
      
      {/* Modal */}
      <div className="relative bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl 
        rounded-2xl shadow-2xl border border-white/20 p-6 max-w-md w-full">
        
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white text-2xl font-bold">
            {loading ? 'Checking for updates...' : '✨ New Update Available'}
          </h2>
          <button
            onClick={handleDismiss}
            className="text-white/60 hover:text-white transition-colors"
          >
            <FaTimes className="text-xl" />
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-8">
            <div className="w-10 h-10 border-4 border-white/20 border-t-emerald-500 rounded-full animate-spin" />
          </div>
        ) : latestVersion ? (
          <>
            <div className="text-white/80 text-sm mb-6 space-y-2">
              <p>
                Version <span className="font-semibold text-emerald-400">{latestVersion}</span> is now available.
              </p>
              <p>
                We've added new features and improvements. Refresh the page to get the latest experience.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => window.location.reload()}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600
                  hover:from-emerald-400 hover:to-emerald-500 text-white rounded-xl font-semibold
                  transition-all shadow-lg"
              >
                Refresh Now
              </button>
              <button
                onClick={handleDismiss}
                className="flex-1 px-4 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl
                  font-semibold transition-all border border-white/20"
              >
                Later
              </button>
            </div>
          </>
        ) : (
          <div className="text-white/80 text-sm text-center py-4">
            You're already using the latest version.
          </div>
        )}
      </div>
    </div>
  );
};

export default UpdatePopup;