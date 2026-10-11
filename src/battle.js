// ฉากต่อสู้แนวนอน วาดบน canvas: แท่นหลายชั้น ตัวเราเดิน/กระโดดไล่ตีมอนสเตอร์ แมวลอยตามและยิงช่วย
// พิกัดทั้งหมดเป็นหน่วยฉาก 844×390 (canvas ขยายตามจอเอง)
import { BAL } from './config.js';
import { catById, itemName } from './game.js';

const img = src => { const i = new Image(); i.src = src; return i; };
export const W = 844, H = 390;          // ขนาดจอ (หน่วยฉาก)

// แผนที่: ภาพสัดส่วน 1024×572 ขยาย ×1.4 → โลกกว้าง 1434×801 กล้องเลื่อนตามตัวเรา แต่ละโซนใช้แผนที่ตาม ZONES[].map
const MAP_SCALE = 1.4;
const ZOOM = 0.7;           // กล้องซูมออก: ตัวละครเล็กลง เห็นแผนที่กว้างขึ้น
export const WW = Math.round(1024 * MAP_SCALE), WH = Math.round(572 * MAP_SCALE);
const BOTTOM_PAD = 150;   // ให้กล้องเลื่อนต่ำกว่าแผนที่ได้ ตัวละครบนพื้นล่างสุดจะไม่จมใต้ปุ่มล่างจอ
// แท่นวัดจากภาพ (พิกัดในภาพ 1024×572: x1, x2, y ของขอบหญ้า) floor = พื้นที่กระโดดลงทะลุไม่ได้ แท่นแรกคือจุดเริ่ม
const P = (x1, x2, y, floor = false) => ({ x1: x1 * MAP_SCALE, x2: x2 * MAP_SCALE, y: y * MAP_SCALE, ground: floor });
const MAPS = {
  // ป่าซากปรักหักพัง
  forest: { img: img('assets/scenes/forest.webp'), platforms: [
    // พื้นล่าง: ซ้ายสูง · กลางต่ำ (ริมน้ำ) · ขวาสูง
    P(0, 205, 476, true), P(205, 905, 521, true), P(905, 1024, 471, true),
    // เนินหญ้าชั้นล่าง
    P(215, 325, 440), P(565, 700, 456),
    // บ้านเห็ดซ้าย และเกาะขวา
    P(100, 215, 376), P(847, 1007, 376),
    // แท่นลอยเล็ก
    P(275, 315, 357), P(325, 365, 357), P(577, 617, 357), P(654, 692, 357),
    P(250, 290, 376), P(452, 492, 376), P(527, 567, 376), P(629, 667, 376), P(704, 744, 376), P(779, 819, 376),
    // ชั้นกลาง
    P(75, 265, 257), P(275, 517, 262), P(655, 893, 258),
    // แท่นห้อยเล็ก และชั้นบนสุด
    P(476, 517, 193), P(150, 365, 108), P(380, 415, 120), P(428, 742, 108),
  ] },
  // ชายหาด
  beach: { img: img('assets/scenes/beach.webp'), platforms: [
    // หาดทรายผืนเดียวตลอดแนว
    P(0, 1024, 520, true),
    // เนินพุ่มไม้ชั้นล่าง
    P(195, 320, 440), P(550, 692, 456),
    // บ้านเห็ดซ้าย และเกาะเห็ดเหลืองขวา
    P(100, 215, 376), P(842, 1005, 365),
    // แท่นลอยเล็กเหนือน้ำ
    P(325, 365, 357), P(480, 517, 357), P(577, 617, 357), P(654, 692, 357),
    P(250, 290, 376), P(452, 492, 376), P(527, 567, 376), P(629, 667, 376), P(704, 744, 376), P(779, 819, 376),
    // ชั้นกลาง: ศาลา · ต้นไม้ใหญ่ · เกาะขวา
    P(70, 172, 250), P(278, 517, 258), P(660, 893, 258),
    // แท่นเล็ก และชั้นบนสุด
    P(557, 597, 192), P(757, 795, 149), P(113, 198, 98), P(808, 1005, 84),
  ] },
};
let MAP = MAPS.forest.img, PLATFORMS = MAPS.forest.platforms, GROUND = PLATFORMS[0].y;
const GRAV = 1900, JUMP_V = -1000, WALK = 210;   // กระโดดได้สูงราว 260 หน่วย
const REACH = 70;            // ระยะฟันของตัวเรา
const SLASH_BOX = 120;       // ความกว้างของดาบที่โดนหลายตัวพร้อมกัน
const MAX_MONSTERS = 10;
const REACH_UP = 255;   // แท่นที่สูงกว่านี้กระโดดไม่ถึง

const HERO = [1, 2, 3, 4].map(n => img(`assets/hero/slash${n}.png`));
const GOLEM = img('assets/enemies/golem.png');
const COIN = img('assets/ui/coin.png');
const catImgs = {};
const catImg = id => catImgs[id] || (catImgs[id] = img(`assets/cats/${catById(id).img}.png`));

