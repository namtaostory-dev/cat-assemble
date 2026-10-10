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

  heroCostBase: 10,
  heroCostGrowth: 1.07,
  tapPerLevel: 2,
  catCostGrowth: 1.075,
  mileStep: 25,           // ทุก 25 เลเวล ดาเมจ ×2
  mileMul: 2,
  passiveLevel: 25,

  baseCrit: 0.05,
  critMul: 3,
  catPeriod: 1.2,         // วินาทีต่อการยิงหนึ่งครั้งของแมวผู้ช่วย

  offlineMinSec: 60,
  offlineCapSec: 12 * 3600,
  offlineRate: 0.5,
  offlineX2Gems: 5,
  saveEverySec: 10,
};

export const HERO = { name: 'CatMaster', img: 'assets/cats/hero.png' };

export const CATS = [
  { id: 'fire',    name: 'แมวไฟ',       cost: 50,    dps: 5,     color: '#ff6a2a', passive: 'bossDmg',  passiveText: 'ดาเมจใส่บอส +25%' },
  { id: 'ice',     name: 'แมวน้ำแข็ง',   cost: 600,   dps: 40,    color: '#5ac8ff', passive: 'bossTime', passiveText: 'เวลาสู้บอส +3 วิ' },
  { id: 'thunder', name: 'แมวสายฟ้า',   cost: 7e3,   dps: 300,   color: '#ffd23a', passive: 'crit',     passiveText: 'โอกาสคริติคอล +3%' },
  { id: 'poison',  name: 'แมวพิษ',      cost: 85e3,  dps: 2.2e3, color: '#7be04a', passive: 'dot',      passiveText: 'เลือดศัตรูลดต่อเนื่อง 1% ของ DPS' },
  { id: 'earth',   name: 'แมวดิน',      cost: 1e6,   dps: 16e3,  color: '#c08a52', passive: 'gold',     passiveText: 'เหรียญ +15%' },
  { id: 'wind',    name: 'แมวลม',       cost: 12e6,  dps: 120e3, color: '#4fe3d6', passive: 'speed',    passiveText: 'แมวทุกตัวตีเร็วขึ้น 10%' },
  { id: 'light',   name: 'แมวแสง',      cost: 150e6, dps: 900e3, color: '#fff2a0', passive: 'tapDps',   passiveText: 'ดาเมจแตะ +1% ของ DPS รวม' },
  { id: 'dark',    name: 'แมวมืด',      cost: 2e9,   dps: 7e6,   color: '#a35cff', passive: 'critDmg',  passiveText: 'ดาเมจคริติคอล +50%' },
];

// สกิลผูกกับแมวธาตุเดียวกัน ปลดล็อกเมื่อจ้างแมวตัวนั้น
export const SKILLS = {
  fire:    { name: 'ฝนระเบิด',       cd: 120, dur: 0,  desc: 'ดาเมจทันที = ดาเมจแตะ ×60' },
  ice:     { name: 'แช่แข็ง',        cd: 300, dur: 10, desc: 'หยุดเวลาบอส 10 วิ' },
  thunder: { name: 'ฟ้าผ่า',         cd: 240, dur: 30, desc: 'โอกาสคริติคอล +30% 30 วิ' },
  poison:  { name: 'หมอกพิษ',        cd: 480, dur: 20, desc: 'ศัตรูเสียเลือด 0.5%/วิ 20 วิ' },
  earth:   { name: 'เหมืองทอง',      cd: 360, dur: 30, desc: 'เหรียญ ×2 30 วิ' },
  wind:    { name: 'พายุอุ้งเท้า',    cd: 300, dur: 30, desc: 'แตะอัตโนมัติ 10 ครั้ง/วิ 30 วิ' },
  light:   { name: 'แสงศักดิ์สิทธิ์',  cd: 480, dur: 30, desc: 'DPS แมวทุกตัว ×2 30 วิ' },
  dark:    { name: 'คืนจันทร์ดับ',    cd: 600, dur: 30, desc: 'ดาเมจคริติคอล ×3 30 วิ' },
};

// ทุก 50 ด่านเปลี่ยนโซน ครบแล้ววนใหม่
export const ZONES = [
  { name: 'หน้าผาหญ้า',          hue: 0,   enemies: ['บูลด็อก', 'ชิวาวา', 'ฮัสกี้'],          bosses: ['บูลด็อกจอมโหด', 'ชิวาวาขี้วีน', 'ฮัสกี้หัวร้อน'] },
  { name: 'ตลาดปลาตอนกลางคืน', hue: 200, enemies: ['หนูท่อ', 'หนูขโมยปลา', 'หนูหางยาว'],   bosses: ['หนูยักษ์ขโมยปลา', 'ราชาหนูท่อ', 'หนูนินจา'] },
  { name: 'หอคอยบนภูเขา',       hue: 260, enemies: ['กาดำ', 'นกฮูก', 'อีกาปากร้าย'],        bosses: ['กาดำปากร้าย', 'นกฮูกตาโต', 'จ่าฝูงอีกา'] },
  { name: 'ป่าหิมะ',             hue: 160, enemies: ['จิ้งจอก', 'หมาป่า', 'หมาป่าหิมะ'],     bosses: ['จิ้งจอกเจ้าเล่ห์', 'หมาป่าหินผา', 'ราชาหมาป่า'] },
];

export const SAVE_KEY = 'cat-assemble-save';
export const SAVE_VERSION = 1;
