import { BAL, CATS, GACHA, STAR, SKILLS, HERO } from './config.js';
import { fmt, fmtTime } from './format.js';
import { newState, loadState, saveState, clearSave, exportSave, importSave } from './state.js';
import { Game, catById, swordDmgAt, nextMile, isBigBoss, skillPower } from './game.js';

const $ = id => document.getElementById(id);
const gameEl = $('game'), fx = $('fx');
let scale = 1;

// ---------- ย่อ/ขยายฉาก 390×844 ให้พอดีจอ เว้นรอยบาก/Dynamic Island และขอบล่าง ----------
const probe = document.createElement('div');
probe.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)';
document.body.appendChild(probe);
function fit() {
  const cs = getComputedStyle(probe);
  const top = parseFloat(cs.paddingTop) || 0, bottom = parseFloat(cs.paddingBottom) || 0;
  const w = window.innerWidth, h = window.innerHeight - top - bottom;
  scale = Math.min(w / 390, h / 844);
  const x = (w - 390 * scale) / 2, y = top + (h - 844 * scale) / 2;
  gameEl.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
}
window.addEventListener('resize', fit);
window.addEventListener('orientationchange', () => setTimeout(fit, 200));
fit();

// พิกัดกลางขององค์ประกอบ ในระบบพิกัดของฉาก
function center(el) {
  const a = el.getBoundingClientRect(), g = gameEl.getBoundingClientRect();
  return { x: (a.left - g.left + a.width / 2) / scale, y: (a.top - g.top + a.height / 2) / scale };
}
function toScene(clientX, clientY) {
  const g = gameEl.getBoundingClientRect();
  return { x: (clientX - g.left) / scale, y: (clientY - g.top) / scale };
}

// ---------- ศัตรู (ภาพชั่วคราว วาดด้วย SVG) ----------
function enemySvg(e) {
  const crown = e.big
    ? '<path d="M70 -2 L80 24 L95 4 L110 24 L125 4 L140 24 L150 -2 L150 30 L70 30Z" fill="#ffc83a" stroke="#a87a10" stroke-width="3"/>'
    : '';
  return `<svg viewBox="0 0 220 280" style="filter:hue-rotate(${e.hue}deg)">
    <ellipse cx="110" cy="268" rx="90" ry="10" fill="rgba(0,0,0,.25)"/>
    <rect x="40" y="150" width="140" height="115" rx="50" fill="#a8774a"/>
    <ellipse cx="110" cy="210" rx="45" ry="40" fill="#e8cfa6"/>
    <rect x="50" y="240" width="40" height="30" rx="14" fill="#8a5d36"/><rect x="130" y="240" width="40" height="30" rx="14" fill="#8a5d36"/>
    <path d="M45 50 Q20 40 22 90 Q30 110 55 95Z M175 50 Q200 40 198 90 Q190 110 165 95Z" fill="#6e4421"/>
    <ellipse cx="110" cy="95" rx="72" ry="66" fill="#b8865a"/>
    <path d="M60 70 L95 82 M160 70 L125 82" stroke="#3a2210" stroke-width="7" stroke-linecap="round"/>
    <circle cx="82" cy="92" r="9" fill="#2a1a0c"/><circle cx="138" cy="92" r="9" fill="#2a1a0c"/>
    <circle cx="85" cy="89" r="3" fill="#fff"/><circle cx="141" cy="89" r="3" fill="#fff"/>
    <ellipse cx="110" cy="128" rx="48" ry="32" fill="#e8cfa6"/>
    <ellipse cx="110" cy="112" rx="16" ry="10" fill="#2a1a0c"/>
    <path d="M78 140 Q110 162 142 140 L142 150 Q110 172 78 150Z" fill="#7a1f1f"/>
    <path d="M84 142 L90 130 L96 146 M124 146 L130 130 L136 142" fill="#fff"/>
    <rect x="48" y="158" width="124" height="18" rx="9" fill="${e.boss ? '#d23b2b' : '#3b6fd2'}"/>
    <path d="M62 158 L68 146 L74 158 M92 158 L98 146 L104 158 M116 158 L122 146 L128 158 M146 158 L152 146 L158 158" fill="#e8e8e8"/>
    <circle cx="110" cy="182" r="10" fill="#ffc83a" stroke="#a87a10" stroke-width="2"/>${crown}
  </svg>`;
}
function showEnemy(e) {
  const el = $('enemy');
  const size = e.boss ? (e.big ? 1.12 : 1) : 0.72;
  el.style.width = 210 * size + 'px';
  el.style.height = 270 * size + 'px';
  el.style.marginLeft = -105 * size + 'px';
  el.style.top = 214 + 270 * (1 - size) * 0.9 + 'px';
  el.innerHTML = enemySvg(e);
  el.classList.remove('hit');
  el.classList.add('spawn');
  setTimeout(() => el.classList.remove('spawn'), 300);
  $('bossbar').classList.toggle('boss', e.boss);
}

