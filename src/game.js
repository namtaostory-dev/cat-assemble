// กลไกเกมล้วนๆ ไม่แตะหน้าจอ: สูตร ดาเมจ ด่าน บอส การซื้อ กาชา ดาว สกิล
import { BAL, CATS, RARITY, GACHA, STAR, SKILLS, ZONES } from './config.js';

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

// ราคารวมของการอัป n เลเวลจากเลเวล lv
const geoSum = (base, g, lv, n) => base * g ** lv * (g ** n - 1) / (g - 1);
// อัปได้มากสุดกี่เลเวลด้วยเงินที่มี
const maxAfford = (base, g, lv, gold) =>
  Math.max(0, Math.floor(Math.log(gold * (g - 1) / (base * g ** lv) + 1) / Math.log(g)));

export class Game {
  constructor(state, hooks) {
    this.s = state;
    this.hooks = hooks;
    this.enemy = null;
    this.bossLeft = 0;
    this.dotAcc = 0;
    this.tapTokens = BAL.tapMaxPerSec;
    this.spawn();
  }

  // ---------- ค่าที่คำนวณจากสถานะ ----------
  active(id, now = Date.now()) { return !!this.s.cats[id] && (this.s.skillUntil[id] || 0) > now; }
  power(id) { return skillPower(this.s.cats[id]?.star || 1); }
  inTeam(id) { return this.s.team.includes(id); }

  catDps(id) {
    const c = this.s.cats[id];
    if (!c || !this.inTeam(id)) return 0;
    return catDpsAt(id, c.lv, c.star) * (this.active('lumi') ? 1 + this.power('lumi') : 1);
  }
  totalDps() { return this.s.team.reduce((sum, id) => sum + this.catDps(id), 0); }
  baseDps() {
    return this.s.team.reduce((sum, id) => { const c = this.s.cats[id]; return sum + catDpsAt(id, c.lv, c.star); }, 0);
  }
  slashDamage() { return swordDmgAt(this.s.swordLv); }
  autoRate() {
    const base = BAL.speedBase + BAL.speedPerLevel * this.s.speedLv;
    return base * (this.active('gale') ? 1 + 2 * this.power('gale') : 1);
  }
  heroDps() { return this.slashDamage() * this.autoRate() * (1 + this.critChance() * (this.critMul() - 1)); }
  critChance() { return BAL.baseCrit + (this.active('volt') ? 0.3 * this.power('volt') : 0); }
  critMul() { return BAL.critMul * (this.active('nox') ? 1 + 2 * this.power('nox') : 1); }
  goldMul(now) { return this.active('rock', now) ? 1 + this.power('rock') : 1; }
  bossTimeLimit() { return isBigBoss(this.s.stage) ? BAL.bigBossTime : BAL.bossTime; }
  gems() { return this.s.gemsFree + this.s.gemsPaid; }

  // ---------- ศัตรู ----------
  spawn() {
    const s = this.s.stage, zone = zoneOf(s);
    const boss = !this.s.farming && this.s.kills >= BAL.enemiesPerStage;
    const big = boss && isBigBoss(s);
    const hp = hpOf(s) * (boss ? BAL.bossHpMul * (big ? BAL.bigBossMul : 1) : 1);
    const names = boss ? zone.bosses : zone.enemies;
    this.enemy = { boss, big, hp, maxHp: hp, name: names[(s + this.s.kills) % names.length], hue: zone.hue };
    this.bossLeft = boss ? this.bossTimeLimit() : 0;
    this.hooks.onSpawn?.(this.enemy);
  }

  challengeBoss() {
    if (!this.s.farming) return false;
    this.s.farming = false;
    this.s.kills = BAL.enemiesPerStage;
    this.spawn();
    return true;
  }

  // ดาเมจทุกแหล่งผ่านที่นี่
  damage(amount, source, crit = false) {
    const e = this.enemy;
    if (!e || e.hp <= 0) return 0;
    e.hp -= amount;
    this.hooks.onHit?.(amount, source, crit);
    if (e.hp <= 0) this.kill();
    return amount;
  }

  // ฟันหนึ่งครั้ง (อัตโนมัติหรือจากการแตะ)
  slash(source) {
    const crit = Math.random() < this.critChance();
    return this.damage(this.slashDamage() * (crit ? this.critMul() : 1), source, crit);
  }
  // แตะ: นับได้ไม่เกิน tapMaxPerSec ครั้งต่อวินาที คืน false ถ้าเกิน
  tap() {
    if (this.tapTokens < 1) return false;
    this.tapTokens--;
    this.s.stats.taps++;
    this.slash('tap');
    return true;
  }

