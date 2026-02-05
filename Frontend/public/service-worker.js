// public/service-worker.js

self.addEventListener('install', (event) => {
  self.skipWaiting();
  console.log('Service Worker installing.');
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
  console.log('Service Worker activating.');
});

// Handle background audio playback
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'PLAY_AUDIO') {
    const { audioUrl, title, artist, album } = event.data;
    
    // Store current playing info for notification
    self.currentAudio = {
      url: audioUrl,
      title: title || 'Unknown',
      artist: artist || 'Unknown Artist',
      album: album || 'Unknown Album'
    };
    
    // Show notification if supported
    if ('Notification' in self && self.Notification.permission === 'granted') {
      self.registration.showNotification(title || 'Now Playing', {
        body: artist || 'Unknown Artist',
        icon: 'https://placehold.co/192x192?text=Music',
        badge: 'https://placehold.co/96x96?text=♪',
        tag: 'audio-player',
        requireInteraction: false,
        actions: [
          { action: 'prev', title: 'Previous', icon: '/icons/prev.png' },
          { action: 'playpause', title: 'Pause', icon: '/icons/pause.png' },
          { action: 'next', title: 'Next', icon: '/icons/next.png' },
        ]
      });
    }
  }
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  const action = event.action;
  
  // Send action back to the app
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      for (const client of clientList) {
        client.postMessage({
          type: 'NOTIFICATION_CLICK',
          action: action
        });
      }
    })
  );
});

// Background sync for offline support
self.addEventListener('sync', (event) => {
  if (event.tag === 'audio-sync') {
    console.log('Background sync for audio');
  }
});

// Periodic background sync (for updating playlists, etc.)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'update-playlists') {
    console.log('Periodic sync for playlists');
  }
});