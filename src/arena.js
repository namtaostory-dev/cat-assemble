// ด่านเนื้อเรื่อง (ต้นแบบ): จัดทีมสูงสุด 5 ตัวบนกระดาน 3×3 แล้วสู้กับศัตรูอัตโนมัติ
// วาดด้วย DOM ทั้งหมด (ตัวละครไม่เกิน 10 ตัว) พิกัดเป็นหน่วยฉาก 844×390 เหมือนกรอบเกม
import { CATS, ROLES, UNIT_BASE, HERO_UNIT, ULTS, CAT_ROLE, CAMPAIGN, HERO, ZONES } from './config.js';
import { catById, goldOf } from './game.js';
import { DOG_SRC } from './battle.js';
import { sfx } from './audio.js';
import { fmt } from './format.js';

const W = 844;
// ช่องบนกระดาน: col 0 = แถวหน้า (ใกล้ศัตรู) · row 0 = แถวลึก (อยู่ไกลกล้อง ตัวเล็กลงนิดหน่อย)
const COL_X = [335, 250, 165], ROW_Y = [212, 258, 306], ROW_SCALE = [0.86, 0.93, 1];
const cellPos = (side, col, row) => {
  const x = COL_X[col] + (1 - row) * 16;
  return { x: side === 'ally' ? x : W - x, y: ROW_Y[row], s: ROW_SCALE[row] };
};
// เสียงของท่าไม้ตายแต่ละแบบ (ใช้เสียงสกิลที่มีอยู่)
const ULT_SFX = { titan: 'arc', volt: 'beam', toxin: 'firewall', rock: 'bless', blaze: 'fireball', frost: 'ring',
  gale: 'dash', lumi: 'bless', nox: 'giant', bombardier: 'bombs', saboteur: 'dash', empress: 'rain', smash: 'giant' };
const $ = id => document.getElementById(id);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

export class Arena {
  constructor(root, game, hooks) {
    this.root = root;            // #arena
    this.stage = root.querySelector('.ar-stage');
    this.game = game;
    this.hooks = hooks;          // { toast, onReward(gold, gems), onClose(), save() }
    this.mode = 'closed';        // closed | form | fight | result
    this.speed = 1;
    this.sel = null;
    root.addEventListener('click', e => this.click(e));
  }
  get s() { return this.game.s; }
  get camp() { return this.s.campaign; }

  // ---------- ค่าพลัง ----------
  unitStats(id) {
    const g = CAMPAIGN;
    if (id === 'hero') {
      const lv = 1 + g.lvGrowth * (this.s.level - 1), w = this.game.weapon();
      const mul = lv * (1 + 0.05 * (w ? w.plus : 0));
      return { id, name: 'Meowstral', img: HERO.img, role: HERO_UNIT.role, ult: HERO_UNIT.ult, hp: HERO_UNIT.hp * mul, atk: HERO_UNIT.atk * mul, hero: true };
    }
    const c = catById(id), o = this.s.cats[id], base = UNIT_BASE[c.rarity], role = ROLES[CAT_ROLE[id]];
    const mul = (1 + g.lvGrowth * (o.lv - 1)) * g.starGrowth ** (o.star - 1);
    return { id, name: c.name, img: `assets/cats/${c.img}.png`, role: CAT_ROLE[id], ult: id, rarity: c.rarity,
      hp: base.hp * role.hp * mul, atk: base.atk * role.atk * mul };
  }
  power(u) { return Math.round(u.hp / 4 + u.atk * 3); }
  roster() {
    const ids = ['hero', ...CATS.filter(c => this.s.cats[c.id]).map(c => c.id)];
    return ids.map(id => this.unitStats(id)).sort((a, b) => this.power(b) - this.power(a));
  }
  enemies(n) {
    const g = CAMPAIGN, boss = n % g.bossEvery === 0;
    const count = Math.min(5, 1 + Math.ceil(n / 2));
    const hp = g.enemyHp * g.enemyGrowth ** (n - 1), atk = g.enemyAtk * g.enemyGrowth ** (n - 1);
    const hue = ZONES[Math.floor((n - 1) / 10) % ZONES.length].hue;
    // ตัวแรกยืนแถวหน้ากลาง ตัวต่อไปเติมแถวหน้า แล้วพวกยิงไกลไปอยู่แถวหลัง
    const slots = [[0, 1], [0, 0], [2, 1], [0, 2], [2, 0]];
    const list = [];
    for (let i = 0; i < count; i++) {
      const [col, row] = slots[i];
      if (boss && i === 0) {
        list.push({ id: 'boss', name: 'บอส', img: 'assets/enemies/golem.png', role: 'tank', ult: 'smash', col, row,
          hp: hp * g.bossHp, atk: atk * g.bossAtk, big: true });
      } else {
        const ranged = col === 2, role = ranged ? 'ranged' : 'melee';
        list.push({ id: 'e' + i, name: ranged ? 'หนูยิงไกล' : 'หมาจู่โจม', img: DOG_SRC, role, ult: null, col, row,
          hp: hp * ROLES[role].hp, atk: atk * ROLES[role].atk, hue: ranged ? hue + 160 : hue });
      }
    }
    return list;
  }

