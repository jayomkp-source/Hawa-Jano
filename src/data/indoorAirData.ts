import type { SupportedLanguage } from '../types';

export interface IndoorChecklistItem {
  id: string;
  room: 'living-room' | 'kitchen' | 'bedroom';
  title: string;
  detail: string;
  priority: 'Essential' | 'High Impact' | 'Maintenance';
}

export const INDOOR_CHECKLIST_ITEMS: IndoorChecklistItem[] = [
  {
    id: 'lr-cross-vent',
    room: 'living-room',
    title: 'Time cross-ventilation strictly to cleaner outdoor windows',
    detail:
      'Open opposite windows for 15–20 minutes only when live outdoor AQI is Good or Satisfactory; seal gaps during evening/morning smog inversions.',
    priority: 'Essential',
  },
  {
    id: 'lr-no-combustion',
    room: 'living-room',
    title: 'Eliminate indoor smoke, incense, and scented candles',
    detail:
      'Burning agarbatti, dhoop, mosquito coils, or tobacco spikes indoor PM2.5 rapidly in closed winter rooms. Switch to liquid/electric repellents or non-combustion alternatives.',
    priority: 'Essential',
  },
  {
    id: 'lr-wet-mop',
    room: 'living-room',
    title: 'Wet mop floors instead of dry sweeping',
    detail:
      'Dry brooms resuspend settled fine dust back into breathing height. Damp microfibre mopping captures settled particulates.',
    priority: 'High Impact',
  },
  {
    id: 'lr-doormat',
    room: 'living-room',
    title: 'Keep outdoor shoes at the entryway',
    detail:
      'Leave footwear outside or on an entryway mat to reduce tracked-in road dust and heavy particulates.',
    priority: 'Maintenance',
  },
  {
    id: 'kt-exhaust',
    room: 'kitchen',
    title: 'Run the chimney / exhaust fan before lighting the stove',
    detail:
      'Start exhaust ventilation 2 minutes before cooking and keep it running 10 minutes after finishing to clear NO2, CO, and cooking aerosols.',
    priority: 'Essential',
  },
  {
    id: 'kt-lids',
    room: 'kitchen',
    title: 'Cover pans during simmering and high-heat tadka/frying',
    detail:
      'Covering cookware reduces grease aerosolization and ultra-fine particle release while saving cooking fuel.',
    priority: 'High Impact',
  },
  {
    id: 'kt-electric',
    room: 'kitchen',
    title: 'Use electric kettle, induction, or pressure cooker where available',
    detail:
      'Electric appliances emit zero indoor NO2 or combustion particles compared to open gas flames.',
    priority: 'High Impact',
  },
  {
    id: 'kt-grease-filter',
    room: 'kitchen',
    title: 'Clean chimney baffle/mesh filters every 3–4 weeks',
    detail:
      'Clogged grease filters cut exhaust airflow significantly, trapping cooking smoke inside the kitchen.',
    priority: 'Maintenance',
  },
  {
    id: 'br-hepa-placement',
    room: 'bedroom',
    title: 'Position air purifier 30–50 cm from walls near sleeping zone',
    detail:
      'Keep intake unobstructed and run on Sleep/Medium continuous mode overnight with bedroom door closed for consistent clean-air exchange.',
    priority: 'Essential',
  },
  {
    id: 'br-bedding',
    room: 'bedroom',
    title: 'Wash pillowcases and sheets weekly in warm water',
    detail:
      'Reduces dust-mite allergens, pet dander, and settled particulate matter accumulated during the day.',
    priority: 'High Impact',
  },
  {
    id: 'br-damp-mold',
    room: 'bedroom',
    title: 'Keep indoor humidity between 40% and 55%',
    detail:
      'Inspect window sills and bathroom-adjacent walls for condensation or dampness to prevent mold spores.',
    priority: 'Maintenance',
  },
  {
    id: 'br-draft-seal',
    room: 'bedroom',
    title: 'Seal under-door and window frame gaps during severe smog',
    detail:
      'Simple foam weatherstripping or a rolled door draft stopper cuts uncontrolled polluted air infiltration.',
    priority: 'High Impact',
  },
];

