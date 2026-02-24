import React, { useEffect, useState } from 'react';
import { FaUser, FaCamera, FaEnvelope, FaPhone, FaMapMarkerAlt, FaSave } from 'react-icons/fa';

export default function Settings() {
  const Toggle = ({ checked, onChange, title }) => (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      title={title}
      onClick={() => onChange(!checked)}
      className={`w-12 h-6 rounded-full p-0.5 flex items-center transition-all duration-200 
      ${checked ? 'bg-gradient-to-r from-emerald-500 to-emerald-600' : 'bg-white/10'}`}
    >
      <div className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform duration-200 
      ${checked ? 'translate-x-6' : 'translate-x-0'}`} />
    </button>
  );

  const [profileName, setProfileName] = useState(() => localStorage.getItem('lb:profileName') || 'Music Lover');
  const [profileEmail, setProfileEmail] = useState(() => localStorage.getItem('lb:profileEmail') || '');
  const [profilePhone, setProfilePhone] = useState(() => localStorage.getItem('lb:profilePhone') || '');
  const [profileLocation, setProfileLocation] = useState(() => localStorage.getItem('lb:profileLocation') || '');
  const [profileBio, setProfileBio] = useState(() => localStorage.getItem('lb:profileBio') || '');
  const [profileAvatar, setProfileAvatar] = useState(() => localStorage.getItem('lb:profileAvatar') || '');
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('lb:darkMode') === 'true');
  const [notifications, setNotifications] = useState(() => localStorage.getItem('lb:notifications') === 'true');
  const [autoDownload, setAutoDownload] = useState(() => localStorage.getItem('lb:autoDownload') === 'true');
  const [downloadQuality, setDownloadQuality] = useState(() => localStorage.getItem('lb:downloadQuality') || 'high');
  const [onlyWifi, setOnlyWifi] = useState(() => localStorage.getItem('lb:onlyWifi') === 'true');
  const [crossfade, setCrossfade] = useState(() => Number(localStorage.getItem('lb:crossfade') || 0));
  const [gapless, setGapless] = useState(() => localStorage.getItem('lb:gapless') === 'true');
  const [maxCacheMB, setMaxCacheMB] = useState(() => Number(localStorage.getItem('lb:maxCacheMB') || 200));
  const [equalizer, setEqualizer] = useState(() => localStorage.getItem('lb:equalizer') === 'true');
  const [cacheSize, setCacheSize] = useState('12.4 MB');
  const [isOnline, setIsOnline] = useState(() => (typeof navigator !== 'undefined' ? navigator.onLine : true));
  const [maxConcurrentDownloads, setMaxConcurrentDownloads] = useState(() => Number(localStorage.getItem('lb:maxConcurrentDownloads') || 3));
  const [notificationVolume, setNotificationVolume] = useState(() => Number(localStorage.getItem('lb:notificationVolume') || 80));
  const [privacyAnalytics, setPrivacyAnalytics] = useState(() => localStorage.getItem('lb:privacyAnalytics') === 'true');
  const [allowRemoteControl, setAllowRemoteControl] = useState(() => localStorage.getItem('lb:allowRemoteControl') === 'true');
  const [eqPreset, setEqPreset] = useState(() => localStorage.getItem('lb:eqPreset') || 'flat');
  const [activeTab, setActiveTab] = useState('profile');

  function saveProfile() {
    localStorage.setItem('lb:profileName', profileName);
    localStorage.setItem('lb:profileEmail', profileEmail);
    localStorage.setItem('lb:profilePhone', profilePhone);
    localStorage.setItem('lb:profileLocation', profileLocation);
    localStorage.setItem('lb:profileBio', profileBio);
    localStorage.setItem('lb:profileAvatar', profileAvatar);
    alert('Profile saved successfully!');
  }

  function handleAvatarChange(e) {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => setProfileAvatar(event.target?.result);
      reader.readAsDataURL(file);
    }
  }

  useEffect(() => { localStorage.setItem('lb:darkMode', darkMode); }, [darkMode]);
  useEffect(() => { localStorage.setItem('lb:notifications', notifications); }, [notifications]);
  useEffect(() => { localStorage.setItem('lb:autoDownload', autoDownload); }, [autoDownload]);
  useEffect(() => { localStorage.setItem('lb:onlyWifi', onlyWifi); }, [onlyWifi]);
  useEffect(() => { localStorage.setItem('lb:crossfade', String(crossfade)); }, [crossfade]);
  useEffect(() => { localStorage.setItem('lb:gapless', gapless); }, [gapless]);
  useEffect(() => { localStorage.setItem('lb:maxCacheMB', String(maxCacheMB)); }, [maxCacheMB]);
  useEffect(() => { localStorage.setItem('lb:equalizer', equalizer); }, [equalizer]);
  useEffect(() => { localStorage.setItem('lb:maxConcurrentDownloads', String(maxConcurrentDownloads)); }, [maxConcurrentDownloads]);
  useEffect(() => { localStorage.setItem('lb:notificationVolume', String(notificationVolume)); }, [notificationVolume]);
  useEffect(() => { localStorage.setItem('lb:privacyAnalytics', privacyAnalytics); }, [privacyAnalytics]);
  useEffect(() => { localStorage.setItem('lb:allowRemoteControl', allowRemoteControl); }, [allowRemoteControl]);
  useEffect(() => { localStorage.setItem('lb:eqPreset', eqPreset); }, [eqPreset]);
  useEffect(() => { localStorage.setItem('lb:downloadQuality', downloadQuality); }, [downloadQuality]);

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

  function clearCache() {
    setCacheSize('0 MB');
    try {
      localStorage.removeItem('downloadedSongs');
      localStorage.removeItem('lb:recentlyPlayed');
    } catch (e) {}
  }

  function resetDefaults() {
    setDarkMode(false);
    setNotifications(true);
    setAutoDownload(false);
    setDownloadQuality('high');
    setOnlyWifi(true);
    setCrossfade(0);
    setGapless(false);
    setMaxCacheMB(200);
    setEqualizer(false);
    const keys = ['lb:darkMode','lb:notifications','lb:autoDownload','lb:downloadQuality','lb:onlyWifi','lb:crossfade','lb:gapless','lb:maxCacheMB','lb:equalizer','lb:maxConcurrentDownloads','lb:notificationVolume','lb:privacyAnalytics','lb:allowRemoteControl','lb:eqPreset'];
    keys.forEach(k => localStorage.removeItem(k));
  }

  useEffect(() => {
    try {
      if (darkMode) document.documentElement.classList.add('dark'); 
      else document.documentElement.classList.remove('dark');
    } catch (e) {}
  }, [darkMode]);

  function exportSettingsToClipboard() {
    const keys = ['lb:darkMode','lb:notifications','lb:autoDownload','lb:downloadQuality','lb:onlyWifi','lb:crossfade','lb:gapless','lb:maxCacheMB','lb:equalizer','lb:maxConcurrentDownloads','lb:notificationVolume','lb:privacyAnalytics','lb:allowRemoteControl','lb:eqPreset'];
    const data = {};
    keys.forEach(k => { try { data[k] = localStorage.getItem(k); } catch (e) {} });
    try { navigator.clipboard.writeText(JSON.stringify(data)); alert('Settings copied to clipboard'); } catch (e) { alert('Copy failed'); }
  }

  function importSettingsFromPrompt() {
    const raw = prompt('Paste settings JSON');
    if (!raw) return;
    try {
      const obj = JSON.parse(raw);
      Object.keys(obj).forEach(k => { localStorage.setItem(k, obj[k]); });
      alert('Imported settings. Reload may be required.');
    } catch (e) { alert('Invalid JSON'); }
  }

  return (
    <div className="w-full h-full flex items-start justify-center overflow-auto pb-20">
      <div className="w-full max-w-6xl mx-auto mt-6 px-4">
        <div className="mb-8">
          <h1 className="text-white text-4xl md:text-5xl font-bold tracking-tight mb-2">Settings</h1>
          <p className="text-white/60 text-sm md:text-base">Manage your account and preferences</p>
        </div>

        <div className="flex items-center gap-2 mb-8 bg-white/10 backdrop-blur-xl rounded-full p-1.5 
        border border-white/20 shadow-lg w-fit">
          <button
            className={`px-6 py-2.5 rounded-full text-sm font-medium transition-all ${
              activeTab === 'profile' 
                ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg' 
                : 'text-white/70 hover:text-white hover:bg-white/10'
            }`}
            onClick={() => setActiveTab('profile')}
          >
            Profile
          </button>
          <button
            className={`px-6 py-2.5 rounded-full text-sm font-medium transition-all ${
              activeTab === 'preferences' 
                ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg' 
                : 'text-white/70 hover:text-white hover:bg-white/10'
            }`}
            onClick={() => setActiveTab('preferences')}
          >
            Preferences
          </button>
          <button
            className={`px-6 py-2.5 rounded-full text-sm font-medium transition-all ${
              activeTab === 'storage' 
                ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg' 
                : 'text-white/70 hover:text-white hover:bg-white/10'
            }`}
            onClick={() => setActiveTab('storage')}
          >
            Storage
          </button>
        </div>

        {activeTab === 'profile' && (
          <div className="grid grid-cols-1 gap-6">
            <div className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl rounded-2xl 
            border border-white/10 p-8 shadow-xl">
              <div className="flex flex-col md:flex-row items-center gap-6">
                <div className="relative group">
                  <div className="w-32 h-32 rounded-full bg-gradient-to-br from-emerald-500/40 to-teal-600/40 
                  border-4 border-white/20 shadow-2xl overflow-hidden">
                    {profileAvatar ? (
                      <img src={profileAvatar} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <FaUser className="text-white/60 text-4xl" />
                      </div>
                    )}
                  </div>
                  <label className="absolute bottom-0 right-0 w-10 h-10 rounded-full bg-gradient-to-r 
                  from-emerald-500 to-emerald-600 flex items-center justify-center cursor-pointer 
                  shadow-lg hover:scale-110 transition-transform">
                    <FaCamera className="text-white text-sm" />
                    <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                  </label>
                </div>

                <div className="flex-1 text-center md:text-left">
                  <h2 className="text-white text-2xl font-bold mb-1">{profileName}</h2>
                  <p className="text-white/60 text-sm mb-4">{profileEmail || 'No email set'}</p>
                  <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                    <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 text-xs rounded-full 
                    border border-emerald-500/30">Premium User</span>
                    <span className="px-3 py-1 bg-white/10 text-white/70 text-xs rounded-full 
                    border border-white/20">Member since 2024</span>
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
                  Save Profile
                </button>
              </div>
            </div>

            <div className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl rounded-2xl 
            border border-white/10 p-8 shadow-xl">
              <h3 className="text-white text-xl font-bold mb-6 flex items-center gap-2">
                <span className="w-1 h-6 bg-emerald-500 rounded-full"></span>
                Personal Information
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-white/80 text-sm font-medium mb-2">
                    <FaUser className="inline mr-2" />
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={profileName}
                    onChange={e => setProfileName(e.target.value)}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 text-white rounded-xl 
                    outline-none focus:bg-white/15 focus:border-emerald-400/50 transition-all 
                    placeholder:text-white/40"
                    placeholder="Enter your name"
                  />
                </div>

                <div>
                  <label className="block text-white/80 text-sm font-medium mb-2">
                    <FaEnvelope className="inline mr-2" />
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={profileEmail}
                    onChange={e => setProfileEmail(e.target.value)}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 text-white rounded-xl 
                    outline-none focus:bg-white/15 focus:border-emerald-400/50 transition-all 
                    placeholder:text-white/40"
                    placeholder="Enter your email"
                  />
                </div>

                <div>
                  <label className="block text-white/80 text-sm font-medium mb-2">
                    <FaPhone className="inline mr-2" />
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={profilePhone}
                    onChange={e => setProfilePhone(e.target.value)}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 text-white rounded-xl 
                    outline-none focus:bg-white/15 focus:border-emerald-400/50 transition-all 
                    placeholder:text-white/40"
                    placeholder="Enter your phone"
                  />
                </div>

                <div>
                  <label className="block text-white/80 text-sm font-medium mb-2">
                    <FaMapMarkerAlt className="inline mr-2" />
                    Location
                  </label>
                  <input
                    type="text"
                    value={profileLocation}
                    onChange={e => setProfileLocation(e.target.value)}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 text-white rounded-xl 
                    outline-none focus:bg-white/15 focus:border-emerald-400/50 transition-all 
                    placeholder:text-white/40"
                    placeholder="Enter your location"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-white/80 text-sm font-medium mb-2">Bio</label>
                  <textarea
                    value={profileBio}
                    onChange={e => setProfileBio(e.target.value)}
                    rows={4}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 text-white rounded-xl 
                    outline-none focus:bg-white/15 focus:border-emerald-400/50 transition-all 
                    placeholder:text-white/40 resize-none"
                    placeholder="Tell us about yourself..."
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'preferences' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl rounded-2xl 
            border border-white/10 p-8 shadow-xl">
              <h3 className="text-white text-xl font-bold mb-6 flex items-center gap-2">
                <span className="w-1 h-6 bg-emerald-500 rounded-full"></span>
                Playback
              </h3>
              <div className="flex flex-col gap-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-white font-medium">Crossfade</div>
                    <div className="text-white/60 text-xs">Blend between tracks ({crossfade}s)</div>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="12" 
                    value={crossfade} 
                    onChange={e => setCrossfade(Number(e.target.value))} 
                    className="w-32 accent-emerald-500" 
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-white font-medium">Gapless Playback</div>
                    <div className="text-white/60 text-xs">Remove gaps between tracks</div>
                  </div>
                  <Toggle checked={gapless} onChange={setGapless} title="Gapless" />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-white font-medium">Equalizer</div>
                    <div className="text-white/60 text-xs">Enable audio enhancements</div>
                  </div>
                  <Toggle checked={equalizer} onChange={setEqualizer} title="Equalizer" />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-white font-medium">EQ Preset</div>
                    <div className="text-white/60 text-xs">Choose sound profile</div>
                  </div>
                  <select 
                    value={eqPreset} 
                    onChange={e => setEqPreset(e.target.value)} 
                    className="bg-white/10 border border-white/20 text-white px-4 py-2 rounded-lg 
                    outline-none focus:border-emerald-400/50 cursor-pointer"
                  >
                    <option value="flat">Flat</option>
                    <option value="bass">Bass Boost</option>
                    <option value="vocal">Vocal</option>
                    <option value="treble">Treble</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl rounded-2xl 
            border border-white/10 p-8 shadow-xl">
              <h3 className="text-white text-xl font-bold mb-6 flex items-center gap-2">
                <span className="w-1 h-6 bg-emerald-500 rounded-full"></span>
                Downloads
              </h3>
              <div className="flex flex-col gap-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-white font-medium">Auto-download</div>
                    <div className="text-white/60 text-xs">Download liked songs automatically</div>
                  </div>
                  <Toggle checked={autoDownload} onChange={setAutoDownload} title="Auto-download" />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-white font-medium">Only on Wi‑Fi</div>
                    <div className="text-white/60 text-xs">Limit downloads to Wi‑Fi only</div>
                  </div>
                  <Toggle checked={onlyWifi} onChange={setOnlyWifi} title="Wi-Fi Only" />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-white font-medium">Download Quality</div>
                    <div className="text-white/60 text-xs">Audio bitrate for downloads</div>
                  </div>
                  <select
                    value={downloadQuality}
                    onChange={e => setDownloadQuality(e.target.value)}
                    className="bg-white/10 border border-white/20 text-white px-4 py-2 rounded-lg 
                    outline-none focus:border-emerald-400/50 cursor-pointer"
                  >
                    <option value="low">Low (64kbps)</option>
                    <option value="medium">Medium (128kbps)</option>
                    <option value="high">High (320kbps)</option>
                  </select>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-white font-medium">Max Concurrent</div>
                    <div className="text-white/60 text-xs">Parallel downloads</div>
                  </div>
                  <input 
                    type="number" 
                    min="1" 
                    max="10" 
                    value={maxConcurrentDownloads} 
                    onChange={e => setMaxConcurrentDownloads(Number(e.target.value))} 
                    className="w-20 px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white 
                    text-center outline-none focus:border-emerald-400/50" 
                  />
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl rounded-2xl 
            border border-white/10 p-8 shadow-xl">
              <h3 className="text-white text-xl font-bold mb-6 flex items-center gap-2">
                <span className="w-1 h-6 bg-emerald-500 rounded-full"></span>
                General
              </h3>
              <div className="flex flex-col gap-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-white font-medium">Dark Mode</div>
                    <div className="text-white/60 text-xs">Enable dark theme</div>
                  </div>
                  <Toggle checked={darkMode} onChange={setDarkMode} title="Dark Mode" />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-white font-medium">Notifications</div>
                    <div className="text-white/60 text-xs">Show playback notifications</div>
                  </div>
                  <Toggle checked={notifications} onChange={setNotifications} title="Notifications" />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-white font-medium">Notification Volume</div>
                    <div className="text-white/60 text-xs">Sound level ({notificationVolume}%)</div>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    value={notificationVolume} 
                    onChange={e => setNotificationVolume(Number(e.target.value))} 
                    className="w-32 accent-emerald-500" 
                  />
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl rounded-2xl 
            border border-white/10 p-8 shadow-xl">
              <h3 className="text-white text-xl font-bold mb-6 flex items-center gap-2">
                <span className="w-1 h-6 bg-emerald-500 rounded-full"></span>
                Privacy
              </h3>
              <div className="flex flex-col gap-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-white font-medium">Analytics</div>
                    <div className="text-white/60 text-xs">Share anonymous usage data</div>
                  </div>
                  <Toggle checked={privacyAnalytics} onChange={setPrivacyAnalytics} title="Analytics" />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-white font-medium">Remote Control</div>
                    <div className="text-white/60 text-xs">Allow network device control</div>
                  </div>
                  <Toggle checked={allowRemoteControl} onChange={setAllowRemoteControl} title="Remote Control" />
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'storage' && (
          <div className="grid grid-cols-1 gap-6">
            <div className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl rounded-2xl 
            border border-white/10 p-8 shadow-xl">
              <h3 className="text-white text-xl font-bold mb-6 flex items-center gap-2">
                <span className="w-1 h-6 bg-emerald-500 rounded-full"></span>
                Storage Management
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10">
                  <div>
                    <div className="text-white font-medium">Cache Size</div>
                    <div className="text-white/60 text-xs">Temporary files</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-white/70 text-sm font-mono">{cacheSize}</span>
                    <button 
                      onClick={clearCache} 
                      className="px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 
                      hover:from-red-400 hover:to-red-500 rounded-lg text-sm font-medium text-white 
                      transition-all shadow-lg hover:shadow-red-500/50"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10">
                  <div>
                    <div className="text-white font-medium">Max Cache Size</div>
                    <div className="text-white/60 text-xs">Storage limit (MB)</div>
                  </div>
                  <input 
                    type="number" 
                    min="50" 
                    max="5000" 
                    value={maxCacheMB} 
                    onChange={e => setMaxCacheMB(Number(e.target.value))} 
                    className="w-24 px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white 
                    text-center outline-none focus:border-emerald-400/50" 
                  />
                </div>

                <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10">
                  <div>
                    <div className="text-white font-medium">Connection Status</div>
                    <div className="text-white/60 text-xs">Network availability</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`h-3 w-3 rounded-full ${isOnline ? 'bg-emerald-400' : 'bg-red-400'}`} />
                    <span className="text-white/70 text-sm">{isOnline ? 'Online' : 'Offline'}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10">
                  <div>
                    <div className="text-white font-medium">App Version</div>
                    <div className="text-white/60 text-xs">Current release</div>
                  </div>
                  <span className="text-white/70 text-sm font-mono">1.0.0</span>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl rounded-2xl 
            border border-white/10 p-8 shadow-xl">
              <h3 className="text-white text-xl font-bold mb-6 flex items-center gap-2">
                <span className="w-1 h-6 bg-emerald-500 rounded-full"></span>
                Advanced
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button 
                  onClick={exportSettingsToClipboard} 
                  className="px-6 py-4 bg-white/10 hover:bg-white/20 border border-white/20 
                  rounded-xl text-white font-medium transition-all shadow-lg"
                >
                  Export Settings
                </button>
                <button 
                  onClick={importSettingsFromPrompt} 
                  className="px-6 py-4 bg-white/10 hover:bg-white/20 border border-white/20 
                  rounded-xl text-white font-medium transition-all shadow-lg"
                >
                  Import Settings
                </button>
                <button 
                  onClick={resetDefaults} 
                  className="px-6 py-4 bg-gradient-to-r from-red-500 to-red-600 
                  hover:from-red-400 hover:to-red-500 rounded-xl text-white font-medium 
                  transition-all shadow-lg hover:shadow-red-500/50"
                >
                  Reset to Defaults
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}