// ---------- เอฟเฟกต์ ----------
let fxCount = 0;
function addFx(el, ms) {
  if (fxCount > 45) return false;
  fx.appendChild(el); fxCount++;
  setTimeout(() => { el.remove(); fxCount--; }, ms);
  return true;
}
function popText(text, x, y, cls) {
  const d = document.createElement('div');
  d.className = 'dmg ' + (cls || '');
  d.textContent = text;
  d.style.left = (x - 24 + Math.random() * 20) + 'px';
  d.style.top = (y - 20) + 'px';
  addFx(d, 800);
}
function boom(x, y, color) {
  const b = document.createElement('div');
  b.className = 'boom';
  b.style.left = x + 'px'; b.style.top = y + 'px';
  b.style.background = `radial-gradient(circle, #fff 0%, ${color} 40%, transparent 70%)`;
  addFx(b, 300);
}
function slashFx(x, y, crit) {
  const s = document.createElement('div');
  s.className = 'slashfx' + (crit ? ' crit' : '');
  s.style.left = x + 'px'; s.style.top = y + 'px';
  s.style.setProperty('--r', (-60 + Math.random() * 60) + 'deg');
  addFx(s, 180);
}
function flash(color) {
  const f = document.createElement('div');
  f.className = 'flash'; f.style.background = color;
  fx.appendChild(f); setTimeout(() => f.remove(), 500);
}
let toastTimer;
function toast(t, ms = 1200) {
  const el = $('toast');
  el.textContent = t; el.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('on'), ms);
}
function enemyPoint() {
  const c = center($('enemy'));
  return { x: c.x + Math.random() * 70 - 35, y: c.y + Math.random() * 70 - 50 };
}

// ---------- แมวบนหน้าผา: ช่อง 0-3 ซ้าย, 4-7 ขวา ----------
const LEDGE_Y = [344, 438, 532, 626];
const slots = Array.from({ length: BAL.teamSize }, (_, i) => {
  const right = i >= 4, row = i % 4;
  const el = document.createElement('div');
  el.className = 'cat empty ' + (right ? 'r' : 'l');
  el.style[right ? 'right' : 'left'] = (row % 2 ? 10 : 4) + 'px';
  el.style.top = LEDGE_Y[row] + 'px';
  el.innerHTML = '<div class="bar"><i></i></div><img alt=""><span class="lvtag"></span>';
  $('cats').appendChild(el);
  return { el, img: el.querySelector('img'), bar: el.querySelector('.bar i'), tag: el.querySelector('.lvtag'), id: null, charge: Math.random() };
});
function layoutTeam() {
  slots.forEach((sl, i) => {
    const id = state.team[i] || null;
    if (sl.id !== id) {
      sl.id = id;
      sl.el.classList.toggle('empty', !id);
      if (id) sl.img.src = `assets/cats/${catById(id).img}.png`;
    }
  });
  buildSkillBar();
}

