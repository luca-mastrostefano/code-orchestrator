/**
 * Plays a short "done" chime via the Web Audio API. No audio assets required.
 * Two brief tones (A5 → C#6) with a gentle envelope — noticeable but not harsh.
 *
 * Silently returns if the browser doesn't expose AudioContext or the call
 * fails (e.g. autoplay policy blocked playback before any user interaction).
 */
export function playDoneChime(): void {
  try {
    type Ctor = typeof AudioContext;
    const Ctx: Ctor | undefined =
      (window.AudioContext as Ctor | undefined) ??
      ((window as unknown as { webkitAudioContext?: Ctor }).webkitAudioContext);
    if (!Ctx) return;

    const ctx = new Ctx();
    const now = ctx.currentTime;

    const tone = (freq: number, startAt: number, durationSec: number, peak: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      osc.connect(gain);
      gain.connect(ctx.destination);
      gain.gain.setValueAtTime(0, now + startAt);
      gain.gain.linearRampToValueAtTime(peak, now + startAt + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + startAt + durationSec);
      osc.start(now + startAt);
      osc.stop(now + startAt + durationSec + 0.02);
    };

    tone(880, 0, 0.18, 0.18);      // A5
    tone(1108.73, 0.12, 0.22, 0.18); // C#6

    // Let the graph finish, then release the context.
    setTimeout(() => { void ctx.close(); }, 500);
  } catch {
    // ignore — audio isn't critical
  }
}