  // ---------- เปิด/ปิด ----------
  open() {
    if (!this.camp.team.length) this.autoTeam();
    this.root.hidden = false;
    this.formation();
  }
  close() {
    this.mode = 'closed';
    this.root.hidden = true;
    this.hooks.onClose();
  }
  // ทีมเริ่มต้น: ตัวเราแถวหน้ากลาง แล้วเติมตัวที่แรงที่สุด
  autoTeam() {
    this.camp.team = [];
    for (const u of this.roster()) { if (this.camp.team.length >= CAMPAIGN.teamMax) break; this.place(u.id); }
  }
  // วางตัวลงช่องว่างที่เหมาะกับบทบาท: สายประชิดไปแถวหน้า สายยิงไกลไปแถวหลัง
  place(id) {
    const t = this.camp.team;
    if (t.length >= CAMPAIGN.teamMax || t.some(o => o.id === id)) return false;
    const role = id === 'hero' ? HERO_UNIT.role : CAT_ROLE[id];
    const cols = role === 'tank' || role === 'melee' ? [0, 1, 2] : role === 'assassin' ? [1, 0, 2] : [2, 1, 0];
    for (const col of cols) for (const row of [1, 0, 2]) {
      if (!t.some(o => o.col === col && o.row === row)) { t.push({ id, col, row }); return true; }
    }
    return false;
  }

