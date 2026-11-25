# HAWA JANO — Breathe Smarter. Live Better.

**HAWA JANO** *(Build with AI · PromptWars Virtual · Challenge 6)* is a full-stack environmental intelligence platform and bilingual GenAI clean-air companion built to help families, students, elderly residents, outdoor workers, and communities navigate severe winter smog, hazardous air quality, and urban pollution.

## Problem Statement

Urban and winter-smog pollution episodes leave households with raw numbers and fragmented forecasts rather than actionable, localized guidance. Many existing trackers rely solely on uncalibrated US EPA numbers, break on Indian 6-digit PIN code lookups, or offer generic advice disconnected from household vulnerability (children, elderly residents, outdoor workers), indoor filtration capacity, and local weather stagnation. **HAWA JANO** solves this by uniting real-time Indian National AQI (CPCB NAQI) and US EPA AQI telemetry, weather dispersion physics, multi-day WHO-benchmarked pollutant history, indoor CADR sizing, and grounded Google Gemini recommendations in English and Hindi.

## Key Features

- **Live Air Quality & Weather Telemetry**: Real-time **Indian National AQI (CPCB NAQI)** and **US EPA AQI** monitoring, dominant pollutant tracking, weather dispersion analysis, and indicative pollution contributor ratios.
- **7-Day & 30-Day Historical Pollutant Trends (Recharts)**: Interactive line and bar charts tracking **PM2.5**, **NO2**, **PM10**, and **O3** (daily averages and peaks) against WHO guideline thresholds, plus 48-hour observed and forecast trajectories.
- **HAWA JANO AI Weather & Air Companion**: Streaming conversational assistant powered by Google Gemini supporting **English**, **Hindi (हिन्दी)**, and **Hinglish**, with live multi-city weather and AQI lookup tool-calling.
- **AI Personalized Daily Planner**: Generates Morning, Afternoon, Evening, and Night clean-air routines tailored to household composition, commute mode, budget, and live AQI.
- **Indoor Air Lab**: Interactive CADR sizing calculator, cross-ventilation directives grounded in live outdoor AQI, room-by-room clean-air checklists, and HEPA filter replacement reminders.
- **Eco Alternatives & Impact Explainer**: Low-emission commute, household, and lifestyle swaps comparing baseline vs. sustainable alternatives and estimated monthly cost/emissions savings.
- **Community Action Center**: Local clean-air checklists, civic initiatives, and shareable awareness toolkits.
- **Bilingual (EN / HI) & Obsidian Dark/Light Mode**: Full internationalization via `react-i18next` and accessible light/dark sharp-edged editorial themes.

## GenAI Services

All generative AI operations run strictly server-side through Express endpoints so `GEMINI_API_KEY` is never shipped to the browser:

- **SDK**: Official `@google/genai` SDK (`^3.6.1`)
- **Models**: `gemini-4-hydrogen` primary model with automatic fallback and bounded exponential backoff to `gemini-3.1-flash-lite`
- **Personalized Daily Planner (`POST /api/gemini/routine`)**: Structured schema-validated JSON output (`Type.OBJECT`) tailored to user profile, live pollutant concentrations, weather dispersion, and language (`en` / `hi`)
- **Conversational Weather & Air Companion (`POST /api/gemini/chat`)**: Server-Sent Events (SSE) streaming chat with function-calling tool (`lookup_city_weather_and_air_quality`) to fetch live coordinates, AQI, and weather for any queried city or PIN code without fabricating figures
- **Prompt & Safety Controls**: Untrusted location/profile fields are sanitized and enclosed inside `<user_context>` boundaries, AI responses set `Cache-Control: no-store`, and strict medical-safety instructions prohibit clinical diagnoses or false reassurance during severe AQI

## Architecture Overview

