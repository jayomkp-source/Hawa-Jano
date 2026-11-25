import { getValidCache, setBoundedCache, type CacheEntry } from '../utils/cache.ts';
import type { JsonFetcher } from '../utils/upstream.ts';

const GEOCODE_CACHE_TTL_MS = 15 * 60 * 1000;

interface IndiaPostOffice {
  Name?: string;
  BranchType?: string;
  Block?: string;
  District?: string;
  State?: string;
  Country?: string;
}

interface IndiaPostEntry {
  Status?: string;
  PostOffice?: IndiaPostOffice[] | null;
}

interface NominatimItem {
  lat: string;
  lon: string;
  display_name: string;
  address?: Record<string, string>;
}

export interface GeocodeResultItem {
  name: string;
  city: string;
  district: string;
  region: string;
  country: string;
  countryCode: string;
  pinCode?: string;
  latitude: number;
  longitude: number;
}

export interface GeocodeServiceOutcome {
  status: number;
  body: { results: GeocodeResultItem[] } | { error: string };
}

export async function resolveGeocodeQuery(params: {
  qRaw: string;
  latStr: string;
  lonStr: string;
  fetchJson: JsonFetcher;
  cache: Map<string, CacheEntry<{ results: GeocodeResultItem[] }>>;
  nowFn: () => number;
}): Promise<GeocodeServiceOutcome> {
  const { qRaw, latStr, lonStr, fetchJson, cache, nowFn } = params;

  if (qRaw.length > 100) {
    return { status: 400, body: { error: 'Location search query is too long.' } };
  }
  const q = qRaw.slice(0, 100);

  // Reverse geocoding from browser coordinates
  if (latStr && lonStr) {
    const lat = Number(latStr);
    const lon = Number(lonStr);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
      return { status: 400, body: { error: 'Invalid coordinates provided.' } };
    }
    const revKey = `rev:${lat.toFixed(3)},${lon.toFixed(3)}`;
    const cached = getValidCache(cache, revKey, nowFn());
    if (cached) {
      return { status: 200, body: cached };
    }

    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(
      lat
    )}&lon=${encodeURIComponent(lon)}&zoom=12&addressdetails=1`;
    const data = (await fetchJson(url, 8000)) as {
      address?: Record<string, string>;
    };
    const addr = data.address ?? {};
    const city =
      addr.city ||
      addr.town ||
      addr.suburb ||
      addr.city_district ||
      addr.county ||
      addr.state_district ||
      'Current Location';
    const district = addr.state_district || addr.county || addr.city_district || '';
    const region = addr.state || addr.region || '';
    const country = addr.country || 'Unknown';
    const countryCode = (addr.country_code || '').toUpperCase();
    const pinCode = addr.postcode || undefined;

    const payload = {
      results: [
        {
          name: region ? `${city}, ${region}` : city,
          city,
          district,
          region,
          country,
          countryCode,
          pinCode,
          latitude: lat,
          longitude: lon,
        },
      ],
    };
    setBoundedCache(cache, revKey, payload, GEOCODE_CACHE_TTL_MS, nowFn());
    return { status: 200, body: payload };
  }

  if (!q) {
    return { status: 400, body: { error: 'Please enter a valid 6-digit PIN code.' } };
  }

  // Enforce exact 6-digit Indian PIN code validation for numeric queries
  if (/^\d+$/.test(q)) {
    if (!/^\d{6}$/.test(q)) {
      return { status: 400, body: { error: 'Please enter a valid 6-digit PIN code.' } };
    }

    const pinKey = `pin:${q}`;
    const cachedPin = getValidCache(cache, pinKey, nowFn());
    if (cachedPin) {
      return { status: 200, body: cachedPin };
    }

    const postalUrl = `https://api.postalpincode.in/pincode/${encodeURIComponent(q)}`;
    const nomUrl = `https://nominatim.openstreetmap.org/search?format=jsonv2&postalcode=${encodeURIComponent(
      q
    )}&countrycodes=in&addressdetails=1&limit=5`;

    const [postalSettled, nomSettled] = await Promise.allSettled([
      fetchJson(postalUrl, 8000) as Promise<IndiaPostEntry[]>,
      fetchJson(nomUrl, 8000) as Promise<NominatimItem[]>,
    ]);

    let postalSuccess = false;
    let postalNotFound = false;
    let primaryPo: IndiaPostOffice | null = null;

    if (postalSettled.status === 'fulfilled' && Array.isArray(postalSettled.value)) {
      const firstEntry = postalSettled.value[0];
      if (
        firstEntry?.Status === 'Success' &&
        Array.isArray(firstEntry.PostOffice) &&
        firstEntry.PostOffice.length > 0
      ) {
        postalSuccess = true;
        primaryPo =
          firstEntry.PostOffice.find((p) => p.BranchType === 'Head Post Office') ||
          firstEntry.PostOffice.find((p) => p.BranchType === 'Sub Post Office') ||
          firstEntry.PostOffice[0];
      } else if (firstEntry?.Status === 'Error' || firstEntry?.Status === '404') {
        postalNotFound = true;
      }
    }

    const nomItems =
      nomSettled.status === 'fulfilled' && Array.isArray(nomSettled.value) ? nomSettled.value : [];
    const nomResolvedCleanly = nomSettled.status === 'fulfilled';

    const validNomCoords = nomItems
      .map((item) => ({
        lat: Number(item.lat),
        lon: Number(item.lon),
      }))
      .find((item) => Number.isFinite(item.lat) && Number.isFinite(item.lon));

    // 1. Primary path: India Post returned verified city, district, state, country
    if (postalSuccess && primaryPo) {
      const district = (primaryPo.District || '').trim();
      const region = (primaryPo.State || '').trim();
      const country = (primaryPo.Country || 'India').trim();
      const block = primaryPo.Block && primaryPo.Block !== 'NA' ? primaryPo.Block.trim() : '';
      const poName = (primaryPo.Name || '').trim();
      const city = block || district || poName || q;

      let latitude = validNomCoords?.lat ?? NaN;
      let longitude = validNomCoords?.lon ?? NaN;

      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        const coordQueries = [
          [city, region].filter(Boolean).join(', '),
          [district, region].filter(Boolean).join(', '),
          district,
        ].filter(Boolean);

        for (const cq of coordQueries) {
          try {
            const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
              cq
            )}&count=3&language=en&format=json&countryCode=IN`;
            const geoData = (await fetchJson(geoUrl, 6000)) as {
              results?: Array<{ latitude: number; longitude: number; country_code?: string }>;
            };
            const match = (geoData.results ?? []).find(
              (r) =>
                Number.isFinite(r.latitude) &&
                Number.isFinite(r.longitude) &&
                (!r.country_code || r.country_code.toUpperCase() === 'IN')
            );
            if (match) {
              latitude = match.latitude;
              longitude = match.longitude;
              break;
            }
          } catch {
            // Try next coordinate query
          }
        }
      }

      if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
        const displayLabel =
          city && region && city.toLowerCase() !== region.toLowerCase()
            ? `${city}, ${region} (${q})`
            : `${city} (${q})`;

        const payload = {
          results: [
            {
              name: displayLabel,
              city,
              district,
              region,
              country,
              countryCode: 'IN',
              pinCode: q,
              latitude,
              longitude,
            },
          ],
        };
        setBoundedCache(cache, pinKey, payload, GEOCODE_CACHE_TTL_MS, nowFn());
        return { status: 200, body: payload };
      }
    }

    // 2. Fallback path: Nominatim returned valid Indian postal coordinates directly
    if (nomItems.length > 0 && !postalNotFound) {
      const results = nomItems
        .map((item): GeocodeResultItem | null => {
          const lat = Number(item.lat);
          const lon = Number(item.lon);
          if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
          const addr = item.address ?? {};
          const city =
            addr.city ||
            addr.town ||
            addr.village ||
            addr.suburb ||
            addr.state_district ||
            addr.county ||
            q;
          const district = addr.state_district || addr.county || addr.city_district || '';
          const region = addr.state || '';
          const country = addr.country || 'India';
          const countryCode = (addr.country_code || 'IN').toUpperCase();
          return {
            name: region ? `${city}, ${region} (${q})` : `${city} (${q})`,
            city,
            district,
            region,
            country,
            countryCode,
            pinCode: q,
            latitude: lat,
            longitude: lon,
          };
        })
        .filter((item): item is GeocodeResultItem => item !== null);

      if (results.length > 0) {
        const payload = { results };
        setBoundedCache(cache, pinKey, payload, GEOCODE_CACHE_TTL_MS, nowFn());
        return { status: 200, body: payload };
      }
    }

    // 3. Clean "no match found" if providers answered cleanly saying no such PIN
    if (
      postalNotFound ||
      (nomResolvedCleanly && nomItems.length === 0 && postalSettled.status === 'fulfilled')
    ) {
      return { status: 200, body: { results: [] } };
    }

    return { status: 503, body: { error: 'Location service is temporarily unavailable.' } };
  }

  if (q.length < 2) {
    return { status: 400, body: { error: 'Enter at least 2 characters for city or PIN code.' } };
  }

  const cityKey = `city:${q.toLowerCase()}`;
  const cachedCity = getValidCache(cache, cityKey, nowFn());
  if (cachedCity) {
    return { status: 200, body: cachedCity };
  }

  const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
    q
  )}&count=6&language=en&format=json`;
  const geoData = (await fetchJson(geoUrl, 8000)) as {
    results?: Array<{
      name: string;
      admin1?: string;
      admin2?: string;
      country?: string;
      country_code?: string;
      latitude: number;
      longitude: number;
    }>;
  };

  const results: GeocodeResultItem[] = (geoData.results ?? []).map((r) => ({
    name: r.admin1 ? `${r.name}, ${r.admin1}` : r.name,
    city: r.name,
    district: r.admin2 || '',
    region: r.admin1 || '',
    country: r.country || '',
    countryCode: (r.country_code || '').toUpperCase(),
    latitude: r.latitude,
    longitude: r.longitude,
  }));

  const payload = { results };
  setBoundedCache(cache, cityKey, payload, GEOCODE_CACHE_TTL_MS, nowFn());
  return { status: 200, body: payload };
}
