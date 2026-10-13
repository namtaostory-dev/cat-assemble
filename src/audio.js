// เสียงทั้งหมดสังเคราะห์ด้วย Web Audio ไม่มีไฟล์เสียง: เอฟเฟกต์สั้นๆ และเพลงชิปทูนวนตามแผนที่
// iOS/Chrome ไม่ยอมเล่นเสียงจนกว่าผู้เล่นจะแตะจอครั้งแรก จึงสร้าง AudioContext ตอนแตะครั้งแรก

let ctx = null, master, sfxBus, musicBus, noiseBuf;
const opts = { sfx: true, music: true, vol: 0.7 };
const lastPlay = {};          // ชื่อเสียง → เวลาที่เล่นล่าสุด (กันเสียงซ้อนรัวเกินไป)

function init() {
  if (ctx) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  // คอมเพรสเซอร์กันเสียงแตกตอนสกิลหลายท่าดังพร้อมกัน
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14; comp.ratio.value = 6;
  master.connect(comp).connect(ctx.destination);
  sfxBus = ctx.createGain(); sfxBus.connect(master);
  musicBus = ctx.createGain(); musicBus.connect(master);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  apply();
}
function apply() {
  if (!ctx) return;
  master.gain.value = opts.vol;
  sfxBus.gain.value = opts.sfx ? 0.55 : 0;
  musicBus.gain.value = opts.music ? 0.22 : 0;
}

export function setSound(o) {
  const wasMusic = opts.music;
  Object.assign(opts, o);
  apply();
  if (!opts.music) stopMusic();
  else if (!wasMusic && ctx && track) startMusic(track, true);
}
// เรียกจากการแตะครั้งแรก (และทุกครั้งที่แตะ เผื่อระบบพักเสียงไว้)
export function unlock() {
  init();
  if (ctx && ctx.state !== 'running') ctx.resume();
  if (ctx && track && !music) startMusic(track, true);
}
// พับแอปแล้วหยุดเสียง เปิดกลับมาเล่นต่อ
export function pause(hidden) {
  if (!ctx) return;
  if (hidden) ctx.suspend(); else ctx.resume();
}

// ---------- ตัวสร้างเสียงพื้นฐาน ----------
// โน้ตหนึ่งตัว: type = รูปคลื่น, f0 → f1 = ความถี่เริ่ม → จบ, dur วินาที
function tone(type, f0, f1, dur, vol = 0.3, at = 0, bus = sfxBus) {
  const t = ctx.currentTime + at;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(bus);
  o.start(t); o.stop(t + dur + 0.02);
}
// เสียงซ่า (ลม ระเบิด ฟัน) กรองด้วย filter แบบ bandpass/lowpass
function noise(dur, vol, filter, f0, f1 = f0, at = 0, q = 1) {
  const t = ctx.currentTime + at;
  const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = noiseBuf;
  f.type = filter; f.Q.value = q;
  f.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(sfxBus);
  s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
}
const N = n => 440 * 2 ** ((n - 69) / 12);   // เลขโน้ต MIDI → ความถี่