// shots > 1 เมื่อชดเชยเฟรมที่ช้า: ยิงลูกเดียวแต่ดาเมจรวมทุกนัด
function shoot(sl, shots = 1) {
  const from = center(sl.el), to = enemyPoint(), col = catById(sl.id).color;
  const dmg = game.catDps(sl.id) * BAL.catPeriod * shots;
  sl.el.classList.add('atk');
  setTimeout(() => sl.el.classList.remove('atk'), 120);
  const s = document.createElement('div');
  s.className = 'shot';
  s.style.background = col; s.style.boxShadow = `0 0 12px 4px ${col}`;
  if (!addFx(s, 300)) { lastHit = to; game.damage(dmg, 'cat'); return; }
  s.animate([{ transform: `translate(${from.x}px,${from.y}px)` }, { transform: `translate(${to.x}px,${to.y}px)` }], { duration: 260, easing: 'ease-in' })
    .onfinish = () => { boom(to.x, to.y, col); lastHit = to; game.damage(dmg, 'cat'); };
}

// ---------- ตัวเรา: ฟันอัตโนมัติ + แตะเพื่อฟันเพิ่ม ----------
let lastHit = null, heroCharge = 0;
function heroSlash(p, source) {
  lastHit = p;
  if (source === 'tap') { if (!game.tap()) { lastHit = null; return; } }
  else game.slash('auto');
  const h = $('hero');
  h.classList.remove('slash'); void h.offsetWidth; h.classList.add('slash');
  setTimeout(() => h.classList.remove('slash'), 90);
}
$('battle').addEventListener('pointerdown', e => heroSlash(toScene(e.clientX, e.clientY), 'tap'));
$('fight').addEventListener('click', () => {
  if (game.challengeBoss()) { toast('ท้าบอสอีกครั้ง!'); return; }
  heroSlash(enemyPoint(), 'tap');
});

// ---------- เริ่มเกม ----------
let state = loadState() || newState();
let game;
function startGame(s) {
  state = s;
  game = new Game(state, {
    onSpawn: showEnemy,
    onHit(amount, source, crit) {
      const p = lastHit || enemyPoint();
      lastHit = null;
      if (source === 'dot') return popText(fmt(amount), p.x, p.y, 'cat');
      if (source === 'tap' || source === 'auto') slashFx(p.x, p.y, crit);
      popText(fmt(amount) + (crit ? '!' : ''), p.x, p.y, crit ? 'crit' : source === 'cat' ? 'cat' : '');
      const el = $('enemy');
      el.classList.remove('hit'); void el.offsetWidth; el.classList.add('hit');
    },
    onKill(e, gold, gems) {
      const c = center($('enemy'));
      popText('+' + fmt(gold), c.x, c.y - 40, 'gold');
      if (gems) popText('+' + gems + ' เพชร', c.x, c.y - 70, 'gold');
    },
    onStage(stage) {
      toast(isBigBoss(stage - 1) ? `ล้มบอสใหญ่! ไปด่าน ${stage}` : `ผ่านด่าน! ไปด่าน ${stage}`);
      saveState(state);
    },
    onBossFail() { toast('บอสหนีไปแล้ว! อัปเกรดแล้วกด FIGHT เพื่อท้าใหม่', 2500); },
    onNewCat() { layoutTeam(); },
    onSkill(id) { flash(catById(id).color); toast(`${SKILLS[id].name}!`); },
  });
  layoutTeam();
  updateHud();
}

// ---------- แถบสกิล: ตามช่องในทีม ----------
let skillEls = [];
function buildSkillBar() {
  const bar = $('skills');
  bar.innerHTML = '';
  skillEls = slots.map((sl, i) => {
    const id = state.team[i];
    const b = document.createElement('button');
    b.className = 'sk' + (id ? '' : ' empty');
    if (id) {
      b.setAttribute('aria-label', 'สกิล' + SKILLS[id].name);
      b.innerHTML = `<img src="assets/skills/${catById(id).img}.png" alt=""><div class="cd"></div><span class="t"></span>`;
      b.addEventListener('click', () => {
        const st = game.skillState(id);
        if (!st.ready) return toast(`${SKILLS[id].name} พร้อมใน ${fmtTime(st.left)}`);
        game.useSkill(id);
      });
    } else {
      b.innerHTML = '<img alt="">';
      b.setAttribute('aria-hidden', 'true');
    }
    bar.appendChild(b);
    return id ? { id, b, ov: b.querySelector('.cd'), t: b.querySelector('.t') } : null;
  });
}
const shortTime = s => s >= 60 ? Math.ceil(s / 60) + 'น.' : Math.ceil(s) + 'วิ';
function updateSkills() {
  const now = Date.now();
  for (const el of skillEls) {
    if (!el) continue;
    const st = game.skillState(el.id, now);
    el.b.classList.toggle('on', st.activeLeft > 0);
    el.b.classList.toggle('ready', st.ready);
    el.ov.style.setProperty('--p', (st.frac * 100) + '%');
    el.t.textContent = st.activeLeft > 0 ? Math.ceil(st.activeLeft) + 'วิ' : st.ready ? '' : shortTime(st.left);
  }
}

