import { BAL, CATS, SKILLS, HERO } from './config.js';
import { fmt, fmtTime } from './format.js';
import { newState, loadState, saveState, clearSave, exportSave, importSave } from './state.js';
import { Game, heroTap, catDpsAt, nextMile, isBigBoss } from './game.js';

const $ = id => document.getElementById(id);
const gameEl = $('game'), fx = $('fx');
let scale = 1;

// ---------- ย่อ/ขยายฉาก 390×844 ให้พอดีจอ ----------
function fit() {
  const w = window.innerWidth, h = window.innerHeight;
  scale = Math.min(w / 390, h / 844);
  gameEl.style.transform = `translate(${-195 * scale}px, ${-422 * scale}px) scale(${scale})`;
}
window.addEventListener('resize', fit);
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
    ? '<path d="M70 8 L80 34 L95 14 L110 34 L125 14 L140 34 L150 8 L150 40 L70 40Z" fill="#ffc83a" stroke="#a87a10" stroke-width="3" transform="translate(-0 -10)"/>'
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
function popText(text, x, y, cls) {
  if (fxCount > 40) return;
  const d = document.createElement('div');
  d.className = 'dmg ' + (cls || '');
  d.textContent = text;
  d.style.left = (x - 24 + Math.random() * 20) + 'px';
  d.style.top = (y - 20) + 'px';
  fx.appendChild(d); fxCount++;
  setTimeout(() => { d.remove(); fxCount--; }, 800);
}
function boom(x, y, color) {
  if (fxCount > 40) return;
  const b = document.createElement('div');
  b.className = 'boom';
  b.style.left = x + 'px'; b.style.top = y + 'px';
  b.style.background = `radial-gradient(circle, #fff 0%, ${color} 40%, transparent 70%)`;
  fx.appendChild(b); fxCount++;
  setTimeout(() => { b.remove(); fxCount--; }, 300);
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

// ---------- เริ่มเกม ----------
let state = loadState() || newState();
let lastHit = null;   // จุดที่จะเด้งตัวเลขของการโจมตีครั้งถัดไป
let game;

function startGame(s) {
  state = s;
  game = new Game(state, {
    onSpawn: showEnemy,
    onHit(amount, source, crit) {
      const p = lastHit || enemyPoint();
      lastHit = null;
      if (source === 'dot') return popText(fmt(amount), p.x, p.y, 'cat');
      popText(fmt(amount) + (crit ? '!' : ''), p.x, p.y, crit ? 'crit' : source === 'cat' ? 'cat' : '');
      const el = $('enemy');
      el.classList.remove('hit'); void el.offsetWidth; el.classList.add('hit');
    },
    onKill(e, gold, gems) {
      const c = center($('enemy'));
      popText('+' + fmt(gold), c.x, c.y - 40, 'gold');
      if (gems) toast(`ได้เพชร ${gems} เม็ด`);
    },
    onStage(stage) {
      toast(isBigBoss(stage - 1) ? `ล้มบอสใหญ่! ไปด่าน ${stage}` : `ผ่านด่าน! ไปด่าน ${stage}`);
      saveState(state);
    },
    onBossFail() {
      toast('บอสหนีไปแล้ว! อัปเกรดแล้วกด FIGHT เพื่อท้าใหม่', 2500);
    },
    onHire(i) {
      toast(`${CATS[i].name} เข้าทีมแล้ว! ปลดล็อกสกิล${SKILLS[CATS[i].id].name}`, 2000);
      catEls[i].el.classList.remove('locked');
    },
    onSkill(id) {
      flash(CATS.find(c => c.id === id).color);
      toast(`${SKILLS[id].name}!`);
    },
  });
  catEls.forEach((c, i) => c.el.classList.toggle('locked', state.cats[i] === 0));
  updateHud(true);
}

// ---------- แมวผู้ช่วยบนหน้าผา ----------
const LEDGE_Y = [344, 438, 532, 626];
const catEls = CATS.map((c, i) => {
  const right = i >= 4, row = i % 4;
  const el = document.createElement('div');
  el.className = 'cat ' + (right ? 'r' : 'l');
  el.style[right ? 'right' : 'left'] = (row % 2 ? 10 : 4) + 'px';
  el.style.top = LEDGE_Y[row] + 'px';
  el.innerHTML = `<div class="bar"><i></i></div><img src="assets/cats/${c.id}.png" alt=""><span class="lvtag"></span>`;
  $('cats').appendChild(el);
  return { el, bar: el.querySelector('.bar i'), tag: el.querySelector('.lvtag'), charge: Math.random() };
});

// shots > 1 เมื่อชดเชยเฟรมที่ช้า: ยิงลูกเดียวแต่ดาเมจรวมทุกนัด
function shoot(i, shots = 1) {
  const from = center(catEls[i].el), to = enemyPoint();
  const col = CATS[i].color;
  const s = document.createElement('div');
  s.className = 'shot';
  s.style.background = col; s.style.boxShadow = `0 0 12px 4px ${col}`;
  fx.appendChild(s);
  catEls[i].el.classList.add('atk');
  setTimeout(() => catEls[i].el.classList.remove('atk'), 120);
  const dmg = game.catDps(i) * game.catPeriod() * shots;
  s.animate([{ transform: `translate(${from.x}px,${from.y}px)` }, { transform: `translate(${to.x}px,${to.y}px)` }], { duration: 260, easing: 'ease-in' })
    .onfinish = () => {
      s.remove();
      boom(to.x, to.y, col);
      lastHit = to;
      game.damage(dmg, 'cat');
    };
}

// ---------- แตะ ----------
function doTap(x, y) {
  lastHit = { x, y };
  boom(x, y, '#ffb300');
  game.tap();
  const h = $('hero');
  h.classList.remove('atk'); void h.offsetWidth; h.classList.add('atk');
  setTimeout(() => h.classList.remove('atk'), 80);
}
$('battle').addEventListener('pointerdown', e => {
  const p = toScene(e.clientX, e.clientY);
  doTap(p.x, p.y);
});
$('fight').addEventListener('click', () => {
  if (game.challengeBoss()) { toast('ท้าบอสอีกครั้ง!'); return; }
  const p = enemyPoint();
  doTap(p.x, p.y);
});

// ---------- สกิล ----------
const skillEls = CATS.map(c => {
  const b = document.createElement('button');
  b.className = 'sk';
  b.setAttribute('aria-label', 'สกิล' + SKILLS[c.id].name);
  b.innerHTML = `<img src="assets/skills/${c.id}.png" alt=""><div class="cd"></div><span class="t"></span>`;
  b.addEventListener('click', () => {
    const st = game.skillState(c.id);
    if (st.locked) return toast(`จ้าง${c.name}ก่อนเพื่อปลดล็อก: ${SKILLS[c.id].desc}`, 2000);
    if (!st.ready) return toast(`${SKILLS[c.id].name} พร้อมใน ${fmtTime(st.left)}`);
    game.useSkill(c.id);
  });
  $('skills').appendChild(b);
  return { b, ov: b.querySelector('.cd'), t: b.querySelector('.t') };
});
function updateSkills() {
  const now = Date.now();
  CATS.forEach((c, i) => {
    const st = game.skillState(c.id, now), el = skillEls[i];
    el.b.classList.toggle('locked', st.locked);
    el.b.classList.toggle('on', !st.locked && st.activeLeft > 0);
    el.b.classList.toggle('ready', !st.locked && st.ready);
    el.ov.style.setProperty('--p', st.locked ? '0%' : (st.frac * 100) + '%');
    el.t.textContent = st.locked ? '' : st.activeLeft > 0 ? Math.ceil(st.activeLeft) + 'วิ' : st.ready ? '' : shortTime(st.left);
  });
}
const shortTime = s => s >= 60 ? Math.ceil(s / 60) + 'น.' : Math.ceil(s) + 'วิ';

// ---------- HUD ----------
function updateHud(force) {
  const s = state, e = game.enemy;
  $('gold').textContent = fmt(s.gold);
  $('gems').textContent = fmt(s.gems);
  $('heroLv').textContent = s.heroLv;
  $('s0').textContent = s.stage > 1 ? s.stage - 1 : '';
  $('s1').textContent = s.stage;
  $('s2').textContent = s.stage + 1;
  document.querySelector('.st.cur').classList.toggle('big', isBigBoss(s.stage));
  $('ename').textContent = e.name;
  $('hptxt').textContent = fmt(Math.max(0, e.hp)) + ' HP';
  $('hpbar').style.width = Math.max(0, e.hp / e.maxHp * 100) + '%';
  $('dps').textContent = 'DPS ' + fmt(game.totalDps());
  const wave = $('wave');
  if (e.boss) {
    wave.textContent = (game.active('ice') ? '❄ ' : '⏱ ') + Math.max(0, game.bossLeft).toFixed(1) + ' วิ';
    wave.classList.toggle('hot', game.bossLeft < 10);
  } else {
    wave.textContent = s.farming ? 'ฟาร์มเหรียญ · กด FIGHT' : `ศัตรู ${s.kills + 1}/${BAL.enemiesPerStage}`;
    wave.classList.remove('hot');
  }
  $('fight').classList.toggle('pulse', s.farming);
  catEls.forEach((c, i) => { c.tag.textContent = s.cats[i] ? 'Lv ' + s.cats[i] : fmt(CATS[i].cost, true); });
  $('heroBadge').classList.toggle('on', canAffordSomething());
}
function canAffordSomething() {
  if (game.heroQuote(1).cost <= state.gold) return true;
  return CATS.some((_, i) => game.catQuote(i, 1).cost <= state.gold);
}

// ---------- แผ่น Heroes ----------
let buyMode = 1;
const rows = [];
function buildHeroList() {
  const list = $('heroList');
  list.innerHTML = '';
  const add = (key, img) => {
    const r = document.createElement('div');
    r.className = 'row';
    r.innerHTML = `<div class="pic"><img src="${img}" alt=""></div><div class="mid"><div class="nm"></div><div class="sub"></div></div><button class="buy" data-key="${key}"><b></b><span><img src="assets/ui/coin.png" alt=""><em></em></span></button>`;
    list.appendChild(r);
    rows.push({ key, r, nm: r.querySelector('.nm'), sub: r.querySelector('.sub'), btn: r.querySelector('.buy'), label: r.querySelector('.buy b'), cost: r.querySelector('.buy em') });
  };
  add('hero', HERO.img);
  CATS.forEach((c, i) => add(String(i), `assets/cats/${c.id}.png`));
}
function updateHeroList() {
  for (const row of rows) {
    let q, nm, sub, label;
    if (row.key === 'hero') {
      const lv = state.heroLv;
      q = game.heroQuote(buyMode);
      nm = `${HERO.name}<small>Lv ${lv}</small>`;
      sub = `ดาเมจแตะ ${fmt(game.tapDamage())} · ต่อเลเวล +${fmt(heroTap(lv + 1) - heroTap(lv))}<br><span class="p">×2 ที่ Lv ${nextMile(lv)} · คริติคอล ${Math.round(game.critChance() * 100)}%</span>`;
      label = `อัป ×${q.n}`;
    } else {
      const i = +row.key, c = CATS[i], lv = state.cats[i];
      q = game.catQuote(i, buyMode);
      const passiveOn = lv >= BAL.passiveLevel;
      nm = `${c.name}<small>${lv ? 'Lv ' + lv : 'ยังไม่จ้าง'}</small>`;
      sub = (lv ? `DPS ${fmt(game.catDps(i))} · ` : '') + `+${fmt(catDpsAt(i, lv + 1) - catDpsAt(i, lv))} DPS/เลเวล` +
        `<br><span class="p ${passiveOn ? 'on' : ''}">${passiveOn ? '✓ ' : `Lv ${BAL.passiveLevel}: `}${c.passiveText}</span>`;
      label = lv ? `อัป ×${q.n}` : 'จ้าง';
      row.r.classList.toggle('locked', !lv);
    }
    if (row.nm.innerHTML !== nm) row.nm.innerHTML = nm;
    if (row.sub.innerHTML !== sub) row.sub.innerHTML = sub;
    row.label.textContent = label;
    row.cost.textContent = fmt(q.cost, true);
    row.btn.classList.toggle('no', q.cost > state.gold);
  }
}
$('heroList').addEventListener('click', e => {
  const b = e.target.closest('.buy');
  if (!b) return;
  const ok = b.dataset.key === 'hero' ? game.buyHero(buyMode) : game.buyCat(+b.dataset.key, buyMode);
  if (!ok) toast('เหรียญไม่พอ');
  updateHeroList(); updateHud();
});
$('modes').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  buyMode = b.dataset.mode === 'max' ? 'max' : +b.dataset.mode;
  $('modes').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
  updateHeroList();
});

