import { describe, expect, it, vi } from 'vitest';
import { generateDailyRoutine, streamAssistantChat } from '../geminiService';
import type { UserProfile } from '../../types';

const baseProfile: UserProfile = {
  onboardingCompleted: true,
  displayName: 'Test Family',
  preferredScale: 'auto',
  location: {
    name: 'New Delhi, Delhi',
    city: 'New Delhi',
    region: 'Delhi',
    country: 'India',
    countryCode: 'IN',
    latitude: 28.61,
    longitude: 77.2,
    source: 'manual',
    updatedAt: '2026-11-25T09:00:00.000Z',
  },
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
};

function makeSseResponse(events: Array<Record<string, unknown>>): Response {
  const encoder = new TextEncoder();
  const payload = events.map((ev) => `data: ${JSON.stringify(ev)}\n\n`).join('');
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(payload));
      controller.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
  });
}

describe('geminiService (Sections A & D)', () => {
  it('generates and validates structured daily routines and rejects malformed responses', async () => {
    const validPlan = {
      generatedAt: '2026-11-25T10:00:00.000Z',
      locationName: 'New Delhi, Delhi',
      aqiSummary: 'Poor PM2.5 today — keep morning school commute brief and wear N95 masks.',
      safetyNote: 'Reduces exposure where practical; does not eliminate all risk.',
      recommendations: [
        {
          id: 'r1',
          timeBlock: 'morning',
          whatToDo: 'Shift outdoor walk indoors',
          whyItMatters: 'Avoids winter inversion peaks',
          howToDoIt: 'Do 20 min mobility indoors',
          estimatedImpact: 'High exposure drop',
          cost: 'Free',
          difficulty: 'Easy',
          whoBenefits: 'Children and elderly',
        },
      ],
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(validPlan), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const plan = await generateDailyRoutine({
      profile: baseProfile,
      airQuality: null,
      activeScale: 'IN_NAQI',
      language: 'en',
    });
    expect(plan.recommendations).toHaveLength(1);
    expect(plan.aqiSummary).toContain('N95');

    // Invalid payload missing recommendations array
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ aqiSummary: 'Partial only' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    await expect(
      generateDailyRoutine({
        profile: baseProfile,
        airQuality: null,
        activeScale: 'IN_NAQI',
        language: 'en',
      })
    ).rejects.toThrow('Failed to generate personalized daily routine.');

    // Network failure
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await expect(
      generateDailyRoutine({
        profile: baseProfile,
        airQuality: null,
        activeScale: 'IN_NAQI',
        language: 'en',
      })
    ).rejects.toThrow('AI connection unavailable');
  });

  it('streams assistant SSE chunks with conversation history and maps errors accurately', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(makeSseResponse([{ text: 'Hello! ' }, { text: 'Wear an N95 mask.' }, { done: true }]));

    const chunks: string[] = [];
    await streamAssistantChat({
      messages: [
        { role: 'user', content: 'Hi' },
        { role: 'assistant', content: 'Hello!' },
        { role: 'user', content: 'Should I walk outside?' },
      ],
      profile: baseProfile,
      airQuality: null,
      activeScale: 'IN_NAQI',
      language: 'en',
      onChunk: (c) => chunks.push(c),
    });

    expect(chunks.join('')).toBe('Hello! Wear an N95 mask.');
    const bodySent = JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body));
    expect(bodySent.messages).toHaveLength(3);

    // Rate limit 429 JSON error
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: 'AI request limit reached temporarily. Please wait a moment and try again.',
        }),
        { status: 429, headers: { 'Content-Type': 'application/json' } }
      )
    );
    await expect(
      streamAssistantChat({
        messages: [{ role: 'user', content: 'Check Delhi' }],
        profile: baseProfile,
        airQuality: null,
        activeScale: 'IN_NAQI',
        language: 'en',
        onChunk: () => {},
      })
    ).rejects.toThrow(/limit reached/i);

    // SSE error event mid-stream
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      makeSseResponse([{ error: 'AI connection unavailable. Please check your API configuration or try again.' }])
    );
    await expect(
      streamAssistantChat({
        messages: [{ role: 'user', content: 'Check Mumbai' }],
        profile: baseProfile,
        airQuality: null,
        activeScale: 'IN_NAQI',
        language: 'en',
        onChunk: () => {},
      })
    ).rejects.toThrow('AI connection unavailable');

    // Empty stream rejected cleanly
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(makeSseResponse([{ done: true }]));
    await expect(
      streamAssistantChat({
        messages: [{ role: 'user', content: 'Empty?' }],
        profile: baseProfile,
        airQuality: null,
        activeScale: 'IN_NAQI',
        language: 'en',
        onChunk: () => {},
      })
    ).rejects.toThrow(/did not return a response/i);
  });
});