  // ---------- หน้าจัดทีม ----------
  formation() {
    this.mode = 'form';
    this.sel = null;
    this.foes = this.enemies(this.camp.stage);
    this.renderForm();
  }
  renderForm() {
    const st = this.stage, n = this.camp.stage;
    st.innerHTML = '';
    st.append(this.topBar(`ด่าน ${n}${n % CAMPAIGN.bossEvery === 0 ? ' · บอส' : ''}`));
    // ช่องว่างฝั่งเรา
    for (let col = 0; col < 3; col++) for (let row = 0; row < 3; row++) {
      const p = cellPos('ally', col, row);
      const c = el('button', 'ar-cell' + (this.sel && this.sel.col === col && this.sel.row === row ? ' sel' : ''));
      c.dataset.cell = col + ',' + row;
      c.style.left = p.x + 'px'; c.style.top = p.y + 'px'; c.style.setProperty('--s', p.s);
      c.setAttribute('aria-label', `ช่อง ${col + 1}-${row + 1}`);
      st.append(c);
    }
    const team = this.camp.team.map(o => ({ ...this.unitStats(o.id), col: o.col, row: o.row }));
    const units = [...team.map(u => ({ ...u, side: 'ally' })), ...this.foes.map(u => ({ ...u, side: 'foe' }))];
    units.sort((a, b) => a.row - b.row).forEach(u => st.append(this.unitEl(u, true)));
    const myPow = team.reduce((a, u) => a + this.power(u), 0), foePow = this.foes.reduce((a, u) => a + this.power(u), 0);
    st.append(el('div', 'ar-power', `<span class="me">พลังทีม ${fmt(myPow)}</span> VS <span class="foe">${fmt(foePow)}</span>`));
    // รายชื่อให้เลือกลงทีม
    const bar = el('div', 'ar-roster');
    for (const u of this.roster()) {
      const inTeam = this.camp.team.some(o => o.id === u.id);
      const b = el('button', 'ar-card' + (inTeam ? ' on' : '') + (u.rarity ? ' ' + u.rarity : ''),
        `<img src="${u.img}" alt=""><b>${u.name}</b><small>${ROLES[u.role].name} · ${fmt(this.power(u))}</small>`);
      b.dataset.unit = u.id;
      bar.append(b);
    }
    st.append(bar);
    st.append(el('p', 'ar-hint', 'แตะการ์ดเพื่อลง/ถอดทีม · แตะตัวบนกระดานแล้วแตะช่องว่างเพื่อย้าย'));
    const go = el('button', 'ar-fight', '⚔ สู้!');
    go.dataset.act = 'fight';
    st.append(go);
  }
  topBar(title) {
    const t = el('div', 'ar-top');
    t.innerHTML = `<button class="ar-back" data-act="back">← ออก</button><h3>${title}</h3>`;
    return t;
  }
  unitEl(u, still) {
    const p = cellPos(u.side, u.col, u.row), h = (u.big ? 112 : 74) * p.s;
    const d = el('div', 'ar-u ' + u.side + (still ? '' : ' live'));
    d.style.left = p.x + 'px'; d.style.top = p.y + 'px'; d.style.zIndex = 10 + u.row;
    d.innerHTML = `<i class="sh"></i><img src="${u.img}" alt="" style="height:${h}px${u.hue != null ? `;filter:hue-rotate(${u.hue}deg)` : ''}">` +
      `<span class="bars" style="bottom:${h + 4}px"><i class="hp"></i>${u.ult ? '<i class="en"></i>' : ''}</span>`;
    if (u.side === 'ally' && still) { d.dataset.unitAt = u.col + ',' + u.row; d.classList.add('pick'); }
    if (this.sel && still && u.side === 'ally' && this.sel.col === u.col && this.sel.row === u.row) d.classList.add('sel');
    return d;
  }

  click(e) {
    const t = e.target.closest('[data-act],[data-unit],[data-cell],[data-unit-at]');
    if (!t) return;
    sfx('click');
    const act = t.dataset.act;
    if (act === 'back') return this.close();
    if (act === 'fight') return this.startFight();
    if (act === 'speed') { this.speed = this.speed === 1 ? 2 : 1; t.textContent = '×' + this.speed; return; }
    if (act === 'next' || act === 'retry') return this.formation();
    if (this.mode !== 'form') return;
    const team = this.camp.team;
    if (t.dataset.unit) {
      const id = t.dataset.unit, i = team.findIndex(o => o.id === id);
      if (i >= 0) team.splice(i, 1);
      else if (!this.place(id)) this.hooks.toast(`ลงทีมได้สูงสุด ${CAMPAIGN.teamMax} ตัว`);
      this.sel = null;
    } else if (t.dataset.unitAt) {
      const [col, row] = t.dataset.unitAt.split(',').map(Number);
      this.sel = this.sel && this.sel.col === col && this.sel.row === row ? null : { col, row };
    } else if (t.dataset.cell) {
      const [col, row] = t.dataset.cell.split(',').map(Number);
      const u = this.sel && team.find(o => o.col === this.sel.col && o.row === this.sel.row);
      if (u) { u.col = col; u.row = row; }
      this.sel = null;
    }
    this.hooks.save();
    this.renderForm();
  }

