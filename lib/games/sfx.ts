// Tiny synthesised sounds: no audio files to download.
const STORE = "play.sound";

type Note = [frequency: number, startS: number, lengthS: number];
const SOUNDS: Record<string, { wave: OscillatorType; volume: number; notes: Note[] }> = {
  tap: { wave: "triangle", volume: 0.05, notes: [[520, 0, 0.05]] },
  step: { wave: "triangle", volume: 0.05, notes: [[660, 0, 0.04]] },
  good: { wave: "triangle", volume: 0.07, notes: [[660, 0, 0.08], [880, 0.07, 0.1]] },
  bad: { wave: "sawtooth", volume: 0.035, notes: [[180, 0, 0.14]] },
  pour: { wave: "sine", volume: 0.06, notes: [[300, 0, 0.1], [420, 0.08, 0.1], [560, 0.16, 0.12]] },
  dice: { wave: "square", volume: 0.02, notes: [[240, 0, 0.03], [320, 0.06, 0.03], [260, 0.12, 0.03], [360, 0.18, 0.03]] },
  capture: { wave: "square", volume: 0.035, notes: [[440, 0, 0.07], [220, 0.07, 0.14]] },
  win: { wave: "triangle", volume: 0.08, notes: [[523, 0, 0.12], [659, 0.11, 0.12], [784, 0.22, 0.12], [1047, 0.33, 0.26]] },
};

let context: AudioContext | null = null;

export function soundOn(): boolean {
  try {
    return localStorage.getItem(STORE) !== "off";
  } catch {
    return true;
  }
}

export function setSound(on: boolean): void {
  try {
    localStorage.setItem(STORE, on ? "on" : "off");
  } catch {
    // Blocked storage only means the choice isn't remembered.
  }
}

const HAPTIC_STORE = "play.haptics";
// A short buzz to go with each sound, so every game gets touch feedback on phones that support it.
const HAPTICS: Record<keyof typeof SOUNDS, number | number[]> = {
  tap: 8, step: 6, good: 14, bad: [20, 40, 20], pour: 12, dice: [6, 40, 6, 40, 6], capture: [30, 30, 60], win: [20, 60, 40],
};

export const canVibrate = () => typeof navigator !== "undefined" && typeof navigator.vibrate === "function";

export function hapticsOn(): boolean {
  try {
    return localStorage.getItem(HAPTIC_STORE) !== "off";
  } catch {
    return true;
  }
}

export function setHaptics(on: boolean): void {
  try {
    localStorage.setItem(HAPTIC_STORE, on ? "on" : "off");
  } catch {
    // Blocked storage only means the choice isn't remembered.
  }
}

export function sfx(name: keyof typeof SOUNDS): void {
  if (typeof window === "undefined") return;
  buzz(HAPTICS[name] ?? 8);
  if (!soundOn()) return;
  context ??= new AudioContext();
  const sound = SOUNDS[name]!;
  const now = context.currentTime;
  for (const [frequency, start, length] of sound.notes) {
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = sound.wave;
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(sound.volume, now + start);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + start + length);
    osc.connect(gain).connect(context.destination);
    osc.start(now + start);
    osc.stop(now + start + length);
  }
}

export function buzz(pattern: number | number[]): void {
  if (canVibrate() && hapticsOn()) navigator.vibrate(pattern);
}
