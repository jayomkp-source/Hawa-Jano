# HAWA JANO — Breathe Smarter. Live Better.

**HAWA JANO** is a full-stack environmental intelligence platform and personal clean-air companion designed to help families, students, elderly residents, outdoor workers, and communities navigate severe winter smog, hazardous air quality, and urban pollution.

## Key Features

- **Live Air Quality & Weather Telemetry**: Real-time **Indian National AQI (CPCB NAQI)** and **US EPA AQI** monitoring, dominant pollutant tracking, weather dispersion analysis, and likely pollution contributor insights.
- **7-Day & 30-Day Historical Pollutant Trends (Recharts)**: Interactive line and bar charts tracking **PM2.5**, **NO2**, **PM10**, and **O3** (daily averages and peaks) against WHO guideline thresholds, plus 48-hour observed and forecast trajectories.
- **HAWA JANO AI Weather & Air Companion**: Streaming conversational assistant (powered by Google Gemini) supporting **English**, **Hindi (हिन्दी)**, and **Hinglish**, with live multi-city weather and AQI lookup tool-calling.
- **AI Personalized Daily Planner**: Generates Morning, Afternoon, Evening, and Night clean-air routines tailored to household members, commute mode, budget, and live AQI.
- **Indoor Air Lab**: Interactive CADR sizing calculator, cross-ventilation guidance based on live outdoor AQI, room-by-room checklists, and HEPA filter replacement tracking.
- **Eco Alternatives & Impact Explainer**: Sustainable commute, household, and lifestyle swaps comparing baseline vs. low-emission impact and estimated monthly savings.
- **Community Action Center**: Local clean-air checklists, civic initiatives, and shareable awareness toolkits.
- **Bilingual (EN / HI) & Obsidian Dark/Light Mode**: Full internationalization via `react-i18next` and sharp-edged editorial light/dark themes.

## Architecture Overview

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4, Recharts, Lucide React, `react-i18next`
- **Backend Proxy (`server.ts`)**: Express server running on port `3000` (mounts Vite middlewares in development and serves `dist/` in production).
  - Keeps `GEMINI_API_KEY` and optional `WAQI_API_KEY` strictly on the server.
  - Exposes `/api/health`, `/api/air-quality`, `/api/air-quality/history`, `/api/geocode`, `/api/gemini/routine`, and `/api/gemini/chat` (SSE streaming).
- **AI Engine**: Google Gemini API via `@google/genai` (`gemini-4-hydrogen` with automatic `gemini-3.1-flash-lite` fallback) for structured JSON routine generation and tool-grounded streaming weather/AQI chat.
- **Air Quality & Weather Providers**:
  - Primary zero-key open data provider: **Open-Meteo Air Quality (Copernicus CAMS)** + **Open-Meteo Weather Forecast** + **Open-Meteo Geocoding** + **Nominatim PIN Lookup**.
  - Optional provider enhancement: Set `WAQI_API_KEY` in environment secrets to enrich station-level readings via the World Air Quality Index API.

## Environment Variables

Copy `.env.example` or configure the following variables in your environment / Secrets panel:

- `GEMINI_API_KEY` *(Required)*: Your Google Gemini API key (accessed server-side only).
- `APP_URL` *(Optional)*: Hosted application URL.
- `WAQI_API_KEY` *(Optional)*: Token from `aqicn.org/data-platform/token/` for station-level WAQI readings.

## Running Locally

```bash
npm install
npm run dev
```

Build and start in production mode:

```bash
npm run build
npm start
```

## Pushing to GitHub

After downloading or exporting the project folder locally, run:

```bash
git init
git add .
git commit -m "Initial commit: HAWA JANO environmental intelligence app"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```

## Privacy & Data Handling

User onboarding preferences (location, lifestyle, household composition, commute/diet preferences), completed checklists, and chat history are stored locally in your browser's `localStorage`. Only the contextual summary required to generate routines or answer AI assistant questions is sent to the backend `/api/gemini/*` endpoints.
