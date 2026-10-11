// กลไกเกมล้วนๆ ไม่แตะหน้าจอ: สูตร ดาเมจ ด่าน บอส การซื้อ กาชา ดาว สกิล
import { BAL, CATS, RARITY, GACHA, STAR, PASSIVES, WEAPONS, WSKILLS, WSKILL_PLUS, ZONES, LEVEL, EQUIP, POTIONS, POTION_MAX_MIN, OUTFIT_PRICE, BREADS } from './config.js';

export const hpOf = s =>
  BAL.hpBase * BAL.hpGrowth ** Math.min(s, BAL.hpLateStart) * BAL.hpLateGrowth ** Math.max(s - BAL.hpLateStart, 0);
export const goldOf = s => Math.ceil(BAL.goldFactor * hpOf(s));
export const isBigBoss = s => s % BAL.bigBossEvery === 0;
export const zoneOf = s => ZONES[Math.floor((s - 1) / 50) % ZONES.length];
export const catById = id => CATS.find(c => c.id === id);
export const starMul = star => 2 ** (star - 1);
export const skillPower = star => 1 + STAR.skillPerStar * (star - 1);

export const swordDmgAt = lv => BAL.swordPerLevel * lv * BAL.mileMul ** Math.floor(lv / BAL.swordMileStep);
export const catDpsAt = (id, lv, star) =>
  RARITY[catById(id).rarity].dps * lv * BAL.mileMul ** Math.floor(lv / BAL.catMileStep) * starMul(star);
export const nextMile = (lv, step) => (Math.floor(lv / step) + 1) * step;
export const expNeed = lv => Math.ceil(LEVEL.expBase * lv ** LEVEL.expPow);
export const slotsAtLevel = lv => LEVEL.slotsAt.filter(l => lv >= l).length;
// ค่าพลังของอุปกรณ์หนึ่งชิ้น
export function itemValue(it) {
  const st = EQUIP.stats[EQUIP.slots[it.slot].stat];
  return st.base * EQUIP.rarity[it.rarity].mul * (1 + st.scale * it.lv) * (1 + EQUIP.enhancePer * it.plus);
}
export function itemName(it) {
  if (it.slot === 'outfit') return EQUIP.outfits[it.look || 0].name;
  if (it.slot === 'weapon') return `${WEAPONS[it.kind || 'sword'].name}${EQUIP.rarity[it.rarity].name}`;
  return `${EQUIP.slots[it.slot].name}${EQUIP.rarity[it.rarity].name}`;
}

// ราคารวมของการอัป n เลเวลจากเลเวล lv
const geoSum = (base, g, lv, n) => base * g ** lv * (g ** n - 1) / (g - 1);
// อัปได้มากสุดกี่เลเวลด้วยเงินที่มี
const maxAfford = (base, g, lv, gold) =>
  Math.max(0, Math.floor(Math.log(gold * (g - 1) / (base * g ** lv) + 1) / Math.log(g)));

export class Game {
  constructor(state, hooks) {
    this.s = state;
    this.hooks = hooks;
    this.bossActive = false;
    this.bossLeft = 0;
    this.tapTokens = BAL.tapMaxPerSec;
  }

  // ---------- ค่าที่คำนวณจากสถานะ ----------
  power(id) { return skillPower(this.s.cats[id]?.star || 1); }
  inTeam(id) { return this.s.team.includes(id); }
  // ค่าพาสซีฟจากแมวในทีม (0 ถ้าไม่มี)
  passive(type) {
    const c = CATS.find(x => x.passive === type && this.inTeam(x.id));
    return c ? PASSIVES[type].v(this.power(c.id)) : 0;
  }
  // บัฟจากสกิล (เช่นพรแห่งแสง) ยังทำงานอยู่ไหม
  buffed(id, now = Date.now()) { return (this.s.skillUntil[id] || 0) > now; }
  buffDmg(now = Date.now()) {
    return WSKILLS.reduce((m, k) => m * (k.buff && this.buffed(k.id, now) ? 1 + k.buff.dmg : 1), 1) * this.potionMul('dmg', now);
  }
  // ยาจากตลาด: ตัวคูณถ้ายังไม่หมดเวลา
  potionLeft(id, now = Date.now()) { return Math.max(0, ((this.s.potions[id] || 0) - now) / 1000); }
  potionMul(id, now) { return this.potionLeft(id, now) > 0 ? POTIONS[id].mul : 1; }

