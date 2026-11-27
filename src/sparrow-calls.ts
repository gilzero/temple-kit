// @file: sparrow-calls.ts
// @desc: time perched sparrow contact calls
const phrases = [
  { at: 0, bird: 0, clip: 0 },
  { at: 2.15, bird: 2, clip: 1 },
  { at: 14.9, bird: 1, clip: 2 },
  { at: 30.5, bird: 0, clip: 1 },
  { at: 33.35, bird: 3, clip: 0 },
  { at: 49.6, bird: 2, clip: 2 },
] as const;
const clipSeconds = 0.8;

function opening(t: number, onset: number, strength: number) {
  const attack = Math.max(0, Math.min(1, (t - onset) / 0.045));
  const release = Math.max(0, Math.min(1, (onset + 0.21 - t) / 0.13));
  return strength * attack * release;
}

export function sparrowPhrase(secondsAfterLanding: number, seatPhase: number) {
  const age = secondsAfterLanding - 2.8 - (seatPhase % 2.9);
  if (age < 0) return;
  const phase = age % (67.3 + (seatPhase % 7.1));
  for (const phrase of phrases) {
    const t = phase - phrase.at;
    if (t < 0) break;
    if (t >= clipSeconds) continue;
    const lead = phrase.clip === 0;
    const gape = Math.max(
      opening(t, 0.143, lead ? 0.85 : 0.63),
      opening(t, lead ? 0.268 : 0.451, 1),
    );
    return {
      bird: phrase.bird,
      gape,
      posture: Math.min(1, t / 0.14, (clipSeconds - t) / 0.18),
      offset: phrase.clip * clipSeconds + t,
      end: (phrase.clip + 1) * clipSeconds,
    };
  }
  return undefined;
}