// ---------- เอฟเฟกต์ ----------
// gap = ระยะห่างขั้นต่ำ (ms) ของเสียงชนิดเดียวกัน
const SFX = {
  slash:   { gap: 70,  play: () => { noise(0.09, 0.35, 'bandpass', 3200, 900, 0, 1.4); tone('triangle', 900, 500, 0.06, 0.08); } },
  hit:     { gap: 55,  play: () => { tone('square', 220, 110, 0.05, 0.1); noise(0.04, 0.15, 'lowpass', 1800); } },
  crit:    { gap: 90,  play: () => { noise(0.12, 0.4, 'bandpass', 4200, 1200, 0, 2); tone('square', 1400, 700, 0.1, 0.12); tone('triangle', 2100, 1800, 0.12, 0.08, 0.02); } },
  cat:     { gap: 90,  play: () => { tone('sine', 880 + Math.random() * 200, 1400, 0.07, 0.07); } },
  coin:    { gap: 60,  play: () => { tone('square', N(88), N(88), 0.05, 0.06); tone('square', N(93), N(93), 0.12, 0.06, 0.05); } },
  kill:    { gap: 80,  play: () => { noise(0.18, 0.25, 'lowpass', 1600, 300); tone('triangle', 300, 90, 0.16, 0.12); } },
  jump:    { gap: 60,  play: () => { tone('square', 300, 700, 0.12, 0.07); } },
  boss:    { gap: 500, play: () => { [0, 0.18, 0.36].forEach((a, i) => tone('sawtooth', N(45 - i * 2), N(44 - i * 2), 0.3, 0.14, a)); noise(0.8, 0.2, 'lowpass', 400, 100, 0.1); } },
  bossFail:{ gap: 500, play: () => { [N(64), N(60), N(55)].forEach((f, i) => tone('triangle', f, f * 0.97, 0.25, 0.14, i * 0.2)); } },
  stage:   { gap: 400, play: () => { [72, 76, 79, 84].forEach((n, i) => tone('square', N(n), N(n), 0.16, 0.09, i * 0.09)); tone('triangle', N(60), N(60), 0.5, 0.1, 0.27); } },
  levelup: { gap: 400, play: () => { [67, 71, 74, 79, 83, 86].forEach((n, i) => tone('square', N(n), N(n), 0.14, 0.08, i * 0.07)); tone('triangle', N(91), N(91), 0.5, 0.07, 0.42); } },
  click:   { gap: 40,  play: () => { tone('square', 660, 660, 0.03, 0.05); } },
  buy:     { gap: 80,  play: () => { tone('square', N(84), N(84), 0.06, 0.07); tone('square', N(91), N(91), 0.18, 0.07, 0.06); } },
  enhOk:   { gap: 200, play: () => { noise(0.08, 0.3, 'bandpass', 5000, 5000, 0, 3); [76, 80, 83, 88].forEach((n, i) => tone('square', N(n), N(n), 0.14, 0.08, 0.06 + i * 0.07)); } },
  enhFail: { gap: 200, play: () => { noise(0.08, 0.3, 'bandpass', 5000, 5000, 0, 3); tone('triangle', N(57), N(50), 0.4, 0.14, 0.08); } },
  enhBreak:{ gap: 200, play: () => { noise(0.5, 0.45, 'lowpass', 6000, 200); tone('sawtooth', 400, 60, 0.5, 0.12); } },
  gacha:   { gap: 200, play: () => { noise(0.6, 0.15, 'bandpass', 800, 5000, 0, 2); [72, 76, 79].forEach((n, i) => tone('triangle', N(n), N(n), 0.2, 0.08, 0.4 + i * 0.08)); } },
  ssr:     { gap: 300, play: () => { [72, 76, 79, 84, 88, 91, 96].forEach((n, i) => tone('square', N(n), N(n), 0.2, 0.07, i * 0.07)); tone('triangle', N(60), N(60), 1.0, 0.12, 0.5); noise(1.2, 0.08, 'highpass', 6000, 9000, 0.4); } },
  // สกิลตามท่า
  arc:     { gap: 150, play: () => { noise(0.25, 0.4, 'bandpass', 600, 4000, 0, 1.5); } },
  tornado: { gap: 300, play: () => { noise(0.9, 0.3, 'bandpass', 300, 1800, 0, 4); noise(0.9, 0.15, 'bandpass', 1500, 400, 0.1, 6); } },
  dash:    { gap: 200, play: () => { noise(0.3, 0.4, 'highpass', 1200, 6000); tone('sawtooth', 200, 1200, 0.25, 0.08); } },
  giant:   { gap: 400, play: () => { tone('sawtooth', 1200, 200, 0.35, 0.08); noise(0.9, 0.55, 'lowpass', 900, 60, 0.33); tone('sine', 90, 35, 0.8, 0.4, 0.33); } },
  beam:    { gap: 200, play: () => { tone('sine', N(84), N(96), 0.4, 0.1); tone('triangle', N(91), N(91), 0.5, 0.06, 0.05); noise(0.5, 0.12, 'highpass', 5000, 8000); } },
  ring:    { gap: 200, play: () => { [79, 84, 88].forEach((n, i) => tone('sine', N(n), N(n), 0.6, 0.08, i * 0.04)); } },
  bless:   { gap: 400, play: () => { [72, 76, 79, 84].forEach((n, i) => tone('triangle', N(n), N(n), 0.9 - i * 0.1, 0.07, i * 0.1)); } },
  rain:    { gap: 400, play: () => { for (let i = 0; i < 8; i++) tone('sine', N(84 + (i % 4) * 3), N(80), 0.2, 0.06, 0.25 + i * 0.09); } },
  fireball:{ gap: 150, play: () => { noise(0.25, 0.3, 'bandpass', 500, 1500, 0, 1); noise(0.35, 0.4, 'lowpass', 1200, 150, 0.2); } },
  firewall:{ gap: 300, play: () => { noise(1.1, 0.35, 'lowpass', 400, 2500, 0, 1); noise(1.1, 0.15, 'bandpass', 3000, 1000, 0.1, 2); } },
  bombs:   { gap: 400, play: () => { for (let i = 0; i < 4; i++) noise(0.3, 0.4, 'lowpass', 1400, 120, 0.25 + i * 0.12); } },
  meteor:  { gap: 500, play: () => { noise(0.6, 0.3, 'bandpass', 300, 1500, 0, 1); tone('sawtooth', 600, 120, 0.6, 0.06); noise(1.2, 0.6, 'lowpass', 1200, 50, 0.6); tone('sine', 70, 30, 1.0, 0.45, 0.6); } },
};

