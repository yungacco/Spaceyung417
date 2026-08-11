import { Player, Enemy, Boss, Bullet, Particle, Pickup } from "./entities.js";
import { COLORS, hexToRgba, clamp, rand, dist2 } from "./theme.js";
import { loadSave, persist } from "./storage.js";
import { pickUpgrades } from "./upgrades.js";
import * as audio from "./audio.js";

const PLAYER_HIT_RADIUS = 15;

function circleHit(a, b) {
  const r = (a.radius || 4) + (b.radius || PLAYER_HIT_RADIUS);
  return dist2(a.x, a.y, b.x, b.y) <= r * r;
}

export class Game {
  constructor(canvas, input) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.input = input;
    this.state = "menu";
    this.width = 0;
    this.height = 0;
    this.stars = [];
    this.nebulae = [];
    this.particles = [];
    this.floatingTexts = [];
    this.bullets = [];
    this.enemies = [];
    this.pickups = [];
    this.boss = null;
    this.player = null;
    this.formation = null;
    this.transition = null;
    this.waveActive = false;
    this.demoTimer = 0;
    this.demoEnemies = [];
    this.demoPlayerPhase = 0;
    this.shake = { mag: 0, time: 0, duration: 0 };
    this.settings = { shake: true, haptics: true };
    this.score = 0;
    this.wave = 1;
    this.runDust = 0;
    this.nextLevelThreshold = 40;
    this.comboCount = 0;
    this.comboTimer = 0;
    this.comboWindow = 1.1;
    this.lastTime = 0;

    this.onLevelUp = null;
    this.onGameOver = null;
    this.onWaveToast = null;
    this.onBossIncoming = null;
    this.onPlayerHit = null;