// ---------- เปิด/ปิดแผ่น ----------
function openSheet(id) {
  document.querySelectorAll('.sheet').forEach(s => s.classList.toggle('open', s.id === id));
  if (id === 'heroesSheet') updateHeroList();
  if (id === 'settingsSheet') refreshSettings();
}
function closeSheets() { document.querySelectorAll('.sheet').forEach(s => s.classList.remove('open')); }
$('openHeroes').addEventListener('click', () => $('heroesSheet').classList.contains('open') ? closeSheets() : openSheet('heroesSheet'));
$('openSettings').addEventListener('click', () => $('settingsSheet').classList.contains('open') ? closeSheets() : openSheet('settingsSheet'));
document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', closeSheets));

// ---------- Setting ----------
function refreshSettings() {
  $('exportText').value = exportSave(state);
  $('importErr').textContent = '';
  const st = state.stats;
  $('statsText').textContent = `ด่านสูงสุด ${state.maxStage} · แตะ ${fmt(st.taps)} ครั้ง\nล้มศัตรู ${fmt(st.kills)} ตัว · ล้มบอส ${fmt(st.bosses)} ตัว`;
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
  } catch (err) {
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
  $('offText').textContent = `ระหว่างที่ไม่อยู่ ${fmtTime(Math.min(sec, BAL.offlineCapSec))} แมวช่วยกันหาเหรียญได้`;
  $('offGold').textContent = fmt(offAmount);
  $('offCost').textContent = BAL.offlineX2Gems;
  $('offX2').disabled = state.gems < BAL.offlineX2Gems;
  $('offline').hidden = false;
}
$('offTake').addEventListener('click', () => { state.gold += offAmount; $('offline').hidden = true; saveState(state); });
$('offX2').addEventListener('click', () => {
  if (state.gems < BAL.offlineX2Gems) return;
  state.gems -= BAL.offlineX2Gems; state.gold += offAmount * 2;
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
// นับตามเวลาจริง: ถ้าเฟรมมาช้า (เครื่องช้า/แท็บอยู่เบื้องหลัง) จะชดเชยให้สูงสุด 5 วิ
// ช่วงที่หายไปนานกว่านั้นนับเป็นเวลาออฟไลน์แทน
let last = performance.now(), hudAcc = 0, autoTapAcc = 0;
function loop(now) {
  const dt = Math.min(5, (now - last) / 1000);
  last = now;
  game.tick(dt);
  const period = game.catPeriod();
  CATS.forEach((_, i) => {
    const c = catEls[i];
    if (!state.cats[i]) return;
    c.charge += dt / period;
    const shots = Math.floor(c.charge);
    if (shots > 0) { c.charge -= shots; shoot(i, shots); }
    c.bar.style.width = (c.charge * 100) + '%';
  });
  if (game.active('wind')) {
    autoTapAcc += dt * 10;
    let n = Math.min(20, Math.floor(autoTapAcc));
    autoTapAcc -= Math.floor(autoTapAcc);
    while (n-- > 0) { const p = enemyPoint(); doTap(p.x, p.y); }
  }
  hudAcc += dt;
  if (hudAcc >= 0.1) {
    hudAcc = 0;
    updateHud();
    updateSkills();
    if ($('heroesSheet').classList.contains('open')) updateHeroList();
  }
  requestAnimationFrame(loop);
}

buildHeroList();
const firstLoad = !loadState();
startGame(state);
if (!firstLoad) checkOffline(state.lastSeen);
else toast('แตะที่ศัตรูเพื่อปาระเบิด!', 2500);
requestAnimationFrame(loop);
