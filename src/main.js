import { BAL, CATS, GACHA, STAR, HERO, PASSIVES, WEAPONS, WSKILLS, DEV, EQUIP, LEVEL, MARKET, POTIONS, BREADS, OUTFIT_PRICE } from './config.js';
import { fmt, fmtTime } from './format.js';
import { newState, loadState, saveState, clearSave, exportSave, importSave } from './state.js';
import { Game, catById, catDpsAt, swordDmgAt, nextMile, isBigBoss, skillPower, itemValue, itemName, expNeed, slotsAtLevel } from './game.js';
import { Battle, W, H } from './battle.js';
import { sfx, setSound, unlock, pause, setTrack } from './audio.js';

const $ = id => document.getElementById(id);
const gameEl = $('game'), fx = $('fx');
let scale = 1, view = null;

// ---------- ย่อ/ขยายฉาก 844×390 ให้พอดีจอแนวนอน เว้นรอยบาก/Dynamic Island ด้านข้างและแถบโฮม ----------
const probe = document.createElement('div');
probe.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
document.body.appendChild(probe);
function fit() {
  const cs = getComputedStyle(probe);
  const t = parseFloat(cs.paddingTop) || 0, r = parseFloat(cs.paddingRight) || 0;
  const b = parseFloat(cs.paddingBottom) || 0, l = parseFloat(cs.paddingLeft) || 0;
  const w = window.innerWidth - l - r, h = window.innerHeight - t - b;
  scale = Math.min(w / W, h / H);
  const x = l + (w - W * scale) / 2, y = t + (h - H * scale) / 2;
  gameEl.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
  // ฉากวาดเต็มจอ (รวมขอบนอกกรอบเกม) ส่วน HUD อยู่ในกรอบที่หลบ safe area
  view = { l: -x / scale, t: -y / scale, w: window.innerWidth / scale, h: window.innerHeight / scale };
  battle?.resize(scale, view);
  layoutMarket();
}
window.addEventListener('resize', fit);
window.addEventListener('orientationchange', () => setTimeout(fit, 250));
// iOS ไม่สนใจ user-scalable=no: กันซูมสองนิ้วและแตะสองครั้งเอง และถ้าหน้าเลื่อนไปเมื่อไหร่ให้ดึงกลับ
['gesturestart', 'gesturechange'].forEach(ev => document.addEventListener(ev, e => e.preventDefault(), { passive: false }));
document.addEventListener('dblclick', e => e.preventDefault(), { passive: false });
window.addEventListener('scroll', () => { if (window.scrollX || window.scrollY) window.scrollTo(0, 0); });

function toScene(clientX, clientY) {
  const g = gameEl.getBoundingClientRect();
  return { x: (clientX - g.left) / scale, y: (clientY - g.top) / scale };
}

