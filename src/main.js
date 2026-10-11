import { BAL, CATS, GACHA, STAR, SKILLS, HERO, PASSIVES, DEV, EQUIP, LEVEL } from './config.js';
import { fmt, fmtTime } from './format.js';
import { newState, loadState, saveState, clearSave, exportSave, importSave } from './state.js';
import { Game, catById, catDpsAt, swordDmgAt, nextMile, isBigBoss, skillPower, itemValue, itemName, expNeed, slotsAtLevel } from './game.js';
import { Battle, W, H } from './battle.js';

const $ = id => document.getElementById(id);
const gameEl = $('game'), fx = $('fx');
let scale = 1;

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
  battle?.resize(scale, { l: -x / scale, t: -y / scale, w: window.innerWidth / scale, h: window.innerHeight / scale });
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
  if (fxCount > 70) return false;
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
function popOn(m, amount, cls, key) {
  const off = { hero: -12, cat: 26, dot: 6 }[key] || 0;
  const row = stackRow(m.id + key);
  const y = m.y - m.h - 30 - row * (cls === 'crit' ? 30 : 25);
  popText(fmtDmg(amount), battle.sx(m.x) + off + (Math.random() * 8 - 4), battle.sy(y), cls);
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
      toast(isBigBoss(stage - 1) ? `ล้มบอสใหญ่! ไปด่าน ${stage}` : `ผ่านด่าน! ไปด่าน ${stage}`);
      saveState(state);
    },
    onBossFail() { battle.bossFled(); toast('บอสหนีไปแล้ว! อัปเกรดแล้วกด FIGHT เพื่อท้าใหม่', 2500); },
    onSkill(id) { flash(catById(id).color); toast(`${SKILLS[id].name}!`); },
    onSkillDamage(id, amount, mode, crit) { battle.skillDamage(amount, mode, crit); },
  });
  if (!battle) battle = new Battle($('stage'), game, ui);
  battle.game = game;
  battle.reset();
  battle.updateCam(0, true);
  onTeamChanged();
  fit();
  updateHud();
}
function onTeamChanged() {
  battle.syncTeam(state.team);
  buildSkillBar();
}

// ---------- แตะ / ท้าบอส ----------
$('battle').addEventListener('pointerdown', e => {
  const p = toScene(e.clientX, e.clientY);
  battle.tap(p.x, p.y);
});
$('fight').addEventListener('click', () => {
  if (game.challengeBoss()) toast('ท้าบอสอีกครั้ง!');
  else toast(game.bossActive ? 'กำลังสู้บอสอยู่!' : `ล้มศัตรูให้ครบ ${BAL.enemiesPerStage} ตัวก่อน บอสจะออกมาเอง`);
});

