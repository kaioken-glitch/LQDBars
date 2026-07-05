/**
 * deviceId.js
 *
 * Generates and persists a stable per-browser device identity used by
 * the remote-control feature to distinguish devices signed into the
 * same account.
 */

const ID_KEY    = 'lb:deviceId';
const LABEL_KEY = 'lb:deviceLabel';

function detectLabel() {
  const ua = navigator.userAgent || '';

  let browser = 'Browser';
  if (/Edg\//.test(ua))                                   browser = 'Edge';
  else if (/Chrome\//.test(ua) && !/Chromium/.test(ua))   browser = 'Chrome';
  else if (/Firefox\//.test(ua))                          browser = 'Firefox';
  else if (/Safari\//.test(ua) && !/Chrome/.test(ua))     browser = 'Safari';

  let os = 'Device';
  if (/Windows/.test(ua))                                 os = 'Windows';
  else if (/iPhone|iPad|iPod/.test(ua))                    os = 'iOS';
  else if (/Android/.test(ua))                             os = 'Android';
  else if (/Mac OS X/.test(ua))                            os = 'Mac';
  else if (/Linux/.test(ua))                               os = 'Linux';

  return `${browser} · ${os}`;
}

export function getDeviceId() {
  try {
    let id = localStorage.getItem(ID_KEY);
    if (!id) {
      id = (crypto?.randomUUID?.() || `dev-${Date.now()}-${Math.random().toString(36).slice(2)}`);
      localStorage.setItem(ID_KEY, id);
    }
    return id;
  } catch {
    return `dev-${Date.now()}`;
  }
}

export function getDeviceLabel() {
  try {
    let label = localStorage.getItem(LABEL_KEY);
    if (!label) {
      label = detectLabel();
      localStorage.setItem(LABEL_KEY, label);
    }
    return label;
  } catch {
    return detectLabel();
  }
}