// Sound, all synthesized with WebAudio: an engine hum that follows the car's speed,
// a two-tone police siren, and short blips and thuds for pickups, crashes and jobs.
// No audio files, no network — and everything is a no-op until the first user gesture
// creates the context, so headless screenshot runs stay silent and safe.

export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineOsc2 = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenHigh = false;
  let sirenTimer = 0;
  let muted = false;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return true;
    }
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return false;
      ctx = new AudioContext();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 50;
      engineOsc2 = ctx.createOscillator();
      engineOsc2.type = 'square';
      engineOsc2.frequency.value = 25;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineGain);
      engineOsc2.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      engineOsc2.start();
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'triangle';
      sirenOsc.frequency.value = 720;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      return true;
    } catch {
      ctx = null;
      return false;
    }
  }

  function blip(freq, dur, type, vol) {
    if (!ctx || muted) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type || 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(vol || 0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      osc.connect(gain);
      gain.connect(master);
      osc.start();
      osc.stop(ctx.currentTime + dur);
    } catch {
      // A blip is never worth crashing the game over.
    }
  }

  function noise(dur, vol, low) {
    if (!ctx || muted) return;
    try {
      const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
      const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = low || 900;
      const gain = ctx.createGain();
      gain.gain.value = vol || 0.3;
      src.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      src.start();
    } catch {
      // See blip.
    }
  }

  return {
    ensure,
    setMuted(value) {
      muted = value;
      if (master) master.gain.value = value ? 0 : 0.5;
    },
    isMuted() {
      return muted;
    },
    /** Call every frame with the car's speed (0..1) and whether the engine runs. */
    engine(speed01, running) {
      if (!ctx || muted) return;
      const target = running ? 0.05 + speed01 * 0.09 : 0;
      engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.08);
      engineOsc.frequency.setTargetAtTime(48 + speed01 * 130, ctx.currentTime, 0.08);
      engineOsc2.frequency.setTargetAtTime(24 + speed01 * 65, ctx.currentTime, 0.08);
    },
    /** Call every frame; the siren wails while the police are after the player. */
    siren(on, dt) {
      if (!ctx) return;
      sirenGain.gain.setTargetAtTime(on && !muted ? 0.045 : 0, ctx.currentTime, 0.1);
      if (!on) return;
      sirenTimer -= dt;
      if (sirenTimer <= 0) {
        sirenTimer = 0.42;
        sirenHigh = !sirenHigh;
        sirenOsc.frequency.setTargetAtTime(sirenHigh ? 950 : 720, ctx.currentTime, 0.05);
      }
    },
    pickup() { blip(880, 0.12, 'sine', 0.3); setTimeout(() => blip(1320, 0.16, 'sine', 0.3), 70); },
    coin() { blip(1046, 0.1, 'triangle', 0.28); },
    crash(strength) { noise(0.18, Math.min(0.5, 0.15 + strength * 0.4), 700); },
    punch() { noise(0.08, 0.25, 1200); },
    honk() { blip(370, 0.18, 'square', 0.12); setTimeout(() => blip(370, 0.18, 'square', 0.12), 200); },
    jingle() {
      [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => blip(f, 0.22, 'triangle', 0.3), i * 110));
    },
    fail() { [392, 330, 262].forEach((f, i) => setTimeout(() => blip(f, 0.25, 'sawtooth', 0.2), i * 140)); },
    click() { blip(660, 0.06, 'square', 0.15); },
  };
}
