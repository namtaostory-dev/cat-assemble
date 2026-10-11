// ฉากต่อสู้แนวนอน วาดบน canvas: แท่นหลายชั้น ตัวเราเดิน/กระโดดไล่ตีมอนสเตอร์ แมวลอยตามและยิงช่วย
// พิกัดทั้งหมดเป็นหน่วยฉาก 844×390 (canvas ขยายตามจอเอง)
import { BAL } from './config.js';
import { catById } from './game.js';

export const W = 844, H = 390;
const GROUND = 300;   // พื้นอยู่เหนือแถบปุ่มด้านล่าง มอนสเตอร์บนพื้นจึงไม่โดนบัง
// แท่นแบบทะลุขึ้นได้ (ยืนได้เมื่อตกลงมาจากข้างบน)
const PLATFORMS = [
  { x1: -40, x2: W + 40, y: GROUND, ground: true },
  { x1: 60, x2: 320, y: 224 },
  { x1: 524, x2: 784, y: 224 },
  { x1: 292, x2: 552, y: 150 },
];
const GRAV = 1900, JUMP_V = -720, WALK = 190;
const REACH = 70;            // ระยะฟันของตัวเรา
const SLASH_BOX = 120;       // ความกว้างของดาบที่โดนหลายตัวพร้อมกัน
const MAX_MONSTERS = 6;