  kill() {
    const e = this.enemy, s = this.s, now = Date.now();
    s.stats.kills++;
    let gold = goldOf(s.stage) * this.goldMul(now), gems = 0;
    if (e.boss) {
      gold *= BAL.bossHpMul * (e.big ? BAL.bigBossMul : 1);
      gems = BAL.gemsPerBoss + (e.big ? BAL.gemsBigBoss : 0);
      if (s.stage % BAL.gemsMilestoneEvery === 0 && s.stage >= s.maxStage) gems += BAL.gemsMilestone;
      s.stats.bosses++;
      s.stage++;
      s.maxStage = Math.max(s.maxStage, s.stage);
      s.kills = 0;
    } else if (!s.farming) {
      s.kills++;
    }
    s.gold += gold;
    s.gemsFree += gems;
    this.hooks.onKill?.(e, gold, gems);
    if (e.boss) this.hooks.onStage?.(s.stage);
    this.spawn();
  }

  // dt เป็นวินาที เรียกทุกเฟรม
  tick(dt) {
    const e = this.enemy, now = Date.now();
    this.tapTokens = Math.min(BAL.tapMaxPerSec, this.tapTokens + dt * BAL.tapMaxPerSec);
    if (e.boss && !this.active('frost', now)) {
      this.bossLeft -= dt;
      if (this.bossLeft <= 0) {
        this.s.farming = true;
        this.hooks.onBossFail?.();
        this.spawn();
        return;
      }
    }
    // สกิลหมอกพิษ รวบดาเมจเป็นก้อนทุก 0.5 วิ
    if (this.active('toxin', now)) this.dotAcc += 0.005 * this.power('toxin') * e.maxHp * dt;
    if (this.dotAcc > 0 && (this.dotAcc >= e.hp || Math.floor(now / 500) !== this.lastDot)) {
      this.lastDot = Math.floor(now / 500);
      const d = this.dotAcc; this.dotAcc = 0;
      this.damage(d, 'dot');
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
    return r < RARITY.SSR.rate + RARITY.SR.rate ? 'SR' : 'R';
  }
  // คืนรายการผลลัพธ์ หรือ null ถ้าเพชรไม่พอ
  pull(count) {
    const cost = count === 10 ? GACHA.cost10 : GACHA.cost1 * count;
    if (!this.spendGems(cost)) return null;
    const rarities = [];
    for (let i = 0; i < count; i++) rarities.push(this.rollRarity());
    // เปิด 10 ครั้งการันตี SR ขึ้นไปอย่างน้อย 1 ตัว
    if (count === 10 && rarities.every(r => r === 'R')) rarities[9] = 'SR';
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
      if (s.team.length < BAL.teamSize) s.team.push(id);
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

  // ---------- สกิล ----------
  skillState(id, now = Date.now()) {
    if (!this.s.cats[id] || !this.inTeam(id)) return { locked: true };
    const cd = SKILLS[id].cd;
    const left = Math.max(0, ((this.s.skillReadyAt[id] || 0) - now) / 1000);
    const activeLeft = Math.max(0, ((this.s.skillUntil[id] || 0) - now) / 1000);
    return { locked: false, ready: left <= 0, left, frac: left / cd, activeLeft };
  }
  useSkill(id) {
    const st = this.skillState(id);
    if (st.locked || !st.ready) return false;
    const now = Date.now(), sk = SKILLS[id], p = this.power(id);
    this.s.skillReadyAt[id] = now + sk.cd * 1000;
    const dur = id === 'frost' ? sk.dur * p : sk.dur;
    if (dur) this.s.skillUntil[id] = now + dur * 1000;
    this.hooks.onSkill?.(id);
    if (id === 'blaze') this.damage(this.slashDamage() * 60 * p, 'skill');
    return true;
  }

  // ---------- ออฟไลน์ ----------
  offlineGold(sec) {
    const t = Math.min(sec, BAL.offlineCapSec);
    const dps = this.baseDps() + this.slashDamage() * (BAL.speedBase + BAL.speedPerLevel * this.s.speedLv);
    if (t < BAL.offlineMinSec || dps <= 0) return 0;
    return dps * t / hpOf(this.s.stage) * goldOf(this.s.stage) * BAL.offlineRate;
  }
}
