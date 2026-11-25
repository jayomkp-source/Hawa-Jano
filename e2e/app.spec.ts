import { expect, test, type Page } from '@playwright/test';
import axe from 'axe-core';

const SAMPLE_AQ_NOW = () => ({
  locationName: 'New Delhi, Delhi (110001)',
  countryCode: 'IN',
  latitude: 28.6227,
  longitude: 77.2133,
  measuredAt: new Date().toISOString(),
  fetchedAt: new Date().toISOString(),
  source: 'Open-Meteo Copernicus CAMS & Weather',
  stationCoverage: 'gridded-model',
  stationNotice: 'No nearby verified air-quality monitoring station is currently available.',
  pollutants: {
    pm25: 138,
    pm10: 215,
    no2: 61,
    o3: 44,
    co: 1120,
    so2: 14,
  },
  weather: {
    temperature: 21,
    humidity: 60,
    windSpeed: 5.5,
    windDirection: 270,
    weatherCode: 2,
    weatherLabel: 'Partly cloudy',
    isDay: true,
  },
  scales: {
    IN_NAQI: { value: 314, dominantPollutant: 'PM2.5' },
    US_EPA: { value: 193, dominantPollutant: 'PM2.5' },
  },
  hourly: [
    {
      time: '2026-11-25T09:00',
      label: '09:00',
      pm25: 128,
      pm10: 195,
      no2: 55,
      o3: 39,
      usAqi: 188,
      inAqi: 306,
      temperature: 19,
      humidity: 65,
      windSpeed: 4,
      isForecast: false,
    },
    {
      time: '2026-11-25T10:00',
      label: '10:00',
      pm25: 138,
      pm10: 215,
      no2: 61,
      o3: 44,
      usAqi: 193,
      inAqi: 314,
      temperature: 21,
      humidity: 60,
      windSpeed: 5.5,
      isForecast: true,
    },
  ],
  previous24hAvgAqi: { IN_NAQI: 294, US_EPA: 184 },
});

async function setupApiRoutes(page: Page) {
  await page.route('**/api/geocode**', async (route) => {
    const url = route.request().url();
    if (url.includes('999999')) {
      await route.fulfill({
        status: 502,
        contentType: 'text/html',
        body: 'The page cannot be displayed',
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        results: [
          {
            name: 'New Delhi, Delhi (110001)',
            city: 'New Delhi',
            district: 'New Delhi',
            region: 'Delhi',
            country: 'India',
            countryCode: 'IN',
            pinCode: '110001',
            latitude: 28.6227,
            longitude: 77.2133,
          },
        ],
      }),
    });
  });

  await page.route('**/api/air-quality/history**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        locationName: 'New Delhi, Delhi (110001)',
        days: 7,
        source: 'Open-Meteo Copernicus CAMS Historical Archive',
        fetchedAt: new Date().toISOString(),
        daily: [
          {
            date: '2026-11-24',
            label: '24/11',
            pm25Avg: 120,
            pm25Peak: 148,
            pm10Avg: 190,
            pm10Peak: 230,
            o3Avg: 40,
            o3Peak: 65,
            no2Avg: 52,
            no2Peak: 75,
            inAqiAvg: 300,
            usAqiAvg: 184,
          },
          {
            date: '2026-11-25',
            label: '25/11',
            pm25Avg: 138,
            pm25Peak: 156,
            pm10Avg: 215,
            pm10Peak: 245,
            o3Avg: 44,
            o3Peak: 68,
            no2Avg: 61,
            no2Peak: 80,
            inAqiAvg: 314,
            usAqiAvg: 193,
          },
        ],
      }),
    });
  });

  await page.route('**/api/air-quality?**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(SAMPLE_AQ_NOW()),
    });
  });

  await page.route('**/api/gemini/routine', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        generatedAt: new Date().toISOString(),
        locationName: 'New Delhi, Delhi (110001)',
        aqiSummary: 'Very Poor PM2.5 at 314 IN NAQI — keep heavy exertion indoors.',
        safetyNote: 'Practical exposure reduction guide.',
        recommendations: [
          {
            id: 'e2e-r1',
            timeBlock: 'morning',
            whatToDo: 'Indoor warm-up instead of park jog',
            whyItMatters: 'Avoids morning smog inversion layer',
            howToDoIt: 'Keep exterior doors closed',
            estimatedImpact: 'High',
            cost: 'Free',
            difficulty: 'Easy',
            whoBenefits: 'Entire household',
          },
        ],
      }),
    });
  });

  await page.route('**/api/gemini/chat', async (route) => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
      body: `data: ${JSON.stringify({ text: 'Keep windows sealed while IN NAQI is 314.' })}\n\ndata: ${JSON.stringify({ done: true })}\n\n`,
    });
  });
}

