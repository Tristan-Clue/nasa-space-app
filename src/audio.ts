// Tiny WebAudio beeps, no audio files needed.
let ctx: AudioContext | null = null;
export const audio = { muted: false };

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'triangle', vol = 0.12) {
  if (audio.muted) return;
  try {
    ctx ??= new AudioContext();
    const t0 = ctx.currentTime + start;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(ctx.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  } catch { /* audio is optional */ }
}

export const sfx = {
  click: () => tone(660, 0, 0.08),
  launch: () => { tone(392, 0, 0.12); tone(523, 0.12, 0.12); tone(784, 0.24, 0.2); },
  alert: () => { tone(880, 0, 0.15, 'square', 0.08); tone(660, 0.2, 0.15, 'square', 0.08); tone(880, 0.4, 0.15, 'square', 0.08); },
  good: () => { tone(523, 0, 0.12); tone(659, 0.12, 0.12); tone(784, 0.24, 0.25); },
  win: () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.15, 0.3)); },
  lose: () => { tone(330, 0, 0.25); tone(262, 0.25, 0.25); tone(196, 0.5, 0.4); },
};
