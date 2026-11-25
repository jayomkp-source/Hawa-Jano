// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp, type GeminiClientLike } from '../createApp.ts';

function jsonRes(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function htmlRes(body: string, status = 502): Response {
  return new Response(body, {
    status,
    headers: { 'Content-Type': 'text/html' },
  });
}

describe('Express backend /api/* integration (Sections A, B, C, D & Security)', () => {
  it('sets security headers and enforces strict CORS origin checks', async () => {
    const app = createApp({
      getGeminiClient: () => null,
      disableRateLimit: true,
      allowedOrigins: ['https://trusted.example.com'],
    });

    const okRes = await request(app)
      .get('/api/health')
      .set('Origin', 'https://trusted.example.com');
    expect(okRes.status).toBe(200);
    expect(okRes.headers['x-content-type-options']).toBe('nosniff');
    expect(okRes.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(okRes.headers['x-powered-by']).toBeUndefined();
    expect(okRes.headers['access-control-allow-origin']).toBe('https://trusted.example.com');

    const blockedRes = await request(app)
      .get('/api/health')
      .set('Origin', 'https://evil-attacker.example.com');
    expect(blockedRes.status).toBe(403);
    expect(blockedRes.body.error).toBe('Origin not allowed.');
  });

  it('enforces sliding-window rate limits with Retry-After header', async () => {
    const app = createApp({
      getGeminiClient: () => null,
      rateLimitMaxPerMinute: { ai: 2, data: 2 },
    });

    const r1 = await request(app).get('/api/health');
    const r2 = await request(app).get('/api/health');
    const r3 = await request(app).get('/api/health');

    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    expect(r3.status).toBe(429);
    expect(r3.headers['retry-after']).toBeDefined();
    expect(r3.body.error).toMatch(/too many requests/i);
  });

  it('handles Indian PIN code lookup, validation errors, and HTML upstream error sanitization', async () => {
    const fetchFn = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('postalpincode.in/pincode/110001')) {
        return jsonRes([
          {
            Status: 'Success',
            PostOffice: [
              {
                Name: 'Sansad Marg H.O',
                BranchType: 'Head Post Office',
                Block: 'New Delhi',
                District: 'New Delhi',
                State: 'Delhi',
                Country: 'India',
              },
            ],
          },
        ]);
      }
      if (url.includes('nominatim.openstreetmap.org/search')) {
        return jsonRes([
          {
            lat: '28.6227',
            lon: '77.2133',
            display_name: 'New Delhi 110001',
            address: { state: 'Delhi', country: 'India', country_code: 'in' },
          },
        ]);
      }
      if (url.includes('nominatim.openstreetmap.org/reverse')) {
        return jsonRes({
          address: {
            city: 'Jaipur',
            state_district: 'Jaipur',
            state: 'Rajasthan',
            country: 'India',
            country_code: 'in',
            postcode: '302001',
          },
        });
      }
      return htmlRes('The page cannot be displayed due to upstream proxy error', 502);
    }) as unknown as typeof fetch;

    const app = createApp({ fetchFn, getGeminiClient: () => null, disableRateLimit: true });

    // Empty and malformed PIN rejection
    const emptyPin = await request(app).get('/api/geocode?q=');
    expect(emptyPin.status).toBe(400);
    const shortPin = await request(app).get('/api/geocode?q=1100');
    expect(shortPin.status).toBe(400);

    // Valid 6-digit Indian PIN resolution
    const validPin = await request(app).get('/api/geocode?q=110001');
    expect(validPin.status).toBe(200);
    expect(validPin.body.results).toHaveLength(1);
    expect(validPin.body.results[0]).toMatchObject({
      city: 'New Delhi',
      district: 'New Delhi',
      region: 'Delhi',
      country: 'India',
      countryCode: 'IN',
      pinCode: '110001',
    });

    // Reverse geocoding invalid & valid coordinates
    const badCoords = await request(app).get('/api/geocode?lat=999&lon=77');
    expect(badCoords.status).toBe(400);
    const revOk = await request(app).get('/api/geocode?lat=26.9124&lon=75.7873');
    expect(revOk.status).toBe(200);
    expect(revOk.body.results[0].city).toBe('Jaipur');

    // Upstream HTML failure returns clean sanitized 503 JSON, never raw HTML or JSON syntax exception
    const htmlErrApp = createApp({
      fetchFn: vi.fn(async () =>
        htmlRes('The page cannot be displayed', 502)
      ) as unknown as typeof fetch,
      getGeminiClient: () => null,
      disableRateLimit: true,
    });
    const upstreamFail = await request(htmlErrApp).get('/api/geocode?q=560001');
    expect(upstreamFail.status).toBe(503);
    expect(upstreamFail.body.error).toBe('Location service is temporarily unavailable.');
    expect(JSON.stringify(upstreamFail.body)).not.toContain('Unexpected token');
  });

  it('returns calibrated IN_NAQI air quality snapshots, sanitizes invalid readings, and serves historical trends', async () => {
    const fetchFn = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('past_days=7')) {
        return jsonRes({
          hourly: {
            time: ['2026-11-24T08:00', '2026-11-24T12:00', '2026-11-25T08:00'],
            pm2_5: [120, 80, 95],
            pm10: [200, 150, 175],
            nitrogen_dioxide: [60, 40, 50],
            ozone: [30, 55, 35],
            us_aqi: [185, 160, 172],
          },
        });
      }
      if (url.includes('air-quality-api.open-meteo.com')) {
        return jsonRes({
          current: {
            time: '2026-11-25T10:00',
            pm2_5: 135,
            pm10: -25, // invalid negative reading should be dropped to null
            nitrogen_dioxide: 64,
            ozone: 42,
            carbon_monoxide: 1100,
            sulphur_dioxide: 14,
            us_aqi: 192,
          },
          hourly: {
            time: ['2026-11-25T09:00', '2026-11-25T10:00', '2026-11-25T11:00'],
            pm2_5: [130, 135, 110],
            pm10: [190, 200, 175],
            nitrogen_dioxide: [60, 64, 52],
            ozone: [38, 42, 50],
            carbon_monoxide: [1000, 1100, 950],
            us_aqi: [188, 192, 178],
          },
        });
      }
      return jsonRes({
        current: {
          temperature_2m: 21,
          relative_humidity_2m: 62,
          wind_speed_10m: 5.5,
          wind_direction_10m: 270,
          weather_code: 2,
          is_day: 1,
        },
        hourly: {
          temperature_2m: [19, 21, 23],
          relative_humidity_2m: [68, 62, 55],
          wind_speed_10m: [4, 5.5, 7],
        },
      });
    }) as unknown as typeof fetch;

    const app = createApp({ fetchFn, getGeminiClient: () => null, disableRateLimit: true });

    const invalidCoords = await request(app).get('/api/air-quality?lat=abc&lon=77');
    expect(invalidCoords.status).toBe(400);

    const liveRes = await request(app).get(
      '/api/air-quality?lat=28.61&lon=77.21&name=New+Delhi&countryCode=IN'
    );
    expect(liveRes.status).toBe(200);
    expect(liveRes.body.pollutants.pm25).toBe(135);
    expect(liveRes.body.pollutants.pm10).toBeNull();
    expect(liveRes.body.scales.IN_NAQI.dominantPollutant).toBe('PM2.5');
    expect(liveRes.body.scales.IN_NAQI.value).toBeGreaterThan(300);
    expect(liveRes.body.source).toContain('Open-Meteo');

    // Second request uses cache cleanly without hitting upstream again
    const callsBefore = (fetchFn as unknown as ReturnType<typeof vi.fn>).mock.calls.length;
    const cachedRes = await request(app).get(
      '/api/air-quality?lat=28.61&lon=77.21&name=New+Delhi&countryCode=IN'
    );
    expect(cachedRes.status).toBe(200);
    expect((fetchFn as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBe(callsBefore);

    const histRes = await request(app).get(
      '/api/air-quality/history?lat=28.61&lon=77.21&days=7&name=New+Delhi'
    );
    expect(histRes.status).toBe(200);
    expect(histRes.body.daily).toHaveLength(2);
    expect(histRes.body.daily[0].pm25Avg).toBe(100);
    expect(histRes.body.daily[0].pm25Peak).toBe(120);

    // Upstream AQ error must not leak internal details
    const downApp = createApp({
      fetchFn: vi.fn(async () => {
        throw new Error('ECONNREFUSED 10.0.0.1:443 internal-host');
      }) as unknown as typeof fetch,
      getGeminiClient: () => null,
      disableRateLimit: true,
    });
    const downRes = await request(downApp).get('/api/air-quality?lat=28.61&lon=77.21');
    expect(downRes.status).toBe(502);
    expect(downRes.body.error).toBe('Live air quality data is currently unavailable.');
    expect(downRes.body.details).toBeUndefined();
  });

  it('handles Gemini AI routine, streaming chat, tool calls, timeouts, rate limits, and auth errors', async () => {
    // 1. Unconfigured API key
    const noKeyApp = createApp({ getGeminiClient: () => null, disableRateLimit: true });
    const noKeyRes = await request(noKeyApp).post('/api/gemini/routine').send({});
    expect(noKeyRes.status).toBe(503);

    // 2. Valid routine generation (even wrapped in markdown fences) + chat tool call + SSE stream
    let chatTurnCallCount = 0;
    const mockAi: GeminiClientLike = {
      models: {
        generateContent: vi.fn(async (args) => {
          const textPrompt = JSON.stringify(args.contents);
          if (textPrompt.includes('Generate a practical, location-aware daily clean-air routine')) {
            return {
              text:
                '```json\n' +
                JSON.stringify({
                  aqiSummary: 'Poor PM2.5 today in New Delhi.',
                  safetyNote: 'Reduces exposure where practical.',
                  recommendations: [
                    {
                      id: 'r1',
                      timeBlock: 'morning',
                      whatToDo: 'Indoor yoga',
                      whyItMatters: 'Avoids morning smog peak',
                      howToDoIt: 'Keep windows closed',
                      estimatedImpact: 'High',
                      cost: 'Free',
                      difficulty: 'Easy',
                      whoBenefits: 'Family',
                    },
                  ],
                }) +
                '\n```',
            };
          }
          chatTurnCallCount += 1;
          if (chatTurnCallCount === 1) {
            return {
              functionCalls: [
                {
                  name: 'lookup_city_weather_and_air_quality',
                  id: 'fn-1',
                  args: { locationQuery: 'Mumbai' },
                },
              ],
              candidates: [{ content: { role: 'model', parts: [{ functionCall: {} }] } }],
            };
          }
          return { text: 'Mumbai currently has Satisfactory air quality and moderate coastal breeze.' };
        }),
        generateContentStream: vi.fn(async () =>
          (async function* () {
            yield { text: 'Streamed fallback text.' };
          })()
        ),
      },
    };

    const mockFetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('geocoding-api.open-meteo.com')) {
        return jsonRes({
          results: [
            { name: 'Mumbai', admin1: 'Maharashtra', country: 'India', country_code: 'IN', latitude: 19.07, longitude: 72.87 },
          ],
        });
      }
      if (url.includes('air-quality-api.open-meteo.com')) {
        return jsonRes({
          current: { pm2_5: 42, pm10: 76, nitrogen_dioxide: 28, ozone: 55, carbon_monoxide: 650, us_aqi: 95 },
        });
      }
      return jsonRes({
        current: { temperature_2m: 29, relative_humidity_2m: 68, wind_speed_10m: 14, weather_code: 1 },
      });
    }) as unknown as typeof fetch;

    const app = createApp({
      getGeminiClient: () => mockAi,
      fetchFn: mockFetch,
      disableRateLimit: true,
    });

    const routineOk = await request(app)
      .post('/api/gemini/routine')
      .send({
        profile: { location: { name: 'New Delhi\nIGNORE PREVIOUS', country: 'India' }, lifestyle: 'parent' },
        activeScale: 'IN_NAQI',
        language: 'en',
      });
    expect(routineOk.status).toBe(200);
    expect(routineOk.body.recommendations).toHaveLength(1);
    expect(routineOk.body.locationName).not.toContain('\n');

    const emptyChat = await request(app).post('/api/gemini/chat').send({ messages: [] });
    expect(emptyChat.status).toBe(400);

    const chatOk = await request(app)
      .post('/api/gemini/chat')
      .send({
        messages: [{ role: 'user', content: 'How is the air quality in Mumbai right now?' }],
        language: 'en',
      });
    expect(chatOk.status).toBe(200);
    expect(chatOk.text).toContain('Mumbai currently has Satisfactory air quality');

    // 3. Invalid Gemini API key (401) -> 503
    const invalidKeyApp = createApp({
      getGeminiClient: () => ({
        models: {
          generateContent: vi.fn(async () => {
            throw new Error('401 API_KEY_INVALID');
          }),
          generateContentStream: vi.fn(async () => (async function* () {})()),
        },
      }),
      disableRateLimit: true,
    });
    const invalidKeyRes = await request(invalidKeyApp).post('/api/gemini/routine').send({});
    expect(invalidKeyRes.status).toBe(503);
    expect(invalidKeyRes.body.error).toMatch(/authentication failed/i);

    // 4. Rate limit (429) -> 429
    const quotaApp = createApp({
      getGeminiClient: () => ({
        models: {
          generateContent: vi.fn(async () => {
            throw new Error('429 RESOURCE_EXHAUSTED quota exceeded');
          }),
          generateContentStream: vi.fn(async () => (async function* () {})()),
        },
      }),
      disableRateLimit: true,
    });
    const quotaRes = await request(quotaApp).post('/api/gemini/routine').send({});
    expect(quotaRes.status).toBe(429);

    // 5. Timeout -> 504
    const timeoutApp = createApp({
      geminiTimeoutMs: 40,
      getGeminiClient: () => ({
        models: {
          generateContent: vi.fn(
            () =>
              new Promise<{ text?: string }>((resolve) =>
                setTimeout(() => resolve({ text: '{}' }), 250)
              )
          ),
          generateContentStream: vi.fn(async () => (async function* () {})()),
        },
      }),
      disableRateLimit: true,
    });
    const timeoutRes = await request(timeoutApp)
      .post('/api/gemini/chat')
      .send({ messages: [{ role: 'user', content: 'Hello' }] });
    expect(timeoutRes.status).toBe(504);

    // 6. Malformed JSON response -> 502
    const badJsonApp = createApp({
      getGeminiClient: () => ({
        models: {
          generateContent: vi.fn(async () => ({ text: 'not valid json at all' })),
          generateContentStream: vi.fn(async () => (async function* () {})()),
        },
      }),
      disableRateLimit: true,
    });
    const badJsonRes = await request(badJsonApp).post('/api/gemini/routine').send({});
    expect(badJsonRes.status).toBe(502);
  });

  it('supports city search caching, WAQI station agency attribution, and empty Gemini recommendation guard', async () => {
    const fetchFn = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('geocoding-api.open-meteo.com')) {
        return jsonRes({
          results: [
            {
              name: 'Mumbai',
              admin2: 'Mumbai Suburban',
              admin1: 'Maharashtra',
              country: 'India',
              country_code: 'IN',
              latitude: 19.076,
              longitude: 72.8777,
            },
          ],
        });
      }
      if (url.includes('api.waqi.info')) {
        return jsonRes({
          status: 'ok',
          data: {
            aqi: 142,
            city: { name: 'Bandra Kurla Complex, Mumbai' },
            time: { iso: '2026-11-25T10:30:00+05:30' },
            attributions: [{ name: 'MPCB - Maharashtra Pollution Control Board' }],
          },
        });
      }
      if (url.includes('air-quality-api.open-meteo.com')) {
        return jsonRes({
          current: {
            time: '2026-11-25T10:00',
            pm2_5: 55,
            pm10: 98,
            nitrogen_dioxide: 40,
            ozone: 32,
            carbon_monoxide: 700,
            sulphur_dioxide: 10,
            us_aqi: 120,
          },
          hourly: { time: ['2026-11-25T10:00'], pm2_5: [55], pm10: [98], nitrogen_dioxide: [40], ozone: [32], carbon_monoxide: [700], us_aqi: [120] },
        });
      }
      return jsonRes({
        current: { temperature_2m: 28, relative_humidity_2m: 66, wind_speed_10m: 12, wind_direction_10m: 240, weather_code: 1, is_day: 1 },
        hourly: { temperature_2m: [28], relative_humidity_2m: [66], wind_speed_10m: [12] },
      });
    }) as unknown as typeof fetch;

    const prevWaqiKey = process.env.WAQI_API_KEY;
    process.env.WAQI_API_KEY = 'test-waqi-token';
    try {
      const app = createApp({ fetchFn, getGeminiClient: () => null, disableRateLimit: true });

      // City lookup & cache hit
      const city1 = await request(app).get('/api/geocode?q=Mumbai');
      expect(city1.status).toBe(200);
      expect(city1.body.results[0]).toMatchObject({
        city: 'Mumbai',
        region: 'Maharashtra',
        countryCode: 'IN',
      });
      const callsAfterFirst = (fetchFn as unknown as ReturnType<typeof vi.fn>).mock.calls.length;
      const city2 = await request(app).get('/api/geocode?q=Mumbai');
      expect(city2.status).toBe(200);
      expect((fetchFn as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBe(callsAfterFirst);

      // WAQI monitoring station + agency attribution enrichment
      const waqiRes = await request(app).get(
        '/api/air-quality?lat=19.08&lon=72.88&name=Mumbai&countryCode=IN'
      );
      expect(waqiRes.status).toBe(200);
      expect(waqiRes.body.stationCoverage).toBe('verified');
      expect(waqiRes.body.stationName).toContain('Bandra Kurla Complex, Mumbai');
      expect(waqiRes.body.stationName).toContain('MPCB');
      expect(waqiRes.body.scales.US_EPA.value).toBe(142);
    } finally {
      if (prevWaqiKey === undefined) {
        delete process.env.WAQI_API_KEY;
      } else {
        process.env.WAQI_API_KEY = prevWaqiKey;
      }
    }

    // Empty recommendations array from Gemini returns 502 instead of invalid empty plan
    const emptyRecApp = createApp({
      getGeminiClient: () => ({
        models: {
          generateContent: vi.fn(async () => ({
            text: JSON.stringify({ aqiSummary: 'Summary', safetyNote: 'Note', recommendations: [] }),
          })),
          generateContentStream: vi.fn(async () => (async function* () {})()),
        },
      }),
      disableRateLimit: true,
    });
    const emptyRecRes = await request(emptyRecApp).post('/api/gemini/routine').send({});
    expect(emptyRecRes.status).toBe(502);
  });

  it('isolates rate limits per proxy X-Forwarded-For IP, rejects non-HTTP origins, strips leading model turns, and sets no-store on AI responses', async () => {
    const generateSpy = vi.fn<GeminiClientLike['models']['generateContent']>(async () => ({
      text: 'Stay indoors when haze spikes.',
    }));
    const app = createApp({
      rateLimitMaxPerMinute: { ai: 1, data: 1 },
      getGeminiClient: () => ({
        models: {
          generateContent: generateSpy,
          generateContentStream: vi.fn(async () => (async function* () {})()),
        },
      }),
    });

    // Rejects non-HTTP/HTTPS protocol origins
    const badProto = await request(app).get('/api/health').set('Origin', 'javascript://evil');
    expect(badProto.status).toBe(403);

    // Rate-limit isolation by X-Forwarded-For (trust proxy = 1)
    const ip1First = await request(app).get('/api/health').set('X-Forwarded-For', '203.0.113.10');
    const ip1Second = await request(app).get('/api/health').set('X-Forwarded-For', '203.0.113.10');
    const ip2First = await request(app).get('/api/health').set('X-Forwarded-For', '203.0.113.11');
    expect(ip1First.status).toBe(200);
    expect(ip1Second.status).toBe(429);
    expect(ip2First.status).toBe(200);

    // Strips leading model greeting turn & sets Cache-Control: no-store
    const chatRes = await request(app)
      .post('/api/gemini/chat')
      .set('X-Forwarded-For', '203.0.113.12')
      .send({
        messages: [
          { role: 'assistant', content: 'Welcome greeting' },
          { role: 'user', content: 'How is PM2.5 today?' },
        ],
      });
    expect(chatRes.status).toBe(200);
    expect(chatRes.headers['cache-control']).toContain('no-store');
    const firstArg = generateSpy.mock.calls[0]?.[0] as { contents?: Array<{ role: string }> } | undefined;
    expect(firstArg?.contents?.[0]?.role).toBe('user');

    // Routine endpoint sets Cache-Control: no-store even on validation/success
    const routineApp = createApp({
      getGeminiClient: () => ({
        models: {
          generateContent: vi.fn(async () => ({
            text: JSON.stringify({
              aqiSummary: 'OK',
              safetyNote: 'Safe',
              recommendations: [
                {
                  id: 'r1',
                  timeBlock: 'morning',
                  whatToDo: 'Walk indoors',
                  whyItMatters: 'Smog',
                  howToDoIt: 'Keep doors shut',
                  estimatedImpact: 'High',
                  cost: 'Free',
                  difficulty: 'Easy',
                  whoBenefits: 'All',
                },
              ],
            }),
          })),
          generateContentStream: vi.fn(async () => (async function* () {})()),
        },
      }),
      disableRateLimit: true,
    });
    const routineRes = await request(routineApp).post('/api/gemini/routine').send({});
    expect(routineRes.status).toBe(200);
    expect(routineRes.headers['cache-control']).toContain('no-store');
  });
});