// มอนสเตอร์ธรรมดาชั่วคราว: บูลด็อกจาก SVG
const DOG = img('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 280">
<rect x="40" y="150" width="140" height="115" rx="50" fill="#a8774a"/><ellipse cx="110" cy="210" rx="45" ry="40" fill="#e8cfa6"/>
<rect x="50" y="240" width="40" height="30" rx="14" fill="#8a5d36"/><rect x="130" y="240" width="40" height="30" rx="14" fill="#8a5d36"/>
<path d="M45 50 Q20 40 22 90 Q30 110 55 95Z M175 50 Q200 40 198 90 Q190 110 165 95Z" fill="#6e4421"/>
<ellipse cx="110" cy="95" rx="72" ry="66" fill="#b8865a"/><path d="M60 70 L95 82 M160 70 L125 82" stroke="#3a2210" stroke-width="7" stroke-linecap="round"/>
<circle cx="82" cy="92" r="9" fill="#2a1a0c"/><circle cx="138" cy="92" r="9" fill="#2a1a0c"/><ellipse cx="110" cy="128" rx="48" ry="32" fill="#e8cfa6"/>
<ellipse cx="110" cy="112" rx="16" ry="10" fill="#2a1a0c"/><path d="M78 140 Q110 162 142 140 L142 150 Q110 172 78 150Z" fill="#7a1f1f"/>
<rect x="48" y="158" width="124" height="18" rx="9" fill="#3b6fd2"/></svg>`));

let nextId = 1;

export class Battle {
  constructor(canvas, game, ui) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.game = game;
    this.ui = ui;              // { pop(entity, text, cls, key), tapFx(x,y), coinTo: {x,y}, flash(color) }
    this.k = 1;
    this.view = { l: 0, t: 0, w: W, h: H };   // พื้นที่ที่ canvas ครอบ (หน่วยฉาก เทียบมุมกรอบเกม) ล้นกรอบเต็มจอได้
    this.reset();
  }

  // เปลี่ยนแผนที่ตามโซนของด่าน: ล้างมอนสเตอร์แล้ววางตัวเรากลับจุดเริ่ม
  setMap(id) {
    const m = MAPS[id] || MAPS.forest;
    if (this.mapId === id) return;
    this.mapId = id;
    MAP = m.img; PLATFORMS = m.platforms; GROUND = PLATFORMS[0].y;
    const h = this.hero;
    if (!h) return;
    this.monsters = []; this.shots = []; this.hits = []; this.skfx = [];
    Object.assign(h, { x: 120, y: GROUND, vy: 0, plat: PLATFORMS[0], stuck: 0, drop: 0 });
    this.updateCam(0, true);
  }

  reset() {
    this.cam = { x: 0, y: WH - H / ZOOM };
    this.hero = { x: 120, y: GROUND, vy: 0, face: 1, plat: PLATFORMS[0], attackCD: 0, anim: 0, frame: 0, stuck: 0, drop: 0, walking: false, lastX: 140 };
    this.monsters = [];
    this.shots = [];
    this.coins = [];
    this.poofs = [];
    this.loot = [];
    this.cats = [];
    this.spawnT = 0;
    this.autoMove = true;              // false = ผู้เล่นบังคับเดิน/กระโดดเอง
    this.input = { dir: 0, down: false };
    this.hits = [];   // ดาเมจสกิลที่รอลงทีละจังหวะ { t, m, k, row }
    this.skfx = [];   // ท่าสกิลที่กำลังวาด
    this.shake = 0;
  }

  // ความละเอียดจริงของ canvas = ขนาดฉาก × สเกลบนจอ × ความหนาแน่นพิกเซล
  resize(scale, view = { l: 0, t: 0, w: W, h: H }) {
    this.view = view;
    this.k = scale * (window.devicePixelRatio || 1);
    Object.assign(this.cv.style, { left: view.l + 'px', top: view.t + 'px', width: view.w + 'px', height: view.h + 'px' });
    this.cv.width = Math.round(view.w * this.k);
    this.cv.height = Math.round(view.h * this.k);
  }

  // ---------- แมวในทีม: ลอยตามหลังตัวเรา ----------
  syncTeam(team) {
    const old = new Map(this.cats.map(c => [c.id, c]));
    this.cats = team.map(id => old.get(id) || { id, x: this.hero.x, y: this.hero.y - 30, charge: Math.random() });
  }

  get boss() { return this.monsters.find(m => m.boss && !m.dead); }

  // ---------- มอนสเตอร์ ----------
  spawnMonster() {
    const plats = PLATFORMS.filter(p => p.x2 - p.x1 >= 100);
    const p = plats[Math.floor(Math.random() * plats.length)];
    const x1 = Math.max(p.x1 + 30, 30), x2 = Math.min(p.x2 - 30, WW - 30);
    let x = x1 + Math.random() * (x2 - x1);
    if (Math.abs(x - this.hero.x) < 90 && Math.abs(p.y - this.hero.y) < 10) x = x < W / 2 ? x2 : x1;
    const hp = this.game.monsterHp();
    this.monsters.push({ id: nextId++, x, y: p.y, plat: p, dir: Math.random() < 0.5 ? -1 : 1, speed: 25 + Math.random() * 25,
      w: 52, h: 66, hp, max: hp, name: this.game.monsterName(false), hue: this.game.zoneHue(), hitT: 0, spawnT: 0.3 });
  }
  spawnBoss() {
    for (const m of this.monsters) this.poof(m);
    this.monsters = [];
    const big = this.game.s.stage % BAL.bigBossEvery === 0;
    const hp = this.game.bossHp();
    const w = big ? 230 : 200, h = w * 370 / 406;
    // บอสเกิดบนพื้นล่างที่กว้างที่สุดใกล้ตัวเรา
    const floor = PLATFORMS.filter(p => p.ground).sort((a, b) => (b.x2 - b.x1) - (a.x2 - a.x1))[0];
    const x = Math.min(floor.x2 - w / 2, Math.max(floor.x1 + w / 2, this.hero.x + 220));
    this.monsters.push({ id: nextId++, x, y: floor.y, plat: floor, dir: -1, speed: 18, w, h, hp, max: hp, boss: true, big,
      name: this.game.monsterName(true), hue: this.game.zoneHue(), hitT: 0, spawnT: 0.5 });
    this.game.startBoss();
  }
  bossFled() {
    const b = this.boss;
    if (b) { this.poof(b); this.monsters = this.monsters.filter(m => m !== b); }
  }
  poof(m) { this.poofs.push({ x: m.x, y: m.y - m.h / 2, r: m.w / 2, t: 0 }); }
  // ไอเทมดรอป: กล่องเรืองแสงสีตามความหายาก เด้งขึ้นแล้วบินเข้าปุ่ม "ตัวเรา"
  lootFx(m, color) { this.loot.push({ x: m.x, y: m.y - m.h * 0.5, vy: -320, t: 0, color }); }

  damage(m, amount, src, crit, row) {
    if (!m || m.dead) return;
    m.hp -= amount;
    m.hitT = 0.12;
    this.ui.pop(m, amount, crit ? 'crit' : src === 'cat' ? 'cat' : src === 'skill' ? 'skill' : '', src === 'cat' ? 'cat' : src === 'skill' ? 'skill' : 'hero', row);
    if (m.hp <= 0) this.kill(m);
  }
  kill(m) {
    m.dead = true; m.deadT = 0;
    const n = m.boss ? 10 : 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < n; i++) {
      this.coins.push({ x: m.x, y: m.y - m.h * 0.5, vx: (Math.random() - 0.5) * 220, vy: -260 - Math.random() * 160, ground: m.y, t: 0, fly: false });
    }
    this.game.killed(m);
  }

  // ---------- ตัวเรา ----------
  target() {
    const h = this.hero, b = this.boss;
    if (b) return b;
    let best = null, bd = Infinity;
    for (const m of this.monsters) {
      if (m.dead || m.spawnT > 0) continue;
      const d = Math.abs(m.x - h.x) + Math.abs(m.y - h.y) * 2.2;
      if (d < bd) { bd = d; best = m; }
    }
    return best;
  }
  inSlash(m) {
    const h = this.hero, dx = (m.x - h.x) * h.face;
    return !m.dead && dx > -20 && dx < SLASH_BOX + m.w / 2 && Math.abs((m.y - m.h / 2) - (h.y - 30)) < 40 + m.h / 2;
  }
  // ฟัน: โดนได้สูงสุด 3 ตัวที่อยู่หน้าดาบ ถ้าไม่มีใครในระยะ ยิงคลื่นดาบไปหาเป้า
  slash(roll, src) {
    const h = this.hero;
    h.anim = 0.18;
    const hits = this.monsters.filter(m => this.inSlash(m)).slice(0, 3);
    if (hits.length) {
      hits.forEach((m, i) => { const r = i === 0 ? roll : this.game.rollSlash(); this.damage(m, r.amount, src, r.crit); });
      this.ui.slashFx(this.sx(h.x + h.face * 60), this.sy(h.y - 34), h.face, roll.crit);
    } else {
      const t = this.target();
      if (t) this.shots.push({ wave: true, x: h.x + h.face * 30, y: h.y - 34, to: t, amount: roll.amount, crit: roll.crit, src, color: '#bff4ff' });
    }
  }
  tap(x, y) {
    const roll = this.game.tap();
    if (!roll) return;
    this.ui.tapFx(x, y);
    const t = this.target();
    if (t) this.hero.face = t.x >= this.hero.x ? 1 : -1;
    this.slash(roll, 'tap');
  }

  // ปุ่มกระโดด: บนพื้นกระโดดปกติ กดอีกครั้งกลางอากาศเป็นกระโดดสูง (กระโดดสองชั้น) กดค้างแป้นลงแล้วกระโดด = ลงทะลุแท่น
  jump() {
    const h = this.hero, onGround = h.vy === 0 && h.plat;
    if (onGround) {
      if (this.input.down && !h.plat.ground) { h.drop = 0.25; h.plat = null; h.vy = 60; return; }
      h.vy = JUMP_V * 0.85; h.plat = null; h.jumps = 1;
    } else if ((h.jumps || 0) < 2) {
      h.vy = JUMP_V * 0.95; h.jumps = 2;
      this.poofs.push({ x: h.x, y: h.y + 6, r: 22, t: 0 });
    }
  }

  standingOn(e) { return PLATFORMS.find(p => Math.abs(e.y - p.y) < 1 && e.x >= p.x1 && e.x <= p.x2); }

  updateHero(dt) {
    const h = this.hero, t = this.target();
    h.attackCD -= dt;
    h.anim = Math.max(0, h.anim - dt);
    let dir = 0;
    const onGround = h.vy === 0 && h.plat;
    if (onGround) h.jumps = 0;
    if (!this.autoMove) {
      // บังคับเอง: เดินตามแป้น หยุดอยู่ก็หันหาศัตรูที่อยู่ใกล้ให้ฟันอัตโนมัติได้
      dir = this.input.dir;
      if (!dir && t && Math.abs(t.y - h.y) < 60 && Math.abs(t.x - h.x) < SLASH_BOX + 60) h.face = Math.sign(t.x - h.x) || h.face;
    } else if (t && onGround) {
      const sameLevel = Math.abs(t.y - h.y) < 4;
      if (sameLevel) {
        const dx = t.x - h.x;
        if (Math.abs(dx) > REACH + t.w * 0.3) dir = Math.sign(dx);
        else h.face = Math.sign(dx) || h.face;
      } else if (t.y < h.y) {
        // เป้าอยู่สูงกว่า: เดินไปใต้แท่นที่กระโดดถึงซึ่งใกล้เป้าที่สุด แล้วกระโดด
        const ups = PLATFORMS.filter(p => p.y < h.y - 10 && p.y >= h.y - REACH_UP && p.x2 - p.x1 > 30);
        const p = ups.sort((a, b) => Math.abs((a.x1 + a.x2) / 2 - t.x) - Math.abs((b.x1 + b.x2) / 2 - t.x))[0];
        if (p) {
          const want = Math.min(Math.max(t.x, p.x1 + 40), p.x2 - 40);
          if (Math.abs(want - h.x) > 12 && !(h.x > p.x1 + 25 && h.x < p.x2 - 25 && Math.abs(want - h.x) < 120)) dir = Math.sign(want - h.x);
          else { h.vy = JUMP_V; h.plat = null; }
        }
      } else {
        // เป้าอยู่ต่ำกว่า: เดินไปทางเป้า แล้วกระโดดลงทะลุแท่นที่ยืนอยู่
        const dx = t.x - h.x;
        if (Math.abs(dx) > 40) dir = Math.sign(dx);
        if (!h.plat.ground && (Math.abs(dx) < 140 || h.x < h.plat.x1 + 30 || h.x > h.plat.x2 - 30)) { h.drop = 0.25; h.plat = null; h.vy = 60; }
      }
    }
    if (dir) h.face = dir;
    h.walking = !!dir;
    h.x = Math.min(WW - 20, Math.max(20, h.x + dir * WALK * dt));

    // ฟันอัตโนมัติเมื่อมีเป้าในระยะ
    if (t && h.attackCD <= 0 && this.monsters.some(m => this.inSlash(m))) {
      h.attackCD = 1 / this.game.autoRate();
      this.slash(this.game.rollSlash(), 'auto');
    }

    // แรงโน้มถ่วงและการลงบนแท่น
    const prevY = h.y;
    if (!h.plat || h.vy !== 0) {
      h.vy += GRAV * dt;
      h.y += h.vy * dt;
      h.drop = Math.max(0, h.drop - dt);
      if (h.vy > 0) {
        for (const p of PLATFORMS) {
          if (h.drop > 0 && p.y <= prevY + 2) continue;
          if (prevY <= p.y && h.y >= p.y && h.x >= p.x1 && h.x <= p.x2) { h.y = p.y; h.vy = 0; h.plat = p; break; }
        }
      }
    } else if (h.x < h.plat.x1 || h.x > h.plat.x2) {
      h.plat = null; h.vy = 1;   // เดินตกขอบ
    }

    if (h.y > WH + 100) { h.x = 120; h.y = GROUND; h.vy = 0; h.plat = PLATFORMS[0]; }
    // ติดอยู่นานเกินไป: วาร์ปไปใกล้เป้า
    h.stuck = this.autoMove && t && Math.abs(h.x - h.lastX) < 0.5 && !this.monsters.some(m => this.inSlash(m)) ? h.stuck + dt : 0;
    h.lastX = h.x;
    if (h.stuck > 2.5 && t) {
      this.poofs.push({ x: h.x, y: h.y - 30, r: 30, t: 0 });
      h.x = Math.min(WW - 30, Math.max(30, t.x - 60 * (t.x > WW / 2 ? 1 : -1)));
      h.y = t.y; h.vy = 0; h.plat = this.standingOn(h) || PLATFORMS[0]; h.y = h.plat.y; h.stuck = 0;
    }
  }

  // ---------- กล้อง ----------
  // cam = จุดในโลกที่ตรงกับมุมซ้ายบนของกรอบเกม
  sx(x) { return (x - this.cam.x) * ZOOM; }
  sy(y) { return (y - this.cam.y) * ZOOM; }
  updateCam(dt, snap) {
    const h = this.hero, v = this.view;
    const clamp = (want, lo, size, world) => {
      const min = -lo / ZOOM, max = world - (lo + size) / ZOOM;
      return min > max ? (min + max) / 2 : Math.min(max, Math.max(min, want));
    };
    const tx = clamp(h.x - W / 2 / ZOOM, v.l, v.w, WW);
    const ty = clamp(h.y - H * 0.58 / ZOOM, v.t, v.h, WH + BOTTOM_PAD);
    const k = snap ? 1 : Math.min(1, dt * 5);
    this.cam.x += (tx - this.cam.x) * k;
    this.cam.y += (ty - this.cam.y) * k;
  }

  // ---------- อัปเดตทั้งฉาก ----------
  update(dt) {
    const g = this.game;
    this.setMap(g.mapId());
    if (g.wantsBoss() && !this.boss) this.spawnBoss();
    if (!this.boss) {
      this.spawnT -= dt;
      const alive = this.monsters.filter(m => !m.dead).length;
      if (alive < MAX_MONSTERS && this.spawnT <= 0) { this.spawnMonster(); this.spawnT = 0.5; }
    }

    for (const m of this.monsters) {
      m.hitT = Math.max(0, m.hitT - dt);
      m.spawnT = Math.max(0, m.spawnT - dt);
      if (m.dead) { m.deadT += dt; continue; }
      m.x += m.dir * m.speed * dt;
      const lo = Math.max(m.plat.x1 + m.w / 4, m.w / 2), hi = Math.min(m.plat.x2 - m.w / 4, WW - m.w / 2);
      if (lo >= hi) { m.x = (m.plat.x1 + m.plat.x2) / 2; continue; }
      if (m.x < lo) { m.x = lo; m.dir = 1; }
      if (m.x > hi) { m.x = hi; m.dir = -1; }
      if (Math.random() < dt * 0.3) m.dir *= -1;
    }
    this.monsters = this.monsters.filter(m => !m.dead || m.deadT < 0.35);

    this.updateHero(dt);
    this.updateCam(dt);

    // คู่หู: ยืนเรียงตามหลังตัวเรา (ตัวใหญ่เท่าตัวเรา) แล้วยิงลูกพลังใส่เป้า
    const h = this.hero, t = this.target();
    this.cats.forEach((c, i) => {
      const tx = Math.min(WW - 30, Math.max(30, h.x - h.face * (62 + i * 56))), ty = h.y + Math.sin(performance.now() / 300 + i) * 2;
      c.x += (tx - c.x) * Math.min(1, dt * 5);
      c.y += (ty - c.y) * Math.min(1, dt * 5);
      c.charge += dt / BAL.catPeriod;
      const shots = Math.floor(c.charge);
      if (shots > 0 && t) {
        c.charge -= shots;
        this.shots.push({ x: c.x, y: c.y - 50, to: t, amount: g.catDps(c.id) * BAL.catPeriod * shots, src: 'cat', color: catById(c.id).color });
      } else if (!t) c.charge = Math.min(c.charge, 1);
    });

    // ลูกยิง: วิ่งตามเป้า
    for (const s of this.shots) {
      const tgt = s.to.dead ? this.target() : s.to;
      if (!tgt) { s.done = true; continue; }
      s.to = tgt;
      const tx = tgt.x, ty = tgt.y - tgt.h * 0.55;
      const dx = tx - s.x, dy = ty - s.y, d = Math.hypot(dx, dy), v = (s.wave ? 720 : 620) * dt;
      if (d <= v) { s.done = true; this.damage(tgt, s.amount, s.src, s.crit); this.ui.boomFx(this.sx(tx), this.sy(ty), s.color); }
      else { s.x += dx / d * v; s.y += dy / d * v; s.ang = Math.atan2(dy, dx); }
    }
    this.shots = this.shots.filter(s => !s.done);

    // ดาเมจสกิลที่ถึงเวลาลง
    for (const x of this.hits) {
      x.t -= dt;
      if (x.t > 0) continue;
      x.done = true;
      if (x.m.dead) continue;
      const r = g.rollSkill(x.k, x.m.boss);
      this.damage(x.m, r.amount, 'skill', r.crit, x.row);
    }
    this.hits = this.hits.filter(x => !x.done);
    for (const f of this.skfx) {
      f.t += dt;
      if (f.boomAt && !f.boomed && f.t >= f.boomAt) { f.boomed = true; this.shake = 0.45; this.ui.flash(f.type === 'meteor' ? '#ff7a2a' : '#bff4ff'); }
    }
    this.skfx = this.skfx.filter(f => f.t < f.dur);
    this.shake = Math.max(0, this.shake - dt);

    // เหรียญ: เด้งลงพื้น แล้วบินเข้ากระเป๋า
    for (const c of this.coins) {
      c.t += dt;
      if (!c.fly) {
        c.vy += GRAV * 0.8 * dt; c.x += c.vx * dt; c.y += c.vy * dt;
        if (c.y > c.ground) { c.y = c.ground; c.vy *= -0.4; c.vx *= 0.6; }
        if (c.t > 0.7) c.fly = true;
      } else {
        const to = this.ui.coinTo, dx = to.x / ZOOM + this.cam.x - c.x, dy = to.y / ZOOM + this.cam.y - c.y, d = Math.hypot(dx, dy), v = 900 * dt;
        if (d < v) c.done = true; else { c.x += dx / d * v; c.y += dy / d * v; }
      }
    }
    this.coins = this.coins.filter(c => !c.done);
    for (const l of this.loot) {
      l.t += dt;
      if (l.t < 0.7) { l.vy += GRAV * 0.6 * dt; l.y += l.vy * dt; }
      else {
        const to = this.ui.bagTo, dx = to.x / ZOOM + this.cam.x - l.x, dy = to.y / ZOOM + this.cam.y - l.y, d = Math.hypot(dx, dy), v = 700 * dt;
        if (d < v) l.done = true; else { l.x += dx / d * v; l.y += dy / d * v; }
      }
    }
    this.loot = this.loot.filter(l => !l.done);
    for (const p of this.poofs) p.t += dt;
    this.poofs = this.poofs.filter(p => p.t < 0.4);
  }

  // ---------- สกิลตามอาวุธ ----------
  // กรอบโลกที่เห็นบนจอตอนนี้
  viewRect() {
    const v = this.view;
    return { x1: this.cam.x + v.l / ZOOM, x2: this.cam.x + (v.l + v.w) / ZOOM, y1: this.cam.y + v.t / ZOOM, y2: this.cam.y + (v.t + v.h) / ZOOM };
  }
  // ร่ายสกิล k: เลือกเป้าในระยะ ถ้าไม่มีเป้าไม่ร่าย (ไม่เสียคูลดาวน์) คืน true ถ้าร่ายสำเร็จ
  castSkill(k) {
    const h = this.hero, g = this.game;
    const alive = this.monsters.filter(m => !m.dead && m.spawnT <= 0);
    if (!alive.length) return false;
    if (k.buff) {
      if (!g.useSkill(k)) return false;
      this.skfx.push({ type: k.fx, t: 0, dur: 0.9, x: h.x, y: h.y });
      return true;
    }
    const vr = this.viewRect();
    const hy = h.y - 30;
    let list = k.range === 'all'
      ? alive.filter(m => m.x > vr.x1 - 20 && m.x < vr.x2 + 20 && m.y > vr.y1 && m.y - m.h < vr.y2)
      : alive.filter(m => Math.abs(m.x - h.x) <= k.range && Math.abs(m.y - m.h / 2 - hy) <= k.range * 0.7);
    if (!list.length) return false;
    const dist = (a, b) => Math.hypot(a.x - b.x, (a.y - a.h / 2) - (b.y - (b.h || 60) / 2));
    let face = h.face;
    if (k.fx === 'dash' || k.fx === 'firewall' || k.fx === 'tornado') {
      // ท่าพุ่งไปทางเดียว: เลือกฝั่งที่มีมอนสเตอร์มากกว่า
      const right = list.filter(m => m.x >= h.x - 20).length, left = list.filter(m => m.x <= h.x + 20).length;
      face = right >= left ? 1 : -1;
      list = list.filter(m => (m.x - h.x) * face >= -30);
    }
    if (k.fx === 'fireball') {
      const first = list.reduce((a, b) => (dist(a, h) < dist(b, h) ? a : b));
      list = list.filter(m => dist(m, first) <= k.splash).sort((a, b) => dist(a, first) - dist(b, first));
    } else {
      list.sort((a, b) => (b.boss - a.boss) || dist(a, h) - dist(b, h));
    }
    list = list.slice(0, k.targets);
    if (!list.length || !g.useSkill(k)) return false;
    h.face = face;
    h.anim = 0.25;

    const pts = list.map(m => ({ x: m.x, y: m.y - m.h / 2 }));
    const c = list[0], center = { x: pts.reduce((a, p) => a + p.x, 0) / pts.length, y: pts.reduce((a, p) => a + p.y, 0) / pts.length };
    const fx = { type: k.fx, t: 0, x: h.x, y: h.y, face, pts, range: typeof k.range === 'number' ? k.range : 0, vr };
    let start = 0.08, gap = 0.07, stagger = 0;
    switch (k.fx) {
      case 'arc': fx.dur = 0.35; start = 0.05; break;
      case 'tornado': fx.dur = 0.9; start = 0.15; gap = 0.12; break;
      case 'dash': fx.dur = 0.45; start = 0.12; gap = 0.05; break;
      case 'giant': fx.dur = 1.0; start = 0.4; gap = 0.06; fx.boomAt = 0.35; fx.cx = center.x; fx.cy = Math.max(...list.map(m => m.y)); break;
      case 'beam': fx.dur = 0.6; start = 0.12; gap = 0.06; break;
      case 'ring': fx.dur = 0.55; start = 0.1; gap = 0.08; break;
      case 'rain': fx.dur = 1.1; start = 0.3; gap = 0.08; break;
      case 'fireball': { fx.travel = Math.min(0.5, dist(c, h) / 1100); fx.to = pts[0]; fx.dur = fx.travel + 0.4; start = fx.travel; gap = 0.07; break; }
      case 'firewall': fx.dur = 1.1; start = 0.15; gap = 0.13; break;
      case 'bombs': fx.dur = 0.5 + 0.12 * pts.length; start = 0.25; stagger = 0.12; gap = 0.06; break;
      case 'meteor': fx.dur = 1.2; start = 0.6; gap = 0.06; fx.to = center; fx.boomAt = 0.6; break;
    }
    this.skfx.push(fx);
    list.forEach((m, i) => {
      for (let n = 0; n < k.hits; n++) this.hits.push({ t: start + i * stagger + n * gap, m, k, row: n });
    });
    return true;
  }

  // ---------- วาด ----------
  draw() {
    const c = this.ctx;
    c.setTransform(this.k, 0, 0, this.k, 0, 0);
    c.clearRect(0, 0, this.view.w, this.view.h);
    c.imageSmoothingEnabled = true;
    c.translate(-this.view.l, -this.view.t);
    c.scale(ZOOM, ZOOM);
    c.translate(-this.cam.x, -this.cam.y);
    if (this.shake > 0) c.translate((Math.random() - 0.5) * 14 * this.shake / 0.45, (Math.random() - 0.5) * 10 * this.shake / 0.45);
    if (MAP.complete) {
      c.drawImage(MAP, 0, 0, WW, WH);
      // ใต้แผนที่: สะท้อนแถบดินล่างสุดลงไป แล้วไล่มืด ให้ดูเป็นดินใต้พื้น
      const sh = MAP.naturalHeight * BOTTOM_PAD / WH;
      c.save();
      c.translate(0, WH * 2); c.scale(1, -1);
      c.drawImage(MAP, 0, MAP.naturalHeight - sh, MAP.naturalWidth, sh, 0, WH - BOTTOM_PAD, WW, BOTTOM_PAD);
      c.restore();
      const g = c.createLinearGradient(0, WH, 0, WH + BOTTOM_PAD);
      g.addColorStop(0, 'rgba(18,14,10,.35)'); g.addColorStop(1, 'rgba(18,14,10,.9)');
      c.fillStyle = g; c.fillRect(0, WH, WW, BOTTOM_PAD + 2);
    }

    const ms = [...this.monsters].sort((a, b) => (b.boss ? 1 : 0) - (a.boss ? 1 : 0));
    for (const m of ms) this.drawMonster(m);
    for (const cat of this.cats) this.drawCat(cat);
    this.drawHero();

    for (const s of this.shots) {
      c.save();
      if (s.wave) {
        c.translate(s.x, s.y); c.rotate(s.ang || 0);
        c.strokeStyle = s.crit ? '#ff8ab8' : '#dffaff'; c.lineWidth = 5; c.shadowColor = '#7fe0ff'; c.shadowBlur = 12;
        c.beginPath(); c.arc(-10, 0, 22, -1.1, 1.1); c.stroke();
      } else {
        c.fillStyle = s.color; c.shadowColor = s.color; c.shadowBlur = 14;
        c.beginPath(); c.arc(s.x, s.y, 6, 0, Math.PI * 2); c.fill();
      }
      c.restore();
    }
    for (const f of this.skfx) this.drawSkillFx(f);
    for (const co of this.coins) if (COIN.complete) c.drawImage(COIN, co.x - 9, co.y - 18, 18, 18);
    for (const l of this.loot) {
      c.save(); c.translate(l.x, l.y); c.rotate(l.t * 4);
      c.shadowColor = l.color; c.shadowBlur = 16; c.fillStyle = l.color; c.fillRect(-9, -9, 18, 18);
      c.fillStyle = '#fff'; c.fillRect(-3, -9, 6, 18);
      c.restore();
    }
    for (const p of this.poofs) {
      c.save(); c.globalAlpha = 1 - p.t / 0.4; c.fillStyle = '#fff';
      for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; c.beginPath(); c.arc(p.x + Math.cos(a) * p.r * (0.5 + p.t * 2), p.y + Math.sin(a) * p.r * (0.5 + p.t * 2), 8 * (1 - p.t / 0.4), 0, 7); c.fill(); }
      c.restore();
    }
  }

  // ---------- ท่าสกิล (วาดด้วยโค้ด จนกว่าจะมีภาพเอฟเฟกต์จริง) ----------
  drawSkillFx(f) {
    const c = this.ctx, p = f.t / f.dur, fade = Math.min(1, (1 - p) * 4), hy = f.y - 34;
    const glow = (col, blur) => { c.shadowColor = col; c.shadowBlur = blur; };
    const boom = (x, y, r, a, inner, outer) => {
      const g = c.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(255,255,240,${a})`); g.addColorStop(0.35, inner); g.addColorStop(1, outer);
      c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill();
    };
    c.save();
    c.globalCompositeOperation = 'lighter';
    switch (f.type) {
      case 'arc': {   // ครึ่งวงดาบขนาดใหญ่ 2 วงซ้อน
        c.globalAlpha = fade; c.lineCap = 'round'; glow('#7fe0ff', 20);
        for (let i = 0; i < 2; i++) {
          const r = 90 + 70 * Math.min(1, p * 2.5) + i * 30, a0 = -1.6 + i * 0.3;
          c.strokeStyle = i ? '#7fe0ff' : '#ffffff'; c.lineWidth = 14 - i * 5;
          c.beginPath();
          if (f.face > 0) c.arc(f.x, hy, r, a0, a0 + 3.0 * Math.min(1, p * 3));
          else c.arc(f.x, hy, r, Math.PI - a0, Math.PI - a0 - 3.0 * Math.min(1, p * 3), true);
          c.stroke();
        }
        break;
      }
      case 'tornado': {   // พายุหมุนสีแดงขาว เคลื่อนไปข้างหน้า
        const x = f.x + f.face * f.range * Math.min(1, p * 1.2);
        c.globalAlpha = fade * 0.9; glow('#ff3a4a', 24);
        for (let i = 0; i < 9; i++) {
          const yy = f.y - 10 - i * 20, rw = 26 + i * 9, sp = f.t * 22 + i;
          c.strokeStyle = i % 2 ? 'rgba(255,60,80,.9)' : 'rgba(255,230,230,.9)'; c.lineWidth = 6;
          c.beginPath(); c.ellipse(x + Math.sin(sp) * 6, yy, rw, 8, 0, sp % 6.28, sp % 6.28 + 4.4); c.stroke();
        }
        break;
      }
      case 'dash': {   // แสงดาบพุ่งยาวทะลุแถว
        const len = f.range * Math.min(1, p * 3), x2 = f.x + f.face * len;
        c.globalAlpha = fade; glow('#7fe0ff', 26);
        const g = c.createLinearGradient(f.x, 0, x2, 0);
        g.addColorStop(0, 'rgba(127,224,255,0)'); g.addColorStop(0.7, 'rgba(200,245,255,.9)'); g.addColorStop(1, '#fff');
        c.fillStyle = g; c.fillRect(Math.min(f.x, x2), hy - 9, Math.abs(len), 18);
        c.fillStyle = '#fff'; c.fillRect(Math.min(f.x, x2), hy - 2, Math.abs(len), 4);
        for (let i = 0; i < 6; i++) { const yy = hy + (i - 2.5) * 12; c.fillStyle = 'rgba(160,230,255,.5)'; c.fillRect(Math.min(f.x, x2), yy, Math.abs(len) * (0.4 + (i % 3) * 0.2), 2); }
        break;
      }
      case 'giant': {   // ดาบยักษ์ปักลงพื้น แล้วคลื่นกระแทกกระจายออก
        const fall = Math.min(1, f.t / 0.35), x = f.cx, gy = f.cy;
        const tip = gy - 520 * (1 - fall);
        c.globalAlpha = fade; glow('#bff4ff', 30);
        c.fillStyle = 'rgba(220,250,255,.95)';
        c.beginPath(); c.moveTo(x, tip); c.lineTo(x - 34, tip - 60); c.lineTo(x - 34, tip - 360); c.lineTo(x + 34, tip - 360); c.lineTo(x + 34, tip - 60); c.closePath(); c.fill();
        c.fillStyle = '#ffd35a'; c.fillRect(x - 80, tip - 380, 160, 22); c.fillRect(x - 12, tip - 450, 24, 70);
        if (f.t > 0.35) {
          const q = (f.t - 0.35) / (f.dur - 0.35);
          c.strokeStyle = `rgba(190,244,255,${1 - q})`; c.lineWidth = 10;
          c.beginPath(); c.ellipse(x, gy, 60 + q * 700, 18 + q * 60, 0, 0, 7); c.stroke();
          boom(x, gy - 30, 140 * (1 - q * 0.5), 1 - q, 'rgba(160,230,255,.6)', 'rgba(80,160,255,0)');
        }
        break;
      }
      case 'beam': {   // ลำแสงตกจากฟ้าลงทุกเป้า
        c.globalAlpha = fade; glow('#fff3a8', 24);
        for (const pt of f.pts) {
          const w = 30 * (1 - p * 0.5);
          const g = c.createLinearGradient(pt.x - w, 0, pt.x + w, 0);
          g.addColorStop(0, 'rgba(255,240,150,0)'); g.addColorStop(0.5, 'rgba(255,255,230,.95)'); g.addColorStop(1, 'rgba(255,240,150,0)');
          c.fillStyle = g; c.fillRect(pt.x - w, pt.y - 600, w * 2, 640);
          boom(pt.x, pt.y, 50, 0.9, 'rgba(255,230,120,.6)', 'rgba(255,200,60,0)');
        }
        break;
      }
      case 'ring': {   // วงแสงขยายออกจากตัว
        const r = f.range * Math.min(1, p * 1.6);
        c.globalAlpha = fade; glow('#ffe27a', 30);
        c.strokeStyle = 'rgba(255,240,170,.95)'; c.lineWidth = 12;
        c.beginPath(); c.arc(f.x, hy, r, 0, 7); c.stroke();
        c.lineWidth = 4; c.strokeStyle = '#fff';
        c.beginPath(); c.arc(f.x, hy, r * 0.8, 0, 7); c.stroke();
        boom(f.x, hy, r * 0.7, 0.35, 'rgba(255,230,120,.25)', 'rgba(255,200,60,0)');
        break;
      }
      case 'bless': {   // เสาแสงสีทองบนตัวเรา
        c.globalAlpha = fade; glow('#ffe27a', 30);
        const g = c.createLinearGradient(f.x - 60, 0, f.x + 60, 0);
        g.addColorStop(0, 'rgba(255,220,100,0)'); g.addColorStop(0.5, 'rgba(255,245,200,.85)'); g.addColorStop(1, 'rgba(255,220,100,0)');
        c.fillStyle = g; c.fillRect(f.x - 60, f.y - 500, 120, 510);
        for (let i = 0; i < 14; i++) {
          const a = i * 2.4, yy = f.y - ((f.t * 260 + i * 37) % 200);
          c.fillStyle = '#fff6c0'; c.beginPath(); c.arc(f.x + Math.sin(a + f.t * 4) * 40, yy, 4, 0, 7); c.fill();
        }
        break;
      }
      case 'rain': {   // ฝนแสงทั้งจอ
        c.globalAlpha = fade; glow('#fff3a8', 16);
        const vr = f.vr, w = vr.x2 - vr.x1;
        for (let i = 0; i < 46; i++) {
          const x = vr.x1 + (i / 46) * w + Math.sin(i * 7) * 20;
          const y = vr.y1 + ((f.t * 1100 + i * 131) % (vr.y2 - vr.y1 + 200)) - 100;
          c.strokeStyle = i % 3 ? 'rgba(255,245,190,.9)' : '#fff'; c.lineWidth = i % 3 ? 4 : 6;
          c.beginPath(); c.moveTo(x - 18, y - 70); c.lineTo(x, y); c.stroke();
        }
        for (const pt of f.pts) if (f.t > 0.3) boom(pt.x, pt.y, 46, 0.8, 'rgba(255,230,120,.5)', 'rgba(255,200,60,0)');
        break;
      }
      case 'fireball': {   // ลูกไฟพุ่งใส่ แล้วระเบิด
        const q = Math.min(1, f.t / f.travel), to = f.to;
        if (q < 1) {
          const x = f.x + (to.x - f.x) * q, y = hy + (to.y - hy) * q;
          glow('#ff7a2a', 30); boom(x, y, 26, 1, 'rgba(255,160,40,.95)', 'rgba(255,60,0,0)');
        } else {
          const e = (f.t - f.travel) / (f.dur - f.travel);
          c.globalAlpha = 1 - e; glow('#ff5a1a', 30);
          boom(to.x, to.y, 60 + e * 110, 1, 'rgba(255,150,30,.85)', 'rgba(255,40,0,0)');
        }
        break;
      }
      case 'firewall': {   // เปลวไฟลุกเป็นแนวยาวข้างหน้า
        c.globalAlpha = fade; glow('#ff5a1a', 20);
        const n = 14, rise = Math.min(1, p * 4);
        for (let i = 0; i < n; i++) {
          const x = f.x + f.face * (40 + i / (n - 1) * (f.range - 40)), fl = Math.sin(f.t * 30 + i * 2) * 0.15 + 1;
          const hgt = 110 * rise * fl;
          const g = c.createLinearGradient(0, f.y, 0, f.y - hgt);
          g.addColorStop(0, 'rgba(255,240,180,.95)'); g.addColorStop(0.4, 'rgba(255,140,30,.85)'); g.addColorStop(1, 'rgba(255,40,0,0)');
          c.fillStyle = g;
          c.beginPath(); c.moveTo(x - 24, f.y); c.quadraticCurveTo(x - 20, f.y - hgt * 0.6, x, f.y - hgt); c.quadraticCurveTo(x + 20, f.y - hgt * 0.6, x + 24, f.y); c.fill();
        }
        break;
      }
      case 'bombs': {   // ระเบิดทีละจุดไล่ไปทุกเป้า
        f.pts.forEach((pt, i) => {
          const e = (f.t - 0.25 - i * 0.12) / 0.4;
          if (e < -0.6 || e > 1) return;
          if (e < 0) {   // ลูกระเบิดตกลงมา
            const y = pt.y - 160 * -e / 0.6;
            c.fillStyle = '#333'; c.beginPath(); c.arc(pt.x, y, 10, 0, 7); c.fill();
            return;
          }
          c.globalAlpha = 1 - e; glow('#ff7a2a', 24);
          boom(pt.x, pt.y, 40 + e * 70, 1, 'rgba(255,170,50,.9)', 'rgba(255,50,0,0)');
        });
        break;
      }
      case 'meteor': {   // อุกกาบาตตกเฉียงลงกลางกลุ่มมอนสเตอร์ แล้วระเบิดใหญ่
        const to = f.to, q = Math.min(1, f.t / 0.6);
        if (q < 1) {
          const x = to.x - 420 * (1 - q), y = to.y - 620 * (1 - q);
          glow('#ff7a2a', 40);
          for (let i = 6; i >= 0; i--) boom(x - i * 26, y - i * 38, 30 + (6 - i) * 4, 0.5, `rgba(255,${120 + i * 15},40,.5)`, 'rgba(255,40,0,0)');
          c.globalCompositeOperation = 'source-over';
          c.fillStyle = '#5a3a2a'; c.beginPath(); c.arc(x, y, 34, 0, 7); c.fill();
          c.fillStyle = '#ff9a3a'; c.beginPath(); c.arc(x + 8, y + 8, 22, 0, 7); c.fill();
        } else {
          const e = (f.t - 0.6) / 0.6;
          c.globalAlpha = 1 - e; glow('#ff5a1a', 40);
          boom(to.x, to.y, 120 + e * 320, 1, 'rgba(255,150,30,.85)', 'rgba(255,40,0,0)');
          c.strokeStyle = `rgba(255,200,120,${1 - e})`; c.lineWidth = 10;
          c.beginPath(); c.ellipse(to.x, to.y + 30, 100 + e * 600, 30 + e * 80, 0, 0, 7); c.stroke();
        }
        break;
      }
    }
    c.restore();
  }

  drawMonster(m) {
    const c = this.ctx, sprite = m.boss ? GOLEM : DOG;
    if (!sprite.complete) return;
    c.save();
    let a = 1, sc = 1;
    if (m.spawnT > 0) { a = 1 - m.spawnT / 0.5; sc = 0.6 + 0.4 * a; }
    if (m.dead) { a = 1 - m.deadT / 0.35; sc = 1 + m.deadT; }
    c.globalAlpha = Math.max(0, a);
    c.translate(m.x, m.y);
    if (m.hitT > 0) c.translate((Math.random() - 0.5) * 4, 0);
    c.scale(sc * (m.boss ? 1 : -m.dir), sc);
    if (m.hue) c.filter = `hue-rotate(${m.hue}deg)`;
    if (m.big) { c.shadowColor = 'rgba(255,70,50,.9)'; c.shadowBlur = 18; }
    c.drawImage(sprite, -m.w / 2, -m.h, m.w, m.h);
    if (m.hitT > 0) { c.globalCompositeOperation = 'source-atop'; c.globalAlpha = 0.35; c.fillStyle = '#fff'; c.fillRect(-m.w / 2, -m.h, m.w, m.h); }
    c.restore();
    // หลอดเลือดเล็กเหนือหัว (บอสใช้หลอดใหญ่ด้านบนจอ)
    if (!m.boss && !m.dead && m.hp < m.max) {
      c.fillStyle = '#1d2a44'; c.fillRect(m.x - 22, m.y - m.h - 10, 44, 6);
      c.fillStyle = '#e8412f'; c.fillRect(m.x - 21, m.y - m.h - 9, 42 * Math.max(0, m.hp / m.max), 4);
    }
  }

  drawCat(cat) {
    const c = this.ctx, im = catImg(cat.id);
    if (!im.complete || !im.naturalHeight) return;
    const hgt = 86, w = hgt * im.naturalWidth / im.naturalHeight;   // สูงเท่าตัวเรา
    c.save();
    c.translate(cat.x, cat.y);
    c.scale(this.hero.face, 1);
    c.fillStyle = 'rgba(0,0,0,.2)'; c.beginPath(); c.ellipse(0, 2, w * 0.28, 5, 0, 0, 7); c.fill();
    c.drawImage(im, -w / 2, -hgt, w, hgt);
    c.restore();
  }

  // ออร่าตามระดับตีบวกอาวุธ: 1 ขาว, 2 ประกายฟ้า, 3 ไฟ/สายฟ้าสีทอง (วาดในพิกัดของตัวเรา)
  drawAura(tier) {
    if (!tier) return;
    const c = this.ctx, t = performance.now() / 1000;
    const col = ['', '255,255,255', '110,190,255', '255,200,70'][tier];
    const r = 48 + tier * 8 + Math.sin(t * 4) * 4;
    const g = c.createRadialGradient(0, -38, 8, 0, -38, r);
    g.addColorStop(0, `rgba(${col},${0.45 + tier * 0.12})`);
    g.addColorStop(0.6, `rgba(${col},${0.18 + tier * 0.06})`);
    g.addColorStop(1, `rgba(${col},0)`);
    c.fillStyle = g;
    c.beginPath(); c.ellipse(0, -38, r * 0.8, r, 0, 0, 7); c.fill();
    if (tier >= 2) {
      c.fillStyle = `rgba(${col},.9)`;
      for (let i = 0; i < 6; i++) {
        const a = t * 2 + i * Math.PI / 3, rr = 30 + Math.sin(t * 3 + i) * 6;
        c.beginPath(); c.arc(Math.cos(a) * rr * 1.2, -38 + Math.sin(a) * rr * 1.4, 3.2, 0, 7); c.fill();
      }
    }
    if (tier >= 3) {
      c.strokeStyle = 'rgba(255,236,140,.95)'; c.lineWidth = 3; c.shadowColor = '#ffb400'; c.shadowBlur = 14;
      for (let k = 0; k < 3; k++) {
        let x = (Math.random() - 0.5) * 70, y = -92;
        c.beginPath(); c.moveTo(x, y);
        for (let j = 0; j < 4; j++) { x += (Math.random() - 0.5) * 18; y += 18; c.lineTo(x, y); }
        c.stroke();
      }
      c.shadowBlur = 0;
    }
  }

  drawHero() {
    const c = this.ctx, h = this.hero;
    const f = h.anim > 0 ? HERO[h.anim > 0.12 ? 1 : h.anim > 0.06 ? 2 : 3] : HERO[0];
    if (!f.complete) return;
    const w = 150, hh = w * 127 / 190;
    const bob = h.walking ? Math.abs(Math.sin(performance.now() / 90)) * 3 : 0;
    c.save();
    c.translate(h.x, h.y - bob);
    c.scale(h.face, 1);
    c.fillStyle = 'rgba(0,0,0,.22)'; c.beginPath(); c.ellipse(0, bob + 2, 26, 5, 0, 0, 7); c.fill();
    this.drawAura(this.game.auraTier());
    const look = this.game.outfitLook();   // ชุดที่สวม: ปรับโทนสีตัวเรา
    if (look) c.filter = look.filter;
    // จุดหมุนของภาพ: ลำตัวอยู่ที่ x≈62 จากซ้ายในภาพกว้าง 190
    c.drawImage(f, -62 * w / 190, -hh + 4, w, hh);
    c.restore();
    this.drawNameplate(h);
  }
  // ป้ายชื่อใต้ตัวเรา: ชื่อ + อาวุธที่สวม
  drawNameplate(h) {
    const c = this.ctx, wpn = this.game.item(this.game.s.equip.weapon);
    const lines = [['Meowstral, The Titan Saber', '#ffe27a']];
    if (wpn) lines.push([`+${wpn.plus} ${itemName(wpn)}`, '#fff']);
    c.save();
    c.font = '600 10.5px Mitr, sans-serif';
    c.textAlign = 'center';
    lines.forEach(([txt, col], i) => {
      const y = h.y + 15 + i * 14, tw = c.measureText(txt).width + 12;
      c.fillStyle = 'rgba(12,19,36,.72)'; c.beginPath(); c.roundRect(h.x - tw / 2, y - 10, tw, 13, 4); c.fill();
      c.fillStyle = col; c.fillText(txt, h.x, y);
    });
    c.restore();
  }
}