// ---------- แถบสกิล: ตามแมวในทีม ----------
let skillEls = [];
function buildSkillBar() {
  const bar = $('skills');
  bar.innerHTML = '';
  const open = game.slots();
  skillEls = LEVEL.slotsAt.map((needLv, i) => {
    const id = i < open ? state.team[i] : null;
    const b = document.createElement('button');
    if (i >= open) {
      b.className = 'sk lock';
      b.textContent = 'Lv ' + needLv;
      b.setAttribute('aria-label', `ช่องคู่หูปลดที่เลเวล ${needLv}`);
      bar.appendChild(b);
      return null;
    }
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
    el.t.textContent = st.activeLeft > 0 ? st.activeLeft.toFixed(1) + 's' : st.ready ? '' : st.left >= 60 ? Math.ceil(st.left / 60) + 'm' : st.left.toFixed(1) + 's';
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
    wave.textContent = (game.active('frost') ? '❄ ' : '⏱ ') + Math.max(0, game.bossLeft).toFixed(1) + 's';
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
      sub = `${starsHtml(o.star)}${starBtn}<br>DPS ${fmt(inTeam ? game.catDps(id) : 0)} · ${SKILLS[id].name}: ${SKILLS[id].desc(p)}` +
        (c.passive ? `<br><span class="p on">พาสซีฟ: ${PASSIVES[c.passive].text(p)}</span>` : '');
      label = `อัป ×${q.n}`;
    } else {
      const c = catById(id);
      setHtml(row.nm, `${c.name}<span class="rar ${c.rarity}">${c.rarity}</span>`);
      setHtml(row.sub, `<span class="tag">${SKILLS[id].name}: ${SKILLS[id].desc(1)}${c.passive ? '<br>พาสซีฟ: ' + PASSIVES[c.passive].text(1) : ''}</span>`);
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
  const passive = c.passive ? `<br><b>พาสซีฟ:</b> ${PASSIVES[c.passive].text(p)}` : '';
  return `<img class="big" src="assets/cats/${c.img}.png" alt="" style="animation-delay:${delay}s">` +
    `<div class="gc ${r.rarity}" style="animation-delay:${delay + 0.15}s"><span class="tag">${r.rarity}</span><div class="nm">${c.name} ${'★'.repeat(o.star)}</div>` +
    `<div class="ginfo"><b>DPS พื้นฐาน:</b> ${fmt(catDpsAt(r.id, 1, o.star))}${passive}<br><b>สกิล ${SKILLS[r.id].name}:</b> ${SKILLS[r.id].desc(p)}</div>${resultNote(r)}</div>`;
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
});
$('imEnhance').addEventListener('click', () => {
  const it = game.item(openUid);
  if (!it) return;
  if (game.enhanceRisk(it) === 'break' && !confirm(`ตีบวก +${it.plus + 1} ถ้าพลาดมีโอกาส ${Math.round(EQUIP.breakChance * 100)}% ที่${itemName(it)}จะแตกหายไปเลย ตีต่อไหม?`)) return;
  const r = game.enhance(openUid);
  if (r === 'gold') toast('เหรียญไม่พอ');
  else if (r === 'ok') { toast(`ตีบวกสำเร็จ! +${game.item(openUid).plus}`); flash('#ffe27a'); }
  else if (r === 'fail') toast('ตีบวกไม่สำเร็จ เสียเหรียญไป', 1500);
  else if (r === 'down') { toast(`ตีบวกพลาด! ระดับลดเหลือ +${game.item(openUid).plus}`, 1800); flash('#5a6a8a'); }
  else if (r === 'broken') { toast('ตีบวกพลาด… ไอเทมแตกแล้ว 💥', 2200); flash('#d2473a'); }
  saveState(state); buildEquip(); updateHud();
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

// ---------- เปิด/ปิดแผ่น ----------
function openSheet(id) {
  document.querySelectorAll('.sheet').forEach(s => s.classList.toggle('open', s.id === id));
  if (id === 'heroesSheet') { buildHeroList(); updateHeroList(); }
  if (id === 'gachaSheet') { buildBanner(); updateGacha(); }
  if (id === 'settingsSheet') refreshSettings();
  if (id === 'equipSheet') buildEquip();
}
function toggleSheet(id) { $(id).classList.contains('open') ? closeSheets() : openSheet(id); }
function closeSheets() { document.querySelectorAll('.sheet').forEach(s => s.classList.remove('open')); }
$('openHeroes').addEventListener('click', () => toggleSheet('heroesSheet'));
$('openGacha').addEventListener('click', () => toggleSheet('gachaSheet'));
$('openEquip').addEventListener('click', () => toggleSheet('equipSheet'));
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
// นับตามเวลาจริง: ถ้าเฟรมมาช้าจะชดเชยให้สูงสุด 5 วิ (ฉากต่อสู้ขยับทีละไม่เกิน 1/30 วิ กันกระโดดทะลุแท่น)
let last = performance.now(), hudAcc = 0;
function loop(now) {
  let dt = Math.min(5, (now - last) / 1000);
  last = now;
  game.tick(dt);
  while (dt > 0) { const step = Math.min(dt, 1 / 30); battle.update(step); dt -= step; }
  battle.draw();
  hudAcc += 1 / 60;
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
else toast('ตัวเราตีเองอัตโนมัติ · แตะจอเพื่อฟันเพิ่ม', 3000);
requestAnimationFrame(loop);
