import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

/**
 * Prayer times service — fetches sahur (imsak) and iftar (maghrib)
 * times for the user's current location from the Aladhan public API.
 *
 * API docs: https://aladhan.com/prayer-times-api
 * Endpoint: https://api.aladhan.com/v1/timings/{date}?latitude=..&longitude=..&method=13
 *   method=13 → Diyanet İşleri Başkanlığı (Türkiye)
 *
 * Results are cached by (date, rounded lat/lng) for 24 hours to avoid
 * hammering the API on every app open.
 */

const CACHE_KEY_PREFIX = 'fittrack_prayer_times_';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export interface PrayerTimes {
  /** "HH:mm" — end of sahur / imsak (start of fast) */
  sahur: string;
  /** "HH:mm" — maghrib / iftar (end of fast) */
  iftar: string;
  /** Human-readable city label, e.g. "Istanbul, TR" */
  city: string;
  /** Unix ms when the data was fetched */
  fetchedAt: number;
  /** Cached rounded coordinates */
  latitude: number;
  longitude: number;
}

export interface LocationCoords {
  latitude: number;
  longitude: number;
  city?: string;
}

type PermissionResult = 'granted' | 'denied' | 'unavailable';

/**
 * Request location permission and get the current position.
 * Returns null if the user denies or the platform is unsupported.
 */
export async function requestLocationAndGetCoords(): Promise<
  | { coords: LocationCoords; status: 'granted' }
  | { coords: null; status: 'denied' | 'unavailable' }
> {
  if (Platform.OS === 'web') {
    return { coords: null, status: 'unavailable' };
  }
  let Location: any;
  try {
    // Dynamic require so the app still builds if the package hasn't been
    // installed yet (native module gets linked at build time via EAS).
    Location = require('expo-location');
  } catch {
    return { coords: null, status: 'unavailable' };
  }
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      return { coords: null, status: 'denied' };
    }
    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy?.Balanced ?? 3,
    });

    // Reverse-geocode to get the city name (optional, best-effort).
    let city: string | undefined;
    try {
      const geocoded = await Location.reverseGeocodeAsync({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
      if (geocoded && geocoded[0]) {
        const g = geocoded[0];
        city = [g.city || g.subregion || g.region, g.isoCountryCode]
          .filter(Boolean)
          .join(', ');
      }
    } catch {
      // reverse geocode is optional
    }

    return {
      status: 'granted',
      coords: {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        city,
      },
    };
  } catch {
    return { coords: null, status: 'unavailable' };
  }
}

function cacheKey(date: string, lat: number, lng: number): string {
  // 2 decimals (~1.1km) is granular enough for prayer times and avoids
  // cache-miss thrash from tiny GPS jitter.
  const rLat = lat.toFixed(2);
  const rLng = lng.toFixed(2);
  return `${CACHE_KEY_PREFIX}${date}_${rLat}_${rLng}`;
}

function todayYmd(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Fetch prayer times for the given coordinates, with 24h cache.
 * Returns null on API / network failure so the caller can keep
 * showing the previous/default times.
 */
export async function fetchPrayerTimes(
  coords: LocationCoords,
  opts?: { forceRefresh?: boolean }
): Promise<PrayerTimes | null> {
  const date = todayYmd();
  const key = cacheKey(date, coords.latitude, coords.longitude);

  if (!opts?.forceRefresh) {
    try {
      const cached = await AsyncStorage.getItem(key);
      if (cached) {
        const parsed = JSON.parse(cached) as PrayerTimes;
        if (Date.now() - parsed.fetchedAt < CACHE_TTL_MS) {
          return parsed;
        }
      }
    } catch {
      // fall through to network
    }
  }

  try {
    // Aladhan expects DD-MM-YYYY
    const [y, m, d] = date.split('-');
    const apiDate = `${d}-${m}-${y}`;
    const url =
      `https://api.aladhan.com/v1/timings/${apiDate}` +
      `?latitude=${coords.latitude}&longitude=${coords.longitude}&method=13`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) return null;

    const json: any = await res.json();
    const timings = json?.data?.timings;
    if (!timings?.Imsak || !timings?.Maghrib) return null;

    // Aladhan returns "HH:mm (TZ)" — strip the timezone suffix.
    const strip = (s: string): string => s.split(' ')[0];

    const result: PrayerTimes = {
      sahur: strip(timings.Imsak),
      iftar: strip(timings.Maghrib),
      city: coords.city || json?.data?.meta?.timezone || '',
      fetchedAt: Date.now(),
      latitude: Number(coords.latitude.toFixed(2)),
      longitude: Number(coords.longitude.toFixed(2)),
    };

    try {
      await AsyncStorage.setItem(key, JSON.stringify(result));
    } catch {
      // cache write failure is non-fatal
    }
    return result;
  } catch {
    return null;
  }
}

/**
 * Get the most recently cached prayer times (any date, any location)
 * so the UI can fall back to the last-known values when offline.
 */
export async function getLastCachedPrayerTimes(): Promise<PrayerTimes | null> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const prayerKeys = keys.filter((k) => k.startsWith(CACHE_KEY_PREFIX));
    if (prayerKeys.length === 0) return null;

    const entries = await AsyncStorage.multiGet(prayerKeys);
    let best: PrayerTimes | null = null;
    for (const [, v] of entries) {
      if (!v) continue;
      try {
        const parsed = JSON.parse(v) as PrayerTimes;
        if (!best || parsed.fetchedAt > best.fetchedAt) best = parsed;
      } catch {
        // skip malformed cache entries
      }
    }
    return best;
  } catch {
    return null;
  }
}