// ---------- HUD ----------
function updateHud() {
  const s = state, e = game.enemy;
  $('gold').textContent = fmt(s.gold);
  $('gems').textContent = fmt(game.gems());
  $('heroLv').textContent = s.swordLv;
  $('s0').textContent = s.stage > 1 ? s.stage - 1 : '';
  $('s1').textContent = s.stage;
  $('s2').textContent = s.stage + 1;
  document.querySelector('.st.cur').classList.toggle('big', isBigBoss(s.stage));
  $('ename').textContent = e.name;
  $('hptxt').textContent = fmt(Math.max(0, e.hp)) + ' HP';
  $('hpbar').style.width = Math.max(0, e.hp / e.maxHp * 100) + '%';
  $('dps').textContent = 'DPS ' + fmt(game.totalDps() + game.heroDps());
  const wave = $('wave');
  if (e.boss) {
    wave.textContent = (game.active('frost') ? '❄ ' : '⏱ ') + Math.max(0, game.bossLeft).toFixed(1) + ' วิ';
    wave.classList.toggle('hot', game.bossLeft < 10);
  } else {
    wave.textContent = s.farming ? 'ฟาร์มเหรียญ · กด FIGHT' : `ศัตรู ${s.kills + 1}/${BAL.enemiesPerStage}`;
    wave.classList.remove('hot');
  }
  $('fight').classList.toggle('pulse', s.farming);
  slots.forEach(sl => { if (sl.id) sl.tag.textContent = 'Lv ' + s.cats[sl.id].lv; });
  $('heroBadge').classList.toggle('on', canUpgradeSomething());
  $('gachaBadge').classList.toggle('on', game.gems() >= GACHA.cost1);
}
function canUpgradeSomething() {
  if (game.quote('sword', 1).cost <= state.gold || game.quote('speed', 1).cost <= state.gold) return true;
  return Object.keys(state.cats).some(id => game.quote('cat', 1, id).cost <= state.gold || game.canStarUp(id));
}