- **Frontend**: React 19, TypeScript (`strict: true`), Vite, Tailwind CSS v4, Recharts, Lucide React, `react-i18next`
- **Backend Proxy (`server.ts` & `server/createApp.ts`)**: Express server on port `3000` (mounts Vite middlewares in development; serves `dist/` in production). Modular backend services live under `server/services/` and `server/utils/`.
  - Endpoints: `/api/health`, `/api/geocode`, `/api/air-quality`, `/api/air-quality/history`, `/api/gemini/routine`, `/api/gemini/chat`.
  - Security: Strict CORS origin validation (HTTP/HTTPS schemes only), sliding-window per-IP rate limiting (`trust proxy = 1`), HTML-error sanitization for upstream lookups, bounded TTL caches, and 25s–30s request timeouts.
- **Air Quality, Weather & Location Providers**:
  - Primary open telemetry: **Open-Meteo Air Quality (Copernicus CAMS)** + **Open-Meteo Weather Forecast** + **Open-Meteo Geocoding**
  - Indian PIN lookup: **India Post PIN Code API (`api.postalpincode.in`)** + **Nominatim OpenStreetMap**
  - Optional station enrichment: Set `WAQI_API_KEY` to overlay verified monitoring station readings and local regulatory agency attribution via **aqicn.org**

## Environment Variables

Copy `.env.example` or configure the following variables in your environment / Secrets panel:

- `GEMINI_API_KEY` *(Required for AI tabs)*: Google Gemini API key (accessed server-side only).
- `APP_URL` *(Optional)*: Public origin URL where the app is hosted (included in CORS allowlist).
- `WAQI_API_KEY` *(Optional)*: Token from `aqicn.org/data-platform/token/` for verified station-level readings.

## Running Locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Testing & Coverage Commands

- **TypeScript Strict Check**:
  ```bash
  npm run lint
  ```
- **Unit & Integration Tests (Vitest + Supertest + React Testing Library + axe-core)**:
  ```bash
  npm test
  ```
- **Code Coverage Report**:
  ```bash
  npm run test:coverage
  ```
- **End-to-End Browser Verification (Playwright Chromium + live axe-core)**:
  ```bash
  npm run test:e2e
  ```

## Deployment Instructions

1. Build the production frontend bundle (`dist/`):
   ```bash
   npm run build
   ```
2. Configure `GEMINI_API_KEY` (and optionally `APP_URL`, `WAQI_API_KEY`) in your Node.js host's secret environment variables and set `NODE_ENV=production` and `PORT=3000`.
3. Start the full-stack server (`server.ts` executes directly with Node ESM / TypeScript strip-types or `tsx` depending on Node version):
   ```bash
   npm start
   ```
   Verify deployment health via `GET /api/health` (returns `{ status: "ok", geminiConfigured: true|false, waqiConfigured: true|false }`).

## Known Limitations

- **Gridded Model Fallback Without `WAQI_API_KEY`**: When `WAQI_API_KEY` is omitted or no nearby ground sensor reports within range, live readings come from Open-Meteo Copernicus CAMS gridded atmospheric models (~11 km resolution) and are clearly labeled as modeled estimates rather than street-corner station sensors.
- **Indoor Air Calculations**: The Indoor Air Lab CADR calculator computes estimates from room area, ceiling height, and live outdoor AQI; it does not connect via Bluetooth/Wi-Fi to physical indoor PM2.5 monitors.
- **Browser Local Persistence**: User preferences, filter trackers, eco commitments, and chat history are stored in browser `localStorage` rather than a multi-device cloud account database.

## Pushing to GitHub

After downloading or exporting the project folder locally (build artifacts, `node_modules/`, `coverage/`, `playwright-report/`, and `.env*` secrets are excluded by `.gitignore`):

```bash
git init
git add .
git commit -m "feat: HAWA JANO environmental intelligence platform"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```

## Privacy & Data Handling

User onboarding preferences (location, lifestyle, household composition, commute/diet preferences), completed checklists, and chat history are stored locally in your browser's `localStorage`. Only the contextual summary required to generate routines or answer AI assistant questions is sent to `/api/gemini/*`, and browser geolocation is requested solely on explicit user action.