    this._loop = this._loop.bind(this);
    this.resize();
    requestAnimationFrame(this._loop);
  }

  bounds() { return { left: 44, right: this.width - 44 }; }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.canvas.width = Math.round(this.width * dpr);
    this.canvas.height = Math.round(this.height * dpr);
    this.canvas.style.width = this.width + "px";
    this.canvas.style.height = this.height + "px";
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.canvasRect = this.canvas.getBoundingClientRect();
    this._rebuildStarfield();
    if (this.player) this.player.x = clamp(this.player.x, this.bounds().left, this.bounds().right);
  }

  _rebuildStarfield() {
    const count = Math.round((this.width * this.height) / 9000);
    this.stars = [];
    for (let i = 0; i < count; i++) {
      this.stars.push({
        x: rand(0, this.width),
        y: rand(0, this.height),
        r: rand(0.6, 1.9),
        speed: rand(10, 46),
        phase: rand(0, Math.PI * 2),
        rate: rand(1, 3),
      });
    }
    this.nebulae = [
      { x: this.width * 0.22, y: this.height * 0.18, r: Math.max(this.width, this.height) * 0.35, color: COLORS.navy700 },
      { x: this.width * 0.82, y: this.height * 0.7, r: Math.max(this.width, this.height) * 0.3, color: COLORS.navy600 },
    ];
  }

  setSettings(s) { Object.assign(this.settings, s); }

  addShake(mag, duration) {
    if (!this.settings.shake) return;
    if (mag >= this.shake.mag || duration >= this.shake.time) {
      this.shake.mag = Math.max(mag, this.shake.time > 0 ? this.shake.mag * 0.6 : 0);
      this.shake.time = Math.max(duration, this.shake.time);
      this.shake.duration = this.shake.time;
    }
  }

  vibrate(pattern) { if (this.settings.haptics) audio.vibrate(pattern); }

  spawnExplosion(x, y, color, count, big) {
    for (let i = 0; i < count; i++) {
      const a = rand(0, Math.PI * 2);
      const speed = rand(40, big ? 260 : 150);
      this.particles.push(new Particle(x, y, Math.cos(a) * speed, Math.sin(a) * speed, color, rand(0.35, big ? 0.9 : 0.55), rand(2, big ? 6 : 4)));
    }
  }

  spawnFloatingText(x, y, text, color) {
    this.floatingTexts.push({ x, y, vy: -42, text, color, life: 1, maxLife: 1 });
  }

  // ---------------- Run lifecycle ----------------

  startRun() {
    const save = loadSave();
    const shop = save.shop;
    this.player = new Player(this.width / 2, this.height - 96);
    this.player.maxLives = 3 + shop.life;
    this.player.lives = this.player.maxLives;
    for (let i = 0; i < shop.multishot; i++) this.player.applyRunUpgrade("multishot");
    for (let i = 0; i < shop.shield; i++) this.player.applyRunUpgrade("shield");
    for (let i = 0; i < shop.speed; i++) this.player.applyRunUpgrade("speed");
    for (let i = 0; i < shop.bomb; i++) this.player.applyRunUpgrade("bomb");
    this.player.bombCharge = clamp(shop.bomb * 25, 0, 90);

    this.bullets = [];
    this.enemies = [];
    this.pickups = [];
    this.particles = [];
    this.floatingTexts = [];
    this.boss = null;
    this.formation = null;
    this.transition = null;
    this.score = 0;
    this.wave = 1;
    this.runDust = 0;
    this.nextLevelThreshold = 40;
    this.comboCount = 0;
    this.comboTimer = 0;

    this.state = "playing";
    this.spawnWave(this.wave);
    audio.startMusic();
  }

  pause() { if (this.state === "playing") this.state = "paused"; }
  resume() { if (this.state === "paused") this.state = "playing"; }

  applyLevelUpChoice(id) {
    this.player.applyRunUpgrade(id);
    this.state = "playing";
  }

  triggerGameOver() {
    this.state = "gameover";
    audio.sfxGameOver();
    audio.stopMusic();
    const save = loadSave();
    const bankedDust = Math.round(this.runDust * 0.4);
    const isHighScore = this.score > save.highScore;
    save.highScore = Math.max(save.highScore, this.score);
    save.cosmicDust += bankedDust;
    persist();
    if (this.onGameOver) this.onGameOver({ score: this.score, wave: this.wave, dust: this.runDust, bankedDust, isHighScore });
  }

  // ---------------- Wave / boss spawning ----------------

  spawnWave(waveNumber) {
    this.enemies = [];
    this.boss = null;
    if (waveNumber % 5 === 0) { this._spawnBoss(waveNumber); return; }

    const rows = Math.min(2 + Math.floor((waveNumber - 1) / 3), 5);
    const cols = Math.min(5 + Math.floor((waveNumber - 1) / 2), 8);
    const marginX = 60;
    const spacingX = Math.min(60, (this.width - marginX * 2) / Math.max(cols - 1, 1));
    const spacingY = 48;
    const startX = this.width / 2 - ((cols - 1) * spacingX) / 2;
    const startY = 84;
    const shooterChance = clamp(0.12 + waveNumber * 0.015, 0.12, 0.4);
    let idx = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const roll = Math.random();
        let type = "basic";
        if (roll < shooterChance) type = "shooter";
        else if (roll > 0.86) type = "fast";
        const x = startX + c * spacingX;
        const y = startY + r * spacingY;
        this.enemies.push(new Enemy(x, y, type, idx));
        idx++;
      }
    }
    this.formation = { dir: 1, speed: clamp(46 + waveNumber * 4, 46, 150), stepDown: 22 };
    this.waveActive = true;
    if (this.onWaveToast) this.onWaveToast(`ONDATA ${waveNumber}`);
  }

  _spawnBoss(waveNumber) {
    const tier = waveNumber / 5;
    const hp = Math.round(55 + tier * 38);
    this.boss = new Boss(this.width / 2, -80, hp);
    this.formation = null;
    this.waveActive = true;
    audio.sfxBossAlarm();
    if (this.onBossIncoming) this.onBossIncoming();
    if (this.onWaveToast) this.onWaveToast("ATTENZIONE: BOSS STELLARE");
  }

  // ---------------- Update ----------------

  _loop(ts) {
    const dt = Math.min((ts - (this.lastTime || ts)) / 1000, 0.05);
    this.lastTime = ts;
    this.update(dt);
    this.render();
    requestAnimationFrame(this._loop);
  }

  update(dt) {
    this._updateStarfield(dt);
    if (this.shake.time > 0) this.shake.time = Math.max(0, this.shake.time - dt);
    this._updateParticles(dt);
    this._updateFloatingTexts(dt);

    if (this.state === "menu") { this._updateMenuDemo(dt); return; }
    if (this.state !== "playing") return;
    this._updatePlaying(dt);
  }

  _updateStarfield(dt) {
    for (const s of this.stars) {
      s.y += s.speed * dt;
      s.phase += dt * s.rate;
      if (s.y > this.height + 4) { s.y = -4; s.x = rand(0, this.width); }
    }
  }

  _updateParticles(dt) {
    for (const p of this.particles) p.update(dt);
    this.particles = this.particles.filter((p) => p.alive);
  }

  _updateFloatingTexts(dt) {
    for (const f of this.floatingTexts) { f.y += f.vy * dt; f.life -= dt; }
    this.floatingTexts = this.floatingTexts.filter((f) => f.life > 0);
  }

  _updateMenuDemo(dt) {
    this.demoPlayerPhase += dt;
    this.demoTimer -= dt;
    if (this.demoTimer <= 0) {
      this.demoTimer = rand(3, 5.5);
      const dir = Math.random() < 0.5 ? 1 : -1;
      const e = new Enemy(dir === 1 ? -30 : this.width + 30, rand(this.height * 0.12, this.height * 0.28), "basic", Math.floor(rand(0, 3)));
      e._dir = dir;
      this.demoEnemies.push(e);
    }
    for (const e of this.demoEnemies) {
      e.update(dt, e._dir * 70 * dt, 0);
    }
    this.demoEnemies = this.demoEnemies.filter((e) => e.baseX > -60 && e.baseX < this.width + 60);
  }

  _updatePlaying(dt) {
    const player = this.player;
    const bounds = this.bounds();

    let touchTargetX = null;
    if (this.input.pointerActive && this.input.pointerX !== null) {
      touchTargetX = this.input.pointerX - this.canvasRect.left;
    } else {
      const target = this.input.axisX * player.speed;
      player.vx += (target - player.vx) * Math.min(1, dt * 12);
    }
    player.update(dt, bounds, touchTargetX);

    if (this.input.consumeBomb()) this.triggerBomb();

    if (player.canFire()) {
      player.fire();
      this._spawnPlayerBullets();
      audio.sfxShoot();
    }

    if (this.formation && this.enemies.length) {
      let minX = Infinity, maxX = -Infinity;
      for (const e of this.enemies) { if (!e.alive) continue; minX = Math.min(minX, e.baseX - e.radius); maxX = Math.max(maxX, e.baseX + e.radius); }
      let dx = this.formation.dir * this.formation.speed * dt;
      let dy = 0;
      if (maxX + dx > this.width - 26 || minX + dx < 26) { this.formation.dir *= -1; dy = this.formation.stepDown; dx = 0; }
      for (const e of this.enemies) {
        if (!e.alive) continue;
        e.update(dt, dx, dy);
        if (e.baseY + e.radius >= player.y - 30) {
          e.alive = false;
          this.spawnExplosion(e.x, e.y, COLORS.coral500, 10, false);
          this._handlePlayerHit();
        } else if (e.wantsToShoot()) {
          this._spawnEnemyBullet(e);
        }
      }
      this.enemies = this.enemies.filter((e) => e.alive);
    }

    if (this.boss) {
      this.boss.update(dt, { left: 70, right: this.width - 70 });
      if (this.boss.wantsToAttack()) this._spawnBossAttack();
      if (!this.boss.alive) this._handleBossDefeat();
    }

    for (const b of this.bullets) b.update(dt);
    this._resolveCollisions();
    this.bullets = this.bullets.filter((b) => b.alive && b.y > -40 && b.y < this.height + 40 && b.x > -40 && b.x < this.width + 40);

    for (const p of this.pickups) {
      if (!p.magnetized && dist2(p.x, p.y, player.x, player.y) < 130 * 130) p.magnetized = true;
      p.update(dt, player);
      if (dist2(p.x, p.y, player.x, player.y) < 22 * 22) { p.alive = false; this._collectPickup(p); }
    }
    this.pickups = this.pickups.filter((p) => p.alive && p.y < this.height + 40);

    if (this.comboTimer > 0) { this.comboTimer -= dt; if (this.comboTimer <= 0) this.comboCount = 0; }

    if (this.waveActive && !this.boss && this.enemies.length === 0 && !this.transition) {
      this.waveActive = false;
      this.transition = { timer: 1.15 };
      audio.sfxWaveClear();
      this._addBonusScore(25 * this.wave);
      if (this.onWaveToast) this.onWaveToast(`ONDATA ${this.wave} COMPLETATA`);
    }
    if (this.transition) {
      this.transition.timer -= dt;
      if (this.transition.timer <= 0) { this.transition = null; this.wave++; this.spawnWave(this.wave); }
    }

    if (player.lives <= 0 && this.state === "playing") this.triggerGameOver();
  }

  _spawnPlayerBullets() {
    const player = this.player;
    const count = player.bulletCount;
    const spread = Math.min(0.5, count * 0.09);
    const speed = 640;
    for (let i = 0; i < count; i++) {
      const t = count === 1 ? 0 : -0.5 + i / (count - 1);
      const angle = -Math.PI / 2 + t * spread;
      const offsetX = count === 1 ? 0 : t * 14;
      this.bullets.push(new Bullet(player.x + offsetX, player.y - 26, Math.cos(angle) * speed, Math.sin(angle) * speed, "player", { radius: 4, damage: 1 }));
    }
  }

  _spawnEnemyBullet(e) {
    const speed = 170 + this.wave * 3;
    this.bullets.push(new Bullet(e.x, e.y + e.radius * 0.5, 0, speed, "enemy", { color: COLORS.coral500, radius: 5 }));
    audio.sfxEnemyShoot();
  }

  _spawnBossAttack() {
    const boss = this.boss;
    const tier = boss.maxHp / 55;
    if (Math.random() < 0.5) {
      const count = Math.round(10 + tier * 3);
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2;
        this.bullets.push(new Bullet(boss.x, boss.y, Math.cos(a) * 190, Math.sin(a) * 190, "boss", { color: COLORS.teal400, radius: 6 }));
      }
    } else {
      const dx = this.player.x - boss.x, dy = this.player.y - boss.y;
      const base = Math.atan2(dy, dx);
      for (const off of [-0.2, 0, 0.2]) {
        const a = base + off;
        this.bullets.push(new Bullet(boss.x, boss.y, Math.cos(a) * 300, Math.sin(a) * 300, "boss", { color: COLORS.amber500, radius: 6 }));
      }
    }
    audio.sfxBossShot();
  }

  _resolveCollisions() {
    for (const b of this.bullets) {
      if (!b.alive) continue;
      if (b.owner === "player") {
        for (const e of this.enemies) {
          if (!e.alive) continue;
          if (circleHit(b, e)) {
            b.alive = false;
            const dead = e.hit(b.damage);
            this.spawnExplosion(e.x, e.y, e.variant.rim, dead ? 12 : 4, false);
            if (dead) this._killEnemyRewards(e);
            break;
          }
        }
        if (b.alive && this.boss && circleHit(b, this.boss)) {
          b.alive = false;
          const dead = this.boss.hit(b.damage);
          this.spawnExplosion(this.boss.x + rand(-24, 24), this.boss.y + rand(-24, 24), COLORS.gold400, 5, false);
          if (dead) this._handleBossDefeat();
        }
      } else if (this.player.invulnTimer <= 0) {
        if (circleHit(b, { x: this.player.x, y: this.player.y, radius: PLAYER_HIT_RADIUS })) {
          b.alive = false;
          this._handlePlayerHit();
        }
      }
    }
  }

  _killEnemyRewards(e) {
    audio.sfxExplosion(false);
    const base = e.type === "shooter" ? 16 : e.type === "fast" ? 12 : 10;
    this._addScore(base, e.x, e.y);
    const dustValue = e.type === "shooter" ? 2 : 1;
    this.pickups.push(new Pickup(e.x, e.y, dustValue));
  }

  _handleBossDefeat() {
    const boss = this.boss;
    audio.sfxExplosion(true);
    this.addShake(20, 0.7);
    this.spawnExplosion(boss.x, boss.y, COLORS.gold400, 46, true);
    this._addScore(500 + this.wave * 20, boss.x, boss.y - 30);
    const dropCount = 12;
    for (let i = 0; i < dropCount; i++) {
      const p = new Pickup(boss.x + rand(-40, 40), boss.y + rand(-20, 20), 3);
      this.pickups.push(p);
    }
    this.boss = null;
  }

  _handlePlayerHit() {
    const player = this.player;
    const result = player.takeHit();
    if (result === "invuln") return;
    this.comboCount = 0;
    this.comboTimer = 0;
    if (result === "hit") {
      audio.sfxPlayerHit();
      this.vibrate([40, 30, 40]);
      this.addShake(10, 0.35);
      this.spawnExplosion(player.x, player.y, COLORS.danger500, 14, false);
      if (this.onPlayerHit) this.onPlayerHit();
    } else if (result === "shield") {
      audio.sfxPlayerHit();
      this.vibrate(25);
      this.spawnExplosion(player.x, player.y, COLORS.teal400, 10, false);
    }
  }

  _collectPickup(p) {
    audio.sfxPickup();
    this.runDust += p.value;
    if (this.runDust >= this.nextLevelThreshold && this.state === "playing") this._triggerLevelUp();
  }

  _addScore(base, x, y) {
    this.comboTimer = this.comboWindow;
    this.comboCount = Math.min(this.comboCount + 1, 40);
    const mult = 1 + Math.min(this.comboCount - 1, 20) * 0.08;
    const gained = Math.round(base * mult);
    this.score += gained;
    if (this.comboCount > 2) this.spawnFloatingText(x, y, `+${gained}`, COLORS.gold400);
    return gained;
  }

  _addBonusScore(amount) { this.score += amount; }

  _triggerLevelUp() {
    this.nextLevelThreshold = Math.round((this.nextLevelThreshold + 30) * 1.5);
    this.state = "levelup";
    audio.sfxLevelUp();
    const choices = pickUpgrades(this.player, 3);
    if (this.onLevelUp) this.onLevelUp(choices);
  }

  triggerBomb() {
    if (this.state !== "playing") return;
    const player = this.player;
    if (!player || player.bombCharge < player.bombMax) return;
    player.bombCharge = 0;
    audio.sfxBomb();
    this.vibrate([30, 20, 60]);
    this.addShake(16, 0.5);
    for (const e of this.enemies) {
      if (!e.alive) continue;
      e.alive = false;
      this.spawnExplosion(e.x, e.y, e.variant.rim, 10, false);
      this._killEnemyRewards(e);
    }
    this.enemies = [];
    if (this.boss) {
      const dmg = Math.round(this.boss.maxHp * (0.16 + player.bombLevel * 0.02));
      const dead = this.boss.hit(dmg);
      this.spawnExplosion(this.boss.x, this.boss.y, COLORS.gold400, 30, true);
      if (dead) this._handleBossDefeat();
    }
    this.bullets = this.bullets.filter((b) => b.owner === "player");
  }

  getHud() {
    const p = this.player;
    return {
      score: this.score,
      wave: this.wave,
      lives: p ? p.lives : 0,
      maxLives: p ? p.maxLives : 0,
      dust: this.runDust,
      bombPct: p ? p.bombCharge / p.bombMax : 0,
      bombReady: p ? p.bombCharge >= p.bombMax : false,
      combo: this.comboCount,
      comboActive: this.comboTimer > 0 && this.comboCount > 1,
      bossActive: !!this.boss,
      bossHpPct: this.boss ? this.boss.hp / this.boss.maxHp : 0,
    };
  }

  // ---------------- Render ----------------

  render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);
    ctx.save();
    if (this.shake.time > 0 && this.shake.duration > 0) {
      const m = this.shake.mag * (this.shake.time / this.shake.duration);
      ctx.translate(rand(-m, m), rand(-m, m));
    }

    this._drawBackground(ctx);
    this._drawStarfield(ctx);

    if (this.state === "menu") {
      for (const e of this.demoEnemies) e.draw(ctx);
      this._drawDemoPlayer(ctx);
      ctx.restore();
      return;
    }

    for (const p of this.pickups) p.draw(ctx);
    for (const b of this.bullets) b.draw(ctx);
    for (const e of this.enemies) if (e.alive) e.draw(ctx);
    if (this.boss) this.boss.draw(ctx);
    if (this.player && this.state !== "gameover") this.player.draw(ctx);
    for (const pt of this.particles) pt.draw(ctx);
    for (const ft of this.floatingTexts) this._drawFloatingText(ctx, ft);
    if (this.boss) this._drawBossBar(ctx);

    ctx.restore();
  }

  _drawBackground(ctx) {
    const g = ctx.createLinearGradient(0, 0, 0, this.height);
    g.addColorStop(0, COLORS.navy950);
    g.addColorStop(1, COLORS.navy900);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.save();
    ctx.globalAlpha = 0.35;
    for (const n of this.nebulae) {
      const rg = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r);
      rg.addColorStop(0, hexToRgba(n.color, 0.35));
      rg.addColorStop(1, hexToRgba(n.color, 0));
      ctx.fillStyle = rg;
      ctx.fillRect(0, 0, this.width, this.height);
    }
    ctx.restore();
  }

  _drawStarfield(ctx) {
    for (const s of this.stars) {
      const alpha = 0.35 + 0.55 * Math.abs(Math.sin(s.phase));
      ctx.fillStyle = hexToRgba(COLORS.cream100, alpha);
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  _drawFloatingText(ctx, f) {
    const alpha = clamp(f.life / f.maxLife, 0, 1);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = f.color;
    ctx.font = "700 15px -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(f.text, f.x, f.y);
    ctx.restore();
  }

  _drawBossBar(ctx) {
    const w = Math.min(340, this.width - 80);
    const x = this.width / 2 - w / 2;
    const y = 66;
    ctx.save();
    ctx.fillStyle = hexToRgba(COLORS.navy950, 0.6);
    ctx.fillRect(x, y, w, 10);
    const pct = clamp(this.boss.hp / this.boss.maxHp, 0, 1);
    const g = ctx.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, COLORS.coral500);
    g.addColorStop(1, COLORS.gold400);
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w * pct, 10);
    ctx.strokeStyle = hexToRgba(COLORS.cream200, 0.4);
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x, y, w, 10);
    ctx.fillStyle = COLORS.cream200;
    ctx.font = "700 10px -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("BOSS STELLARE", this.width / 2, y - 5);
    ctx.restore();
  }

  _drawDemoPlayer(ctx) {
    const x = this.width / 2;
    const y = this.height * 0.62 + Math.sin(this.demoPlayerPhase * 0.9) * 10;
    const demo = { x, y, width: 46, height: 52, tilt: Math.sin(this.demoPlayerPhase * 0.5) * 0.15, thrusterPhase: this.demoPlayerPhase * 14, hitFlash: 0 };
    Player.prototype.draw.call(demo, ctx);
  }
}