  // ค่าพลังรวมจากอุปกรณ์ที่สวมอยู่ (หน่วย %)
  // คำนวณครั้งเดียวแล้วจำไว้ ล้างทิ้งเมื่อสวม/ถอด/ตีบวก
  gear() {
    if (this._gear) return this._gear;
    const g = { dmg: 0, crit: 0, critDmg: 0, speed: 0, gold: 0, all: 0 };
    for (const uid of Object.values(this.s.equip)) {
      const it = this.s.items.find(o => o.uid === uid);
      if (it) g[EQUIP.slots[it.slot].stat] += itemValue(it);
    }
    return (this._gear = g);
  }
  levelMul() { return 1 + LEVEL.dmgPerLevel * (this.s.level - 1); }
  slots() { return slotsAtLevel(this.s.level); }
  outfitLook() {
    const it = this.s.items.find(o => o.uid === this.s.equip.outfit);
    return it ? EQUIP.outfits[it.look || 0] : null;
  }
  catDps(id) {
    const c = this.s.cats[id];
    if (!c || !this.inTeam(id)) return 0;
    const g = this.gear();
    return catDpsAt(id, c.lv, c.star) * (1 + this.passive('teamDps')) * this.levelMul() * (1 + g.all / 100) * this.buffDmg();
  }
  totalDps() { return this.s.team.reduce((sum, id) => sum + this.catDps(id), 0); }
  baseDps() {
    return this.s.team.reduce((sum, id) => { const c = this.s.cats[id]; return sum + catDpsAt(id, c.lv, c.star); }, 0);
  }
  slashDamage() {
    const g = this.gear();
    return swordDmgAt(this.s.swordLv) * this.levelMul() * (1 + g.dmg / 100) * (1 + g.all / 100) * this.buffDmg();
  }
  autoRate() {
    const base = BAL.speedBase + BAL.speedPerLevel * this.s.speedLv;
    return base * (1 + this.gear().speed / 100) * (1 + this.passive('speed')) * this.potionMul('speed');
  }
  heroDps() { return this.slashDamage() * this.autoRate() * (1 + this.critChance() * (this.critMul() - 1)); }
  critChance() {
    const c = BAL.baseCrit + this.gear().crit / 100 + this.passive('crit');
    return Math.min(0.75, c);
  }
  critMul() { return BAL.critMul * (1 + this.gear().critDmg / 100 + this.passive('critDmg')); }
  goldMul() { return (1 + this.gear().gold / 100) * (1 + this.passive('gold')) * this.potionMul('gold'); }
  bossTimeLimit() { return (isBigBoss(this.s.stage) ? BAL.bigBossTime : BAL.bossTime) + this.passive('bossTime'); }
  gems() { return this.s.gemsFree + this.s.gemsPaid; }

  // ---------- ศัตรูและบอส (ตัวมอนสเตอร์อยู่ใน battle.js ที่นี่ดูแลตัวเลขและรางวัล) ----------
  monsterHp() { return hpOf(this.s.stage); }
  bossHp() {
    const s = this.s.stage, big = isBigBoss(s);
    const cut = this.passive('bossHp');
    return hpOf(s) * BAL.bossHpMul * (big ? BAL.bigBossMul : 1) * (1 - cut);
  }
  monsterName(boss) {
    const zone = zoneOf(this.s.stage), names = boss ? zone.bosses : zone.enemies;
    return names[(this.s.stage + this.s.kills + Math.floor(Math.random() * 3)) % names.length];
  }
  zoneHue() { return zoneOf(this.s.stage).hue; }
  mapId() { return zoneOf(this.s.stage).map; }
  wantsBoss() { return !this.s.farming && this.s.kills >= BAL.enemiesPerStage; }
  startBoss() { this.bossActive = true; this.bossLeft = this.bossTimeLimit(); }

