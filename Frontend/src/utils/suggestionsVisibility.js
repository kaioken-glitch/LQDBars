const STORAGE_KEY = 'lb:suggestionsVisibility';
const DISABLED_UNTIL_KEY = 'lb:suggestionsDisabledUntil';
export const SUGGESTIONS_REENABLE_DAYS = 4;

function readStorage(storage = window.localStorage) {
  return {
    getItem(key) {
      if (!storage) return null;
      return storage.getItem(key);
    },
    setItem(key, value) {
      if (!storage) return;
      storage.setItem(key, value);
    },
    removeItem(key) {
      if (!storage) return;
      storage.removeItem(key);
    },
  };
}

function parseNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function getSuggestionsVisibility(storage, now = Date.now()) {
  const store = readStorage(storage);
  const enabledSetting = store.getItem(STORAGE_KEY);
  const disabledUntil = parseNumber(store.getItem(DISABLED_UNTIL_KEY), 0);

  if (enabledSetting === 'false' && disabledUntil > now) {
    return { enabled: false, isVisible: false, disabledUntil };
  }

  if (enabledSetting === 'false' && disabledUntil <= now) {
    store.setItem(STORAGE_KEY, 'true');
    store.removeItem(DISABLED_UNTIL_KEY);
    return { enabled: true, isVisible: true, disabledUntil: 0 };
  }

  return { enabled: enabledSetting !== 'false', isVisible: true, disabledUntil: 0 };
}

export function setSuggestionsVisibility(enabled, storage, now = Date.now()) {
  const store = readStorage(storage);
  if (!enabled) {
    const disabledUntil = now + SUGGESTIONS_REENABLE_DAYS * 24 * 60 * 60 * 1000;
    store.setItem(STORAGE_KEY, 'false');
    store.setItem(DISABLED_UNTIL_KEY, String(disabledUntil));
    return { enabled: false, isVisible: false, disabledUntil };
  }

  store.setItem(STORAGE_KEY, 'true');
  store.removeItem(DISABLED_UNTIL_KEY);
  return { enabled: true, isVisible: true, disabledUntil: 0 };
}
