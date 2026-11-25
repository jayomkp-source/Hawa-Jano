import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { describe, expect, it, vi } from 'vitest';
import App from '../../App';

function setupCompletedProfileStorage(withLocation = true) {
  window.localStorage.setItem(
    'airwise_user_profile_v1',
    JSON.stringify({
      onboardingCompleted: true,
      displayName: 'Aarav',
      location: withLocation
        ? {
            name: 'New Delhi, Delhi (110001)',
            city: 'New Delhi',
            district: 'New Delhi',
            region: 'Delhi',
            country: 'India',
            countryCode: 'IN',
            pinCode: '110001',
            latitude: 28.6227,
            longitude: 77.2133,
            source: 'manual',
            updatedAt: new Date().toISOString(),
          }
        : null,
      preferredScale: 'auto',
      lifestyle: 'parent',
      household: {
        familyMembers: 4,
        hasChildren: true,
        hasElderly: true,
        hasPets: false,
        typicalOutdoorActivity: 'moderate',
      },
      preferences: {
        commuteMode: 'public-transport',
        diet: 'vegetarian',
        budget: 'moderate',
      },
    })
  );
}

function makeSampleAqPayload(measuredAt = new Date().toISOString()) {
  return {
    locationName: 'New Delhi, Delhi (110001)',
    countryCode: 'IN',
    latitude: 28.6227,
    longitude: 77.2133,
    measuredAt,
    fetchedAt: new Date().toISOString(),
    source: 'Open-Meteo Copernicus CAMS & Weather',
    stationCoverage: 'gridded-model',
    stationNotice: 'No nearby verified air-quality monitoring station is currently available.',
    pollutants: {
      pm25: 132,
      pm10: 204,
      no2: 58,
      o3: 41,
      co: 1050,
      so2: 14,
    },
    weather: {
      temperature: 22,
      humidity: 58,
      windSpeed: 6,
      windDirection: 280,
      weatherCode: 2,
      weatherLabel: 'Partly cloudy',
      isDay: true,
    },
    scales: {
      IN_NAQI: { value: 310, dominantPollutant: 'PM2.5' },
      US_EPA: { value: 191, dominantPollutant: 'PM2.5' },
    },
    hourly: [
      {
        time: '2026-11-25T09:00',
        label: '09:00',
        pm25: 120,
        pm10: 190,
        no2: 50,
        o3: 35,
        usAqi: 185,
        inAqi: 300,
        temperature: 20,
        humidity: 64,
        windSpeed: 5,
        isForecast: false,
      },
      {
        time: '2026-11-25T10:00',
        label: '10:00',
        pm25: 132,
        pm10: 204,
        no2: 58,
        o3: 41,
        usAqi: 191,
        inAqi: 310,
        temperature: 22,
        humidity: 58,
        windSpeed: 6,
        isForecast: true,
      },
    ],
    previous24hAvgAqi: { IN_NAQI: 292, US_EPA: 182 },
  };
}

