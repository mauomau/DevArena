"use client";

/**
 * Synthétiseur d'effets sonores léger basé sur la Web Audio API.
 * Aucun fichier audio externe requis ; silencieux côté serveur / tests.
 */

const MUTE_STORAGE_KEY = "devarena:sound-muted";

let audioCtx: AudioContext | null = null;
let cachedMuted: boolean | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) return null;

  if (!audioCtx) {
    audioCtx = new Ctor();
  }
  if (audioCtx.state === "suspended") {
    void audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function isSoundMuted(): boolean {
  if (typeof window === "undefined") return true;
  if (cachedMuted !== null) return cachedMuted;
  try {
    cachedMuted = window.localStorage.getItem(MUTE_STORAGE_KEY) === "1";
  } catch {
    cachedMuted = false;
  }
  return cachedMuted;
}

export function setSoundMuted(muted: boolean): void {
  cachedMuted = muted;
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(MUTE_STORAGE_KEY, muted ? "1" : "0");
  } catch {
    // Stockage local indisponible (navigation privée stricte)
  }
}

function playTone(
  frequency: number,
  durationSec: number,
  options: {
    delaySec?: number;
    type?: OscillatorType;
    volume?: number;
    endFrequency?: number;
  } = {},
): void {
  if (isSoundMuted()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const {
    delaySec = 0,
    type = "triangle",
    volume = 0.08,
    endFrequency,
  } = options;

  const startTime = ctx.currentTime + delaySec;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(frequency, startTime);
  if (endFrequency !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(
      Math.max(20, endFrequency),
      startTime + durationSec,
    );
  }

  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.exponentialRampToValueAtTime(volume, startTime + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + durationSec);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(startTime);
  osc.stop(startTime + durationSec + 0.02);
}

export const gameSounds = {
  start(): void {
    playTone(440, 0.1, { delaySec: 0, volume: 0.07 });
    playTone(587.33, 0.14, { delaySec: 0.08, volume: 0.08 });
  },

  hint(): void {
    playTone(659.25, 0.12, { type: "sine", volume: 0.06 });
  },

  success(): void {
    playTone(523.25, 0.1, { delaySec: 0, volume: 0.08 });
    playTone(659.25, 0.1, { delaySec: 0.08, volume: 0.08 });
    playTone(783.99, 0.18, { delaySec: 0.16, volume: 0.09 });
  },

  error(): void {
    playTone(220, 0.12, { delaySec: 0, type: "sawtooth", volume: 0.045 });
    playTone(175, 0.16, { delaySec: 0.1, type: "sawtooth", volume: 0.045 });
  },

  skip(): void {
    playTone(392, 0.09, { delaySec: 0, type: "sine", volume: 0.05 });
    playTone(311.13, 0.12, { delaySec: 0.08, type: "sine", volume: 0.05 });
  },

  tick(): void {
    playTone(880, 0.045, { type: "sine", volume: 0.035 });
  },

  victory(): void {
    playTone(523.25, 0.11, { delaySec: 0, volume: 0.08 });
    playTone(659.25, 0.11, { delaySec: 0.09, volume: 0.08 });
    playTone(783.99, 0.11, { delaySec: 0.18, volume: 0.08 });
    playTone(1046.5, 0.28, { delaySec: 0.27, volume: 0.1 });
  },
};
