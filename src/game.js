// กลไกเกมล้วนๆ ไม่แตะหน้าจอ: สูตร ดาเมจ ด่าน บอส การซื้อ สกิล
import { BAL, CATS, SKILLS, ZONES } from './config.js';

export const hpOf = s =>
  BAL.hpBase * BAL.hpGrowth ** Math.min(s, BAL.hpLateStart) * BAL.hpLateGrowth ** Math.max(s - BAL.hpLateStart, 0);
export const goldOf = s => Math.ceil(BAL.goldFactor * hpOf(s));
export const isBigBoss = s => s % BAL.bigBossEvery === 0;
export const zoneOf = s => ZONES[Math.floor((s - 1) / 50) % ZONES.length];
const mile = lv => BAL.mileMul ** Math.floor(lv / BAL.mileStep);

export const heroCost = (lv, n = 1) => geoSum(BAL.heroCostBase, BAL.heroCostGrowth, lv, n);
export const catCost = (i, lv, n = 1) => geoSum(CATS[i].cost, BAL.catCostGrowth, lv, n);
export const heroTap = lv => BAL.tapPerLevel * lv * mile(lv);
export const catDpsAt = (i, lv) => CATS[i].dps * lv * mile(lv);
export const nextMile = lv => (Math.floor(lv / BAL.mileStep) + 1) * BAL.mileStep;

// ราคารวมของการอัป n เลเวลจากเลเวล lv
function geoSum(base, g, lv, n) {
  return base * g ** lv * (g ** n - 1) / (g - 1);
}
// อัปได้มากสุดกี่เลเวลด้วยเงินที่มี
function maxAfford(base, g, lv, gold) {
  const n = Math.floor(Math.log(gold * (g - 1) / (base * g ** lv) + 1) / Math.log(g));
  return Math.max(0, n);
}

export class Game {
  constructor(state, hooks) {
    this.s = state;
    this.hooks = hooks;           // onHit, onKill, onBossFail, onStage, onSkill
    this.enemy = null;
    this.bossLeft = 0;
    this.dotAcc = 0;
    this.spawn();
  }

  // ---------- ค่าที่คำนวณจากสถานะ ----------
  has(passive) {
    const i = CATS.findIndex(c => c.passive === passive);
    return this.s.cats[i] >= BAL.passiveLevel;
  }
  active(id, now = Date.now()) { return (this.s.skillUntil[id] || 0) > now; }
  skillUnlocked(id) { return this.s.cats[CATS.findIndex(c => c.id === id)] > 0; }

  baseDps() { return CATS.reduce((sum, _, i) => sum + catDpsAt(i, this.s.cats[i]), 0); }
  catDps(i) { return catDpsAt(i, this.s.cats[i]) * (this.active('light') ? 2 : 1); }
  totalDps() { return CATS.reduce((sum, _, i) => sum + this.catDps(i), 0); }
  catPeriod() { return BAL.catPeriod / (this.has('speed') ? 1.1 : 1); }
  tapDamage() { return heroTap(this.s.heroLv) + (this.has('tapDps') ? 0.01 * this.totalDps() : 0); }
  critChance() { return BAL.baseCrit + (this.has('crit') ? 0.03 : 0) + (this.active('thunder') ? 0.3 : 0); }
  critMul() { return (BAL.critMul + (this.has('critDmg') ? 0.5 : 0)) * (this.active('dark') ? 3 : 1); }
  goldMul(now) { return (this.has('gold') ? 1.15 : 1) * (this.active('earth', now) ? 2 : 1); }
  bossTimeLimit() {
    return (isBigBoss(this.s.stage) ? BAL.bigBossTime : BAL.bossTime) + (this.has('bossTime') ? 3 : 0);
  }

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

  // ดาเมจทุกแหล่งผ่านที่นี่ คืนค่าดาเมจจริงที่ทำ
  damage(amount, source, crit = false) {
    const e = this.enemy;
    if (!e || e.hp <= 0) return 0;
    if (e.boss && this.has('bossDmg')) amount *= 1.25;
    e.hp -= amount;
    this.hooks.onHit?.(amount, source, crit);
    if (e.hp <= 0) this.kill();
    return amount;
  }

  tap(source = 'tap') {
    this.s.stats.taps++;
    const crit = Math.random() < this.critChance();
    return this.damage(this.tapDamage() * (crit ? this.critMul() : 1), source, crit);
  }

