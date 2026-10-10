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
  R:   { dps: 5,  cost: 50,  rate: 0.75, refund: 10,  color: '#7fb2e6' },
  SR:  { dps: 15, cost: 150, rate: 0.22, refund: 30,  color: '#b583ff' },
  SSR: { dps: 50, cost: 500, rate: 0.03, refund: 100, color: '#ffc83a' },
};

export const GACHA = { cost1: 100, cost10: 900, pity: 50 };

// ใช้แมวซ้ำกี่ตัวเพื่ออัปจาก ★1→2, 2→3, 3→4, 4→5
export const STAR = { dupes: [1, 2, 4, 8], max: 5, skillPerStar: 0.2 };

export const HERO = { name: 'CatMaster', img: 'assets/hero/slash1.png' };
export const STARTER = 'volt';

// img = ชื่อไฟล์ภาพใน assets/cats และ assets/skills
export const CATS = [
  { id: 'volt',  name: 'โวลต์',   img: 'thunder', rarity: 'R',   color: '#ffd23a' },
  { id: 'toxin', name: 'ท็อกซิน', img: 'poison',  rarity: 'R',   color: '#7be04a' },
  { id: 'rock',  name: 'ร็อค',    img: 'earth',   rarity: 'R',   color: '#c08a52' },
  { id: 'blaze', name: 'บลาซ',    img: 'fire',    rarity: 'SR',  color: '#ff6a2a' },
  { id: 'frost', name: 'ฟรอสต์',  img: 'ice',     rarity: 'SR',  color: '#5ac8ff' },
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

// โหมดทดสอบ: ปุ่ม + รับเหรียญและเพชรฟรี ต้องตั้งเป็น false ก่อนเปิดขายเพชรจริง
export const DEV = { freeCurrency: true, gemsPerClick: 1000, minGoldPerClick: 10000 };

export const SAVE_KEY = 'cat-assemble-save';
export const SAVE_VERSION = 2;
