import type { SupportedLanguage, WeatherData } from '../types';

export interface DispersionInsight {
  status: 'favorable' | 'moderate' | 'stagnant' | 'unknown';
  label: string;
  summary: string;
}

export function analyzeAtmosphericDispersion(
  weather: WeatherData | null,
  language: SupportedLanguage = 'en'
): DispersionInsight {
  if (!weather || weather.windSpeed === null) {
    return language === 'hi'
      ? {
          status: 'unknown',
          label: 'फैलाव डेटा अनुपलब्ध',
          summary: 'प्रदूषक फैलाव का आकलन करने के लिए वर्तमान हवा की गति उपलब्ध नहीं है।',
        }
      : {
          status: 'unknown',
          label: 'Dispersion Data Unavailable',
          summary: 'Wind speed data is not currently available to assess pollutant dispersion.',
        };
  }

  const wind = weather.windSpeed;
  const humidity = weather.humidity ?? 50;
  const temp = weather.temperature ?? 20;

  if (wind < 6 && (humidity >= 70 || temp <= 14)) {
    return language === 'hi'
      ? {
          status: 'stagnant',
          label: 'उच्च स्थिरता / शीतकालीन इन्वर्जन जोखिम',
          summary: `धीमी हवा (${wind.toFixed(1)} किमी/घं) और ${humidity}% नमी जमीन के पास सूक्ष्म कणों को फंसा सकती है।`,
        }
      : {
          status: 'stagnant',
          label: 'High Stagnation / Winter Inversion Risk',
          summary: `Calm winds (${wind.toFixed(1)} km/h) combined with ${humidity}% humidity can trap fine particulates near ground level.`,
        };
  }

  if (wind < 8) {
    return language === 'hi'
      ? {
          status: 'moderate',
          label: 'कम वायु फैलाव',
          summary: `हल्की हवा (${wind.toFixed(1)} किमी/घं) क्षैतिज प्रदूषक सफाई को सीमित करती है; स्थानीय ट्रैफ़िक और धुआं अधिक देर तक टिकता है।`,
        }
      : {
          status: 'moderate',
          label: 'Low Wind Dispersion',
          summary: `Light wind (${wind.toFixed(1)} km/h) limits horizontal pollutant clearing; local traffic and cooking emissions linger longer.`,
        };
  }

  return language === 'hi'
    ? {
        status: 'favorable',
        label: 'सक्रिय वायु फैलाव',
        summary: `लगभग ${wind.toFixed(1)} किमी/घं की हवा सतही धुंध और ट्रैफ़िक धुएं को फैलाने में मदद करती है।`,
      }
    : {
        status: 'favorable',
        label: 'Active Wind Dispersion',
        summary: `Breezes around ${wind.toFixed(1)} km/h help disperse surface-level haze and traffic exhaust more effectively.`,
      };
}

export function formatWindDirection(degrees: number | null): string {
  if (degrees === null || Number.isNaN(degrees)) return '—';
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const idx = Math.round(((degrees % 360) / 45)) % 8;
  return `${dirs[idx]} (${Math.round(degrees)}°)`;
}
