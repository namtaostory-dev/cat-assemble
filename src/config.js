// ค่าตัวเลขทั้งหมดของเกม ปรับสมดุลที่ไฟล์นี้ไฟล์เดียว

export const BAL = {
  hpBase: 20,
  hpGrowth: 1.3,          // เลือดศัตรูโตต่อด่าน
  hpLateStart: 140,       // หลังด่านนี้โตช้าลง
  hpLateGrowth: 1.12,
  goldFactor: 0.2,        // เหรียญต่อศัตรู = ค่านี้ × HP
  enemiesPerStage: 10,
  bossHpMul: 10,
  bigBossEvery: 10,
  bigBossMul: 3,
  bossTime: 30,
  bigBossTime: 45,

  // ตัวเรา (แมวนักดาบ)
  swordCostBase: 10,
  swordCostGrowth: 1.07,
  swordPerLevel: 2,
  swordMileStep: 25,      // ทุก 25 เลเวล ดาเมจดาบ ×2
  speedCostBase: 50,
  speedCostGrowth: 1.5,
  speedBase: 1,           // ฟันอัตโนมัติ ครั้ง/วินาที
  speedPerLevel: 0.1,
  speedMaxLevel: 30,
  tapMaxPerSec: 15,       // แตะนับได้สูงสุดเท่านี้ กันโปรแกรมกดอัตโนมัติ

  // แมวในทีม
  catCostGrowth: 1.075,
  catMileStep: 16,        // ทุก 16 เลเวล DPS ×2
  mileMul: 2,
  catPeriod: 1.2,         // วินาทีต่อการยิงหนึ่งครั้ง
  teamSize: 8,

  baseCrit: 0.05,
  critMul: 3,

  // เพชร
  gemsStart: 500,
  gemsPerBoss: 5,
  gemsBigBoss: 50,
  gemsMilestoneEvery: 25,
  gemsMilestone: 100,

  offlineMinSec: 60,
  offlineCapSec: 12 * 3600,
  offlineRate: 0.5,
  offlineX2Gems: 5,
  saveEverySec: 10,
};

export const RARITY = {
  C:   { dps: 3,  cost: 30,  rate: 0.55, refund: 5,   color: '#a8b4c4' },
  R:   { dps: 6,  cost: 60,  rate: 0.30, refund: 10,  color: '#7fb2e6' },
  SR:  { dps: 15, cost: 150, rate: 0.12, refund: 30,  color: '#b583ff' },
  SSR: { dps: 50, cost: 500, rate: 0.03, refund: 100, color: '#ffc83a' },
};

export const GACHA = { cost1: 100, cost10: 900, pity: 50 };

// ใช้แมวซ้ำกี่ตัวเพื่ออัปจาก ★1→2, 2→3, 3→4, 4→5
export const STAR = { dupes: [1, 2, 4, 8], max: 5, skillPerStar: 0.2 };

export const HERO = { name: 'CatMaster', img: 'assets/hero/slash1.png' };
export const STARTER = 'volt';

// img = ชื่อไฟล์ภาพใน assets/cats และ assets/skills
export const CATS = [
  { id: 'volt',  name: 'โวลต์',   img: 'thunder', rarity: 'C',   color: '#ffd23a' },
  { id: 'toxin', name: 'ท็อกซิน', img: 'poison',  rarity: 'C',   color: '#7be04a' },
  { id: 'rock',  name: 'ร็อค',    img: 'earth',   rarity: 'C',   color: '#c08a52' },
  { id: 'blaze', name: 'บลาซ',    img: 'fire',    rarity: 'R',  color: '#ff6a2a' },
  { id: 'frost', name: 'ฟรอสต์',  img: 'ice',     rarity: 'R',  color: '#5ac8ff' },
  { id: 'gale',  name: 'เกล',     img: 'wind',    rarity: 'SR',  color: '#4fe3d6' },
  { id: 'lumi',  name: 'ลูมิ',    img: 'light',   rarity: 'SSR', color: '#fff2a0' },
  { id: 'nox',   name: 'น็อกซ์',  img: 'dark',    rarity: 'SSR', color: '#a35cff' },
  // แมวพิกเซล มีพาสซีฟติดตัวเมื่ออยู่ในทีม (แรงขึ้นตามดาวเหมือนสกิล)
  { id: 'bombardier', name: 'บอมเบอร์', img: 'bombardier', rarity: 'R',   color: '#ff9a3a', passive: 'teamDps' },
  { id: 'saboteur',   name: 'ซาโบ',     img: 'saboteur',   rarity: 'SR',  color: '#ff5a4a', passive: 'crit' },
  { id: 'empress',    name: 'เอ็มเพรส', img: 'empress',    rarity: 'SSR', color: '#ff9ad5', passive: 'bossHp' },
];