const INDOOR_CHECKLIST_ITEMS_HI: IndoorChecklistItem[] = [
  {
    id: 'lr-cross-vent',
    room: 'living-room',
    title: 'क्रॉस-वेंटिलेशन केवल स्वच्छ बाहरी समय तक सीमित रखें',
    detail:
      'आमने-सामने की खिड़कियां केवल तभी 15–20 मिनट खोलें जब बाहरी AQI अच्छा या संतोषजनक हो; सुबह-शाम के स्मॉग के दौरान दरारें बंद रखें।',
    priority: 'Essential',
  },
  {
    id: 'lr-no-combustion',
    room: 'living-room',
    title: 'घर के अंदर धुआं, अगरबत्ती और सुगंधित मोमबत्तियां बंद करें',
    detail:
      'बंद सर्दियों के कमरों में अगरबत्ती, धूप, मच्छर कॉइल या तंबाकू जलाने से इनडोर PM2.5 तेजी से बढ़ता है। बिना धुएं वाले विकल्प अपनाएं।',
    priority: 'Essential',
  },
  {
    id: 'lr-wet-mop',
    room: 'living-room',
    title: 'सूखी झाड़ू के बजाय गीला पोछा लगाएं',
    detail:
      'सूखी झाड़ू से बैठी हुई बारीक धूल फिर से सांस लेने की ऊंचाई तक हवा में उड़ जाती है। नम माइक्रोफ़ाइबर पोछा धूल कणों को समेट लेता है।',
    priority: 'High Impact',
  },
  {
    id: 'lr-doormat',
    room: 'living-room',
    title: 'बाहरी जूते-चप्पल प्रवेश द्वार पर ही रखें',
    detail:
      'फुटवियर बाहर या एंट्री मैट पर उतारने से सड़क की धूल और भारी कण घर के अंदर नहीं आते।',
    priority: 'Maintenance',
  },
  {
    id: 'kt-exhaust',
    room: 'kitchen',
    title: 'चूल्हा जलाने से पहले चिमनी या एग्जॉस्ट फैन चलाएं',
    detail:
      'खाना पकाने से 2 मिनट पहले एग्जॉस्ट चालू करें और पकाने के बाद 10 मिनट तक चलने दें ताकि NO2, CO और धुआं बाहर निकल जाए।',
    priority: 'Essential',
  },
  {
    id: 'kt-lids',
    room: 'kitchen',
    title: 'धीमी आंच और तड़का/तलने के दौरान बर्तन ढककर रखें',
    detail:
      'बर्तन ढकने से तेल के सूक्ष्म कण और धुआं कम फैलते हैं तथा ईंधन की भी बचत होती है।',
    priority: 'High Impact',
  },
  {
    id: 'kt-electric',
    room: 'kitchen',
    title: 'संभव हो तो इलेक्ट्रिक केतली, इंडक्शन या प्रेशर कुकर उपयोग करें',
    detail:
      'खुली गैस की लौ की तुलना में इलेक्ट्रिक उपकरण घर के अंदर शून्य NO2 या दहन कण उत्सर्जित करते हैं।',
    priority: 'High Impact',
  },
  {
    id: 'kt-grease-filter',
    room: 'kitchen',
    title: 'चिमनी के बैफ़ल/जाली फ़िल्टर हर 3–4 सप्ताह में साफ़ करें',
    detail:
      'चिकनाई से बंद फ़िल्टर एग्जॉस्ट हवा को कम कर देते हैं, जिससे रसोई का धुआं घर के अंदर फंस जाता है।',
    priority: 'Maintenance',
  },
  {
    id: 'br-hepa-placement',
    room: 'bedroom',
    title: 'एयर प्यूरीफायर को दीवार से 30–50 सेमी दूर सोने के क्षेत्र के पास रखें',
    detail:
      'एयर इनटेक खुला रखें और लगातार स्वच्छ हवा के लिए बेडरूम का दरवाजा बंद करके रात भर Sleep/Medium मोड पर चलाएं।',
    priority: 'Essential',
  },
  {
    id: 'br-bedding',
    room: 'bedroom',
    title: 'तकिये के कवर और चादरें साप्ताहिक रूप से गर्म पानी में धोएं',
    detail:
      'इससे दिन भर जमा हुए धूल के कण, डस्ट-माइट एलर्जन और पालतू जानवरों के रोएं कम होते हैं।',
    priority: 'High Impact',
  },
  {
    id: 'br-damp-mold',
    room: 'bedroom',
    title: 'घर के अंदर की नमी 40% से 55% के बीच बनाए रखें',
    detail:
      'फफूंदी (मोल्ड) से बचने के लिए खिड़की की चौखट और बाथरूम से सटी दीवारों पर सीलन या नमी की जांच करें।',
    priority: 'Maintenance',
  },
  {
    id: 'br-draft-seal',
    room: 'bedroom',
    title: 'गंभीर स्मॉग के समय दरवाजे के नीचे और खिड़की की दरारें बंद करें',
    detail:
      'फोम वेदरस्ट्रिपिंग या डोर ड्राफ्ट स्टॉपर लगाने से बाहर की प्रदूषित हवा का अनियंत्रित प्रवेश रुकता है।',
    priority: 'High Impact',
  },
];