// ---------- แผ่นทีมแมว ----------
let buyMode = 1;
let rows = [];
const starsHtml = n => `<span class="stars">${'★'.repeat(n)}<span class="off">${'★'.repeat(STAR.max - n)}</span></span>`;
function buildHeroList() {
  const list = $('heroList');
  list.innerHTML = '';
  rows = [];
  const add = (key, img, cls = '') => {
    const r = document.createElement('div');
    r.className = 'row ' + cls;
    r.innerHTML = `<div class="pic"><img src="${img}" alt=""></div><div class="mid"><div class="nm"></div><div class="sub"></div></div>` +
      (cls === 'unowned' ? '' : `<button class="buy" data-key="${key}"><b></b><span><img src="assets/ui/coin.png" alt=""><em></em></span></button>`);
    list.appendChild(r);
    rows.push({ key, r, nm: r.querySelector('.nm'), sub: r.querySelector('.sub'), btn: r.querySelector('.buy'), label: r.querySelector('.buy b'), cost: r.querySelector('.buy em') });
  };
  const sect = t => { const h = document.createElement('div'); h.className = 'sect'; h.textContent = t; list.appendChild(h); };
  sect('ตัวเรา');
  add('sword', HERO.img);
  add('speed', HERO.img);
  sect('แมวในทีม');
  state.team.forEach(id => add('cat:' + id, `assets/cats/${catById(id).img}.png`));
  const missing = CATS.filter(c => !state.cats[c.id]);
  if (missing.length) {
    sect('ยังไม่มี · หาได้จากกาชา');
    missing.forEach(c => add('none:' + c.id, `assets/cats/${c.img}.png`, 'unowned'));
  }
}
function setHtml(el, html) { if (el.innerHTML !== html) el.innerHTML = html; }
function updateHeroList() {
  const s = state;
  for (const row of rows) {
    const [kind, id] = row.key.split(':');
    let q, nm, sub, label;
    if (kind === 'sword') {
      q = game.quote('sword', buyMode);
      nm = `พลังดาบ<small>Lv ${s.swordLv}</small>`;
      sub = `ดาเมจต่อการฟัน ${fmt(game.slashDamage())} · ต่อเลเวล +${fmt(swordDmgAt(s.swordLv + 1) - swordDmgAt(s.swordLv))}<br><span class="p">×2 ที่ Lv ${nextMile(s.swordLv, BAL.swordMileStep)} · คริติคอล ${Math.round(game.critChance() * 100)}%</span>`;
      label = `อัป ×${q.n}`;
    } else if (kind === 'speed') {
      q = game.quote('speed', buyMode);
      const rate = BAL.speedBase + BAL.speedPerLevel * s.speedLv;
      nm = `ความเร็วดาบ<small>Lv ${s.speedLv}/${BAL.speedMaxLevel}</small>`;
      sub = `ฟันอัตโนมัติ ${rate.toFixed(1)} ครั้ง/วิ<br><span class="p">แตะจอเพื่อฟันเพิ่มได้สูงสุด ${BAL.tapMaxPerSec} ครั้ง/วิ</span>`;
      label = q.maxed ? 'สูงสุด' : `อัป ×${q.n}`;
    } else if (kind === 'cat') {
      const c = catById(id), o = s.cats[id];
      q = game.quote('cat', buyMode, id);
      const need = game.starCost(id);
      const starBtn = need === null ? '' :
        `<button class="starup ${o.dupes >= need ? 'ok' : ''}" data-star="${id}">อัปดาว ${o.dupes}/${need}</button>`;
      nm = `${c.name}<span class="rar ${c.rarity}">${c.rarity}</span> <small>Lv ${o.lv}</small>`;
      sub = `${starsHtml(o.star)}${starBtn}<br>DPS ${fmt(game.catDps(id))} · ${SKILLS[id].name}: ${SKILLS[id].desc(skillPower(o.star))}`;
      label = `อัป ×${q.n}`;
    } else {
      const c = catById(id);
      setHtml(row.nm, `${c.name}<span class="rar ${c.rarity}">${c.rarity}</span>`);
      setHtml(row.sub, `<span class="tag">${SKILLS[id].name}: ${SKILLS[id].desc(1)}</span>`);
      continue;
    }
    setHtml(row.nm, nm);
    setHtml(row.sub, sub);
    row.label.textContent = label;
    row.cost.textContent = q.maxed ? '-' : fmt(q.cost, true);
    row.btn.classList.toggle('no', q.maxed || q.cost > s.gold);
  }
}
$('heroList').addEventListener('click', e => {
  const star = e.target.closest('[data-star]');
  if (star) {
    const id = star.dataset.star;
    if (game.starUp(id)) { toast(`${catById(id).name} ★${state.cats[id].star}!`); saveState(state); }
    else toast(`ต้องได้${catById(id).name}ซ้ำอีก ${game.starCost(id) - state.cats[id].dupes} ตัว`);
    updateHeroList(); return;
  }
  const b = e.target.closest('.buy');
  if (!b) return;
  const [kind, id] = b.dataset.key.split(':');
  if (!game.buy(kind, buyMode, id)) toast(kind === 'speed' && state.speedLv >= BAL.speedMaxLevel ? 'ความเร็วดาบเต็มแล้ว' : 'เหรียญไม่พอ');
  updateHeroList(); updateHud();
});
$('modes').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  buyMode = b.dataset.mode === 'max' ? 'max' : +b.dataset.mode;
  $('modes').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
  updateHeroList();
});