export const PASSIVES = {
  teamDps: { text: p => `DPS แมวทั้งทีม +${Math.round(10 * p)}%` },
  crit:    { text: p => `โอกาสคริติคอล +${Math.round(5 * p)}%` },
  bossHp:  { text: p => `HP บอสลดลง ${Math.round(Math.min(50, 10 * p))}%` },
};

// สกิลเฉพาะของแมวแต่ละตัว p = พลังสกิลตามดาว (★1 = 1, +0.2 ต่อดาว)
export const SKILLS = {
  blaze: { name: 'ฟันเพลิง',        cd: 120, dur: 0,  desc: p => `ดาเมจทันที = ดาเมจดาบ ×${Math.round(60 * p)}` },
  frost: { name: 'แช่แข็ง',         cd: 300, dur: 10, desc: p => `หยุดเวลาบอส ${Math.round(10 * p)} วิ` },
  volt:  { name: 'ฟ้าผ่า',          cd: 240, dur: 30, desc: p => `โอกาสคริติคอล +${Math.round(30 * p)}% 30 วิ` },
  toxin: { name: 'หมอกพิษ',         cd: 480, dur: 20, desc: p => `ศัตรูเสียเลือด ${(0.5 * p).toFixed(1)}%/วิ 20 วิ` },
  rock:  { name: 'เหมืองทอง',       cd: 360, dur: 30, desc: p => `เหรียญ ×${(1 + p).toFixed(1)} 30 วิ` },
  gale:  { name: 'ลมเร่ง',          cd: 300, dur: 30, desc: p => `ตัวเราฟันเร็ว ×${(1 + 2 * p).toFixed(1)} 30 วิ` },
  lumi:  { name: 'แสงศักดิ์สิทธิ์',   cd: 480, dur: 30, desc: p => `DPS แมวทุกตัว ×${(1 + p).toFixed(1)} 30 วิ` },
  nox:   { name: 'คืนจันทร์ดับ',     cd: 600, dur: 30, desc: p => `ดาเมจคริติคอล ×${(1 + 2 * p).toFixed(1)} 30 วิ` },
  bombardier: { name: 'ระเบิดลูกใหญ่',  cd: 150, dur: 0, desc: p => `ดาเมจทันที = DPS ทีม ×${Math.round(15 * p)}` },
  saboteur:   { name: 'ไดนาไมต์ลูกโซ่', cd: 240, dur: 0, desc: p => `คริติคอลทันที = ดาเมจดาบ ×${Math.round(40 * p)} ×คริ` },
  empress:    { name: 'ฝนเวทมนตร์',    cd: 300, dur: 0, desc: p => `ดาเมจทันที = DPS ทีม ×${Math.round(30 * p)}` },
};

// ทุก 50 ด่านเปลี่ยนโซน ครบแล้ววนใหม่
export const ZONES = [
  { name: 'หน้าผาหญ้า',          hue: 0,   enemies: ['บูลด็อก', 'ชิวาวา', 'ฮัสกี้'],          bosses: ['บูลด็อกจอมโหด', 'ชิวาวาขี้วีน', 'ฮัสกี้หัวร้อน'] },
  { name: 'ตลาดปลาตอนกลางคืน', hue: 200, enemies: ['หนูท่อ', 'หนูขโมยปลา', 'หนูหางยาว'],   bosses: ['หนูยักษ์ขโมยปลา', 'ราชาหนูท่อ', 'หนูนินจา'] },
  { name: 'หอคอยบนภูเขา',       hue: 260, enemies: ['กาดำ', 'นกฮูก', 'อีกาปากร้าย'],        bosses: ['กาดำปากร้าย', 'นกฮูกตาโต', 'จ่าฝูงอีกา'] },
  { name: 'ป่าหิมะ',             hue: 160, enemies: ['จิ้งจอก', 'หมาป่า', 'หมาป่าหิมะ'],     bosses: ['จิ้งจอกเจ้าเล่ห์', 'หมาป่าหินผา', 'ราชาหมาป่า'] },
];