test('full desktop user journey: PIN onboarding, all 7 tabs, theme & language switch, modals, and accessibility check', async ({
  page,
}) => {
  await setupApiRoutes(page);
  await page.goto('/');

  // 1. Onboarding PIN lookup for 110001
  const onboardingInput = page.getByPlaceholder(/Enter city or PIN code|110001/i);
  await onboardingInput.fill('110001');
  await page.getByRole('button', { name: 'Find' }).click();
  await page.getByRole('button', { name: /Select/i }).first().click();
  await expect(page.getByText(/New Delhi, Delhi \(110001\)/i)).toBeVisible();

  // Finish 4-step wizard
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: /Launch HAWA JANO Dashboard/i }).click();

  // 2. Dashboard displays live IN NAQI 314 & theme / language switches work
  await expect(page.getByText('314').first()).toBeVisible();

  await page.getByRole('button', { name: 'हिन्दी' }).click();
  await expect(page.getByRole('button', { name: /अवलोकन/ }).first()).toBeVisible();
  await page.getByRole('button', { name: 'EN' }).click();
  await expect(page.getByRole('button', { name: 'Overview' })).toBeVisible();

  await page.getByRole('button', { name: /Toggle color theme/i }).first().click();
  await expect(page.locator('html')).toHaveClass(/dark/);

  // 3. Location modal validates invalid PIN and handles HTML proxy error cleanly
  await page.getByRole('button', { name: /Change Location/i }).first().click();
  const locationDialog = page.getByRole('dialog');
  await expect(locationDialog).toBeVisible();
  const modalInput = locationDialog.getByPlaceholder(/Enter 6-digit PIN/i);
  await modalInput.fill('110');
  await locationDialog.getByRole('button', { name: 'Search' }).click();
  await expect(locationDialog.getByRole('alert')).toContainText(/valid 6-digit PIN/i);

  await modalInput.fill('999999');
  await locationDialog.getByRole('button', { name: 'Search' }).click();
  await expect(locationDialog.getByRole('alert')).toContainText(/temporarily unavailable/i);
  await expect(locationDialog.getByRole('alert')).not.toContainText('Unexpected token');

  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);

  // 4. Navigate across all tabs and exercise core flows
  await page.getByRole('button', { name: 'Air Quality' }).first().click();
  await expect(page.getByText(/Open-Meteo Copernicus CAMS/i).first()).toBeVisible();

  await page.getByRole('button', { name: 'Daily Planner' }).first().click();
  await page.getByRole('button', { name: /Generate Personalized Routine/i }).click();
  await expect(page.getByText('Indoor warm-up instead of park jog')).toBeVisible();

  await page.getByRole('button', { name: 'Indoor Air' }).first().click();
  await expect(page.getByLabel(/Room Size/i)).toBeVisible();

  await page.getByRole('button', { name: 'Eco Alternatives' }).first().click();
  await page.getByRole('button', { name: /Commit Action/i }).first().click();
  await expect(page.getByRole('button', { name: /Committed/i }).first()).toBeVisible();

  // 4b. Open ProfileSettingsModal, change lifestyle & budget, close, and verify persistence across reload
  await page.getByRole('button', { name: 'Profile' }).first().click();
  const profileDialog = page.getByRole('dialog');
  await expect(profileDialog).toBeVisible();
  await profileDialog.getByLabel(/Lifestyle Role/i).selectOption('elderly');
  await profileDialog.getByLabel(/Budget Preference/i).selectOption('zero-low');
  await profileDialog.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  // Open NotificationsDrawer and toggle rule
  await page.getByRole('button', { name: /Notifications/i }).first().click();
  const alertsDialog = page.getByRole('dialog');
  await expect(alertsDialog).toBeVisible();
  const ruleToggle = alertsDialog.getByRole('button', { name: /Enable In-App Alerts/i });
  await expect(ruleToggle).toHaveAttribute('aria-pressed', 'true');
  await ruleToggle.click();
  await expect(alertsDialog.getByRole('button', { name: /Enable In-App Alerts/i })).toHaveAttribute(
    'aria-pressed',
    'false'
  );
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);

  // Verify Eco commitment + Profile edits persist across page reload
  await page.reload();
  await page.getByRole('button', { name: 'Eco Alternatives' }).first().click();
  await expect(page.getByRole('button', { name: /Committed/i }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Profile' }).first().click();
  await expect(page.getByLabel(/Lifestyle Role/i)).toHaveValue('elderly');
  await expect(page.getByLabel(/Budget Preference/i)).toHaveValue('zero-low');
  await page.getByRole('button', { name: 'Done' }).click();

  await page.getByRole('button', { name: 'Community' }).first().click();
  await expect(page.getByRole('tablist').first()).toBeVisible();

  await page.getByRole('button', { name: 'AI Assistant' }).first().click();
  await page.getByPlaceholder(/Ask about weather/i).fill('Should I open my windows?');
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.getByText(/Keep windows sealed while IN NAQI is 314/i)).toBeVisible();

  // 5. Run live axe-core check in real Chromium
  await page.addScriptTag({ content: axe.source });
  const violations = await page.evaluate(async () => {
    const w = window as unknown as {
      axe: { run: (opts?: unknown) => Promise<{ violations: Array<{ id: string; impact?: string }> }> };
    };
    const res = await w.axe.run();
    return res.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
  });
  expect(violations).toEqual([]);
});

test('mobile viewport layout, mobile drawer navigation, and Escape dismissal', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await setupApiRoutes(page);
  await page.goto('/');

  await page.getByRole('button', { name: /Skip Setup/i }).click();

  const menuBtn = page.getByRole('button', { name: 'Open navigation menu' });
  await expect(menuBtn).toBeVisible();
  await menuBtn.click();
  await expect(page.getByRole('dialog', { name: 'Mobile navigation' })).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Mobile navigation' })).toHaveCount(0);

  // Confirm no horizontal overflow at 375px
  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1
  );
  expect(hasHorizontalOverflow).toBe(false);
});