  // ---------- การต่อสู้ ----------
  startFight() {
    if (!this.camp.team.length) return this.hooks.toast('ลงทีมอย่างน้อย 1 ตัวก่อน');
    this.mode = 'fight';
    this.time = 0;
    const st = this.stage;
    st.innerHTML = '';
    st.append(this.topBar(`ด่าน ${this.camp.stage}`));
    const sp = el('button', 'ar-speed', '×' + this.speed); sp.dataset.act = 'speed';
    st.append(sp);
    this.timerEl = el('div', 'ar-timer', '');
    st.append(this.timerEl);
    const mk = (u, side) => {
      const r = ROLES[u.role];
      const x = { ...u, side, max: u.hp, armor: r.armor || 0, rate: r.rate, ranged: r.ranged, back: !!r.back,
        cd: 0.3 + Math.random() * 0.5, energy: 0, shield: 0, stun: 0, dots: [], alive: true, lunge: 0 };
      x.el = this.unitEl(x, false);
      x.hpEl = x.el.querySelector('.hp'); x.enEl = x.el.querySelector('.en'); x.imgEl = x.el.querySelector('img');
      st.append(x.el);
      return x;
    };
    this.units = [
      ...this.camp.team.map(o => mk({ ...this.unitStats(o.id), col: o.col, row: o.row }, 'ally')),
      ...this.foes.map(u => mk(u, 'foe')),
    ];
    this.shots = [];
    this.fxLayer = el('div', 'ar-fx');
    st.append(this.fxLayer);
    sfx('boss');
  }
  alive(side) { return this.units.filter(u => u.alive && u.side === side); }
  // เป้าโจมตีปกติ: คอลัมน์หน้าสุดของอีกฝั่ง (นักฆ่าเล็งคอลัมน์หลังสุด) แถวเดียวกันก่อน
  pickTarget(u) {
    const foes = this.alive(u.side === 'ally' ? 'foe' : 'ally');
    if (!foes.length) return null;
    const col = u.back ? Math.max(...foes.map(f => f.col)) : Math.min(...foes.map(f => f.col));
    const line = foes.filter(f => f.col === col);
    return line.sort((a, b) => Math.abs(a.row - u.row) - Math.abs(b.row - u.row))[0];
  }
  pos(u) { return cellPos(u.side, u.col, u.row); }

  update(dt) {
    if (this.mode !== 'fight') return;
    dt *= this.speed;
    this.time += dt;
    this.timerEl.textContent = '⏱ ' + Math.max(0, CAMPAIGN.timeLimit - this.time).toFixed(0);
    for (const u of this.units) {
      if (!u.alive) continue;
      // พิษ
      for (const d of u.dots) { d.left -= dt; d.acc += dt; if (d.acc >= 0.5) { this.hurt(u, d.dps * d.acc, false, 'dot'); d.acc = 0; } }
      u.dots = u.dots.filter(d => d.left > 0);
      if (!u.alive) continue;
      u.lunge = Math.max(0, u.lunge - dt);
      if (u.stun > 0) { u.stun -= dt; continue; }
      u.cd -= dt;
      if (u.cd > 0) continue;
      const t = this.pickTarget(u);
      if (!t) break;
      u.cd = u.rate;
      if (u.ult && u.energy >= 100) { this.ult(u, t); continue; }
      this.attack(u, t);
    }
    // ลูกยิง
    for (const s of this.shots) {
      s.t += dt;
      const q = Math.min(1, s.t / s.dur);
      s.el.style.left = s.x0 + (s.x1 - s.x0) * q + 'px';
      s.el.style.top = s.y0 + (s.y1 - s.y0) * q - Math.sin(q * Math.PI) * 30 + 'px';
      if (q >= 1) { s.el.remove(); s.done = true; if (s.to.alive) this.hit(s.from, s.to, 1); }
    }
    this.shots = this.shots.filter(s => !s.done);
    // ท่าทาง: พุ่งเข้าหาตอนตี หัวสั่นตอนโดนตี
    for (const u of this.units) {
      const dir = u.side === 'ally' ? 1 : -1;
      const lx = u.lunge > 0 ? Math.sin((1 - u.lunge / 0.3) * Math.PI) * (u.ranged ? 8 : 34) * dir : 0;
      const flip = u.side === 'foe' && !u.big ? -1 : 1;
      u.el.style.transform = `translate(${lx}px, 0)`;
      u.imgEl.style.transform = `translateX(-50%) scaleX(${flip})` + (u.hitT > 0 ? ' translateX(3px)' : '');
      u.hitT = Math.max(0, (u.hitT || 0) - dt);
      u.hpEl.style.width = Math.max(0, u.hp / u.max * 100) + '%';
      if (u.enEl) u.enEl.style.width = Math.min(100, u.energy) + '%';
      u.el.classList.toggle('stun', u.stun > 0);
      u.el.classList.toggle('shield', u.shield > 0);
    }
    const allies = this.alive('ally').length, foes = this.alive('foe').length;
    if (!foes) this.finish(true);
    else if (!allies || this.time >= CAMPAIGN.timeLimit) this.finish(false);
  }