export function sfx(name) {
  if (!ctx || !opts.sfx || ctx.state !== 'running') return;
  const s = SFX[name];
  if (!s) return;
  const now = performance.now();
  if (now - (lastPlay[name] || 0) < s.gap) return;
  lastPlay[name] = now;
  s.play();
}

// ---------- เพลงชิปทูน ----------
// แต่ละเพลง: tempo, คอร์ดวน (โน้ตราก), สเกลของทำนอง และลายทำนองแบบสุ่มคงที่ (seed) ให้วนซ้ำเหมือนเดิมทุกรอบ
const TRACKS = {
  forest: { bpm: 104, wave: 'square',   chords: [57, 53, 48, 55], scale: [0, 2, 4, 7, 9, 12, 14, 16], seed: 7 },
  beach:  { bpm: 118, wave: 'triangle', chords: [53, 55, 60, 57], scale: [0, 2, 4, 5, 7, 9, 12, 14], seed: 21 },
  arena:  { bpm: 138, wave: 'sawtooth', chords: [57, 57, 53, 55], scale: [0, 2, 3, 7, 8, 12, 14, 15], seed: 11 },
  market: { bpm: 92,  wave: 'square',   chords: [50, 55, 48, 53], scale: [0, 3, 5, 7, 10, 12, 15], seed: 3 },
};
let track = null, music = null;

function rng(seed) { let x = seed; return () => (x = (x * 16807) % 2147483647) / 2147483647; }
function buildPattern(tr) {
  const r = rng(tr.seed), mel = [];
  for (let bar = 0; bar < tr.chords.length; bar++) {
    for (let i = 0; i < 8; i++) {
      // ตัวโน้ตครึ่งหนึ่งเป็นช่องว่าง ทำนองจะไม่แน่นเกินไป
      mel.push(r() < 0.55 ? tr.chords[bar] + 12 + tr.scale[Math.floor(r() * tr.scale.length)] : null);
    }
  }
  return mel;
}

export function startMusic(name, force) {
  if (!TRACKS[name]) return;
  if (track === name && music && !force) return;
  track = name;
  stopMusic();
  if (!ctx || !opts.music) return;
  const tr = TRACKS[name], mel = buildPattern(tr), step = 60 / tr.bpm / 2;
  let i = 0, next = ctx.currentTime + 0.1;
  // ตัวจัดคิว: ล่วงหน้า 0.3 วิ เรียกทุก 100ms (เสียงไม่สะดุดแม้เฟรมช้า)
  const timer = setInterval(() => {
    if (!ctx || ctx.state !== 'running') return;
    while (next < ctx.currentTime + 0.3) {
      const at = next - ctx.currentTime, bar = Math.floor(i / 8) % tr.chords.length, root = tr.chords[bar];
      if (i % 8 === 0) {   // เบสกับคอร์ดตอนต้นห้อง
        tone('triangle', N(root - 12), N(root - 12), step * 7, 0.28, at, musicBus);
        [0, 4, 7].forEach(k => tone('sine', N(root + k), N(root + k), step * 7.5, 0.05, at, musicBus));
      }
      if (i % 2 === 1) tone('triangle', N(root - 12 + 7), N(root - 12 + 7), step * 0.9, 0.12, at, musicBus);
      const m = mel[i % mel.length];
      if (m) tone(tr.wave, N(m), N(m), step * 0.85, 0.06, at, musicBus);
      if (i % 4 === 2) { // ฉาบเบาๆ
        const t = ctx.currentTime + at, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
        s.buffer = noiseBuf; f.type = 'highpass'; f.frequency.value = 7000;
        g.gain.setValueAtTime(0.04, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
        s.connect(f).connect(g).connect(musicBus); s.start(t); s.stop(t + 0.06);
      }
      next += step; i++;
    }
  }, 100);
  music = { timer };
}
export function stopMusic() {
  if (music) clearInterval(music.timer);
  music = null;
}
// เปลี่ยนเพลงตามแผนที่ (เรียกได้บ่อย จะเปลี่ยนเมื่อชื่อเพลงต่างไปเท่านั้น)
export function setTrack(name) {
  if (name === track && (music || !ctx || !opts.music)) return;
  if (!ctx || !opts.music) { track = name; return; }   // จำไว้ เริ่มเล่นตอนแตะจอครั้งแรกหรือเปิดเพลง
  startMusic(name, true);
}