  challengeBoss() {
    if (!this.s.farming) return false;
    this.s.farming = false;
    this.s.kills = BAL.enemiesPerStage;
    return true;
  }

  // ฟันหนึ่งครั้ง: คืน { amount, crit }
  rollSlash() {
    const crit = Math.random() < this.critChance();
    return { amount: this.slashDamage() * (crit ? this.critMul() : 1), crit };
  }
  // แตะ: นับได้ไม่เกิน tapMaxPerSec ครั้งต่อวินาที คืน null ถ้าเกิน
  tap() {
    if (this.tapTokens < 1) return null;
    this.tapTokens--;
    this.s.stats.taps++;
    return this.rollSlash();
  }

  // มอนสเตอร์ตาย: ให้รางวัล นับความคืบหน้า และขึ้นด่านถ้าเป็นบอส
  killed(e) {
    const s = this.s;
    s.stats.kills++;
    let gold = goldOf(s.stage) * this.goldMul(), gems = 0;
    if (e.boss) {
      gold *= BAL.bossHpMul * (e.big ? BAL.bigBossMul : 1);
      gems = BAL.gemsPerBoss + (e.big ? BAL.gemsBigBoss : 0);
      if (s.stage % BAL.gemsMilestoneEvery === 0 && s.stage >= s.maxStage) gems += BAL.gemsMilestone;
      s.stats.bosses++;
      s.stage++;
      s.maxStage = Math.max(s.maxStage, s.stage);
      s.kills = 0;
      this.bossActive = false;
    } else if (!s.farming) {
      s.kills = Math.min(BAL.enemiesPerStage, s.kills + 1);
    }
    s.gold += gold;
    s.gemsFree += gems;
    const stageAtKill = e.boss ? s.stage - 1 : s.stage;
    this.gainExp(LEVEL.expPerMonster(stageAtKill) * (e.boss ? LEVEL.expBossMul : 1) * (1 + this.passive('exp')));
    const drop = e.boss || Math.random() < EQUIP.dropRate ? this.rollItem(stageAtKill, e.boss) : null;
    this.hooks.onKill?.(e, gold, gems, drop);
    if (e.boss) this.hooks.onStage?.(s.stage);
  }

  // ---------- เลเวล ----------
  gainExp(n) {
    const s = this.s;
    s.exp += n;
    let up = 0;
    while (s.exp >= expNeed(s.level)) { s.exp -= expNeed(s.level); s.level++; up++; }
    if (up) this.hooks.onLevel?.(s.level, slotsAtLevel(s.level) > slotsAtLevel(s.level - up));
  }