const img = src => { const i = new Image(); i.src = src; return i; };
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
    this.reset();
  }

  reset() {
    this.hero = { x: 140, y: GROUND, vy: 0, face: 1, plat: PLATFORMS[0], attackCD: 0, anim: 0, frame: 0, stuck: 0, drop: 0, walking: false, lastX: 140 };
    this.monsters = [];
    this.shots = [];
    this.coins = [];
    this.poofs = [];
    this.loot = [];
    this.cats = [];
    this.spawnT = 0;
    this.dotT = 0;
  }

  // ความละเอียดจริงของ canvas = ขนาดฉาก × สเกลบนจอ × ความหนาแน่นพิกเซล
  resize(scale) {
    this.k = scale * (window.devicePixelRatio || 1);
    this.cv.width = Math.round(W * this.k);
    this.cv.height = Math.round(H * this.k);
  }

  // ---------- แมวในทีม: ลอยตามหลังตัวเรา ----------
  syncTeam(team) {
    const old = new Map(this.cats.map(c => [c.id, c]));
    this.cats = team.map(id => old.get(id) || { id, x: this.hero.x, y: this.hero.y - 30, charge: Math.random() });
  }

  get boss() { return this.monsters.find(m => m.boss && !m.dead); }

  // ---------- มอนสเตอร์ ----------
  spawnMonster() {
    const plats = PLATFORMS.filter(p => !p.ground || Math.random() < 0.5);
    const p = plats[Math.floor(Math.random() * plats.length)];
    const x1 = Math.max(p.x1 + 30, 30), x2 = Math.min(p.x2 - 30, W - 30);
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
    const x = this.hero.x < W / 2 ? W - 190 : 190;
    this.monsters.push({ id: nextId++, x, y: GROUND, plat: PLATFORMS[0], dir: -1, speed: 18, w, h, hp, max: hp, boss: true, big,
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

  damage(m, amount, src, crit) {
    if (!m || m.dead) return;
    m.hp -= amount;
    m.hitT = 0.12;
    this.ui.pop(m, amount, crit ? 'crit' : src === 'cat' ? 'cat' : src === 'dot' ? 'dot' : '', src === 'cat' ? 'cat' : src === 'dot' ? 'dot' : 'hero');
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
      this.ui.slashFx(h.x + h.face * 60, h.y - 34, h.face, roll.crit);
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

  standingOn(e) { return PLATFORMS.find(p => Math.abs(e.y - p.y) < 1 && e.x >= p.x1 && e.x <= p.x2); }

  updateHero(dt) {
    const h = this.hero, t = this.target();
    h.attackCD -= dt;
    h.anim = Math.max(0, h.anim - dt);
    let dir = 0;
    const onGround = h.vy === 0 && h.plat;
    if (t && onGround) {
      const sameLevel = Math.abs(t.y - h.y) < 4;
      if (sameLevel) {
        const dx = t.x - h.x;
        if (Math.abs(dx) > REACH + t.w * 0.3) dir = Math.sign(dx);
        else h.face = Math.sign(dx) || h.face;
      } else if (t.y < h.y) {
        // เป้าอยู่สูงกว่า: เดินไปใต้แท่นที่กระโดดถึงซึ่งใกล้เป้าที่สุด แล้วกระโดด
        const ups = PLATFORMS.filter(p => p.y < h.y - 10 && p.y >= h.y - 130);
        const p = ups.sort((a, b) => Math.abs((a.x1 + a.x2) / 2 - t.x) - Math.abs((b.x1 + b.x2) / 2 - t.x))[0];
        if (p) {
          const want = Math.min(Math.max(t.x, p.x1 + 40), p.x2 - 40);
          if (Math.abs(want - h.x) > 12 && !(h.x > p.x1 + 25 && h.x < p.x2 - 25 && Math.abs(want - h.x) < 120)) dir = Math.sign(want - h.x);
          else { h.vy = JUMP_V; h.plat = null; }
        }
      } else {
        // เป้าอยู่ต่ำกว่า: เดินไปทางเป้า แล้วกระโดดลงทะลุแท่นที่ยืนอยู่
        const dx = t.x - h.x;
        if (Math.abs(dx) > 40 && !h.plat.ground) dir = Math.sign(dx);
        if (!h.plat.ground && (Math.abs(dx) < 140 || h.x < h.plat.x1 + 30 || h.x > h.plat.x2 - 30)) { h.drop = 0.25; h.plat = null; h.vy = 60; }
      }
    }
    if (dir) h.face = dir;
    h.walking = !!dir;
    h.x = Math.min(W - 20, Math.max(20, h.x + dir * WALK * dt));

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

    // ติดอยู่นานเกินไป: วาร์ปไปใกล้เป้า
    h.stuck = t && Math.abs(h.x - h.lastX) < 0.5 && !this.monsters.some(m => this.inSlash(m)) ? h.stuck + dt : 0;
    h.lastX = h.x;
    if (h.stuck > 2.5 && t) {
      this.poofs.push({ x: h.x, y: h.y - 30, r: 30, t: 0 });
      h.x = Math.min(W - 30, Math.max(30, t.x - 60 * (t.x > W / 2 ? 1 : -1)));
      h.y = t.y; h.vy = 0; h.plat = this.standingOn(h) || PLATFORMS[0]; h.y = h.plat.y; h.stuck = 0;
    }
  }

  // ---------- อัปเดตทั้งฉาก ----------
  update(dt) {
    const g = this.game;
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
      const lo = Math.max(m.plat.x1 + m.w / 2, m.w / 2), hi = Math.min(m.plat.x2 - m.w / 2, W - m.w / 2);
      if (m.x < lo) { m.x = lo; m.dir = 1; }
      if (m.x > hi) { m.x = hi; m.dir = -1; }
      if (Math.random() < dt * 0.3) m.dir *= -1;
    }
    this.monsters = this.monsters.filter(m => !m.dead || m.deadT < 0.35);

    this.updateHero(dt);

    // แมว: ลอยตามหลังตัวเราเป็นแถว แล้วยิงลูกพลังใส่เป้า
    const h = this.hero, t = this.target();
    this.cats.forEach((c, i) => {
      const row = Math.floor(i / 4), col = i % 4;
      const tx = h.x - h.face * (46 + col * 34), ty = h.y - 8 - row * 46 + Math.sin(performance.now() / 300 + i) * 3;
      c.x += (tx - c.x) * Math.min(1, dt * 5);
      c.y += (ty - c.y) * Math.min(1, dt * 5);
      c.charge += dt / BAL.catPeriod;
      const shots = Math.floor(c.charge);
      if (shots > 0 && t) {
        c.charge -= shots;
        this.shots.push({ x: c.x, y: c.y - 30, to: t, amount: g.catDps(c.id) * BAL.catPeriod * shots, src: 'cat', color: catById(c.id).color });
      } else if (!t) c.charge = Math.min(c.charge, 1);
    });

    // ลูกยิง: วิ่งตามเป้า
    for (const s of this.shots) {
      const tgt = s.to.dead ? this.target() : s.to;
      if (!tgt) { s.done = true; continue; }
      s.to = tgt;
      const tx = tgt.x, ty = tgt.y - tgt.h * 0.55;
      const dx = tx - s.x, dy = ty - s.y, d = Math.hypot(dx, dy), v = (s.wave ? 720 : 620) * dt;
      if (d <= v) { s.done = true; this.damage(tgt, s.amount, s.src, s.crit); this.ui.boomFx(tx, ty, s.color); }
      else { s.x += dx / d * v; s.y += dy / d * v; s.ang = Math.atan2(dy, dx); }
    }
    this.shots = this.shots.filter(s => !s.done);

    // สกิลหมอกพิษ: เลือดลดทุกตัว รวบเป็นก้อนทุก 0.5 วิ
    if (g.active('toxin')) {
      this.dotT += dt;
      if (this.dotT >= 0.5) {
        const p = g.power('toxin');
        for (const m of [...this.monsters]) if (!m.dead) this.damage(m, m.max * 0.005 * p * this.dotT, 'dot');
        this.dotT = 0;
      }
    }

    // เหรียญ: เด้งลงพื้น แล้วบินเข้ากระเป๋า
    for (const c of this.coins) {
      c.t += dt;
      if (!c.fly) {
        c.vy += GRAV * 0.8 * dt; c.x += c.vx * dt; c.y += c.vy * dt;
        if (c.y > c.ground) { c.y = c.ground; c.vy *= -0.4; c.vx *= 0.6; }
        if (c.t > 0.7) c.fly = true;
      } else {
        const to = this.ui.coinTo, dx = to.x - c.x, dy = to.y - c.y, d = Math.hypot(dx, dy), v = 900 * dt;
        if (d < v) c.done = true; else { c.x += dx / d * v; c.y += dy / d * v; }
      }
    }
    this.coins = this.coins.filter(c => !c.done);
    for (const l of this.loot) {
      l.t += dt;
      if (l.t < 0.7) { l.vy += GRAV * 0.6 * dt; l.y += l.vy * dt; }
      else {
        const to = this.ui.bagTo, dx = to.x - l.x, dy = to.y - l.y, d = Math.hypot(dx, dy), v = 700 * dt;
        if (d < v) l.done = true; else { l.x += dx / d * v; l.y += dy / d * v; }
      }
    }
    this.loot = this.loot.filter(l => !l.done);
    for (const p of this.poofs) p.t += dt;
    this.poofs = this.poofs.filter(p => p.t < 0.4);
  }

  // สกิลดาเมจจาก game.useSkill
  skillDamage(amount, mode, crit) {
    if (mode === 'aoe') for (const m of [...this.monsters]) this.damage(m, amount, 'skill', crit);
    else this.damage(this.target(), amount, 'skill', crit);
  }

  // ---------- วาด ----------
  draw() {
    const c = this.ctx;
    c.setTransform(this.k, 0, 0, this.k, 0, 0);
    c.clearRect(0, 0, W, H);
    c.imageSmoothingEnabled = true;

    for (const p of PLATFORMS) if (!p.ground) this.drawPlatform(p);

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

  drawPlatform(p) {
    const c = this.ctx, w = p.x2 - p.x1;
    c.save();
    c.fillStyle = 'rgba(0,0,0,.18)';
    c.beginPath(); c.ellipse(p.x1 + w / 2, p.y + 40, w * 0.42, 8, 0, 0, 7); c.fill();
    const g = c.createLinearGradient(0, p.y, 0, p.y + 34);
    g.addColorStop(0, '#9a8a74'); g.addColorStop(1, '#5a4c40');
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(p.x1, p.y + 4); c.lineTo(p.x2, p.y + 4); c.lineTo(p.x2 - 16, p.y + 22); c.lineTo(p.x1 + w * 0.6, p.y + 36);
    c.lineTo(p.x1 + w * 0.3, p.y + 30); c.lineTo(p.x1 + 14, p.y + 20); c.closePath(); c.fill();
    c.fillStyle = '#7fb04a'; c.beginPath(); c.roundRect(p.x1 - 4, p.y - 2, w + 8, 10, 5); c.fill();
    c.fillStyle = '#5c8a32'; c.fillRect(p.x1, p.y + 5, w, 3);
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
    const hgt = 46, w = hgt * im.naturalWidth / im.naturalHeight;
    c.save();
    c.translate(cat.x, cat.y);
    c.scale(this.hero.face, 1);
    c.fillStyle = 'rgba(0,0,0,.18)'; c.beginPath(); c.ellipse(0, 2, w * 0.3, 4, 0, 0, 7); c.fill();
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
  }
}