  attack(u, t) {
    u.lunge = 0.3;
    u.energy += 25;
    if (u.ranged) {
      const a = this.pos(u), b = this.pos(t);
      const s = el('i', 'ar-shot');
      s.style.background = u.side === 'ally' ? (catById(u.id)?.color || '#bff4ff') : '#ff8a5a';
      this.fxLayer.append(s);
      this.shots.push({ el: s, from: u, to: t, t: 0, dur: 0.28, x0: a.x, y0: a.y - 40 * a.s, x1: b.x, y1: b.y - 40 * b.s });
      sfx('cat');
    } else {
      setTimeout(() => { if (u.alive && t.alive && this.mode === 'fight') this.hit(u, t, 1); }, 140 / this.speed);
      sfx('slash');
    }
  }
  // ดาเมจหนึ่งครั้ง: สุ่ม ±10% คริ 15% ×1.6 แทงก์ลดดาเมจ โล่ดูดก่อน
  hit(u, t, mul, ultHit) {
    const crit = Math.random() < 0.15;
    const dmg = u.atk * mul * (0.9 + Math.random() * 0.2) * (crit ? 1.6 : 1);
    this.hurt(t, dmg, crit, ultHit ? 'skill' : '');
  }
  hurt(t, dmg, crit, cls) {
    if (!t.alive) return;
    dmg *= 1 - t.armor;
    if (t.shield > 0) { const a = Math.min(t.shield, dmg); t.shield -= a; dmg -= a; }
    t.hp -= dmg;
    t.hitT = 0.12;
    t.energy += 12;
    this.pop(t, fmt(Math.max(1, dmg)), crit ? 'crit' : cls);
    if (t.hp <= 0) { t.alive = false; t.el.classList.add('dead'); sfx('kill'); }
  }
  ult(u, primary) {
    const k = ULTS[u.ult];
    u.energy = 0;
    u.lunge = 0.3;
    const foes = this.alive(u.side === 'ally' ? 'foe' : 'ally'), allies = this.alive(u.side);
    let list;
    if (k.pick === 'all') list = foes;
    else if (k.pick === 'allies') list = allies;
    else if (k.pick === 'col') { const c = Math.min(...foes.map(f => f.col)); list = foes.filter(f => f.col === c); }
    else if (k.pick === 'row') list = foes.filter(f => f.row === primary.row);
    else if (k.pick === 'front') list = [primary];
    else if (k.pick === 'back') { const c = Math.max(...foes.map(f => f.col)); list = [foes.filter(f => f.col === c)[0]]; }
    else if (k.pick === 'lowest') list = [foes.reduce((a, b) => (a.hp < b.hp ? a : b))];
    else list = [primary, ...foes.filter(f => f !== primary)].slice(0, k.pick);
    // ชื่อท่าเหนือหัว + แสงที่ตัวผู้ใช้ + แสงที่เป้าทุกตัว
    const p = this.pos(u);
    const name = el('div', 'ar-ultname', k.name);
    name.style.left = p.x + 'px'; name.style.top = p.y - 110 * p.s + 'px'; name.style.color = k.color;
    this.fxLayer.append(name); setTimeout(() => name.remove(), 1000);
    u.el.classList.add('cast'); setTimeout(() => u.el.classList.remove('cast'), 400);
    sfx(ULT_SFX[u.ult] || 'arc');
    list.forEach((t, i) => {
      const q = this.pos(t);
      const b = el('i', 'ar-burst');
      b.style.left = q.x + 'px'; b.style.top = q.y - 36 * q.s + 'px';
      b.style.background = `radial-gradient(circle, #fff 0%, ${k.color} 35%, transparent 70%)`;
      b.style.animationDelay = i * 0.06 + 's';
      this.fxLayer.append(b); setTimeout(() => b.remove(), 700);
      if (k.kind === 'heal') { const h = u.atk * k.mul; t.hp = Math.min(t.max, t.hp + h); this.pop(t, '+' + fmt(h), 'heal'); }
      else if (k.kind === 'shield') { t.shield += u.atk * k.mul; this.pop(t, 'โล่', 'heal'); }
      else if (k.kind === 'dot') t.dots.push({ dps: u.atk * k.mul, left: k.dur, acc: 0 });
      else {
        // ท่าดาเมจตีเป็นหลายจังหวะ ตัวเลขซ้อนเป็นคอลัมน์
        const hits = k.pick === 'all' || typeof k.pick === 'number' ? 2 : 3;
        for (let n = 0; n < hits; n++) setTimeout(() => { if (t.alive && this.mode === 'fight') this.hit(u, t, k.mul / hits, true); }, (150 + i * 60 + n * 110) / this.speed);
        if (k.kind === 'stun') t.stun = Math.max(t.stun, k.dur);
      }
    });
  }
  pop(u, text, cls) {
    const p = this.pos(u);
    const d = el('div', 'dmg ar-dmg ' + (cls || ''));
    d.innerHTML = '<span class="o"></span><span class="f"></span>';
    d.firstChild.textContent = d.children[1].textContent = text;
    u.popN = ((u.popN || 0) + 1) % 4;
    d.style.left = p.x + (Math.random() * 16 - 8) + 'px';
    d.style.top = p.y - (u.big ? 130 : 92) * p.s - u.popN * 20 + 'px';
    this.fxLayer.append(d);
    setTimeout(() => d.remove(), 900);
  }

