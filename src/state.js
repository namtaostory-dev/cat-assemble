import { BAL, CATS, STAR, STARTER, EQUIP, LEVEL, WEAPONS, WSKILLS, POTIONS, POTION_MAX_MIN, SAVE_KEY, SAVE_VERSION } from './config.js';

export function newState() {
  return {
    v: SAVE_VERSION,
    gold: 0,
    gemsFree: BAL.gemsStart,
    gemsPaid: 0,       // เพชรที่ซื้อด้วยเงินจริง (ยังไม่เปิดขาย) แยกไว้ตั้งแต่ตอนนี้
    stage: 1,
    maxStage: 1,
    kills: 0,          // ศัตรูธรรมดาที่ล้มแล้วในด่านนี้
    farming: false,    // แพ้บอสแล้ว วนตีศัตรูธรรมดาจนกว่าจะกด FIGHT
    swordLv: 1,
    speedLv: 0,
    cats: { [STARTER]: { lv: 1, star: 1, dupes: 0 } },
    team: [STARTER],
    pity: 0,           // นับครั้งที่เปิดกาชาตั้งแต่ได้ SSR ล่าสุด
    pulls: 0,
    skillReadyAt: {},  // id สกิลอาวุธ → Date.now() ที่ใช้ได้อีกครั้ง
    skillUntil: {},    // id สกิลอาวุธ → Date.now() ที่บัฟหมด
    autoSkill: true,   // ร่ายสกิลเองเมื่อคูลดาวน์หมด
    autoMove: true,    // ตัวเราเดิน/กระโดดไล่ศัตรูเอง (ปิด = บังคับด้วยแป้นและปุ่มกระโดด)
    potions: {},       // id ยา → Date.now() ที่ยาหมดฤทธิ์
    sound: { sfx: true, music: true, vol: 0.7 },
    lastSeen: Date.now(),
    stats: { taps: 0, kills: 0, bosses: 0 },
    level: 1,
    exp: 0,
    items: [],         // { uid, slot, rarity, lv, plus, look?, kind? }
    equip: {},         // ช่อง → uid
    nextUid: 1,
  };
}

// เซฟจากข้อความหรือเวอร์ชันเก่าเป็นข้อมูลที่เชื่อไม่ได้: บังคับทุกช่องให้เป็นค่าที่ถูกต้อง
const num = (v, def, min = 0) => (typeof v === 'number' && isFinite(v) && v >= min ? v : def);
const int = (v, def, min = 0) => Math.floor(num(v, def, min));
const obj = v => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
const timeMap = m => {
  const out = {};
  for (const k of WSKILLS) if (typeof obj(m)[k.id] === 'number' && isFinite(m[k.id])) out[k.id] = m[k.id];
  return out;
};
// ลำดับแมวในเซฟเวอร์ชัน 1 (แบ่งตามธาตุ) → แมวตัวใหม่
const V1_ORDER = ['blaze', 'frost', 'volt', 'toxin', 'rock', 'gale', 'lumi', 'nox'];