// ---------- กาชา ----------
function buildBanner() {
  const order = ['SSR', 'SR', 'R'];
  $('banner').innerHTML = [...CATS].sort((a, b) => order.indexOf(a.rarity) - order.indexOf(b.rarity)).map(c => {
    const o = state.cats[c.id];
    return `<div class="bcat ${c.rarity}"><span class="rar ${c.rarity}">${c.rarity}</span>${o ? `<span class="own">★${o.star}</span>` : ''}<img src="assets/cats/${c.img}.png" alt=""><div class="nm">${c.name}</div></div>`;
  }).join('');
}
function updateGacha() {
  const g = game.gems();
  $('gGems').textContent = fmt(g);
  $('pityText').textContent = `อีก ${GACHA.pity - state.pity} ครั้งการันตี SSR`;
  $('pull1').disabled = g < GACHA.cost1;
  $('pull10').disabled = g < GACHA.cost10;
}
function doPull(n) {
  const res = game.pull(n);
  if (!res) return toast('เพชรไม่พอ');
  saveState(state);
  const cards = $('cards');
  cards.className = 'cards' + (n === 1 ? ' one' : '');
  cards.innerHTML = res.map((r, i) => {
    const c = catById(r.id);
    const note = r.isNew ? '<div class="note new">ใหม่!</div>'
      : r.refund ? `<div class="note">★5 แล้ว +${r.refund} เพชร</div>`
      : `<div class="note${r.canStar ? ' new' : ''}">ซ้ำ +1${r.canStar ? ' อัปดาวได้' : ''}</div>`;
    return `<div class="card ${r.rarity}" style="animation-delay:${i * 0.12}s"><span class="rar ${r.rarity}">${r.rarity}</span><img src="assets/cats/${c.img}.png" alt=""><div class="nm">${c.name}</div>${note}</div>`;
  }).join('');
  $('gachaResult').hidden = false;
  if (res.some(r => r.rarity === 'SSR')) flash('#ffc83a');
  buildBanner(); updateGacha(); buildHeroList(); updateHud();
}
$('pull1').addEventListener('click', () => doPull(1));
$('pull10').addEventListener('click', () => doPull(10));
$('resultOk').addEventListener('click', () => ($('gachaResult').hidden = true));

// ---------- เปิด/ปิดแผ่น ----------
function openSheet(id) {
  document.querySelectorAll('.sheet').forEach(s => s.classList.toggle('open', s.id === id));
  if (id === 'heroesSheet') { buildHeroList(); updateHeroList(); }
  if (id === 'gachaSheet') { buildBanner(); updateGacha(); }
  if (id === 'settingsSheet') refreshSettings();
}
function toggleSheet(id) { $(id).classList.contains('open') ? closeSheets() : openSheet(id); }
function closeSheets() { document.querySelectorAll('.sheet').forEach(s => s.classList.remove('open')); }
$('openHeroes').addEventListener('click', () => toggleSheet('heroesSheet'));
$('openGacha').addEventListener('click', () => toggleSheet('gachaSheet'));
$('openSettings').addEventListener('click', () => toggleSheet('settingsSheet'));
document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', closeSheets));

// ---------- Setting ----------
function refreshSettings() {
  $('exportText').value = exportSave(state);
  $('importErr').textContent = '';
  const st = state.stats;
  $('statsText').textContent = `ด่านสูงสุด ${state.maxStage} · แตะ ${fmt(st.taps)} ครั้ง\nล้มศัตรู ${fmt(st.kills)} ตัว · ล้มบอส ${fmt(st.bosses)} ตัว\nเปิดกาชา ${fmt(state.pulls)} ครั้ง`;
}
$('copyBtn').addEventListener('click', async () => {
  const t = $('exportText');
  try { await navigator.clipboard.writeText(t.value); toast('คัดลอกเซฟแล้ว'); }
  catch { t.select(); document.execCommand('copy'); toast('คัดลอกเซฟแล้ว'); }
});
$('importBtn').addEventListener('click', () => {
  try {
    const s = importSave($('importText').value);
    if (!confirm(`โหลดเซฟด่าน ${s.stage} แทนความคืบหน้าปัจจุบันไหม?`)) return;
    startGame(s); saveState(state); closeSheets(); toast('โหลดเซฟแล้ว');
  } catch {
    $('importErr').textContent = 'ข้อความเซฟไม่ถูกต้อง ลองคัดลอกใหม่ทั้งหมด';
  }
});
$('importText').addEventListener('input', () => ($('importErr').textContent = ''));
$('resetBtn').addEventListener('click', () => {
  if (!confirm('ลบเซฟทั้งหมดและเริ่มใหม่จากด่าน 1 ใช่ไหม?')) return;
  clearSave(); startGame(newState()); saveState(state); closeSheets(); toast('เริ่มเกมใหม่แล้ว');
});

