import React, { useState, useEffect } from 'react';
import { FaTimes } from 'react-icons/fa';

// This could be imported from package.json or a separate version file
import packageJson from '../../package.json';

const STORAGE_KEY = 'last_seen_version';

const UpdatePopup = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentVersion] = useState(packageJson.version);
  const [latestVersion, setLatestVersion] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for new version on mount
    const checkForUpdate = async () => {
      try {
        // Fetch version from server (could be a simple endpoint returning { version: 'x.y.z' })
        const response = await fetch('/version.json'); // You'll need to serve a version.json file
        const data = await response.json();
        setLatestVersion(data.version);

        const lastSeen = localStorage.getItem(STORAGE_KEY);
        if (data.version !== currentVersion && data.version !== lastSeen) {
          setIsOpen(true);
        }
      } catch (error) {
        console.warn('Update check failed:', error);
      } finally {
        setLoading(false);
      }
    };

    checkForUpdate();
  }, [currentVersion]);

  const handleDismiss = () => {
    // Store the latest version as seen, so it won't show again until next update
    if (latestVersion) {
      localStorage.setItem(STORAGE_KEY, latestVersion);
    }
    setIsOpen(false);
  };

  if (!isOpen || loading) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={handleDismiss} />
      
      {/* Modal */}
      <div className="relative bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl 
        rounded-2xl shadow-2xl border border-white/20 p-6 max-w-md w-full">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white text-2xl font-bold">✨ New Update Available</h2>
          <button
            onClick={handleDismiss}
            className="text-white/60 hover:text-white transition-colors"
          >
            <FaTimes className="text-xl" />
          </button>
        </div>

        {/* Content */}
        <div className="text-white/80 text-sm mb-6 space-y-2">
          <p>
            Version <span className="font-semibold text-emerald-400">{latestVersion}</span> is now available.
          </p>
          <p>
            We've added new features and improvements. Refresh the page to get the latest experience.
          </p>
        </div>

        {/* Actions */}
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

        {/* Optional: release notes link */}
        <p className="text-white/40 text-xs text-center mt-4">
          <a href="/changelog" className="underline hover:text-white/60">See what's new</a>
        </p>
      </div>
    </div>
  );
};

export default UpdatePopup;