// เลเวลตัวเรา: ล่ามอนได้ EXP ขึ้นเลเวลแล้วดาเมจเพิ่ม และปลดช่องเรียกคู่หู
export const LEVEL = {
  expBase: 12,            // EXP ที่ต้องใช้จาก Lv L → L+1 = expBase × L^expPow
  expPow: 2,
  expPerMonster: s => 3 + 2 * s,
  expBossMul: 10,
  dmgPerLevel: 0.03,      // ทุกเลเวล ดาเมจทั้งตัวเราและคู่หู +3%
  slotsAt: [1, 10, 30, 60], // เลเวลที่ได้ช่องคู่หูช่องที่ 1, 2, 3, 4
};

// อุปกรณ์: ดรอปจากมอนสเตอร์ ตีบวกได้ +1 ถึง +10 ชุด (outfit) เปลี่ยนหน้าตาตัวเราด้วย
export const EQUIP = {
  slots: {
    weapon: { name: 'อาวุธ',   icon: '⚔️', stat: 'dmg' },
    hat:    { name: 'หมวก',    icon: '🎩', stat: 'crit' },
    armor:  { name: 'เกราะ',   icon: '🛡️', stat: 'dmg' },
    gloves: { name: 'ถุงมือ',   icon: '🧤', stat: 'critDmg' },
    shoes:  { name: 'รองเท้า',  icon: '👢', stat: 'speed' },
    ring:   { name: 'แหวน',    icon: '💍', stat: 'gold' },
    outfit: { name: 'ชุด',     icon: '👘', stat: 'all' },
  },
  rarity: {
    C: { name: 'ธรรมดา', mul: 1,   color: '#b8c4d6' },
    R: { name: 'หายาก',  mul: 1.9, color: '#5aa8ff' },
    E: { name: 'ล้ำค่า',  mul: 3.5, color: '#b583ff' },
    L: { name: 'ตำนาน',  mul: 6,   color: '#ffc83a' },
  },
  // ค่าพลัง = base × ตัวคูณความหายาก × (1 + scale × เลเวลไอเทม) × (1 + 10% ต่อขั้นตีบวก)
  stats: {
    dmg:     { name: 'ดาเมจตัวเรา',  base: 8,  scale: 0.03 },
    crit:    { name: 'โอกาสคริติคอล', base: 1,  scale: 0.002 },
    critDmg: { name: 'ดาเมจคริติคอล', base: 10, scale: 0.02 },
    speed:   { name: 'ความเร็วตี',    base: 3,  scale: 0.004 },
    gold:    { name: 'เหรียญ',       base: 5,  scale: 0.01 },
    all:     { name: 'ดาเมจทั้งทีม',  base: 6,  scale: 0.03 },
  },
  dropRate: 0.03,                                   // โอกาสดรอปจากมอนสเตอร์ธรรมดา
  dropRarity: { C: 0.70, R: 0.22, E: 0.07, L: 0.01 },
  bossRarity: { C: 0.30, R: 0.45, E: 0.20, L: 0.05 }, // บอสดรอปทุกครั้ง
  enhanceMax: 10,
  enhanceRate: [1, 0.95, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2],  // โอกาสสำเร็จ +0→+1 … +9→+10 (ล้มเหลวเสียแค่เหรียญ)
  enhancePer: 0.1,
  downFrom: 5,             // ตั้งแต่ +5 ตีพลาดแล้วระดับลด 1 ขั้น
  breakFrom: 8,            // ตั้งแต่ +8 ตีพลาดมีโอกาสแตก
  breakChance: 0.3,
  invMax: 60,
  // หน้าตาชุดชั่วคราว: ปรับโทนสีภาพตัวเรา จนกว่าจะมีภาพชุดจริง
  outfits: [
    { name: 'ชุดอัศวินทอง',  filter: 'sepia(.6) saturate(1.8) hue-rotate(-10deg)' },
    { name: 'ชุดนินจาเงา',   filter: 'grayscale(.7) brightness(.65) contrast(1.3)' },
    { name: 'ชุดจอมเวทม่วง', filter: 'hue-rotate(200deg) saturate(1.3)' },
    { name: 'ชุดเกราะมรกต',  filter: 'hue-rotate(100deg) saturate(1.3)' },
    { name: 'ชุดซามูไรแดง',  filter: 'hue-rotate(-50deg) saturate(1.6)' },
  ],
};

// โหมดทดสอบ: ปุ่ม + รับเหรียญและเพชรฟรี ต้องตั้งเป็น false ก่อนเปิดขายเพชรจริง
export const DEV = { freeCurrency: true, gemsPerClick: 1000, minGoldPerClick: 10000 };

export const SAVE_KEY = 'cat-assemble-save';
export const SAVE_VERSION = 3;
