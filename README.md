# AIRWISE AI — Breathe Smarter. Live Better.

AIRWISE AI is a full-stack environmental intelligence platform and personal clean-air companion designed to help families, students, elderly residents, outdoor workers, and communities navigate severe winter smog, hazardous air quality, and urban pollution.

## Architecture Overview

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4, Recharts, Lucide React
- **Backend Proxy (`server.ts`)**: Express server running on port `3000` (mounts Vite middlewares in development and serves `dist/` in production).
  - Keeps `GEMINI_API_KEY` and optional `WAQI_API_KEY` strictly on the server.
  - Exposes `/api/air-quality`, `/api/geocode`, `/api/gemini/routine`, and `/api/gemini/chat` (SSE streaming).
- **AI Engine**: Google Gemini API via `@google/genai` (`gemini-4-hydrogen`) for:
  - Personalized Morning / Afternoon / Evening / Night Daily Routine generation with structured JSON schema output.
  - Multilingual conversational AI Assistant (English, Hindi, Hinglish) with live air-quality, weather, and household context.
- **Air Quality & Weather Providers**:
  - Primary zero-key open data provider: **Open-Meteo Air Quality (Copernicus CAMS)** + **Open-Meteo Weather** + **Open-Meteo Geocoding** + **India Post / Nominatim PIN lookup**.
  - Optional provider enhancement: Set `WAQI_API_KEY` in environment secrets to enrich station-level readings via the World Air Quality Index API when available.
  - Accurate **Indian National AQI (CPCB NAQI)** calculation for Indian locations alongside **US EPA AQI**, clearly labeled and never mixed silently.

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

## Privacy & Data Handling

User onboarding preferences (location, lifestyle, household composition, commute/diet preferences), completed checklists, and chat history are stored locally in your browser's `localStorage`. Only the contextual summary required to generate routines or answer AI assistant questions is sent to the backend `/api/gemini/*` endpoints.