function migrate(data) {
  const d = obj(data), st = obj(d.stats);
  const stage = int(d.stage, 1, 1);
  const s = {
    v: SAVE_VERSION,
    gold: num(d.gold, 0),
    gemsFree: int(d.gemsFree, 0),
    gemsPaid: int(d.gemsPaid, 0),
    stage,
    maxStage: Math.max(stage, int(d.maxStage, 1, 1)),
    kills: int(d.kills, 0),
    farming: d.farming === true,
    swordLv: int(d.swordLv, 1, 1),
    speedLv: Math.min(BAL.speedMaxLevel, int(d.speedLv, 0)),
    cats: {},
    team: [],
    pity: int(d.pity, 0),
    pulls: int(d.pulls, 0),
    skillReadyAt: timeMap(d.skillReadyAt),
    skillUntil: timeMap(d.skillUntil),
    autoSkill: d.autoSkill !== false,
    autoMove: d.autoMove !== false,
    sound: { sfx: obj(d.sound).sfx !== false, music: obj(d.sound).music !== false, vol: Math.min(1, num(obj(d.sound).vol, 0.7)) },
    potions: Object.fromEntries(Object.keys(POTIONS).filter(k => typeof obj(d.potions)[k] === 'number' && isFinite(d.potions[k])).map(k => [k, Math.min(d.potions[k], Date.now() + POTION_MAX_MIN * 60000)])),
    lastSeen: num(d.lastSeen, Date.now()),
    stats: { taps: int(st.taps, 0), kills: int(st.kills, 0), bosses: int(st.bosses, 0) },
    level: int(d.level, 1, 1),
    exp: num(d.exp, 0),
    items: [],
    equip: {},
    nextUid: int(d.nextUid, 1, 1),
  };

  // อุปกรณ์: เก็บเฉพาะชิ้นที่ข้อมูลถูกต้อง
  if (Array.isArray(d.items)) for (const it of d.items.slice(0, EQUIP.invMax + 10)) {
    const x = obj(it);
    if (!Object.hasOwn(EQUIP.slots, x.slot) || !Object.hasOwn(EQUIP.rarity, x.rarity)) continue;
    const item = { uid: int(x.uid, 0, 1), slot: x.slot, rarity: x.rarity, lv: int(x.lv, 1, 1), plus: Math.min(EQUIP.enhanceMax, int(x.plus, 0)) };
    if (x.slot === 'outfit') item.look = Math.min(EQUIP.outfits.length - 1, int(x.look, 0));
    if (x.slot === 'weapon') item.kind = Object.hasOwn(WEAPONS, x.kind) ? x.kind : 'sword';
    if (item.uid && !s.items.some(o => o.uid === item.uid)) s.items.push(item);
  }
  for (const [slot, uid] of Object.entries(obj(d.equip))) {
    const it = s.items.find(o => o.uid === uid);
    if (Object.hasOwn(EQUIP.slots, slot) && it && it.slot === slot) s.equip[slot] = uid;
  }
  s.nextUid = Math.max(s.nextUid, ...s.items.map(o => o.uid + 1));

  if (int(d.v, 1) < 2) {
    // เวอร์ชัน 1: แมวจ้างด้วยเหรียญ เลเวลเดิมยกมาเป็นแมว ★1 และแถมเพชรเริ่มต้น
    s.swordLv = int(d.heroLv, 1, 1);
    s.gemsFree = int(d.gems, 0) + BAL.gemsStart;
    s.skillReadyAt = {}; s.skillUntil = {};
    if (Array.isArray(d.cats)) d.cats.forEach((lv, i) => {
      const id = V1_ORDER[i], l = int(lv, 0);
      if (id && l > 0) s.cats[id] = { lv: l, star: 1, dupes: 0 };
    });
  } else {
    const cats = obj(d.cats);
    for (const c of CATS) {
      const x = obj(cats[c.id]);
      if (!cats[c.id]) continue;
      s.cats[c.id] = { lv: int(x.lv, 1, 1), star: Math.min(STAR.max, int(x.star, 1, 1)), dupes: int(x.dupes, 0) };
    }
  }
  if (!s.cats[STARTER]) s.cats[STARTER] = { lv: 1, star: 1, dupes: 0 };

  if (int(d.v, 1) < 3) s.level = Math.max(s.level, Math.min(59, Math.floor(s.maxStage * 0.6)));

  // คู่หูที่เรียกอยู่: เก็บเฉพาะ id ที่มีจริง ไม่ซ้ำ ไม่เกินจำนวนช่องที่ปลดแล้ว
  const slots = LEVEL.slotsAt.filter(l => s.level >= l).length;
  const team = Array.isArray(d.team) ? d.team.filter(id => s.cats[id]) : [];
  for (const c of CATS) if (s.cats[c.id] && !team.includes(c.id)) team.push(c.id);
  s.team = [...new Set(team)].slice(0, slots);
  return s;
}

export function loadState() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return migrate(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveState(state) {
  state.lastSeen = Date.now();
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch {}
}

// ข้อความเซฟสำหรับคัดลอกไปเก็บหรือย้ายเครื่อง
export function exportSave(state) {
  const json = JSON.stringify({ ...state, lastSeen: Date.now() });
  const bytes = new TextEncoder().encode(json);
  let bin = '';
  bytes.forEach(b => (bin += String.fromCharCode(b)));
  return 'CA1:' + btoa(bin);
}

export function importSave(text) {
  const t = text.trim();
  if (!t.startsWith('CA1:') || t.length > 20000) throw new Error('รูปแบบเซฟไม่ถูกต้อง');
  const bin = atob(t.slice(4));
  const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
  const data = JSON.parse(new TextDecoder().decode(bytes));
  if (!data || typeof data !== 'object' || typeof data.stage !== 'number') throw new Error('รูปแบบเซฟไม่ถูกต้อง');
  return migrate(data);
}
