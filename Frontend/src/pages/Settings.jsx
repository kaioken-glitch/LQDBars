import React, { useEffect, useState } from 'react';
import { FaUser, FaCamera, FaEnvelope, FaPhone, FaMapMarkerAlt, FaSave, FaHeart, FaDownload, FaWifi, FaSlidersH, FaBell, FaMoon, FaChartLine, FaNetworkWired, FaTrash, FaClipboard, FaFileImport, FaRedoAlt } from 'react-icons/fa';
import { VERSION, BUILD_DATE } from '../version'; // create this file

// Minimal toggle switch
const Toggle = ({ checked, onChange, title }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    title={title}
    onClick={() => onChange(!checked)}
    className={`w-12 h-6 rounded-full p-0.5 flex items-center transition-all duration-200 
    ${checked ? 'bg-gradient-to-r from-emerald-500 to-emerald-600' : 'bg-white/20'}`}
  >
    <div className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform duration-200 
    ${checked ? 'translate-x-6' : 'translate-x-0'}`} />
  </button>
);

export default function Settings() {
  const [activeTab, setActiveTab] = useState('profile');

  // Profile state
  const [profileName, setProfileName] = useState(() => localStorage.getItem('lb:profileName') || 'Music Lover');
  const [profileEmail, setProfileEmail] = useState(() => localStorage.getItem('lb:profileEmail') || '');
  const [profilePhone, setProfilePhone] = useState(() => localStorage.getItem('lb:profilePhone') || '');
  const [profileLocation, setProfileLocation] = useState(() => localStorage.getItem('lb:profileLocation') || '');
  const [profileBio, setProfileBio] = useState(() => localStorage.getItem('lb:profileBio') || '');
  const [profileAvatar, setProfileAvatar] = useState(() => localStorage.getItem('lb:profileAvatar') || '');

  // Preferences state
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('lb:darkMode') === 'true');
  const [notifications, setNotifications] = useState(() => localStorage.getItem('lb:notifications') === 'true');
  const [notificationVolume, setNotificationVolume] = useState(() => Number(localStorage.getItem('lb:notificationVolume') || 80));
  const [autoDownload, setAutoDownload] = useState(() => localStorage.getItem('lb:autoDownload') === 'true');
  const [downloadQuality, setDownloadQuality] = useState(() => localStorage.getItem('lb:downloadQuality') || 'high');
  const [onlyWifi, setOnlyWifi] = useState(() => localStorage.getItem('lb:onlyWifi') === 'true');
  const [crossfade, setCrossfade] = useState(() => Number(localStorage.getItem('lb:crossfade') || 0));
  const [gapless, setGapless] = useState(() => localStorage.getItem('lb:gapless') === 'true');
  const [equalizer, setEqualizer] = useState(() => localStorage.getItem('lb:equalizer') === 'true');
  const [eqPreset, setEqPreset] = useState(() => localStorage.getItem('lb:eqPreset') || 'flat');
  const [maxConcurrentDownloads, setMaxConcurrentDownloads] = useState(() => Number(localStorage.getItem('lb:maxConcurrentDownloads') || 3));
  const [privacyAnalytics, setPrivacyAnalytics] = useState(() => localStorage.getItem('lb:privacyAnalytics') === 'true');
  const [allowRemoteControl, setAllowRemoteControl] = useState(() => localStorage.getItem('lb:allowRemoteControl') === 'true');

  // Storage state
  const [maxCacheMB, setMaxCacheMB] = useState(() => Number(localStorage.getItem('lb:maxCacheMB') || 200));
  const [cacheSize, setCacheSize] = useState('12.4 MB');
  const [isOnline, setIsOnline] = useState(() => (typeof navigator !== 'undefined' ? navigator.onLine : true));

  // Save profile
  const saveProfile = () => {
    localStorage.setItem('lb:profileName', profileName);
    localStorage.setItem('lb:profileEmail', profileEmail);
    localStorage.setItem('lb:profilePhone', profilePhone);
    localStorage.setItem('lb:profileLocation', profileLocation);
    localStorage.setItem('lb:profileBio', profileBio);
    localStorage.setItem('lb:profileAvatar', profileAvatar);
    alert('Profile saved successfully!');
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => setProfileAvatar(event.target?.result);
      reader.readAsDataURL(file);
    }
  };

  // Persist preferences
  useEffect(() => localStorage.setItem('lb:darkMode', darkMode), [darkMode]);
  useEffect(() => localStorage.setItem('lb:notifications', notifications), [notifications]);
  useEffect(() => localStorage.setItem('lb:autoDownload', autoDownload), [autoDownload]);
  useEffect(() => localStorage.setItem('lb:onlyWifi', onlyWifi), [onlyWifi]);
  useEffect(() => localStorage.setItem('lb:crossfade', String(crossfade)), [crossfade]);
  useEffect(() => localStorage.setItem('lb:gapless', gapless), [gapless]);
  useEffect(() => localStorage.setItem('lb:equalizer', equalizer), [equalizer]);
  useEffect(() => localStorage.setItem('lb:eqPreset', eqPreset), [eqPreset]);
  useEffect(() => localStorage.setItem('lb:maxConcurrentDownloads', String(maxConcurrentDownloads)), [maxConcurrentDownloads]);
  useEffect(() => localStorage.setItem('lb:notificationVolume', String(notificationVolume)), [notificationVolume]);
  useEffect(() => localStorage.setItem('lb:privacyAnalytics', privacyAnalytics), [privacyAnalytics]);
  useEffect(() => localStorage.setItem('lb:allowRemoteControl', allowRemoteControl), [allowRemoteControl]);
  useEffect(() => localStorage.setItem('lb:maxCacheMB', String(maxCacheMB)), [maxCacheMB]);
  useEffect(() => localStorage.setItem('lb:downloadQuality', downloadQuality), [downloadQuality]);

  // Network status
  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  // Dark mode effect
  useEffect(() => {
    try {
      if (darkMode) document.documentElement.classList.add('dark');
      else document.documentElement.classList.remove('dark');
    } catch (e) {}
  }, [darkMode]);

  // Cache clear
  const clearCache = () => {
    setCacheSize('0 MB');
    try {
      localStorage.removeItem('downloadedSongs');
      localStorage.removeItem('lb:recentlyPlayed');
    } catch (e) {}
  };

  // Export/Import
  const exportSettingsToClipboard = () => {
    const keys = [
      'lb:darkMode','lb:notifications','lb:autoDownload','lb:downloadQuality','lb:onlyWifi',
      'lb:crossfade','lb:gapless','lb:maxCacheMB','lb:equalizer','lb:maxConcurrentDownloads',
      'lb:notificationVolume','lb:privacyAnalytics','lb:allowRemoteControl','lb:eqPreset'
    ];
    const data = {};
    keys.forEach(k => { try { data[k] = localStorage.getItem(k); } catch (e) {} });
    try { navigator.clipboard.writeText(JSON.stringify(data)); alert('Settings copied to clipboard'); } 
    catch (e) { alert('Copy failed'); }
  };

  const importSettingsFromPrompt = () => {
    const raw = prompt('Paste settings JSON');
    if (!raw) return;
    try {
      const obj = JSON.parse(raw);
      Object.keys(obj).forEach(k => { localStorage.setItem(k, obj[k]); });
      alert('Imported settings. Reload may be required.');
    } catch (e) { alert('Invalid JSON'); }
  };

  const resetDefaults = () => {
    setDarkMode(false);
    setNotifications(true);
    setAutoDownload(false);
    setDownloadQuality('high');
    setOnlyWifi(true);
    setCrossfade(0);
    setGapless(false);
    setMaxCacheMB(200);
    setEqualizer(false);
    setMaxConcurrentDownloads(3);
    setNotificationVolume(80);
    setPrivacyAnalytics(false);
    setAllowRemoteControl(false);
    setEqPreset('flat');
    const keys = [
      'lb:darkMode','lb:notifications','lb:autoDownload','lb:downloadQuality','lb:onlyWifi',
      'lb:crossfade','lb:gapless','lb:maxCacheMB','lb:equalizer','lb:maxConcurrentDownloads',
      'lb:notificationVolume','lb:privacyAnalytics','lb:allowRemoteControl','lb:eqPreset'
    ];
    keys.forEach(k => localStorage.removeItem(k));
  };

  return (
    <div className="w-full h-full flex flex-col overflow-hidden">
      {/* Subtle header gradient */}
      <div className="absolute top-0 left-0 right-0 h-48 bg-gradient-to-b from-emerald-500/10 to-transparent pointer-events-none" />

      {/* Main content area */}
      <div className="flex-1 overflow-y-auto px-4 md:px-8 lg:px-12 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Title and version */}
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-white text-3xl md:text-4xl font-bold tracking-tight">Settings</h1>
            <div 
              onClick={() => window.dispatchEvent(new CustomEvent('open-update-popup'))}
              className="flex items-center gap-2 px-3 py-1.5 bg-white/10 backdrop-blur-sm rounded-full border border-white/20 cursor-pointer hover:bg-white/20 transition"
            >
              <span className="text-white/70 text-xs font-medium">v{VERSION}</span>
              <span className="text-white/40 text-xs">•</span>
              <span className="text-white/50 text-xs">{BUILD_DATE}</span>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex items-center justify-center gap-2 mb-10">
            {['profile', 'preferences', 'storage'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-6 py-2.5 rounded-full text-sm font-medium capitalize transition-all ${
                  activeTab === tab
                    ? 'bg-white text-black shadow-lg'
                    : 'text-white/70 hover:text-white hover:bg-white/10'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {activeTab === 'profile' && (
            <div className="space-y-6">
              {/* Profile card */}
              <div className="bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 p-8 shadow-xl">
                <div className="flex flex-col md:flex-row items-center gap-8">
                  {/* Avatar */}
                  <div className="relative group">
                    <div className="w-28 h-28 rounded-full bg-gradient-to-br from-emerald-500/30 to-teal-600/30 
                    border-4 border-white/20 shadow-2xl overflow-hidden">
                      {profileAvatar ? (
                        <img src={profileAvatar} alt="Profile" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <FaUser className="text-white/60 text-3xl" />
                        </div>
                      )}
                    </div>
                    <label className="absolute bottom-0 right-0 w-9 h-9 rounded-full bg-gradient-to-r 
                    from-emerald-500 to-emerald-600 flex items-center justify-center cursor-pointer 
                    shadow-lg hover:scale-110 transition-transform">
                      <FaCamera className="text-white text-xs" />
                      <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                    </label>
                  </div>

                  {/* Info */}
                  <div className="flex-1 text-center md:text-left">
                    <h2 className="text-white text-2xl font-bold mb-1">{profileName}</h2>
                    <p className="text-white/60 text-sm mb-3">{profileEmail || 'No email set'}</p>
                    <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                      <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 text-xs rounded-full border border-emerald-500/30">
                        Premium
                      </span>
                      <span className="px-3 py-1 bg-white/10 text-white/70 text-xs rounded-full border border-white/20">
                        Member since 2024
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={saveProfile}
                    className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 
                    hover:from-emerald-400 hover:to-emerald-500 text-white font-medium rounded-xl 
                    shadow-lg hover:shadow-emerald-500/50 transition-all transform hover:scale-105 
                    flex items-center gap-2"
                  >
                    <FaSave />
                    Save
                  </button>
                </div>
              </div>

              {/* Personal info card */}
              <div className="bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 p-8 shadow-xl">
                <h3 className="text-white text-xl font-bold mb-6 flex items-center gap-2">
                  <span className="w-1 h-6 bg-emerald-500 rounded-full" />
                  Personal Information
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-white/70 text-sm font-medium mb-2">
                      <FaUser className="inline mr-2" /> Display Name
                    </label>
                    <input
                      type="text"
                      value={profileName}
                      onChange={e => setProfileName(e.target.value)}
                      className="w-full px-4 py-3 bg-white/10 border border-white/20 text-white rounded-xl 
                      outline-none focus:bg-white/15 focus:border-emerald-400/50 transition-all"
                      placeholder="Enter your name"
                    />
                  </div>
                  <div>
                    <label className="block text-white/70 text-sm font-medium mb-2">
                      <FaEnvelope className="inline mr-2" /> Email
                    </label>
                    <input
                      type="email"
                      value={profileEmail}
                      onChange={e => setProfileEmail(e.target.value)}
                      className="w-full px-4 py-3 bg-white/10 border border-white/20 text-white rounded-xl 
                      outline-none focus:bg-white/15 focus:border-emerald-400/50 transition-all"
                      placeholder="Enter your email"
                    />
                  </div>
                  <div>
                    <label className="block text-white/70 text-sm font-medium mb-2">
                      <FaPhone className="inline mr-2" /> Phone
                    </label>
                    <input
                      type="tel"
                      value={profilePhone}
                      onChange={e => setProfilePhone(e.target.value)}
                      className="w-full px-4 py-3 bg-white/10 border border-white/20 text-white rounded-xl 
                      outline-none focus:bg-white/15 focus:border-emerald-400/50 transition-all"
                      placeholder="Enter your phone"
                    />
                  </div>
                  <div>
                    <label className="block text-white/70 text-sm font-medium mb-2">
                      <FaMapMarkerAlt className="inline mr-2" /> Location
                    </label>
                    <input
                      type="text"
                      value={profileLocation}
                      onChange={e => setProfileLocation(e.target.value)}
                      className="w-full px-4 py-3 bg-white/10 border border-white/20 text-white rounded-xl 
                      outline-none focus:bg-white/15 focus:border-emerald-400/50 transition-all"
                      placeholder="Enter your location"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-white/70 text-sm font-medium mb-2">Bio</label>
                    <textarea
                      value={profileBio}
                      onChange={e => setProfileBio(e.target.value)}
                      rows={3}
                      className="w-full px-4 py-3 bg-white/10 border border-white/20 text-white rounded-xl 
                      outline-none focus:bg-white/15 focus:border-emerald-400/50 transition-all resize-none"
                      placeholder="Tell us about yourself..."
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'preferences' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Playback */}
              <div className="bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 p-6 shadow-xl">
                <h3 className="text-white text-lg font-bold mb-4 flex items-center gap-2">
                  <FaSlidersH className="text-emerald-400" /> Playback
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-white text-sm">Crossfade</div>
                      <div className="text-white/40 text-xs">{crossfade}s</div>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="12"
                      value={crossfade}
                      onChange={e => setCrossfade(Number(e.target.value))}
                      className="w-24 accent-emerald-500"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-white text-sm">Gapless Playback</span>
                    <Toggle checked={gapless} onChange={setGapless} title="Gapless" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-white text-sm">Equalizer</span>
                    <Toggle checked={equalizer} onChange={setEqualizer} title="Equalizer" />
                  </div>
                  {equalizer && (
                    <div className="flex items-center justify-between">
                      <span className="text-white text-sm">EQ Preset</span>
                      <select
                        value={eqPreset}
                        onChange={e => setEqPreset(e.target.value)}
                        className="bg-white/10 border border-white/20 text-white px-3 py-1 rounded-lg text-sm"
                      >
                        <option value="flat">Flat</option>
                        <option value="bass">Bass Boost</option>
                        <option value="vocal">Vocal</option>
                        <option value="treble">Treble</option>
                      </select>
                    </div>
                  )}
                </div>
              </div>

              {/* Downloads */}
              <div className="bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 p-6 shadow-xl">
                <h3 className="text-white text-lg font-bold mb-4 flex items-center gap-2">
                  <FaDownload className="text-emerald-400" /> Downloads
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-white text-sm">Auto-download</span>
                    <Toggle checked={autoDownload} onChange={setAutoDownload} title="Auto-download" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-white text-sm">Only on Wi‑Fi</span>
                    <Toggle checked={onlyWifi} onChange={setOnlyWifi} title="Wi-Fi Only" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-white text-sm">Quality</span>
                    <select
                      value={downloadQuality}
                      onChange={e => setDownloadQuality(e.target.value)}
                      className="bg-white/10 border border-white/20 text-white px-3 py-1 rounded-lg text-sm"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-white text-sm">Max Concurrent</span>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={maxConcurrentDownloads}
                      onChange={e => setMaxConcurrentDownloads(Number(e.target.value))}
                      className="w-16 px-2 py-1 rounded-lg bg-white/10 border border-white/20 text-white text-center"
                    />
                  </div>
                </div>
              </div>

              {/* General */}
              <div className="bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 p-6 shadow-xl">
                <h3 className="text-white text-lg font-bold mb-4 flex items-center gap-2">
                  <FaMoon className="text-emerald-400" /> General
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-white text-sm">Dark Mode</span>
                    <Toggle checked={darkMode} onChange={setDarkMode} title="Dark Mode" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-white text-sm">Notifications</span>
                    <Toggle checked={notifications} onChange={setNotifications} title="Notifications" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-white text-sm">Notification Volume</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={notificationVolume}
                        onChange={e => setNotificationVolume(Number(e.target.value))}
                        className="w-20 accent-emerald-500"
                      />
                      <span className="text-white/60 text-xs w-8">{notificationVolume}%</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Privacy */}
              <div className="bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 p-6 shadow-xl">
                <h3 className="text-white text-lg font-bold mb-4 flex items-center gap-2">
                  <FaChartLine className="text-emerald-400" /> Privacy
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-white text-sm">Analytics</span>
                    <Toggle checked={privacyAnalytics} onChange={setPrivacyAnalytics} title="Analytics" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-white text-sm">Remote Control</span>
                    <Toggle checked={allowRemoteControl} onChange={setAllowRemoteControl} title="Remote Control" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'storage' && (
            <div className="space-y-6">
              {/* Storage Management */}
              <div className="bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 p-8 shadow-xl">
                <h3 className="text-white text-xl font-bold mb-6 flex items-center gap-2">
                  <span className="w-1 h-6 bg-emerald-500 rounded-full" />
                  Storage
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10">
                    <div>
                      <div className="text-white text-sm font-medium">Cache Size</div>
                      <div className="text-white/40 text-xs">Temporary files</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-white/60 text-sm font-mono">{cacheSize}</span>
                      <button
                        onClick={clearCache}
                        className="px-3 py-1.5 bg-gradient-to-r from-red-500 to-red-600 
                        hover:from-red-400 hover:to-red-500 rounded-lg text-xs font-medium text-white"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10">
                    <div>
                      <div className="text-white text-sm font-medium">Max Cache</div>
                      <div className="text-white/40 text-xs">Storage limit (MB)</div>
                    </div>
                    <input
                      type="number"
                      min="50"
                      max="5000"
                      value={maxCacheMB}
                      onChange={e => setMaxCacheMB(Number(e.target.value))}
                      className="w-20 px-2 py-1 rounded-lg bg-white/10 border border-white/20 text-white text-center"
                    />
                  </div>
                  <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10">
                    <div>
                      <div className="text-white text-sm font-medium">Connection</div>
                      <div className="text-white/40 text-xs">Network status</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${isOnline ? 'bg-emerald-400' : 'bg-red-400'}`} />
                      <span className="text-white/60 text-sm">{isOnline ? 'Online' : 'Offline'}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10">
                    <div>
                      <div className="text-white text-sm font-medium">App Version</div>
                      <div className="text-white/40 text-xs">Current release</div>
                    </div>
                    <span className="text-white/60 text-sm font-mono">{VERSION}</span>
                  </div>
                </div>
              </div>

              {/* Advanced */}
              <div className="bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 p-8 shadow-xl">
                <h3 className="text-white text-xl font-bold mb-6 flex items-center gap-2">
                  <span className="w-1 h-6 bg-emerald-500 rounded-full" />
                  Advanced
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <button
                    onClick={exportSettingsToClipboard}
                    className="px-4 py-3 bg-white/10 hover:bg-white/20 border border-white/20 
                    rounded-xl text-white text-sm font-medium transition-all flex items-center justify-center gap-2"
                  >
                    <FaClipboard /> Export
                  </button>
                  <button
                    onClick={importSettingsFromPrompt}
                    className="px-4 py-3 bg-white/10 hover:bg-white/20 border border-white/20 
                    rounded-xl text-white text-sm font-medium transition-all flex items-center justify-center gap-2"
                  >
                    <FaFileImport /> Import
                  </button>
                  <button
                    onClick={resetDefaults}
                    className="px-4 py-3 bg-gradient-to-r from-red-500 to-red-600 
                    hover:from-red-400 hover:to-red-500 rounded-xl text-white text-sm font-medium 
                    transition-all flex items-center justify-center gap-2"
                  >
                    <FaRedoAlt /> Reset
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}