export function getIndoorChecklistItems(language: SupportedLanguage): IndoorChecklistItem[] {
  return language === 'hi' ? INDOOR_CHECKLIST_ITEMS_HI : INDOOR_CHECKLIST_ITEMS;
}

export interface IndoorLabCalculationInput {
  roomSizeSqFt: number;
  occupants: number;
  filtrationSetup: 'none' | 'basic-fan' | 'hepa-single' | 'hepa-high-cadr';
  budget: 'zero-low' | 'moderate' | 'flexible';
  outdoorAqi: number | null;
  ventilationSafe: boolean;
}

export interface IndoorLabCalculationResult {
  recommendedCadrM3h: number;
  recommendedCadrCfm: number;
  targetAch: number;
  priorityStrategy: string;
  ventilationDirective: string;
  actionSteps: string[];
  inputWarning?: string;
}

export const INDOOR_ROOM_MIN_SQFT = 40;
export const INDOOR_ROOM_MAX_SQFT = 2500;
export const INDOOR_OCCUPANTS_MIN = 1;
export const INDOOR_OCCUPANTS_MAX = 30;

export function sanitizeIndoorInput(input: IndoorLabCalculationInput): {
  sanitized: IndoorLabCalculationInput;
  hadInvalidInput: boolean;
} {
  let hadInvalidInput = false;

  let roomSizeSqFt = input.roomSizeSqFt;
  if (typeof roomSizeSqFt !== 'number' || !Number.isFinite(roomSizeSqFt) || roomSizeSqFt <= 0) {
    hadInvalidInput = true;
    roomSizeSqFt = 180;
  } else if (roomSizeSqFt < INDOOR_ROOM_MIN_SQFT || roomSizeSqFt > INDOOR_ROOM_MAX_SQFT) {
    hadInvalidInput = true;
    roomSizeSqFt = Math.min(INDOOR_ROOM_MAX_SQFT, Math.max(INDOOR_ROOM_MIN_SQFT, roomSizeSqFt));
  }

  let occupants = input.occupants;
  if (typeof occupants !== 'number' || !Number.isFinite(occupants) || occupants < 1) {
    hadInvalidInput = true;
    occupants = 2;
  } else if (occupants > INDOOR_OCCUPANTS_MAX) {
    hadInvalidInput = true;
    occupants = INDOOR_OCCUPANTS_MAX;
  } else {
    occupants = Math.round(occupants);
  }

  let outdoorAqi = input.outdoorAqi;
  if (outdoorAqi !== null && (typeof outdoorAqi !== 'number' || !Number.isFinite(outdoorAqi) || outdoorAqi < 0)) {
    hadInvalidInput = true;
    outdoorAqi = null;
  }

  return {
    sanitized: {
      ...input,
      roomSizeSqFt,
      occupants,
      outdoorAqi,
    },
    hadInvalidInput,
  };
}

