import { ARCHIVE } from './data';
import type { WeatherEvent } from './types';

/**
 * Space weather for the game.
 *
 * LIVE: NASA DONKI (Space Weather Database Of Notifications, Knowledge, Information) solar flares
 * from the last 30 days, fetched in the player's browser from the CCMC DONKI API (no key needed).
 * If DONKI cannot be reached, the same kind of flare list from NOAA's Space Weather Prediction Center
 * (GOES X-ray flares, last 7 days, public JSON) is used, and the game says so.
 * ARCHIVE: a few real, NASA-documented solar events (src/data.ts) used when the live call fails.
 *
 * The game always says which one it is using. Static data is never presented as live.
 */

export type WeatherStatus = 'loading' | 'live' | 'mixed' | 'archive';
export interface Weather { status: WeatherStatus; events: WeatherEvent[]; liveCount: number; provider?: 'nasa' | 'noaa' }

const CACHE_KEY = 'moonrescue-donki-v2';
const CACHE_MS = 60 * 60 * 1000; // be kind to the free API: cache for 1 hour
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const CLASS_RE = /^([ABCMX])(\d+(?:\.\d+)?)$/;

/** Turn a DONKI FLR record list into game weather events (M and X class only). */
export function parseFlares(json: unknown, provider: 'nasa' | 'noaa' = 'nasa'): WeatherEvent[] {
  if (!Array.isArray(json)) return [];
  const out: WeatherEvent[] = [];
  for (const rec of json) {
    const r = rec as { classType?: unknown; peakTime?: unknown; beginTime?: unknown };
    const cls = typeof r.classType === 'string' ? r.classType.trim().toUpperCase() : '';
    const m = CLASS_RE.exec(cls);
    if (!m || (m[1] !== 'M' && m[1] !== 'X')) continue;
    const when = new Date(String(r.peakTime ?? r.beginTime ?? ''));
    if (Number.isNaN(when.getTime())) continue;
    out.push({
      classType: cls,
      date: `${when.getUTCDate()} ${MONTHS[when.getUTCMonth()]} ${when.getUTCFullYear()}`,
      note: `${m[1] === 'X' ? 'A major' : 'A medium'} flare seen by ${provider === 'nasa' ? 'NASA' : 'NOAA GOES'}.`,
      source: 'live',
      provider,
    });
  }
  return out;
}

const ymd = (d: Date) => d.toISOString().slice(0, 10);

async function getJson(url: string): Promise<unknown> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 7000);
  try {
    const res = await fetch(url, { signal: ctl.signal });
    if (!res.ok) throw new Error(`${new URL(url).host} ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchLive(): Promise<WeatherEvent[]> {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) {
      const c = JSON.parse(raw) as { t: number; events: WeatherEvent[] };
      if (Date.now() - c.t < CACHE_MS && Array.isArray(c.events)) return c.events;
    }
  } catch { /* no storage: fine */ }

  const end = new Date();
  const start = new Date(end.getTime() - 30 * 24 * 3600 * 1000);
  // NASA DONKI moved to the CCMC site on 30 Sep 2026. No key is needed, and the path must not end in a slash.
  const donki = async () => parseFlares(await getJson(`https://ccmc.gsfc.nasa.gov/DONKI-API/get/FLR?startDate=${ymd(start)}&endDate=${ymd(end)}`), 'nasa');
  // NOAA SWPC publishes the GOES X-ray flares DONKI is built on; used when DONKI is slow or down.
  const noaa = async () => {
    const json = await getJson('https://services.swpc.noaa.gov/json/goes/primary/xray-flares-7-day.json');
    const rows = Array.isArray(json) ? json.map((r: { max_class?: unknown; max_time?: unknown; begin_time?: unknown }) => ({ classType: r.max_class, peakTime: r.max_time ?? r.begin_time })) : [];
    return parseFlares(rows, 'noaa');
  };
  // Ask both at once. NASA gets 2.5 seconds to answer (and must have something to report); after that
  // the NOAA list is used, so a slow or unreachable NASA server never holds up the game.
  const noaaP = noaa();
  noaaP.catch(() => { /* handled below if needed */ });
  let events: WeatherEvent[];
  try {
    events = await Promise.race([
      donki(),
      new Promise<WeatherEvent[]>((_, reject) => setTimeout(() => reject(new Error('DONKI is slow')), 2500)),
    ]);
    if (events.length === 0) events = await noaaP;
  } catch {
    events = await noaaP;
  }
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), events })); } catch { /* ignore */ }
  return events;
}

/** Fill the list with archive events so every game has at least `min` storms to pick from. */
export function withArchive(live: WeatherEvent[], min = 3): Weather {
  const events = [...live];
  for (const a of ARCHIVE) if (events.length < Math.max(min, 3) && !events.some((e) => e.source === 'archive' && e.classType === a.classType)) events.push(a);
  const status: WeatherStatus = live.length === 0 ? 'archive' : events.length > live.length ? 'mixed' : 'live';
  return { status, events, liveCount: live.length, provider: live[0]?.provider };
}

export async function loadWeather(): Promise<Weather> {
  try {
    return withArchive(await fetchLive());
  } catch {
    return withArchive([]);
  }
}

export const archiveWeather = (): Weather => withArchive([]);

export function statusText(w: Weather): string {
  switch (w.status) {
    case 'loading': return 'Space weather: asking NASA…';
    case 'live': return `Space weather: LIVE from ${w.provider === 'noaa' ? 'NOAA GOES' : 'NASA DONKI'} (${w.liveCount} recent flares)`;
    case 'mixed': return `Space weather: ${w.liveCount} live ${w.provider === 'noaa' ? 'NOAA GOES' : 'NASA'} flares + archive`;
    default: return 'Space weather: NASA archive (live data not available)';
  }
}