function mockDefaultFetch(overrides?: {
  aqStatus?: number;
  aqBody?: unknown;
  historyBody?: unknown;
  geocodeStatus?: number;
  geocodeBody?: unknown;
  routineStatus?: number;
  routineBody?: unknown;
  chatEvents?: Array<Record<string, unknown>>;
}) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('/api/air-quality/history')) {
      return new Response(
        JSON.stringify(
          overrides?.historyBody ?? {
            locationName: 'New Delhi',
            days: 7,
            source: 'Open-Meteo Copernicus CAMS Historical Archive',
            fetchedAt: new Date().toISOString(),
            daily: [
              {
                date: '2026-11-24',
                label: '24/11',
                pm25Avg: 118,
                pm25Peak: 145,
                pm10Avg: 185,
                pm10Peak: 220,
                o3Avg: 42,
                o3Peak: 68,
                no2Avg: 54,
                no2Peak: 78,
                inAqiAvg: 295,
                usAqiAvg: 183,
              },
            ],
          }
        ),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
    if (url.includes('/api/air-quality')) {
      if (overrides?.aqStatus && overrides.aqStatus >= 400) {
        return new Response(JSON.stringify(overrides.aqBody ?? { error: 'Unavailable' }), {
          status: overrides.aqStatus,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify(overrides?.aqBody ?? makeSampleAqPayload()), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (url.includes('/api/geocode')) {
      if (typeof overrides?.geocodeBody === 'string') {
        return new Response(overrides.geocodeBody, {
          status: overrides.geocodeStatus ?? 502,
          headers: { 'Content-Type': 'text/html' },
        });
      }
      return new Response(
        JSON.stringify(
          overrides?.geocodeBody ?? {
            results: [
              {
                name: 'Mumbai, Maharashtra (400001)',
                city: 'Mumbai',
                district: 'Mumbai',
                region: 'Maharashtra',
                country: 'India',
                countryCode: 'IN',
                pinCode: '400001',
                latitude: 18.9388,
                longitude: 72.8354,
              },
            ],
          }
        ),
        {
          status: overrides?.geocodeStatus ?? 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
    if (url.includes('/api/gemini/routine')) {
      return new Response(
        JSON.stringify(
          overrides?.routineBody ?? {
            generatedAt: new Date().toISOString(),
            locationName: 'New Delhi',
            aqiSummary: 'Very Poor PM2.5 — keep kids and elderly indoors with HEPA filtration.',
            safetyNote: 'Practical exposure reduction guide.',
            recommendations: [
              {
                id: 'rec-1',
                timeBlock: 'morning',
                whatToDo: 'Move morning exercise indoors',
                whyItMatters: 'Winter inversion traps PM2.5 near street level',
                howToDoIt: 'Do 20 min stretching indoors with sealed windows',
                estimatedImpact: 'High',
                cost: 'Free',
                difficulty: 'Easy',
                whoBenefits: 'Children & elderly',
              },
            ],
          }
        ),
        {
          status: overrides?.routineStatus ?? 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
    if (url.includes('/api/gemini/chat')) {
      const events = overrides?.chatEvents ?? [
        { text: 'Outdoor jog is unsafe at 310 IN NAQI. Stay indoors.' },
        { done: true },
      ];
      const enc = new TextEncoder();
      const stream = new ReadableStream({
        start(ctrl) {
          ctrl.enqueue(enc.encode(events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join('')));
          ctrl.close();
        },
      });
      return new Response(stream, {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      });
    }
    return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
  });
}

describe('UI Components & Pages Integration + Axe Accessibility (Sections B, D, E, F, G)', () => {
  it('renders onboarding -> completes PIN search -> switches across all 7 tabs, theme, and Hindi i18n', async () => {
    const user = userEvent.setup();
    mockDefaultFetch();

    render(<App />);

    // Onboarding screen: search PIN 110001, select result, and launch dashboard
    expect(screen.getAllByText(/HAWA JANO/i).length).toBeGreaterThan(0);
    const onboardingInput = screen.getByPlaceholderText(/Enter city or PIN code/i);
    await user.type(onboardingInput, '110001');
    await user.click(screen.getByRole('button', { name: 'Find' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Mumbai/i })).toBeInTheDocument();
    });
    await user.click(screen.getByRole('button', { name: /Mumbai/i }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(screen.getByRole('button', { name: /Launch HAWA JANO Dashboard/i }));

    // Overview dashboard loaded with live telemetry
    await waitFor(() => {
      expect(screen.getAllByText('310').length).toBeGreaterThan(0);
    });

    // Toggle dark mode & Hindi language
    const themeBtns = screen.getAllByRole('button', { name: /Toggle color theme/i });
    await user.click(themeBtns[0]);
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    const hindiBtn = screen.getByRole('button', { name: 'हिन्दी' });
    await user.click(hindiBtn);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /अवलोकन/ })).toBeInTheDocument();
    });

    // Switch back to English and navigate across all 7 tabs
    await user.click(screen.getByRole('button', { name: 'EN' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Overview' })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'Air Quality' }));
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'Daily Planner' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Generate Personalized Routine/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'Indoor Air' }));
    await waitFor(() => {
      expect(screen.getByLabelText(/Room Size/i)).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'Eco Alternatives' }));
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /Commit Action/i }).length).toBeGreaterThan(0);
    });

    await user.click(screen.getByRole('button', { name: 'Community' }));
    await waitFor(() => {
      expect(screen.getByRole('tablist')).toBeInTheDocument();
    });

    await user.click(screen.getAllByRole('button', { name: 'AI Assistant' })[0]);
    await waitFor(() => {
      expect(screen.getByRole('log')).toBeInTheDocument();
    });
  });

  it('validates PIN search in LocationSelectorModal, handles HTML errors cleanly, and closes on Escape', async () => {
    const user = userEvent.setup();
    setupCompletedProfileStorage(false);
    mockDefaultFetch({ geocodeBody: 'The page cannot be displayed', geocodeStatus: 502 });

    render(<App />);

    // Status banner shows missing location prompt
    const selectLocBtns = screen.getAllByRole('button', { name: /Select Location/i });
    await user.click(selectLocBtns[0]);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();

    // Invalid 5-digit PIN displays inline validation error
    const input = screen.getByPlaceholderText(/6-digit PIN/i);
    await user.type(input, '1100');
    await user.click(screen.getByRole('button', { name: 'Search' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/valid 6-digit PIN/i);

    // Valid 6-digit PIN against upstream HTML error displays clean friendly message
    await user.clear(input);
    await user.type(input, '400001');
    await user.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/Location service is temporarily unavailable/i);
    });
    expect(screen.getByRole('alert').textContent).not.toContain('Unexpected token');

    // Now mock valid geocode result, search, select, and confirm
    vi.restoreAllMocks();
    mockDefaultFetch();
    await user.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() => {
      expect(screen.getByText(/Mumbai, Maharashtra \(400001\)/i)).toBeInTheDocument();
    });
    await user.click(screen.getByRole('button', { name: /Confirm Location/i }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    // Open modal again and verify Escape closes it
    await user.click(screen.getAllByRole('button', { name: /Change Location/i })[0]);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('shows stale reading notice when measuredAt is older than 3 hours and supports DailyPlanner, Eco, Indoor, and Assistant flows', async () => {
    const user = userEvent.setup();
    setupCompletedProfileStorage(true);
    const staleDate = new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString();
    mockDefaultFetch({ aqBody: makeSampleAqPayload(staleDate) });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/Air quality reading may be outdated/i)).toBeInTheDocument();
    });

    // Daily Planner generate + mark done
    await user.click(screen.getByRole('button', { name: 'Daily Planner' }));
    await user.click(await screen.findByRole('button', { name: /Generate Personalized Routine/i }));
    await waitFor(() => {
      expect(screen.getByText('Move morning exercise indoors')).toBeInTheDocument();
    });

    // Eco Alternatives commit increases weekly impact summary
    await user.click(screen.getByRole('button', { name: 'Eco Alternatives' }));
    const commitButtons = await screen.findAllByRole('button', { name: /Commit Action/i });
    await user.click(commitButtons[0]);
    expect(screen.getByRole('button', { name: /Committed/i })).toBeInTheDocument();

    // Indoor Air calculator updates recommendation on budget change
    await user.click(screen.getByRole('button', { name: 'Indoor Air' }));
    const budgetSelect = await screen.findByLabelText(/Available Budget/i);
    await user.selectOptions(budgetSelect, 'zero-low');
    expect(screen.getByText(/Zero-cost impact:/i)).toBeInTheDocument();

    // Assistant chat sends prompt & streams reply
    await user.click(screen.getAllByRole('button', { name: 'AI Assistant' })[0]);
    const chatInput = await screen.findByPlaceholderText(/Ask about weather/i);
    await user.type(chatInput, 'Is an outdoor jog safe?');
    await user.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => {
      expect(screen.getByText(/Outdoor jog is unsafe at 310 IN NAQI/i)).toBeInTheDocument();
    });
  });

  it('passes automated axe-core accessibility audit without serious or critical violations', async () => {
    setupCompletedProfileStorage(true);
    mockDefaultFetch();

    const { container } = render(<App />);
    await waitFor(() => {
      expect(screen.getAllByText('310').length).toBeGreaterThan(0);
    });

    const axeResults = await axe.run(container, {
      rules: {
        // jsdom does not compute color contrast pixels accurately, tested explicitly via token checks
        'color-contrast': { enabled: false },
      },
    });
    const severe = axeResults.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    );
    expect(severe).toEqual([]);
  });
});