// ---------- ติดตั้ง PWA ----------
let installEvt = null;
const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault(); installEvt = e;
  $('installCard').hidden = false;
});
if (!isStandalone() && /iphone|ipad|ipod/i.test(navigator.userAgent)) {
  $('installCard').hidden = false;
  $('installText').textContent = 'บน iPhone: กดปุ่มแชร์ใน Safari แล้วเลือก "เพิ่มไปยังหน้าจอโฮม" เกมจะเปิดเต็มจอ เล่นออฟไลน์ได้ และเซฟไม่หายง่าย';
  $('installBtn').hidden = true;
}
$('installBtn').addEventListener('click', async () => {
  if (!installEvt) return;
  installEvt.prompt();
  await installEvt.userChoice;
  installEvt = null; $('installCard').hidden = true;
});
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

// ---------- ออฟไลน์ ----------
let offAmount = 0;
function checkOffline(sinceMs) {
  const sec = (Date.now() - sinceMs) / 1000;
  offAmount = game.offlineGold(sec);
  if (offAmount <= 0) return;
  $('offText').textContent = `ระหว่างที่ไม่อยู่ ${fmtTime(Math.min(sec, BAL.offlineCapSec))} ทีมแมวช่วยกันหาเหรียญได้`;
  $('offGold').textContent = fmt(offAmount);
  $('offCost').textContent = BAL.offlineX2Gems;
  $('offX2').disabled = game.gems() < BAL.offlineX2Gems;
  $('offline').hidden = false;
}
$('offTake').addEventListener('click', () => { state.gold += offAmount; $('offline').hidden = true; saveState(state); });
$('offX2').addEventListener('click', () => {
  if (!game.spendGems(BAL.offlineX2Gems)) return;
  state.gold += offAmount * 2;
  $('offline').hidden = true; saveState(state);
});

// ---------- เซฟอัตโนมัติ ----------
let hiddenAt = null;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { hiddenAt = Date.now(); saveState(state); }
  else if (hiddenAt) { checkOffline(hiddenAt); hiddenAt = null; last = performance.now(); }
});
window.addEventListener('pagehide', () => saveState(state));
setInterval(() => saveState(state), BAL.saveEverySec * 1000);

// ---------- ลูปหลัก ----------
// นับตามเวลาจริง: ถ้าเฟรมมาช้าจะชดเชยให้สูงสุด 5 วิ ช่วงที่หายไปนานกว่านั้นนับเป็นเวลาออฟไลน์แทน
let last = performance.now(), hudAcc = 0;
function loop(now) {
  const dt = Math.min(5, (now - last) / 1000);
  last = now;
  game.tick(dt);
  for (const sl of slots) {
    if (!sl.id) continue;
    sl.charge += dt / BAL.catPeriod;
    const shots = Math.floor(sl.charge);
    if (shots > 0) { sl.charge -= shots; shoot(sl, shots); }
    sl.bar.style.width = (sl.charge * 100) + '%';
  }
  heroCharge += dt * game.autoRate();
  let n = Math.min(20, Math.floor(heroCharge));
  heroCharge -= Math.floor(heroCharge);
  while (n-- > 0) heroSlash(enemyPoint(), 'auto');
  $('heroBar').firstElementChild.style.width = (heroCharge * 100) + '%';
  hudAcc += dt;
  if (hudAcc >= 0.1) {
    hudAcc = 0;
    updateHud();
    updateSkills();
    if ($('heroesSheet').classList.contains('open')) updateHeroList();
    if ($('gachaSheet').classList.contains('open')) updateGacha();
  }
  requestAnimationFrame(loop);
}

const firstLoad = !loadState();
startGame(state);
if (!firstLoad) checkOffline(state.lastSeen);
else toast('แตะจอเพื่อฟันเพิ่ม · เปิดกาชาเพื่อหาแมวเข้าทีม!', 3000);
requestAnimationFrame(loop);
