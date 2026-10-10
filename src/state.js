import { CATS, SAVE_KEY, SAVE_VERSION } from './config.js';

export function newState() {
  return {
    v: SAVE_VERSION,
    gold: 0,
    gems: 0,
    stage: 1,
    maxStage: 1,
    kills: 0,          // ศัตรูธรรมดาที่ล้มแล้วในด่านนี้
    farming: false,    // แพ้บอสแล้ว วนตีศัตรูธรรมดาจนกว่าจะกด FIGHT
    heroLv: 1,
    cats: CATS.map(() => 0),
    skillReadyAt: {},  // id → Date.now() ที่ใช้ได้อีกครั้ง
    skillUntil: {},    // id → Date.now() ที่บัฟหมด
    lastSeen: Date.now(),
    stats: { taps: 0, kills: 0, bosses: 0 },
  };
}

// แปลงเซฟเวอร์ชันเก่าให้ใช้กับเกมเวอร์ชันปัจจุบันได้
// และบังคับทุกช่องให้เป็นตัวเลขที่ถูกต้อง: เซฟที่โหลดมาจากข้อความเป็นข้อมูลที่เชื่อไม่ได้
const num = (v, def, min = 0) => (typeof v === 'number' && isFinite(v) && v >= min ? v : def);
const int = (v, def, min = 0) => Math.floor(num(v, def, min));
const timeMap = m => {
  const out = {};
  if (m && typeof m === 'object') for (const c of CATS) if (typeof m[c.id] === 'number' && isFinite(m[c.id])) out[c.id] = m[c.id];
  return out;
};

function migrate(data) {
  const d = data && typeof data === 'object' ? data : {};
  const st = d.stats && typeof d.stats === 'object' ? d.stats : {};
  const stage = int(d.stage, 1, 1);
  return {
    v: SAVE_VERSION,
    gold: num(d.gold, 0),
    gems: int(d.gems, 0),
    stage,
    maxStage: Math.max(stage, int(d.maxStage, 1, 1)),
    kills: int(d.kills, 0),
    farming: d.farming === true,
    heroLv: int(d.heroLv, 1, 1),
    cats: CATS.map((_, i) => int(Array.isArray(d.cats) ? d.cats[i] : 0, 0)),
    skillReadyAt: timeMap(d.skillReadyAt),
    skillUntil: timeMap(d.skillUntil),
    lastSeen: num(d.lastSeen, Date.now()),
    stats: { taps: int(st.taps, 0), kills: int(st.kills, 0), bosses: int(st.bosses, 0) },
  };
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
