/**
 * Sound effects, synthesised at runtime with the Web Audio API.
 *
 * Deliberately NO audio files. The build is a single self-contained HTML file,
 * and even a short encoded clip costs tens of kilobytes each; a few oscillators
 * and gain envelopes cost nothing and let the pitch track the tier, so a big
 * merge genuinely sounds bigger than a small one.
 *
 * Everything is wrapped so a missing or blocked AudioContext can never throw
 * into the game loop — silence is an acceptable outcome, a crash is not.
 * Browsers also refuse to start audio before a user gesture, so the context is
 * created lazily on the first sound and resumed if it was suspended.
 */
class SfxService {
  private ctx: AudioContext | null = null;
  private failed = false;
  /** Master switch, so a mute toggle can be added without touching call sites. */
  enabled = true;

  private context(): AudioContext | null {
    if (this.failed) return null;
    if (this.ctx) {
      // Autoplay policy parks the context until a gesture; nudge it each time.
      if (this.ctx.state === "suspended") void this.ctx.resume();
      return this.ctx;
    }
    try {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!Ctor) {
        this.failed = true;
        return null;
      }
      this.ctx = new Ctor();
      return this.ctx;
    } catch {
      this.failed = true;
      return null;
    }
  }

  /**
   * One shaped tone. `slide` bends the pitch over the note, which is what makes
   * a merge read as a "pop" rather than a beep.
   */
  private tone(opts: {
    freq: number;
    slideTo?: number;
    dur: number;
    type?: OscillatorType;
    gain?: number;
    delay?: number;
  }): void {
    if (!this.enabled) return;
    const ctx = this.context();
    if (!ctx) return;
    try {
      const t0 = ctx.currentTime + (opts.delay ?? 0);
      const osc = ctx.createOscillator();
      const amp = ctx.createGain();
      osc.type = opts.type ?? "sine";
      osc.frequency.setValueAtTime(opts.freq, t0);
      if (opts.slideTo !== undefined) {
        osc.frequency.exponentialRampToValueAtTime(
          Math.max(1, opts.slideTo),
          t0 + opts.dur
        );
      }
      const peak = opts.gain ?? 0.12;
      // A tiny attack avoids the click a hard start makes.
      amp.gain.setValueAtTime(0.0001, t0);
      amp.gain.exponentialRampToValueAtTime(peak, t0 + 0.012);
      amp.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.dur);
      osc.connect(amp).connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + opts.dur + 0.02);
    } catch {
      /* a failed note must never interrupt play */
    }
  }

  /**
   * Two foods became one. Pitch falls as the tier climbs, so the ladder is
   * audible: a tier-2 merge chirps, a tier-8 merge thuds.
   */
  merge(tier: number): void {
    const base = 880 * Math.pow(0.82, Math.max(0, tier - 2));
    this.tone({ freq: base, slideTo: base * 1.5, dur: 0.13, type: "triangle", gain: 0.1 });
    this.tone({ freq: base * 2, slideTo: base * 3, dur: 0.09, type: "sine", gain: 0.045, delay: 0.01 });
  }

  /** The monster accepted a craving. */
  feed(): void {
    this.tone({ freq: 523, slideTo: 784, dur: 0.16, type: "triangle", gain: 0.11 });
    this.tone({ freq: 784, slideTo: 1046, dur: 0.18, type: "sine", gain: 0.06, delay: 0.07 });
  }

  /** A milestone — a little rising arpeggio, the one genuinely happy sound. */
  grow(): void {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) =>
      this.tone({ freq: f, dur: 0.3, type: "triangle", gain: 0.1, delay: i * 0.075 })
    );
  }

  /** The bin was emptied. */
  clear(): void {
    const notes = [659.25, 830.61, 1046.5];
    notes.forEach((f, i) =>
      this.tone({ freq: f, dur: 0.26, type: "sine", gain: 0.09, delay: i * 0.06 })
    );
  }

  /** Refused food — short and flat, not punishing. */
  refuse(): void {
    this.tone({ freq: 220, slideTo: 165, dur: 0.16, type: "sawtooth", gain: 0.05 });
  }
}

export const Sfx = new SfxService();