  kill() {
    const e = this.enemy, s = this.s, now = Date.now();
    s.stats.kills++;
    let gold = goldOf(s.stage) * this.goldMul(now), gems = 0;
    if (e.boss) {
      gold *= BAL.bossHpMul * (e.big ? BAL.bigBossMul : 1);
      if (e.big) gems = 1 + Math.floor(s.stage / 50);
      s.stats.bosses++;
      s.stage++;
      s.maxStage = Math.max(s.maxStage, s.stage);
      s.kills = 0;
    } else if (!s.farming) {
      s.kills++;
    }
    s.gold += gold;
    s.gems += gems;
    this.hooks.onKill?.(e, gold, gems);
    if (e.boss) this.hooks.onStage?.(s.stage);
    this.spawn();
  }

  // dt เป็นวินาที เรียกทุกเฟรม
  tick(dt) {
    const e = this.enemy, now = Date.now();
    if (e.boss && !this.active('ice', now)) {
      this.bossLeft -= dt;
      if (this.bossLeft <= 0) {
        this.s.farming = true;
        this.hooks.onBossFail?.();
        this.spawn();
        return;
      }
    }
    // ดาเมจต่อเนื่อง: พาสซีฟแมวพิษ + สกิลหมอกพิษ รวบเป็นก้อนทุก 0.5 วิ
    let dot = 0;
    if (this.has('dot')) dot += 0.01 * this.totalDps();
    if (this.active('poison', now)) dot += 0.005 * e.maxHp;
    this.dotAcc += dot * dt;
    if (this.dotAcc > 0 && (this.dotAcc >= e.hp || Math.floor(now / 500) !== this.lastDot)) {
      this.lastDot = Math.floor(now / 500);
      const d = this.dotAcc; this.dotAcc = 0;
      this.damage(d, 'dot');
    }
  }

  // ---------- การซื้อ ----------
  // mode: 1, 10 หรือ 'max' → คืน { n, cost }
  heroQuote(mode) {
    const lv = this.s.heroLv;
    const n = mode === 'max' ? maxAfford(BAL.heroCostBase, BAL.heroCostGrowth, lv, this.s.gold) : mode;
    return { n: Math.max(1, n), cost: heroCost(lv, Math.max(1, n)) };
  }
  catQuote(i, mode) {
    const lv = this.s.cats[i];
    const n = mode === 'max' ? maxAfford(CATS[i].cost, BAL.catCostGrowth, lv, this.s.gold) : mode;
    return { n: Math.max(1, n), cost: catCost(i, lv, Math.max(1, n)) };
  }
  buyHero(mode) {
    const q = this.heroQuote(mode);
    if (q.cost > this.s.gold) return false;
    this.s.gold -= q.cost; this.s.heroLv += q.n;
    return true;
  }
  buyCat(i, mode) {
    const q = this.catQuote(i, mode);
    if (q.cost > this.s.gold) return false;
    const wasLocked = this.s.cats[i] === 0;
    this.s.gold -= q.cost; this.s.cats[i] += q.n;
    if (wasLocked) this.hooks.onHire?.(i);
    return true;
  }

  // ---------- สกิล ----------
  skillState(id, now = Date.now()) {
    if (!this.skillUnlocked(id)) return { locked: true };
    const cd = SKILLS[id].cd;
    const left = Math.max(0, ((this.s.skillReadyAt[id] || 0) - now) / 1000);
    const activeLeft = Math.max(0, ((this.s.skillUntil[id] || 0) - now) / 1000);
    return { locked: false, ready: left <= 0, left, frac: left / cd, activeLeft };
  }
  useSkill(id) {
    const st = this.skillState(id);
    if (st.locked || !st.ready) return false;
    const now = Date.now(), sk = SKILLS[id];
    this.s.skillReadyAt[id] = now + sk.cd * 1000;
    if (sk.dur) this.s.skillUntil[id] = now + sk.dur * 1000;
    this.hooks.onSkill?.(id);
    if (id === 'fire') this.damage(this.tapDamage() * 60, 'skill');
    return true;
  }

  // ---------- ออฟไลน์ ----------
  offlineGold(sec) {
    const t = Math.min(sec, BAL.offlineCapSec);
    const dps = this.baseDps();
    if (t < BAL.offlineMinSec || dps <= 0) return 0;
    const kills = dps * t / hpOf(this.s.stage);
    return kills * goldOf(this.s.stage) * BAL.offlineRate * (this.has('gold') ? 1.15 : 1);
  }
}
