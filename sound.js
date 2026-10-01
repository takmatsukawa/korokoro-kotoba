// WebAudio で鳴らす効果音（音源ファイルなし）
export class Sound {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.stampCount = 0;
  }
  resume() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }
  tone(freq, dur, { type = 'sine', vol = 0.3, at = 0, slide = 0 } = {}) {
    const t = this.ctx.currentTime + at;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }
  noise(dur, { vol = 0.2, freq = 1200, q = 1, at = 0, type = 'bandpass' } = {}) {
    const t = this.ctx.currentTime + at;
    const len = Math.ceil(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    src.connect(f).connect(g).connect(this.master);
    src.start(t);
  }
  play(name) {
    if (this.muted || !this.ctx) return;
    const pent = [523, 587, 659, 784, 880, 1047, 1175, 1319];
    switch (name) {
      case 'roll':
        this.noise(0.07, { vol: 0.35, freq: 900, q: 2 });
        this.tone(180 + Math.random() * 40, 0.08, { type: 'triangle', vol: 0.25, slide: 0.6, at: 0.12 });
        break;
      case 'slide':
        this.noise(0.35, { vol: 0.15, freq: 4000, q: 0.8, type: 'highpass' });
        this.tone(1400, 0.3, { vol: 0.05, slide: 1.5 });
        break;
      case 'turn':
        this.tone(300, 0.3, { type: 'sawtooth', vol: 0.08, slide: 2.2 });
        this.tone(600, 0.2, { vol: 0.12, slide: 1.6, at: 0.1 });
        break;
      case 'mark':
        this.tone(988, 0.12, { type: 'square', vol: 0.07 });
        this.tone(1319, 0.2, { type: 'square', vol: 0.07, at: 0.08 });
        break;
      case 'stamp': {
        const k = this.stampCount++ % 4;
        this.noise(0.08, { vol: 0.4, freq: 300, q: 1 });
        this.tone(pent[k + 2], 0.25, { vol: 0.25, at: 0.02 });
        this.tone(pent[k + 4], 0.35, { vol: 0.2, at: 0.1 });
        break;
      }
      case 'miss':
        this.tone(220, 0.15, { type: 'triangle', vol: 0.2, slide: 0.8 });
        break;
      case 'bump':
        this.tone(110, 0.12, { type: 'sine', vol: 0.4, slide: 0.5 });
        this.noise(0.05, { vol: 0.2, freq: 400 });
        break;
      case 'gateBlock':
        this.tone(160, 0.14, { type: 'square', vol: 0.1 });
        this.tone(150, 0.2, { type: 'square', vol: 0.1, at: 0.16 });
        break;
      case 'crumble':
        this.noise(0.4, { vol: 0.3, freq: 250, q: 0.7, at: 0.05 });
        this.tone(140, 0.4, { type: 'triangle', vol: 0.15, slide: 0.4, at: 0.05 });
        break;
      case 'seal':
        this.tone(330, 0.12, { type: 'square', vol: 0.06, slide: 1.5 });
        this.noise(0.06, { vol: 0.25, freq: 600, at: 0.1 });
        break;
      case 'undo':
        this.tone(660, 0.08, { type: 'triangle', vol: 0.15, slide: 0.7 });
        break;
      case 'win':
        [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.25, { type: 'triangle', vol: 0.22, at: i * 0.09 }));
        this.tone(1568, 0.6, { vol: 0.15, at: 0.66 });
        break;
    }
  }
  // クリア時にことばを読み上げる（対応ブラウザのみ）
  speak(word) {
    if (this.muted || !('speechSynthesis' in window)) return;
    try {
      const u = new SpeechSynthesisUtterance(word);
      u.lang = 'ja-JP';
      u.rate = 0.9;
      u.pitch = 1.3;
      setTimeout(() => speechSynthesis.speak(u), 700);
    } catch {}
  }
}
