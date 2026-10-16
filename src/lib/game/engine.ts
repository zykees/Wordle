export type TileState = 'correct' | 'present' | 'absent' | 'empty' | 'tbd';

export interface EvaluatedRow {
  word: string;
  states: TileState[];
}

/**
 * Authentic Wordle duplicate letter algorithm.
 * First pass identifies greens and deducts from target letter counts.
 * Second pass identifies yellows only up to remaining letter counts.
 */
export function evaluateGuess(targetWord: string, guessWord: string): TileState[] {
  const target = targetWord.trim().toUpperCase();
  const guess = guessWord.trim().toUpperCase();
  const len = target.length;
  const result: TileState[] = new Array(len).fill('absent');

  // Count available letters in target
  const targetCounts: Record<string, number> = {};
  for (let i = 0; i < len; i++) {
    const char = target[i];
    targetCounts[char] = (targetCounts[char] || 0) + 1;
  }

  // Pass 1: Mark Greens ('correct')
  for (let i = 0; i < len; i++) {
    if (guess[i] === target[i]) {
      result[i] = 'correct';
      targetCounts[guess[i]]--;
    }
  }

  // Pass 2: Mark Yellows ('present') and Grays ('absent')
  for (let i = 0; i < len; i++) {
    if (result[i] !== 'correct') {
      const char = guess[i];
      if (targetCounts[char] && targetCounts[char] > 0) {
        result[i] = 'present';
        targetCounts[char]--;
      } else {
        result[i] = 'absent';
      }
    }
  }

  return result;
}

/**
 * Compute key state priority: correct > present > absent
 */
export function getKeyStates(rows: EvaluatedRow[]): Record<string, TileState> {
  const keyStates: Record<string, TileState> = {};

  const priority: Record<TileState, number> = {
    correct: 3,
    present: 2,
    absent: 1,
    tbd: 0,
    empty: 0,
  };

  for (const row of rows) {
    for (let i = 0; i < row.word.length; i++) {
      const char = row.word[i].toUpperCase();
      const state = row.states[i];
      const currentPriority = keyStates[char] ? priority[keyStates[char]] : 0;
      const newPriority = priority[state] || 0;

      if (newPriority > currentPriority) {
        keyStates[char] = state;
      }
    }
  }

  return keyStates;
}

/**
 * Web Audio API Sound Synthesizer (Works in all modern browsers without loading external MP3s)
 */
class SoundEngine {
  private ctx: AudioContext | null = null;
  public enabled: boolean = true;

  private initCtx() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  playKey() {
    if (!this.enabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(320, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(140, this.ctx.currentTime + 0.05);

      gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.05);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.05);
    } catch {
      // AudioContext policy handled gracefully
    }
  }

  playFlip(index: number = 0) {
    if (!this.enabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      const baseFreq = 220 + index * 40;
      osc.frequency.setValueAtTime(baseFreq, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.4, this.ctx.currentTime + 0.08);

      gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.08);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.08);
    } catch {
      // Ignore
    }
  }

  playShake() {
    if (!this.enabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(120, this.ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(80, this.ctx.currentTime + 0.15);

      gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.15);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.15);
    } catch {
      // Ignore
    }
  }

  playWin() {
    if (!this.enabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const notes = [261.63, 329.63, 392.00, 523.25, 659.25]; // C4, E4, G4, C5, E5
      notes.forEach((freq, idx) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        const startTime = this.ctx.currentTime + idx * 0.1;
        osc.frequency.setValueAtTime(freq, startTime);

        gain.gain.setValueAtTime(0.18, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.35);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(startTime);
        osc.stop(startTime + 0.35);
      });
    } catch {
      // Ignore
    }
  }

  playLose() {
    if (!this.enabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const notes = [320, 290, 260, 220];
      notes.forEach((freq, idx) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        const startTime = this.ctx.currentTime + idx * 0.12;
        osc.frequency.setValueAtTime(freq, startTime);

        gain.gain.setValueAtTime(0.12, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.25);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(startTime);
        osc.stop(startTime + 0.25);
      });
    } catch {
      // Ignore
    }
  }
}

export const soundManager = new SoundEngine();