// ---------- เอฟเฟกต์บนชั้น DOM (พิกัดเดียวกับฉาก) ----------
let fxCount = 0;
function addFx(el, ms) {
  if (fxCount > 160) return false;
  fx.appendChild(el); fxCount++;
  setTimeout(() => { el.remove(); fxCount--; }, ms);
  return true;
}
// ตัวเลขเต็มมีคอมม่าจนถึง 999,999,999 เกินนั้นใช้หน่วยย่อ
const fmtDmg = n => n < 1e9 ? Math.floor(n).toLocaleString('en-US') : fmt(n);
// ตีรัวๆ ตัวเลขจะซ้อนขึ้นไปเป็นกองเหนือหัวมอนสเตอร์ตัวนั้น แยกตามแหล่งดาเมจ
const stacks = new Map();
function stackRow(key) {
  const now = performance.now(), st = stacks.get(key);
  if (!st || now - st.t > 380) { stacks.set(key, { n: 0, t: now }); return 0; }
  st.t = now;
  st.n = (st.n + 1) % 5;
  return st.n;
}
function popText(text, x, y, cls) {
  const d = document.createElement('div');
  d.className = 'dmg ' + (cls || '');
  d.innerHTML = '<span class="o"></span><span class="f"></span>' + (cls === 'crit' ? '<span class="crittag">CRIT</span>' : '');
  d.firstChild.textContent = d.children[1].textContent = text;
  d.style.left = x + 'px';
  d.style.top = y + 'px';
  addFx(d, 900);
}
// row: แถวที่กำหนดเอง (สกิลหลายครั้งเรียงเป็นคอลัมน์ขึ้นไป) ถ้าไม่ให้มาจะซ้อนตามจังหวะตี
function popOn(m, amount, cls, key, row) {
  const off = { hero: -12, cat: 26 }[key] || 0;
  if (row == null) row = stackRow(m.id + key);
  const y = battle.sy(m.y - m.h) - 24 - row * (key === 'skill' ? 23 : cls === 'crit' ? 28 : 24);
  popText(fmtDmg(amount), battle.sx(m.x) + off + (key === 'skill' ? 0 : Math.random() * 8 - 4), y, cls);
}
function boomFx(x, y, color) {
  const b = document.createElement('div');
  b.className = 'boom';
  b.style.left = x + 'px'; b.style.top = y + 'px';
  b.style.background = `radial-gradient(circle, #fff 0%, ${color} 40%, transparent 70%)`;
  addFx(b, 300);
}
function slashFx(x, y, face, crit) {
  const s = document.createElement('div');
  s.className = 'slashfx' + (crit ? ' crit' : '');
  s.style.left = x + 'px'; s.style.top = y + 'px';
  s.style.setProperty('--f', face);
  addFx(s, 180);
}
let lastTapFx = 0;
function tapFx(x, y) {
  const now = performance.now();
  if (now - lastTapFx < 120) return;
  lastTapFx = now;
  const t = document.createElement('div');
  t.className = 'tapfx';
  t.innerHTML = '<span>TAP</span>';
  t.style.left = x + 'px'; t.style.top = y + 'px';
  addFx(t, 400);
}
function lvupFx(lv, newSlot) {
  const d = document.createElement('div');
  d.className = 'lvup';
  d.innerHTML = `LEVEL UP! ${lv}` + (newSlot ? `<small>ปลดช่องคู่หูใหม่! เรียกได้ ${slotsAtLevel(lv)} ตัว</small>` : '');
  d.style.left = battle.sx(battle.hero.x) + 'px';
  d.style.top = Math.max(50, battle.sy(battle.hero.y) - 110) + 'px';
  addFx(d, 1400);
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

// ---------- เริ่มเกม ----------
let state = loadState() || newState();
let game, battle;
const ui = {
  pop: popOn, slashFx, tapFx, boomFx, flash,
  coinTo: { x: 620, y: 22 },  // ไอคอนเหรียญมุมขวาบน เหรียญจะบินเข้าตรงนี้
  bagTo: { x: 37, y: 352 },   // ปุ่ม "ตีบวก" ซ้ายล่าง ไอเทมที่ดรอปจะบินเข้าตรงนี้
};
function startGame(s) {
  state = s;
  game = new Game(state, {
    onKill(e, gold, gems, drop) {
      popText('+' + fmt(gold), battle.sx(e.x), battle.sy(e.y - e.h - 6), 'gold');
      if (gems) popText('+' + gems + ' เพชร', battle.sx(e.x), battle.sy(e.y - e.h - 30), 'gold');
      if (drop) {
        battle.lootFx(e, EQUIP.rarity[drop.rarity].color);
        if (drop.rarity !== 'C') toast(`ได้${itemName(drop)} (${drop.rarity}) Lv ${drop.lv}`, 1800);
        if ($('equipSheet').classList.contains('open')) buildEquip();
      }
    },
    onLevel(lv, newSlot) {
      lvupFx(lv, newSlot);
      sfx('levelup');
      const k = game.skillList().find(x => x.lv > lv - 1 && x.lv <= lv);
      if (k) toast(`ปลดสกิลใหม่: ${k.name}!`, 2000);
      buildSkillBar();
      if (newSlot) {
        // ปลดช่องคู่หูใหม่: ดึงแมวที่มีอยู่แต่ยังไม่ได้เรียกมาลงช่องอัตโนมัติ
        const spare = CATS.find(c => state.cats[c.id] && !state.team.includes(c.id));
        if (spare) state.team.push(spare.id);
        onTeamChanged();
        if ($('heroesSheet').classList.contains('open')) { buildHeroList(); updateHeroList(); }
      }
      saveState(state);
    },
    onStage(stage) {
      sfx('stage');
      toast(isBigBoss(stage - 1) ? `ล้มบอสใหญ่! ไปด่าน ${stage}` : `ผ่านด่าน! ไปด่าน ${stage}`);
      saveState(state);
    },
    onBossFail() { sfx('bossFail'); battle.bossFled(); toast('บอสหนีไปแล้ว! อัปเกรดแล้วกด FIGHT เพื่อท้าใหม่', 2500); },
  });
  if (!battle) battle = new Battle($('stage'), game, ui);
  battle.game = game;
  battle.reset();
  battle.updateCam(0, true);
  setAutoMove(state.autoMove, true);
  syncSoundUi();
  onTeamChanged();
  fit();
  updateHud();
}
function onTeamChanged() {
  battle.syncTeam(state.team);
  buildSkillBar();
}

// ---------- แตะ / ท้าบอส ----------
// ฝั่งซ้ายของจอ: กดแล้วลาก = แป้นทิศทาง (แตะสั้นๆ ยังเป็นการฟัน) · ฝั่งขวา: แตะเพื่อฟัน
const JOY_R = 40;
let joy = null;
function setAutoMove(on, silent) {
  state.autoMove = on;
  battle.autoMove = on;
  const b = $('autoMove');
  b.classList.toggle('on', on);
  b.setAttribute('aria-pressed', String(on));
  b.textContent = on ? 'AUTO' : 'บังคับเอง';
  if (!silent) toast(on ? 'เดินออโต้: ตัวเราไล่ตีศัตรูเอง' : 'บังคับเอง: ลากฝั่งซ้ายเพื่อเดิน กดปุ่มขวาเพื่อกระโดด', 2200);
}
// แตะแป้นหรือปุ่มกระโดดตอนออโต้เปิดอยู่ = สลับมาบังคับเอง
function takeControl() { if (state.autoMove) setAutoMove(false); }
$('battle').addEventListener('pointerdown', e => {
  const p = toScene(e.clientX, e.clientY);
  if (p.x < W * 0.45 && !joy) {
    joy = { id: e.pointerId, x: p.x, y: p.y, t: performance.now(), moved: false };
    try { $('battle').setPointerCapture(e.pointerId); } catch {}
    return;
  }
  battle.tap(p.x, p.y);
});
$('battle').addEventListener('pointermove', e => {
  if (!joy || e.pointerId !== joy.id) return;
  const p = toScene(e.clientX, e.clientY);
  let dx = p.x - joy.x, dy = p.y - joy.y;
  const d = Math.hypot(dx, dy);
  if (!joy.moved && d < 10) return;
  if (!joy.moved) {
    joy.moved = true;
    takeControl();
    const el = $('joy');
    el.style.left = joy.x + 'px'; el.style.top = joy.y + 'px';
    el.hidden = false;
  }
  if (d > JOY_R) { dx *= JOY_R / d; dy *= JOY_R / d; }
  $('joy').style.setProperty('--jx', dx + 'px');
  $('joy').style.setProperty('--jy', dy + 'px');
  battle.input.dir = Math.abs(dx) > JOY_R * 0.3 ? Math.sign(dx) : 0;
  battle.input.down = dy > JOY_R * 0.6;
});
function endJoy(e) {
  if (!joy || e.pointerId !== joy.id) return;
  if (!joy.moved && performance.now() - joy.t < 300) battle.tap(joy.x, joy.y);
  joy = null;
  battle.input.dir = 0; battle.input.down = false;
  $('joy').hidden = true;
}
$('battle').addEventListener('pointerup', endJoy);
$('battle').addEventListener('pointercancel', endJoy);
$('jumpBtn').addEventListener('pointerdown', e => { e.preventDefault(); takeControl(); battle.jump(); });
$('autoMove').addEventListener('click', () => { setAutoMove(!state.autoMove); saveState(state); });
$('fight').addEventListener('click', () => {
  if (game.challengeBoss()) toast('ท้าบอสอีกครั้ง!');
  else toast(game.bossActive ? 'กำลังสู้บอสอยู่!' : `ล้มศัตรูให้ครบ ${BAL.enemiesPerStage} ตัวก่อน บอสจะออกมาเอง`);
});

// ---------- แถบสกิล: ตามอาวุธที่สวม ปลดตามเลเวล ----------
let skillEls = [], lastCast = 0;
function buildSkillBar() {
  const bar = $('skills'), color = WEAPONS[game.weaponKind()].color;
  bar.innerHTML = '';
  skillEls = game.skillList().map(k => {
    const b = document.createElement('button');
    if (state.level < k.lv) {
      b.className = 'sk lock';
      b.textContent = 'Lv ' + k.lv;
      b.setAttribute('aria-label', `${k.name} ปลดที่เลเวล ${k.lv}`);
      bar.appendChild(b);
      return null;
    }
    b.className = 'sk';
    b.style.setProperty('--c', color);
    b.setAttribute('aria-label', 'สกิล' + k.name);
    b.innerHTML = `<span class="ico">${k.icon}</span><div class="cd"></div><span class="t"></span>`;
    b.addEventListener('click', () => {
      const st = game.skillState(k);
      if (!st.ready) return toast(`${k.name} พร้อมใน ${st.left.toFixed(1)} วิ`);
      if (!battle.castSkill(k)) toast('ไม่มีศัตรูในระยะ');
    });
    bar.appendChild(b);
    return { k, b, ov: b.querySelector('.cd'), t: b.querySelector('.t') };
  });
  updateAutoBtn();
}
function updateAutoBtn() {
  const b = $('autoSkill');
  b.classList.toggle('on', state.autoSkill);
  b.setAttribute('aria-pressed', String(state.autoSkill));
}
$('autoSkill').addEventListener('click', () => {
  state.autoSkill = !state.autoSkill;
  updateAutoBtn();
  toast(state.autoSkill ? 'ร่ายสกิลอัตโนมัติ: เปิด' : 'ร่ายสกิลอัตโนมัติ: ปิด');
  saveState(state);
});
// ออโต้: ร่ายสกิลที่พร้อมทีละท่า เว้นจังหวะไม่ให้ท่าใหญ่ทับกันหมด (ท่าเลเวลสูงก่อน)
function autoCast(now) {
  if (!state.autoSkill || now - lastCast < 450) return;
  for (const el of [...skillEls].reverse()) {
    if (el && game.skillState(el.k).ready && battle.castSkill(el.k)) { lastCast = now; return; }
  }
}
function updateSkills() {
  const now = Date.now();
  for (const el of skillEls) {
    if (!el) continue;
    const st = game.skillState(el.k, now);
    el.b.classList.toggle('on', st.activeLeft > 0);
    el.b.classList.toggle('ready', st.ready);
    el.ov.style.setProperty('--p', (st.frac * 100) + '%');
    el.t.textContent = st.activeLeft > 0 ? st.activeLeft.toFixed(1) + 's' : st.ready ? '' : st.left.toFixed(1) + 's';
  }
}

// ---------- HUD ----------
function updateHud() {
  const s = state, boss = battle.boss;
  $('gold').textContent = fmt(s.gold);
  $('gems').textContent = fmt(game.gems());
  $('heroLv').textContent = s.level;
  $('expBar').style.width = Math.min(100, s.exp / expNeed(s.level) * 100) + '%';
  $('equipBadge').classList.toggle('on', hasBetterGear());
  $('stageNo').textContent = s.stage;
  $('stagePill').classList.toggle('big', isBigBoss(s.stage));
  const wave = $('wave'), bar = $('bossbar');
  if (boss) {
    bar.classList.add('boss');
    $('waveNo').textContent = BAL.enemiesPerStage;
    $('bicon').textContent = boss.big ? '👑' : '👹';
    $('ename').textContent = boss.name + ' (Boss)';
    $('hptxt').textContent = fmt(Math.max(0, boss.hp)) + ' / ' + fmt(boss.max);
    $('hpbar').style.width = Math.max(0, boss.hp / boss.max * 100) + '%';
    wave.textContent = '⏱ ' + Math.max(0, game.bossLeft).toFixed(1) + 's';
    wave.classList.toggle('hot', game.bossLeft < 10);
  } else {
    bar.classList.remove('boss');
    const k = s.farming ? BAL.enemiesPerStage : s.kills;
    $('waveNo').textContent = Math.min(BAL.enemiesPerStage, k + 1);
    $('bicon').textContent = '🐶';
    $('ename').textContent = s.farming ? 'ฟาร์มเหรียญ · กด FIGHT ท้าบอส' : 'ล้มศัตรูเพื่อเรียกบอส';
    $('hptxt').textContent = `${k}/${BAL.enemiesPerStage}`;
    $('hpbar').style.width = (k / BAL.enemiesPerStage * 100) + '%';
    wave.textContent = s.farming ? 'Farming' : isBigBoss(s.stage) ? 'Big Boss Stage' : 'Boss Stage';
    wave.classList.remove('hot');
  }
  $('dps').textContent = fmt(game.totalDps() + game.heroDps());
  $('fight').classList.toggle('pulse', s.farming);
  $('heroBadge').classList.toggle('on', canUpgradeSomething());
  $('gachaBadge').classList.toggle('on', game.gems() >= GACHA.cost1);
}
// มีอุปกรณ์ในกระเป๋าที่แรงกว่าชิ้นที่สวมอยู่ (หรือช่องที่ยังว่าง) ไหม
function hasBetterGear() {
  for (const it of state.items) {
    const cur = game.item(state.equip[it.slot]);
    if (!cur || (cur.uid !== it.uid && itemValue(it) > itemValue(cur))) return true;
  }
  return false;
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
  const open = game.slots(), nextLv = LEVEL.slotsAt[open];
  sect(`คู่หูที่เรียกอยู่ ${state.team.length}/${open}` + (nextLv ? ` · ช่องถัดไปปลดที่ Lv ${nextLv}` : ' · ครบ 4 ช่องแล้ว'));
  state.team.forEach(id => add('cat:' + id, `assets/cats/${catById(id).img}.png`));
  const reserve = CATS.filter(c => state.cats[c.id] && !state.team.includes(c.id));
  if (reserve.length) {
    sect('ในคอลเลกชัน · ยังไม่ได้เรียก');
    reserve.forEach(c => add('cat:' + c.id, `assets/cats/${c.img}.png`));
  }
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
        `<button class="starup ${o.dupes >= need ? 'ok' : ''}" data-star="${id}">อัปดาว · Shards ${o.dupes}/${need}</button>`;
      const inTeam = state.team.includes(id), p = skillPower(o.star);
      nm = `${c.name}<span class="rar ${c.rarity}">${c.rarity}</span> <small>Lv ${o.lv}</small><button class="teambtn ${inTeam ? 'on' : ''}" data-team="${id}">${inTeam ? 'ช่วยสู้อยู่' : 'เรียก'}</button>`;
      sub = `${starsHtml(o.star)}${starBtn}<br>DPS ${fmt(inTeam ? game.catDps(id) : 0)}` +
        `<br><span class="p${inTeam ? ' on' : ''}">พาสซีฟ: ${PASSIVES[c.passive].text(p)}</span>`;
      label = `อัป ×${q.n}`;
    } else {
      const c = catById(id);
      setHtml(row.nm, `${c.name}<span class="rar ${c.rarity}">${c.rarity}</span>`);
      setHtml(row.sub, `<span class="tag">พาสซีฟ: ${PASSIVES[c.passive].text(1)}</span>`);
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
  const tb = e.target.closest('[data-team]');
  if (tb) {
    const id = tb.dataset.team, r = game.toggleTeam(id);
    if (r === 'full') toast(game.slots() < LEVEL.slotsAt.length ? `เรียกได้ ${game.slots()} ตัว · ช่องถัดไปปลดที่ Lv ${LEVEL.slotsAt[game.slots()]}` : 'เรียกครบ 4 ตัวแล้ว ส่งตัวอื่นกลับก่อน', 2000);
    else if (r === 'last') toast('ต้องมีคู่หูอย่างน้อย 1 ตัว');
    else { onTeamChanged(); buildHeroList(); updateHeroList(); updateHud(); saveState(state); }
    return;
  }
  const star = e.target.closest('[data-star]');
  if (star) {
    const id = star.dataset.star;
    if (game.starUp(id)) { toast(`${catById(id).name} ★${state.cats[id].star}!`); saveState(state); }
    else toast(`ต้องการ Shards ของ${catById(id).name}อีก ${game.starCost(id) - state.cats[id].dupes} ชิ้น`);
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
  const order = ['SSR', 'SR', 'R', 'C'];
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
// ---------- หน้าผลกาชา ----------
const RANK = { SSR: 3, SR: 2, R: 1, C: 0 };
const TITLE = { SSR: 'SSR<small>ตำนาน!</small>', SR: 'SR<small>หายาก!</small>', R: 'ได้แมวแล้ว!', C: 'ได้แมวแล้ว!' };
let lastPull = 1;
function resultNote(r) {
  if (r.isNew) return '<div class="note new">ใหม่!</div>';
  if (r.refund) return `<div class="note">★5 แล้ว +${r.refund} เพชร</div>`;
  return `<div class="note${r.canStar ? ' new' : ''}">+1 Shard${r.canStar ? ' อัปดาวได้' : ''}</div>`;
}
function smallCard(r, delay) {
  const c = catById(r.id);
  return `<div class="gc ${r.rarity}" style="animation-delay:${delay}s"><span class="tag">${r.rarity}</span><img src="assets/cats/${c.img}.png" alt=""><div class="nm">${c.name}</div>${resultNote(r)}</div>`;
}
function featCard(r, delay) {
  const c = catById(r.id), o = state.cats[r.id], p = skillPower(o.star);

  return `<img class="big" src="assets/cats/${c.img}.png" alt="" style="animation-delay:${delay}s">` +
    `<div class="gc ${r.rarity}" style="animation-delay:${delay + 0.15}s"><span class="tag">${r.rarity}</span><div class="nm">${c.name} ${'★'.repeat(o.star)}</div>` +
    `<div class="ginfo"><b>DPS พื้นฐาน:</b> ${fmt(catDpsAt(r.id, 1, o.star))}<br><b>พาสซีฟ:</b> ${PASSIVES[c.passive].text(p)}</div>${resultNote(r)}</div>`;
}
function confetti() {
  const box = $('confetti'), cols = ['#ffd23a', '#ff6a8a', '#5ac8ff', '#7be04a', '#b583ff', '#fff'];
  box.innerHTML = Array.from({ length: 40 }, () =>
    `<i style="left:${Math.random() * 390}px;background:${cols[Math.floor(Math.random() * cols.length)]};animation-duration:${2 + Math.random() * 2}s;animation-delay:${Math.random() * 1.2}s"></i>`).join('');
}
function showResults(res, n) {
  // ตัวเด่น: ระดับสูงสุด ถ้าเท่ากันเลือกตัวใหม่ก่อน
  const fi = res.reduce((best, r, i) => {
    const b = res[best];
    return RANK[r.rarity] > RANK[b.rarity] || (RANK[r.rarity] === RANK[b.rarity] && r.isNew && !b.isNew) ? i : best;
  }, 0);
  const feat = res[fi], rest = res.filter((_, i) => i !== fi);
  const top = feat.rarity;
  const show = $('gachaShow');
  show.className = 'gshow ' + top.toLowerCase();
  $('gTitle').innerHTML = TITLE[top];
  const half = Math.ceil(rest.length / 2);
  $('gLeft').innerHTML = rest.slice(0, half).map((r, i) => smallCard(r, 0.3 + i * 0.12)).join('');
  $('gRight').innerHTML = rest.slice(half).map((r, i) => smallCard(r, 0.36 + i * 0.12)).join('');
  $('gFeat').innerHTML = featCard(feat, 0.3 + half * 0.12);
  $('confetti').innerHTML = '';
  if (RANK[top] >= 2) setTimeout(confetti, 300);
  if (top === 'SSR') setTimeout(() => flash('#ffe27a'), 250);
  lastPull = n;
  updateAgain();
  show.hidden = false;
}
function updateAgain() {
  const cost = lastPull === 10 ? GACHA.cost10 : GACHA.cost1;
  const b = $('gAgain');
  b.textContent = `ดึงต่อ! (×${lastPull}) · ${cost} เพชร`;
  b.disabled = game.gems() < cost;
}
function doPull(n) {
  const res = game.pull(n);
  if (!res) return toast('เพชรไม่พอ');
  sfx(res.some(r => r.rarity === 'SSR') ? 'ssr' : 'gacha');
  saveState(state);
  showResults(res, n);
  buildBanner(); updateGacha(); buildHeroList(); updateHud();
}
$('pull1').addEventListener('click', () => doPull(1));
$('pull10').addEventListener('click', () => doPull(10));
$('gOk').addEventListener('click', () => ($('gachaShow').hidden = true));
$('gAgain').addEventListener('click', () => doPull(lastPull));

// ---------- โหมดทดสอบ: รับเหรียญ/เพชรฟรี ----------
// ---------- โหมดทดสอบ: รับเหรียญ/เพชรฟรี ----------
if (DEV.freeCurrency) {
  $('addGold').hidden = $('addGems').hidden = false;
  $('addGold').addEventListener('click', () => {
    const add = Math.max(DEV.minGoldPerClick, state.gold);   // อย่างน้อย 10K หรือเพิ่มเป็นสองเท่า
    state.gold += add;
    toast(`+${fmt(add)} เหรียญ (ทดสอบ)`);
    updateHud(); saveState(state);
  });
  $('addGems').addEventListener('click', () => {
    state.gemsFree += DEV.gemsPerClick;
    toast(`+${fmt(DEV.gemsPerClick)} เพชร (ทดสอบ)`);
    updateHud(); updateGacha(); saveState(state);
  });
}

// ---------- แผ่นตัวเรา: อุปกรณ์และกระเป๋า ----------
const SLOT_KEYS = Object.keys(EQUIP.slots);
const pct = v => (v >= 100 ? Math.round(v) : v.toFixed(1)) + '%';
function tileHtml(it, extra = '') {
  return `<button class="itile ${it.rarity}" data-uid="${it.uid}">${EQUIP.slots[it.slot].icon}` +
    (it.plus ? `<span class="pl">+${it.plus}</span>` : '') + extra + '</button>';
}
function buildEquip() {
  const look = game.outfitLook();
  $('heroPrev').style.filter = look ? look.filter : '';
  $('outfitName').textContent = look ? look.name : 'ชุดปกติ';
  $('slotGrid').innerHTML = SLOT_KEYS.map(k => {
    const it = game.item(state.equip[k]);
    return it ? tileHtml(it, `<span class="sl">${EQUIP.slots[k].name}</span>`)
      : `<button class="itile empty" disabled>${EQUIP.slots[k].icon}<span class="sl">${EQUIP.slots[k].name}</span></button>`;
  }).join('');
  const g = game.gear();
  $('gearStats').innerHTML = Object.entries(EQUIP.stats).map(([k, st]) => `${st.name} <b>+${pct(g[k])}</b>`).join(' · ') +
    `<br>เลเวล Lv ${state.level}: ดาเมจทั้งทีม <b>+${Math.round((game.levelMul() - 1) * 100)}%</b>`;
  $('invCount').textContent = `กระเป๋า ${state.items.length}/${EQUIP.invMax}`;
  const order = { L: 0, E: 1, R: 2, C: 3 };
  const items = [...state.items].sort((a, b) => order[a.rarity] - order[b.rarity] || SLOT_KEYS.indexOf(a.slot) - SLOT_KEYS.indexOf(b.slot) || itemValue(b) - itemValue(a));
  $('invGrid').innerHTML = items.length
    ? items.map(it => tileHtml(it, game.isEquipped(it.uid) ? '<span class="eq">E</span>' : '')).join('')
    : '<p class="rates" style="grid-column:1/-1">ยังไม่มีอุปกรณ์ ล่ามอนสเตอร์เพื่อหาของ</p>';
}
let openUid = null;
function showItem(uid) {
  const it = game.item(uid);
  if (!it) return;
  openUid = uid;
  const st = EQUIP.stats[EQUIP.slots[it.slot].stat], r = EQUIP.rarity[it.rarity];
  $('imIco').textContent = EQUIP.slots[it.slot].icon;
  $('imIco').style.borderColor = r.color;
  $('imName').textContent = itemName(it) + (it.plus ? ` +${it.plus}` : '');
  $('imName').style.color = r.color;
  $('imSub').textContent = `${EQUIP.slots[it.slot].name} · ${r.name} · ไอเทม Lv ${it.lv}`;
  $('imStat').textContent = `${st.name} +${pct(itemValue(it))}`;
  $('imSkills').hidden = it.slot !== 'weapon';
  if (it.slot === 'weapon') {
    $('imSkills').innerHTML = `สกิลของ${WEAPONS[it.kind].name}` + (it.plus ? ` (ดาเมจสกิล +${Math.round(it.plus * 15)}%)` : '') + ':<br>' +
      WSKILLS.filter(k => k.kind === it.kind).map(k => `<span class="${state.level < k.lv ? 'off' : ''}">${k.icon} <b>${k.name}</b> Lv ${k.lv}</span>`).join(' · ');
  }
  const cur = game.item(state.equip[it.slot]);
  const equipped = game.isEquipped(uid);
  if (equipped) $('imCmp').innerHTML = '<span class="up">สวมอยู่</span>';
  else if (!cur) $('imCmp').innerHTML = '<span class="up">ช่องนี้ยังว่าง</span>';
  else {
    const d = itemValue(it) - itemValue(cur);
    $('imCmp').innerHTML = `เทียบกับที่สวมอยู่: <span class="${d >= 0 ? 'up' : 'down'}">${d >= 0 ? '▲ +' : '▼ '}${pct(d)}</span>`;
  }
  $('imEquip').textContent = equipped ? 'ถอด' : 'สวม';
  const maxed = it.plus >= EQUIP.enhanceMax;
  const risk = { none: '', down: ' · พลาดลด 1 ขั้น', break: ` · พลาดแตกได้ ${Math.round(EQUIP.breakChance * 100)}%` }[game.enhanceRisk(it)];
  $('imEnhance').innerHTML = maxed ? 'ตีบวกเต็มแล้ว' : `ตีบวก +${it.plus + 1} · ${Math.round(game.enhanceRate(it) * 100)}%${risk} · <img src="assets/ui/coin.png" alt=""> ${fmt(game.enhanceCost(it), true)}`;
  $('imEnhance').disabled = maxed;
  $('imSalvage').textContent = `ย่อย +${fmt(game.salvageValue(it))} เหรียญ`;
  $('imSalvage').disabled = equipped;
  $('itemModal').hidden = false;
}
document.querySelector('#equipSheet').addEventListener('click', e => {
  const t = e.target.closest('.itile[data-uid]');
  if (t) showItem(+t.dataset.uid);
});
$('imClose').addEventListener('click', () => ($('itemModal').hidden = true));
$('imEquip').addEventListener('click', () => {
  const it = game.item(openUid);
  if (!it) return;
  if (game.isEquipped(it.uid)) game.unequip(it.slot); else game.equipItem(it.uid);
  saveState(state); buildEquip(); showItem(openUid);
  if (it.slot === 'weapon') buildSkillBar();
});
$('imEnhance').addEventListener('click', () => {
  const it = game.item(openUid);
  if (!it) return;
  if (game.enhanceRisk(it) === 'break' && !confirm(`ตีบวก +${it.plus + 1} ถ้าพลาดมีโอกาส ${Math.round(EQUIP.breakChance * 100)}% ที่${itemName(it)}จะแตกหายไปเลย ตีต่อไหม?`)) return;
  const r = game.enhance(openUid);
  sfx({ ok: 'enhOk', fail: 'enhFail', down: 'enhFail', broken: 'enhBreak' }[r] || 'click');
  if (r === 'gold') toast('เหรียญไม่พอ');
  else if (r === 'ok') { toast(`ตีบวกสำเร็จ! +${game.item(openUid).plus}`); flash('#ffe27a'); }
  else if (r === 'fail') toast('ตีบวกไม่สำเร็จ เสียเหรียญไป', 1500);
  else if (r === 'down') { toast(`ตีบวกพลาด! ระดับลดเหลือ +${game.item(openUid).plus}`, 1800); flash('#5a6a8a'); }
  else if (r === 'broken') { toast('ตีบวกพลาด… ไอเทมแตกแล้ว 💥', 2200); flash('#d2473a'); }
  saveState(state); buildEquip(); updateHud();
  if (r === 'broken') buildSkillBar();
  if (game.item(openUid)) showItem(openUid); else $('itemModal').hidden = true;
});
$('imSalvage').addEventListener('click', () => {
  const g = game.salvage(openUid);
  if (!g) return;
  toast(`ย่อยแล้ว +${fmt(g)} เหรียญ`);
  $('itemModal').hidden = true;
  saveState(state); buildEquip(); updateHud();
});
$('salvageC').addEventListener('click', () => {
  const list = state.items.filter(it => it.rarity === 'C' && !game.isEquipped(it.uid));
  if (!list.length) return toast('ไม่มีของธรรมดาให้ย่อย');
  const g = list.reduce((sum, it) => sum + game.salvage(it.uid), 0);
  toast(`ย่อย ${list.length} ชิ้น +${fmt(g)} เหรียญ`);
  saveState(state); buildEquip(); updateHud();
});

// ---------- ตลาด (ออฟไลน์) ----------
// ภาพตลาดขยายเต็มจอแบบ cover ชิดขอบล่าง (ร้านอยู่ครึ่งล่างของภาพ) พิกัดร้านเป็นพิกัดบนภาพ 1024×572
let mk = { k: 1, heroX: 470, walkTimer: 0, shop: null };
function layoutMarket() {
  if (!view) return;
  const m = $('market'), st = $('mkStage');
  Object.assign(m.style, { left: view.l + 'px', top: view.t + 'px', width: view.w + 'px', height: view.h + 'px' });
  mk.k = Math.max(view.w / MARKET.w, view.h / MARKET.h);
  const w = MARKET.w * mk.k, h = MARKET.h * mk.k;
  Object.assign(st.style, { width: w + 'px', height: h + 'px', left: (view.w - w) / 2 + 'px', top: (view.h - h) + 'px' });
  const hero = $('mkHero'), cat = $('mkCat');
  hero.style.height = 74 * mk.k + 'px';
  hero.style.top = (MARKET.street - 74) * mk.k + 'px';
  cat.style.height = 56 * mk.k + 'px';
  cat.style.top = (MARKET.street - 56) * mk.k + 'px';
  placeMarketHero(mk.heroX, 0);
}
function buildMarket() {
  $('mkShops').innerHTML = MARKET.shops.map(sh =>
    `<button class="mk-shop" data-shop="${sh.id}" aria-label="${sh.name}" style="left:${sh.x1 / MARKET.w * 100}%;width:${(sh.x2 - sh.x1) / MARKET.w * 100}%;top:${330 / MARKET.h * 100}%;height:${(MARKET.street - 330) / MARKET.h * 100}%"><span class="mk-tag">${sh.tag}</span></button>`).join('');
}
function placeMarketHero(x, sec) {
  const hero = $('mkHero'), cat = $('mkCat');
  const face = x >= mk.heroX ? 1 : -1;
  hero.style.setProperty('--f', face);
  hero.style.transitionDuration = sec + 's';
  hero.style.left = x * mk.k + 'px';
  cat.style.transitionDuration = sec + 0.15 + 's';
  cat.style.left = (x - face * 52) * mk.k + 'px';
  cat.style.transform = `translateX(-50%) scaleX(${face})`;
  mk.heroX = x;
}
function walkTo(x, then) {
  clearTimeout(mk.walkTimer);
  const sec = Math.min(2, Math.abs(x - mk.heroX) / 320);
  placeMarketHero(x, sec);
  $('mkHero').classList.toggle('walk', sec > 0.05);
  mk.walkTimer = setTimeout(() => { $('mkHero').classList.remove('walk'); then?.(); }, sec * 1000);
}
function openMarket() {
  closeSheets();
  const lead = catById(state.team[0]);
  $('mkCat').src = `assets/cats/${lead.img}.png`;
  $('market').hidden = false;
  gameEl.classList.add('in-market');
  layoutMarket();
}
function closeMarket() {
  closeSheets();
  $('market').hidden = true;
  gameEl.classList.remove('in-market');
}
$('openMarket').addEventListener('click', openMarket);
$('mkExit').addEventListener('click', closeMarket);
$('mkStage').addEventListener('click', e => {
  const b = e.target.closest('.mk-shop');
  const r = $('mkStage').getBoundingClientRect();
  if (!b) { walkTo(Math.max(30, Math.min(MARKET.w - 30, (e.clientX - r.left) / r.width * MARKET.w))); return; }
  const sh = MARKET.shops.find(x => x.id === b.dataset.shop);
  document.querySelectorAll('.mk-shop').forEach(x => x.classList.toggle('on', x === b));
  walkTo((sh.x1 + sh.x2) / 2, () => {
    b.classList.remove('on');
    if (sh.id === 'armory') openSheet('equipSheet');
    else if (sh.id === 'gems') openSheet('gachaSheet');
    else openShop(sh.id);
  });
});

function openShop(id) {
  mk.shop = id;
  $('shopTitle').textContent = MARKET.shops.find(x => x.id === id).name;
  openSheet('shopSheet');
}
const coin = n => `<span><img src="assets/ui/coin.png" alt="">${fmt(n, true)}</span>`;
const gem = n => `<span><img src="assets/ui/gem.png" alt="">${n}</span>`;
function renderShop() {
  const id = mk.shop, now = Date.now();
  let html = '';
  if (id === 'potion') {
    html = Object.entries(POTIONS).map(([k, p]) => {
      const cost = game.shopPrice(p.price), left = game.potionLeft(k, now);
      const ok = state.gold >= cost && left + p.min * 60 <= 3600;
      return `<div class="row"><div class="pic emo">${p.icon}</div><div class="mid"><div class="nm">${p.name}</div>` +
        `<div class="sub">${p.text} ${p.min} นาที<br><span class="p${left > 0 ? ' on' : ''}">${left > 0 ? 'เหลือ ' + fmtClock(left) : 'ซื้อซ้ำเพื่อต่อเวลา สูงสุด 60 นาที'}</span></div></div>` +
        `<button class="buy ${ok ? '' : 'no'}" data-potion="${k}"><b>ดื่ม</b>${coin(cost)}</button></div>`;
    }).join('');
  } else if (id === 'fabric') {
    const cost = game.shopPrice(OUTFIT_PRICE), ok = state.gold >= cost && state.items.length < EQUIP.invMax;
    html = EQUIP.outfits.map((o, i) =>
      `<div class="row"><div class="pic"><img class="pix" src="${HERO.img}" alt="" style="filter:${o.filter}"></div><div class="mid"><div class="nm">${o.name} <small>หายาก · Lv ${state.maxStage}</small></div>` +
      `<div class="sub">${EQUIP.stats.all.name} · เปลี่ยนหน้าตาตัวเรา${state.items.length >= EQUIP.invMax ? '<br><span class="p">กระเป๋าเต็ม ย่อยของก่อนนะ</span>' : ''}</div></div>` +
      `<button class="buy ${ok ? '' : 'no'}" data-outfit="${i}"><b>ซื้อ</b>${coin(cost)}</button></div>`).join('');
  } else if (id === 'bake') {
    html = BREADS.map(b => {
      const ok = b.gems ? game.gems() >= b.gems : state.gold >= game.shopPrice(b.price);
      return `<div class="row"><div class="pic emo">${b.icon}</div><div class="mid"><div class="nm">${b.name}</div>` +
        `<div class="sub">EXP +${fmt(game.breadExp(b))} (${Math.round(b.exp * 100)}% ของเลเวลนี้)</div></div>` +
        `<button class="buy ${b.gems ? 'gemb' : ''} ${ok ? '' : 'no'}" data-bread="${b.id}"><b>กิน</b>${b.gems ? gem(b.gems) : coin(game.shopPrice(b.price))}</button></div>`;
    }).join('');
  }
  setHtml($('shopList'), html);
}
const fmtClock = sec => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
$('shopList').addEventListener('click', e => {
  const b = e.target.closest('.buy');
  if (!b) return;
  if (b.dataset.potion) {
    const r = game.buyPotion(b.dataset.potion), p = POTIONS[b.dataset.potion];
    if (r === 'gold') toast('เหรียญไม่พอ');
    else if (r === 'max') toast('ต่อเวลาได้สูงสุด 60 นาที');
    else { sfx('buy'); toast(`${p.icon} ${p.name}! ${p.text}`); flash('#7be04a'); }
  } else if (b.dataset.outfit) {
    const r = game.buyOutfit(+b.dataset.outfit);
    if (r === 'gold') toast('เหรียญไม่พอ');
    else if (r === 'full') toast('กระเป๋าเต็ม ย่อยของก่อนนะ');
    else { sfx('buy'); toast(`ได้${itemName(r)}แล้ว! ไปสวมที่หน้าตีบวก`, 2000); }
  } else if (b.dataset.bread) {
    const r = game.buyBread(b.dataset.bread);
    if (r === 'gold') toast('เหรียญไม่พอ');
    else if (r === 'gems') toast('เพชรไม่พอ');
    else { sfx('buy'); toast(`อร่อย! EXP +${fmt(r)}`); }
  }
  saveState(state); updateHud(); renderShop();
});
function updateBuffs() {
  const now = Date.now();
  setHtml($('buffs'), Object.entries(POTIONS).map(([k, p]) => {
    const left = game.potionLeft(k, now);
    return left > 0 ? `<span>${p.icon} ${fmtClock(left)}</span>` : '';
  }).join(''));
}

// ---------- เปิด/ปิดแผ่น ----------
function openSheet(id) {
  document.querySelectorAll('.sheet').forEach(s => s.classList.toggle('open', s.id === id));
  if (id === 'heroesSheet') { buildHeroList(); updateHeroList(); }
  if (id === 'gachaSheet') { buildBanner(); updateGacha(); }
  if (id === 'settingsSheet') refreshSettings();
  if (id === 'equipSheet') buildEquip();
  if (id === 'shopSheet') renderShop();
}
function toggleSheet(id) { $(id).classList.contains('open') ? closeSheets() : openSheet(id); }
function closeSheets() { document.querySelectorAll('.sheet').forEach(s => s.classList.remove('open')); }
$('openHeroes').addEventListener('click', () => toggleSheet('heroesSheet'));
$('openGacha').addEventListener('click', () => toggleSheet('gachaSheet'));
$('openEquip').addEventListener('click', () => toggleSheet('equipSheet'));
$('openSettings').addEventListener('click', () => toggleSheet('settingsSheet'));
document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', closeSheets));

// ---------- เสียง ----------
// เบราว์เซอร์ยอมเล่นเสียงหลังผู้เล่นแตะจอเท่านั้น
document.addEventListener('pointerdown', unlock, true);
function syncSoundUi() {
  $('sfxOn').checked = state.sound.sfx;
  $('musicOn').checked = state.sound.music;
  $('volume').value = Math.round(state.sound.vol * 100);
  setSound(state.sound);
}
$('sfxOn').addEventListener('change', e => { state.sound.sfx = e.target.checked; setSound(state.sound); sfx('click'); saveState(state); });
$('musicOn').addEventListener('change', e => { state.sound.music = e.target.checked; setSound(state.sound); saveState(state); });
$('volume').addEventListener('input', e => { state.sound.vol = e.target.value / 100; setSound(state.sound); });
$('volume').addEventListener('change', () => { sfx('coin'); saveState(state); });

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
  pause(document.hidden);
  if (document.hidden) { hiddenAt = Date.now(); saveState(state); }
  else if (hiddenAt) { checkOffline(hiddenAt); hiddenAt = null; last = performance.now(); }
});
window.addEventListener('pagehide', () => saveState(state));
setInterval(() => saveState(state), BAL.saveEverySec * 1000);

// ---------- ลูปหลัก ----------
// นับตามเวลาจริง: ถ้าเฟรมมาช้าจะชดเชยให้สูงสุด 5 วิ (ฉากต่อสู้ขยับทีละไม่เกิน 1/30 วิ กันกระโดดทะลุแท่น)
let last = performance.now(), hudAcc = 0;
function loop(now) {
  let dt = Math.min(5, (now - last) / 1000);
  last = now;
  game.tick(dt);
  while (dt > 0) { const step = Math.min(dt, 1 / 30); battle.update(step); dt -= step; }
  autoCast(now);
  setTrack(gameEl.classList.contains('in-market') ? 'market' : game.mapId());
  battle.draw();
  hudAcc += 1 / 60;
  if (hudAcc >= 0.1) {
    hudAcc = 0;
    updateHud();
    updateSkills();
    if ($('heroesSheet').classList.contains('open')) updateHeroList();
    if ($('gachaSheet').classList.contains('open')) updateGacha();
    if ($('shopSheet').classList.contains('open')) renderShop();
    updateBuffs();
  }
  requestAnimationFrame(loop);
}

const firstLoad = !loadState();
buildMarket();
startGame(state);
if (!firstLoad) checkOffline(state.lastSeen);
else toast('ตัวเราตีเองอัตโนมัติ · แตะจอเพื่อฟันเพิ่ม', 3000);
requestAnimationFrame(loop);