  // ---------- อุปกรณ์ ----------
  rollItem(stage, boss) {
    const s = this.s;
    if (s.items.length >= EQUIP.invMax) return null;   // กระเป๋าเต็ม
    const table = boss ? EQUIP.bossRarity : EQUIP.dropRarity;
    let r = Math.random(), rarity = 'C';
    for (const [k, p] of Object.entries(table)) { if (r < p) { rarity = k; break; } r -= p; }
    const slots = Object.keys(EQUIP.slots);
    // ชุดหายากกว่าอุปกรณ์อื่นครึ่งหนึ่ง
    let slot = slots[Math.floor(Math.random() * slots.length)];
    if (slot === 'outfit' && Math.random() < 0.5) slot = slots[Math.floor(Math.random() * (slots.length - 1))];
    const it = { uid: s.nextUid++, slot, rarity, lv: stage, plus: 0 };
    if (slot === 'outfit') it.look = Math.floor(Math.random() * EQUIP.outfits.length);
    if (slot === 'weapon') { const kinds = Object.keys(WEAPONS); it.kind = kinds[Math.floor(Math.random() * kinds.length)]; }
    s.items.push(it);
    return it;
  }
  item(uid) { return this.s.items.find(o => o.uid === uid); }
  equipItem(uid) {
    const it = this.item(uid);
    if (!it) return false;
    this.s.equip[it.slot] = uid;
    this._gear = null;
    return true;
  }
  unequip(slot) { delete this.s.equip[slot]; this._gear = null; }
  isEquipped(uid) { return Object.values(this.s.equip).includes(uid); }
  salvageValue(it) { return Math.ceil(goldOf(it.lv) * 5 * EQUIP.rarity[it.rarity].mul * (1 + it.plus * 0.5)); }
  salvage(uid) {
    const it = this.item(uid);
    if (!it || this.isEquipped(uid)) return 0;
    const g = this.salvageValue(it);
    this.s.items = this.s.items.filter(o => o !== it);
    this.s.gold += g;
    return g;
  }
  enhanceCost(it) { return Math.ceil(goldOf(it.lv) * 20 * EQUIP.rarity[it.rarity].mul * 1.6 ** it.plus); }
  enhanceRate(it) { return EQUIP.enhanceRate[it.plus] ?? 0; }
  // ถ้าตีพลาดตอนนี้จะเกิดอะไร: 'none' | 'down' | 'break'
  enhanceRisk(it) { return it.plus >= EQUIP.breakFrom ? 'break' : it.plus >= EQUIP.downFrom ? 'down' : 'none'; }
  // คืน 'max' | 'gold' | 'ok' | 'fail' | 'down' | 'broken'
  enhance(uid) {
    const it = this.item(uid);
    if (!it) return null;
    if (it.plus >= EQUIP.enhanceMax) return 'max';
    const cost = this.enhanceCost(it);
    if (this.s.gold < cost) return 'gold';
    this.s.gold -= cost;
    this._gear = null;
    if (Math.random() < this.enhanceRate(it)) { it.plus++; return 'ok'; }
    const risk = this.enhanceRisk(it);
    if (risk === 'break' && Math.random() < EQUIP.breakChance) {
      for (const [k, u] of Object.entries(this.s.equip)) if (u === uid) delete this.s.equip[k];
      this.s.items = this.s.items.filter(o => o !== it);
      return 'broken';
    }
    if (risk !== 'none') { it.plus--; return 'down'; }
    return 'fail';
  }
  // ระดับออร่าจากอาวุธที่สวม: 0 ไม่มี, 1 ขาว (+1–3), 2 ฟ้า (+4–6), 3 ทอง (+7–10)
  auraTier() {
    const w = this.item(this.s.equip.weapon);
    const p = w ? w.plus : 0;
    return p >= 7 ? 3 : p >= 4 ? 2 : p >= 1 ? 1 : 0;
  }

  // dt เป็นวินาที เรียกทุกเฟรม
  tick(dt) {
    this.tapTokens = Math.min(BAL.tapMaxPerSec, this.tapTokens + dt * BAL.tapMaxPerSec);
    if (this.bossActive) {
      this.bossLeft -= dt;
      if (this.bossLeft <= 0) {
        this.bossActive = false;
        this.s.farming = true;
        this.hooks.onBossFail?.();
      }
    }
  }

  // ---------- อัปเกรดด้วยเหรียญ ----------
  // mode: 1, 10 หรือ 'max' → { n, cost }
  quote(kind, mode, id) {
    const s = this.s;
    let base, g, lv, cap = Infinity;
    if (kind === 'sword') { base = BAL.swordCostBase; g = BAL.swordCostGrowth; lv = s.swordLv; }
    else if (kind === 'speed') { base = BAL.speedCostBase; g = BAL.speedCostGrowth; lv = s.speedLv; cap = BAL.speedMaxLevel - lv; }
    else { base = RARITY[catById(id).rarity].cost; g = BAL.catCostGrowth; lv = s.cats[id].lv; }
    if (cap <= 0) return { n: 0, cost: Infinity, maxed: true };
    let n = mode === 'max' ? maxAfford(base, g, lv, s.gold) : mode;
    n = Math.max(1, Math.min(n, cap));
    return { n, cost: geoSum(base, g, lv, n) };
  }
  buy(kind, mode, id) {
    const q = this.quote(kind, mode, id);
    if (q.maxed || q.cost > this.s.gold) return false;
    this.s.gold -= q.cost;
    if (kind === 'sword') this.s.swordLv += q.n;
    else if (kind === 'speed') this.s.speedLv += q.n;
    else this.s.cats[id].lv += q.n;
    return true;
  }