  finish(win) {
    this.mode = 'result';
    const n = this.camp.stage;
    let html;
    if (win) {
      const boss = n % CAMPAIGN.bossEvery === 0;
      const gems = CAMPAIGN.reward.gems + (boss ? CAMPAIGN.reward.bossGems : 0);
      const gold = goldOf(this.s.maxStage) * CAMPAIGN.reward.goldKills;
      this.camp.stage++;
      this.hooks.onReward(gold, gems);
      sfx('stage');
      html = `<h2 class="win">ชนะ!</h2><p>ผ่านด่าน ${n}</p><p class="rw"><img src="assets/ui/coin.png" alt=""> ${fmt(gold)} · <img src="assets/ui/gem.png" alt=""> ${gems}</p>` +
        `<button class="btn" data-act="next">ด่านถัดไป</button> <button class="btn ghost" data-act="back">ออก</button>`;
    } else {
      sfx('bossFail');
      html = `<h2 class="lose">แพ้…</h2><p>${this.time >= CAMPAIGN.timeLimit ? 'หมดเวลา' : 'ทีมล้มหมดแล้ว'} ลองอัปเลเวลแมว อัปดาว หรือย้ายตำแหน่งดูนะ</p>` +
        `<button class="btn" data-act="retry">จัดทีมใหม่</button> <button class="btn ghost" data-act="back">ออก</button>`;
    }
    this.hooks.save();
    setTimeout(() => this.stage.append(el('div', 'ar-result', html)), 500);
  }
}
