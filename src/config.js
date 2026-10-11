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
  { id: 'volt',  name: 'โวลต์',   img: 'thunder', rarity: 'C',   color: '#ffd23a', passive: 'exp' },
  { id: 'toxin', name: 'ท็อกซิน', img: 'poison',  rarity: 'C',   color: '#7be04a', passive: 'bossDmg' },
  { id: 'rock',  name: 'ร็อค',    img: 'earth',   rarity: 'C',   color: '#c08a52', passive: 'gold' },
  { id: 'blaze', name: 'บลาซ',    img: 'fire',    rarity: 'R',   color: '#ff6a2a', passive: 'skillDmg' },
  { id: 'frost', name: 'ฟรอสต์',  img: 'ice',     rarity: 'R',   color: '#5ac8ff', passive: 'bossTime' },
  { id: 'gale',  name: 'เกล',     img: 'wind',    rarity: 'SR',  color: '#4fe3d6', passive: 'speed' },
  { id: 'lumi',  name: 'ลูมิ',    img: 'light',   rarity: 'SSR', color: '#fff2a0', passive: 'cooldown' },
  { id: 'nox',   name: 'น็อกซ์',  img: 'dark',    rarity: 'SSR', color: '#a35cff', passive: 'critDmg' },
  { id: 'bombardier', name: 'บอมเบอร์', img: 'bombardier', rarity: 'R',   color: '#ff9a3a', passive: 'teamDps' },
  { id: 'saboteur',   name: 'ซาโบ',     img: 'saboteur',   rarity: 'SR',  color: '#ff5a4a', passive: 'crit' },
  { id: 'empress',    name: 'เอ็มเพรส', img: 'empress',    rarity: 'SSR', color: '#ff9ad5', passive: 'bossHp' },
];

// พาสซีฟของแมวคู่หู: มีผลเมื่อเรียกมาช่วยสู้ p = พลังตามดาว (★1 = 1, +0.2 ต่อดาว)
// v(p) คือค่าที่ใช้คำนวณ (สัดส่วน หรือวินาทีสำหรับ bossTime)
export const PASSIVES = {
  exp:      { v: p => 0.15 * p, text: p => `EXP +${Math.round(15 * p)}%` },
  bossDmg:  { v: p => 0.2 * p,  text: p => `ดาเมจใส่บอส +${Math.round(20 * p)}%` },
  gold:     { v: p => 0.25 * p, text: p => `เหรียญ +${Math.round(25 * p)}%` },
  skillDmg: { v: p => 0.3 * p,  text: p => `ดาเมจสกิล +${Math.round(30 * p)}%` },
  bossTime: { v: p => 5 * p,    text: p => `เวลาสู้บอส +${Math.round(5 * p)} วิ` },
  speed:    { v: p => 0.2 * p,  text: p => `ความเร็วฟัน +${Math.round(20 * p)}%` },
  cooldown: { v: p => Math.min(0.4, 0.15 * p), text: p => `คูลดาวน์สกิล −${Math.round(Math.min(40, 15 * p))}%` },
  critDmg:  { v: p => 0.4 * p,  text: p => `ดาเมจคริติคอล +${Math.round(40 * p)}%` },
  teamDps:  { v: p => 0.1 * p,  text: p => `DPS แมวทั้งทีม +${Math.round(10 * p)}%` },
  crit:     { v: p => 0.05 * p, text: p => `โอกาสคริติคอล +${Math.round(5 * p)}%` },
  bossHp:   { v: p => Math.min(0.5, 0.1 * p), text: p => `HP บอสลดลง ${Math.round(Math.min(50, 10 * p))}%` },
};

// ชนิดอาวุธ: สกิลของตัวเรามาจากอาวุธที่สวม (ไม่สวมอาวุธ = ดาบ)
export const WEAPONS = {
  sword: { name: 'ดาบ',       color: '#bff4ff' },
  light: { name: 'ไม้เท้าแสง', color: '#fff3a8' },
  fire:  { name: 'ไม้เท้าไฟ',  color: '#ff7a2a' },
};