  // ---------- กาชา ----------
  spendGems(n) {
    if (this.gems() < n) return false;
    const free = Math.min(this.s.gemsFree, n);   // ใช้เพชรฟรีก่อน
    this.s.gemsFree -= free;
    this.s.gemsPaid -= n - free;
    return true;
  }
  rollRarity() {
    this.s.pity++;
    this.s.pulls++;
    const r = Math.random();
    if (this.s.pity >= GACHA.pity || r < RARITY.SSR.rate) { this.s.pity = 0; return 'SSR'; }
    if (r < RARITY.SSR.rate + RARITY.SR.rate) return 'SR';
    return r < RARITY.SSR.rate + RARITY.SR.rate + RARITY.R.rate ? 'R' : 'C';
  }
  // คืนรายการผลลัพธ์ หรือ null ถ้าเพชรไม่พอ
  pull(count) {
    const cost = count === 10 ? GACHA.cost10 : GACHA.cost1 * count;
    if (!this.spendGems(cost)) return null;
    const rarities = [];
    for (let i = 0; i < count; i++) rarities.push(this.rollRarity());
    // เปิด 10 ครั้งการันตี SR ขึ้นไปอย่างน้อย 1 ตัว
    if (count === 10 && rarities.every(r => r === 'R' || r === 'C')) rarities[9] = 'SR';
    return rarities.map(rarity => {
      const pool = CATS.filter(c => c.rarity === rarity);
      return this.addCat(pool[Math.floor(Math.random() * pool.length)].id);
    });
  }
  addCat(id) {
    const s = this.s, rarity = catById(id).rarity;
    const owned = s.cats[id];
    if (!owned) {
      s.cats[id] = { lv: 1, star: 1, dupes: 0 };
      if (s.team.length < this.slots()) s.team.push(id);
      this.hooks.onNewCat?.(id);
      return { id, rarity, isNew: true };
    }
    if (owned.star >= STAR.max) {
      s.gemsFree += RARITY[rarity].refund;
      return { id, rarity, refund: RARITY[rarity].refund };
    }
    owned.dupes++;
    return { id, rarity, dupe: true, canStar: owned.dupes >= STAR.dupes[owned.star - 1] };
  }

  // ---------- จัดทีม ----------
  // คืน 'in' | 'out' | 'full' | 'last'
  toggleTeam(id) {
    const t = this.s.team;
    if (!this.s.cats[id]) return null;
    if (t.includes(id)) {
      if (t.length <= 1) return 'last';
      t.splice(t.indexOf(id), 1);
      return 'out';
    }
    if (t.length >= this.slots()) return 'full';
    t.push(id);
    return 'in';
  }

  // ---------- ดาว ----------
  starCost(id) {
    const c = this.s.cats[id];
    return c && c.star < STAR.max ? STAR.dupes[c.star - 1] : null;
  }
  canStarUp(id) {
    const need = this.starCost(id);
    return need !== null && this.s.cats[id].dupes >= need;
  }
  starUp(id) {
    if (!this.canStarUp(id)) return false;
    const c = this.s.cats[id];
    c.dupes -= this.starCost(id);
    c.star++;
    if (c.star >= STAR.max && c.dupes > 0) {         // ★5 แล้ว ตัวซ้ำที่เหลือแลกเป็นเพชร
      this.s.gemsFree += c.dupes * RARITY[catById(id).rarity].refund;
      c.dupes = 0;
    }
    return true;
  }