export function calculateIndoorRecommendation(
  rawInput: IndoorLabCalculationInput,
  language: SupportedLanguage = 'en'
): IndoorLabCalculationResult {
  const { sanitized: input, hadInvalidInput } = sanitizeIndoorInput(rawInput);
  const areaSqM = input.roomSizeSqFt * 0.0929;
  const ceilingHeightM = 2.8;
  const roomVolumeM3 = areaSqM * ceilingHeightM;
  const targetAch = input.outdoorAqi !== null && input.outdoorAqi > 200 ? 5 : 4;
  const occupancyFactor = input.occupants > 2 ? 1 + (input.occupants - 2) * 0.08 : 1;
  const recommendedCadrM3h = Math.max(10, Math.round(roomVolumeM3 * targetAch * occupancyFactor));
  const recommendedCadrCfm = Math.max(6, Math.round(recommendedCadrM3h / 1.699));
  const inputWarning = hadInvalidInput
    ? language === 'hi'
      ? `अमान्य कमरे का आकार या संख्या सुरक्षित सीमा (${INDOOR_ROOM_MIN_SQFT}–${INDOOR_ROOM_MAX_SQFT} sq ft, ${INDOOR_OCCUPANTS_MIN}–${INDOOR_OCCUPANTS_MAX} लोग) में समायोजित की गई है।`
      : `Out-of-range or invalid room inputs were clamped to safe bounds (${INDOOR_ROOM_MIN_SQFT}–${INDOOR_ROOM_MAX_SQFT} sq ft, ${INDOOR_OCCUPANTS_MIN}–${INDOOR_OCCUPANTS_MAX} occupants).`
    : undefined;

  if (language === 'hi') {
    let priorityStrategy = '';
    if (input.filtrationSetup === 'none') {
      if (input.budget === 'zero-low') {
        priorityStrategy =
          'पहले स्रोत नियंत्रण (अगरबत्ती/धुआं बंद, रसोई एग्जॉस्ट), गीले पोछे और स्मॉग के चरम घंटों में खिड़की की दरारें बंद करने पर ध्यान दें।';
      } else {
        priorityStrategy = `इस कमरे के आयतन के लिए कम से कम ${recommendedCadrM3h} m³/h (${recommendedCadrCfm} CFM) CADR वाला True HEPA (H13) प्यूरीफायर अनुशंसित है।`;
      }
    } else if (input.filtrationSetup === 'basic-fan') {
      priorityStrategy =
        'आयोनाइज़र या ओज़ोन वाले उपकरणों से बचें। प्रति घंटे 4–5 एयर एक्सचेंज के आकार का मैकेनिकल True HEPA H13 फ़िल्टर अपनाएं।';
    } else {
      priorityStrategy = `सुनिश्चित करें कि आपका प्यूरीफायर मीडियम/ऑटो मोड पर लगभग ${recommendedCadrM3h} m³/h CADR दे, हर 2 सप्ताह में प्री-फ़िल्टर साफ़ करें और स्मॉग पीक के समय दरवाजे बंद रखें।`;
    }

    const ventilationDirective = input.ventilationSafe
      ? 'बाहरी हवा अभी सुरक्षित सीमा में है—घर के अंदर की CO2 और खाना पकाने की गंध निकालने के लिए 15–20 मिनट का छोटा क्रॉस-वेंटिलेशन करें।'
      : 'बाहरी हवा अभी खराब/उच्च स्तर पर है। बाहरी खिड़कियां बंद रखें, खाना पकाते समय संक्षेप में एग्जॉस्ट चलाएं और इनडोर फ़िल्ट्रेशन पर निर्भर रहें।';

    const actionSteps: string[] = [
      `कमरे का अनुमानित आयतन: ~${Math.round(roomVolumeM3)} m³ (2.8 मीटर छत मानते हुए), लक्ष्य ${targetAch} एयर एक्सचेंज/घंटा।`,
      'सुबह या देर रात के स्मॉग के बजाय दोपहर में कम प्रदूषण वाली खिड़की के दौरान संक्षिप्त हवादार समय चुनकर इनडोर CO2 संतुलित रखें।',
      'ओज़ोन जनरेटर या UV-C आयोनाइज़र का उपयोग न करें, क्योंकि ये घर के अंदर हानिकारक द्वितीयक प्रदूषक बना सकते हैं।',
    ];

    if (input.budget === 'zero-low') {
      actionSteps.push(
        'शून्य-लागत प्रभाव: प्रतिदिन सतहों को गीले कपड़े से पोंछें, खिड़कियों की दरारें कपड़े/फोम से बंद करें और घर के अंदर अगरबत्ती या मोमबत्ती बंद रखें।'
      );
    } else {
      actionSteps.push(
        `खरीद जांच: स्पष्ट ≥ ${recommendedCadrM3h} m³/h CADR रेटिंग और किफायती True HEPA H13 + एक्टिवेटेड कार्बन रिप्लेसमेंट फ़िल्टर की उपलब्धता देखें।`
      );
    }

    return {
      recommendedCadrM3h,
      recommendedCadrCfm,
      targetAch,
      priorityStrategy,
      ventilationDirective,
      actionSteps,
      inputWarning,
    };
  }

  let priorityStrategy = '';
  if (input.filtrationSetup === 'none') {
    if (input.budget === 'zero-low') {
      priorityStrategy =
        'Focus first on source elimination (zero incense/smoke, kitchen exhaust), wet mopping, and window draft sealing during peak smog hours.';
    } else {
      priorityStrategy = `A True HEPA (H13) purifier rated for at least ${recommendedCadrM3h} m³/h (${recommendedCadrCfm} CFM) CADR is recommended for this room volume.`;
    }
  } else if (input.filtrationSetup === 'basic-fan') {
    priorityStrategy =
      'Avoid ionizers or ozone-producing units. Upgrade to a mechanical True HEPA H13 filter sized for 4–5 air changes per hour, or pair a high-MERV filter box with sealed gaps.';
  } else {
    priorityStrategy = `Verify your purifier delivers ~${recommendedCadrM3h} m³/h CADR on medium/auto mode, vacuum the pre-filter every 2 weeks, and keep doors closed during smog peaks.`;
  }

  const ventilationDirective = input.ventilationSafe
    ? 'Outdoor air is currently within a safer range for short cross-ventilation (15–20 min) to flush indoor CO2 and cooking buildup.'
    : 'Outdoor air is currently elevated/poor. Keep exterior windows closed, use kitchen/bath exhaust briefly during cooking, and rely on indoor filtration.';

  const actionSteps: string[] = [
    `Room volume estimate: ~${Math.round(roomVolumeM3)} m³ (assuming 2.8 m ceiling) with ${targetAch} air changes/hour target.`,
    'Keep indoor CO2 comfortable by briefly airing out during midday lower-pollution windows rather than early morning/late night winter inversions.',
    'Do not use ozone generators or UV-C ionizers, which can generate irritating secondary indoor pollutants.',
  ];

  if (input.budget === 'zero-low') {
    actionSteps.push(
      'Zero-cost impact: wet-wipe surfaces daily, seal window gaps with folded cloth/foam strips, and pause all indoor incense or candles.'
    );
  } else {
    actionSteps.push(
      `Buying check: look for an explicit CADR rating ≥ ${recommendedCadrM3h} m³/h and affordable replacement True HEPA H13 + activated carbon filter packs.`
    );
  }

  return {
    recommendedCadrM3h,
    recommendedCadrCfm,
    targetAch,
    priorityStrategy,
    ventilationDirective,
    actionSteps,
    inputWarning,
  };
}