// สกิลตามอาวุธ: ปลดตามเลเวลตัวเรา (lv) ร่ายอัตโนมัติเมื่อคูลดาวน์หมด
// ดาเมจต่อครั้ง = ดาเมจฟัน × mul × (1 + 15% ต่อขั้นตีบวกอาวุธ) โดนได้ targets ตัว ตัวละ hits ครั้ง ในระยะ range
// range 'all' = ทุกตัวในจอ · fx = ท่าที่วาดในฉาก · buff = บัฟแทนดาเมจ
export const WSKILLS = [
  { id: 'sw1', kind: 'sword', lv: 1,  name: 'ฟันวงกว้าง',     icon: '⚔️', cd: 4,  mul: 1.2, hits: 2, targets: 4,  range: 260, fx: 'arc' },
  { id: 'sw2', kind: 'sword', lv: 10, name: 'พายุดาบ',        icon: '🌀', cd: 10, mul: 1.0, hits: 5, targets: 8,  range: 420, fx: 'tornado' },
  { id: 'sw3', kind: 'sword', lv: 30, name: 'ดาบพุ่งทะลวง',    icon: '🗡️', cd: 15, mul: 1.5, hits: 6, targets: 10, range: 650, fx: 'dash' },
  { id: 'sw4', kind: 'sword', lv: 60, name: 'ดาบยักษ์ฟาดพื้น',  icon: '⚡', cd: 30, mul: 3.0, hits: 8, targets: 15, range: 'all', fx: 'giant' },
  { id: 'li1', kind: 'light', lv: 1,  name: 'ลำแสงศักดิ์สิทธิ์',  icon: '✨', cd: 5,  mul: 0.6, hits: 5, targets: 6,  range: 450, fx: 'beam' },
  { id: 'li2', kind: 'light', lv: 10, name: 'วงแสงศักดิ์สิทธิ์',  icon: '🔆', cd: 10, mul: 1.2, hits: 4, targets: 10, range: 320, fx: 'ring' },
  { id: 'li3', kind: 'light', lv: 30, name: 'พรแห่งแสง',      icon: '😇', cd: 30, buff: { dmg: 0.5, dur: 12 }, fx: 'bless' },
  { id: 'li4', kind: 'light', lv: 60, name: 'ฝนแสง',          icon: '🌟', cd: 30, mul: 3.0, hits: 8, targets: 15, range: 'all', fx: 'rain' },
  { id: 'fi1', kind: 'fire',  lv: 1,  name: 'ลูกไฟระเบิด',     icon: '🔥', cd: 4,  mul: 1.0, hits: 3, targets: 5,  range: 500, fx: 'fireball', splash: 150 },
  { id: 'fi2', kind: 'fire',  lv: 10, name: 'กำแพงไฟ',        icon: '🧱', cd: 12, mul: 0.9, hits: 6, targets: 10, range: 420, fx: 'firewall' },
  { id: 'fi3', kind: 'fire',  lv: 30, name: 'ระเบิดหลายจุด',    icon: '💣', cd: 20, mul: 1.5, hits: 4, targets: 6,  range: 'all', fx: 'bombs' },
  { id: 'fi4', kind: 'fire',  lv: 60, name: 'อุกกาบาตตก',      icon: '☄️', cd: 30, mul: 4.0, hits: 6, targets: 15, range: 'all', fx: 'meteor' },
];
export const WSKILL_PLUS = 0.15;   // ดาเมจสกิลเพิ่มต่อขั้นตีบวกของอาวุธ

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

// ตลาด (ออฟไลน์): ร้านในฉากตลาด ราคาเป็นจำนวนเท่าของเหรียญต่อมอนสเตอร์ในด่านสูงสุด
// x1/x2 = ช่วงหน้าร้านบนภาพตลาด 1024×572
export const MARKET = {
  img: 'assets/scenes/market.webp', w: 1024, h: 572, street: 512,
  shops: [
    { id: 'potion', name: 'ร้านยา',      tag: 'ยาบัฟ',    x1: 8,   x2: 190 },
    { id: 'fabric', name: 'ร้านผ้า',     tag: 'ชุด',      x1: 240, x2: 372 },
    { id: 'armory', name: 'โรงตีเหล็ก',  tag: 'ตีบวก',    x1: 378, x2: 495 },
    { id: 'bake',   name: 'ร้านขนม',     tag: 'ขนม EXP',  x1: 590, x2: 790 },
    { id: 'gems',   name: 'ร้านอัญมณี',  tag: 'กาชา',     x1: 895, x2: 1020 },
  ],
};
// ยาบัฟ: ซื้อซ้ำต่อเวลาได้ สูงสุด maxMin นาที
export const POTIONS = {
  dmg:   { name: 'ยาพลังแมว',  icon: '🧪', text: 'ดาเมจทั้งหมด ×2',   mul: 2,   min: 10, price: 300 },
  gold:  { name: 'ยาโชคทอง',   icon: '🍯', text: 'เหรียญ ×2',        mul: 2,   min: 10, price: 300 },
  speed: { name: 'ยาเร่งฝีเท้า', icon: '🥤', text: 'ความเร็วฟัน ×1.5', mul: 1.5, min: 10, price: 200 },
};
export const POTION_MAX_MIN = 60;
export const OUTFIT_PRICE = 400;    // ชุดระดับหายาก (R) เลเวลเท่าด่านสูงสุด
// ขนม: price = เหรียญ (เท่าของเหรียญต่อมอนสเตอร์) หรือ gems = เพชร · exp = สัดส่วนของ EXP ที่ต้องใช้ขึ้นเลเวลถัดไป
export const BREADS = [
  { id: 'bun',  name: 'ขนมปังปลาทู',   icon: '🥐', exp: 0.25, price: 150 },
  { id: 'cake', name: 'เค้กปลาแซลมอน', icon: '🎂', exp: 1,    gems: 60 },
];

// โหมดทดสอบ: ปุ่ม + รับเหรียญและเพชรฟรี ต้องตั้งเป็น false ก่อนเปิดขายเพชรจริง
export const DEV = { freeCurrency: true, gemsPerClick: 1000, minGoldPerClick: 10000 };

export const SAVE_KEY = 'cat-assemble-save';
export const SAVE_VERSION = 4;
