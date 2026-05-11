type AnalyticsParams = Record<string, string | number | boolean | null | undefined>;

export interface AnalyticsEvent {
  name: string;
  params: AnalyticsParams;
  at: string;
}

const STORAGE_KEY = 'app_event_log';
const MAX_EVENTS = 200;

function isValidEventName(name: string) {
  return /^[a-z0-9]+_[a-z0-9]+_[a-z0-9]+$/.test(name);
}

function readEvents(): AnalyticsEvent[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeEvents(events: AnalyticsEvent[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(events.slice(-MAX_EVENTS)));
}

export function trackEvent(name: string, params: AnalyticsParams = {}) {
  if (!isValidEventName(name)) {
    console.warn(`[analytics] invalid event name: ${name}`);
    return;
  }

  const event: AnalyticsEvent = {
    name,
    params,
    at: new Date().toISOString(),
  };

  const next = [...readEvents(), event];
  writeEvents(next);
  console.debug('[analytics]', event);
}

export function getTrackedEvents() {
  return readEvents();
}

export function clearTrackedEvents() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(STORAGE_KEY);
}

export function exportTrackedEvents() {
  return JSON.stringify(readEvents(), null, 2);
}