  // ---------- สกิลตามอาวุธ ----------
  weapon() { return this.item(this.s.equip.weapon); }
  weaponKind() { return this.weapon()?.kind || 'sword'; }
  // สกิล 4 ช่องของอาวุธที่สวมอยู่ เรียงตามเลเวลที่ปลด
  skillList() { return WSKILLS.filter(k => k.kind === this.weaponKind()); }
  skillCd(k) { return k.cd * (1 - this.passive('cooldown')); }
  skillState(k, now = Date.now()) {
    if (this.s.level < k.lv) return { locked: true };
    const cd = this.skillCd(k);
    const left = Math.max(0, ((this.s.skillReadyAt[k.id] || 0) - now) / 1000);
    const activeLeft = Math.max(0, ((this.s.skillUntil[k.id] || 0) - now) / 1000);
    return { locked: false, ready: left <= 0, left: Math.min(left, cd), frac: Math.min(1, left / cd), activeLeft };
  }
  // ดาเมจสกิลหนึ่งครั้ง (สุ่มคริแยกทุกครั้ง) ใส่บอสแรงขึ้นตามพาสซีฟ
  rollSkill(k, boss) {
    const w = this.weapon(), crit = Math.random() < this.critChance();
    const amount = this.slashDamage() * k.mul * (1 + WSKILL_PLUS * (w ? w.plus : 0)) * (1 + this.passive('skillDmg'))
      * (boss ? 1 + this.passive('bossDmg') : 1) * (crit ? this.critMul() : 1);
    return { amount, crit };
  }
  // เริ่มคูลดาวน์ (และบัฟถ้ามี) คืน false ถ้ายังไม่พร้อม ตัวฉากเป็นคนเลือกเป้าและทำดาเมจ
  useSkill(k) {
    const st = this.skillState(k);
    if (st.locked || !st.ready) return false;
    const now = Date.now();
    this.s.skillReadyAt[k.id] = now + this.skillCd(k) * 1000;
    if (k.buff) this.s.skillUntil[k.id] = now + k.buff.dur * 1000;
    return true;
  }

  // ---------- ตลาด ----------
  shopPrice(n) { return Math.ceil(goldOf(this.s.maxStage) * n); }
  // คืน 'ok' | 'gold' | 'max'
  buyPotion(id) {
    const p = POTIONS[id], now = Date.now(), cost = this.shopPrice(p.price);
    const left = this.potionLeft(id, now);
    if (left + p.min * 60 > POTION_MAX_MIN * 60) return 'max';
    if (this.s.gold < cost) return 'gold';
    this.s.gold -= cost;
    this.s.potions[id] = now + (left + p.min * 60) * 1000;
    return 'ok';
  }
  // คืน item | 'gold' | 'full'
  buyOutfit(look) {
    const cost = this.shopPrice(OUTFIT_PRICE);
    if (this.s.items.length >= EQUIP.invMax) return 'full';
    if (this.s.gold < cost) return 'gold';
    this.s.gold -= cost;
    const it = { uid: this.s.nextUid++, slot: 'outfit', rarity: 'R', lv: this.s.maxStage, plus: 0, look };
    this.s.items.push(it);
    return it;
  }
  breadExp(b) { return Math.ceil(expNeed(this.s.level) * b.exp); }
  // คืน EXP ที่ได้ | 'gold' | 'gems'
  buyBread(id) {
    const b = BREADS.find(x => x.id === id);
    if (!b) return null;
    if (b.gems) { if (!this.spendGems(b.gems)) return 'gems'; }
    else {
      const cost = this.shopPrice(b.price);
      if (this.s.gold < cost) return 'gold';
      this.s.gold -= cost;
    }
    const exp = this.breadExp(b);
    this.gainExp(exp);
    return exp;
  }

  // ---------- ออฟไลน์ ----------
  offlineGold(sec) {
    const t = Math.min(sec, BAL.offlineCapSec);
    const dps = this.baseDps() + this.slashDamage() * (BAL.speedBase + BAL.speedPerLevel * this.s.speedLv);
    if (t < BAL.offlineMinSec || dps <= 0) return 0;
    return dps * t / hpOf(this.s.stage) * goldOf(this.s.stage) * BAL.offlineRate;
  }
}
