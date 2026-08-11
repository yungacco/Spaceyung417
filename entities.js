import { COLORS, sparklePath, drawGlow, hexToRgba, clamp, rand, lerp } from "./theme.js";

export class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.width = 46;
    this.height = 52;
    this.baseSpeed = 360;
    this.vx = 0;
    this.tilt = 0;
    this.lives = 3;
    this.maxLives = 3;
    this.invulnTimer = 0;
    this.fireTimer = 0;
    this.thrusterPhase = 0;

    this.multishotLevel = 0;
    this.shieldLevel = 0;
    this.speedLevel = 0;
    this.bombLevel = 0;

    this.shieldCharges = 0;
    this.shieldMax = 1;
    this.shieldRegenTimer = 0;
    this.bombCharge = 0;
    this.hitFlash = 0;
  }

  get speed() { return this.baseSpeed * (1 + this.speedLevel * 0.16); }
  get fireInterval() { return clamp(0.26 - this.multishotLevel * 0.018, 0.11, 0.5); }
  get bulletCount() { return 1 + Math.min(this.multishotLevel, 6); }
  get bombMax() { return 100; }
  get bombRegenRate() { return 100 / clamp(20 - this.bombLevel * 2.2, 7, 20); }

  applyRunUpgrade(id) {
    if (id === "multishot") this.multishotLevel++;
    else if (id === "shield") { this.shieldLevel++; this.shieldMax = 1 + this.shieldLevel; this.shieldCharges = Math.min(this.shieldCharges + 1, this.shieldMax); }
    else if (id === "speed") this.speedLevel++;
    else if (id === "bomb") this.bombLevel++;
  }

  update(dt, bounds, touchTargetX = null) {
    if (touchTargetX !== null) {
      const target = clamp(touchTargetX, bounds.left, bounds.right);
      const prevX = this.x;
      const smoothing = 1 - Math.pow(0.0007, dt);
      this.x = lerp(this.x, target, smoothing);
      this.vx = (this.x - prevX) / Math.max(dt, 0.0001);
    } else {
      this.x = clamp(this.x + this.vx * dt, bounds.left, bounds.right);
    }
    const tiltTarget = clamp(this.vx / this.speed, -1, 1) * 0.32;
    this.tilt += (tiltTarget - this.tilt) * Math.min(1, dt * 10);
    this.thrusterPhase += dt * 14;
    if (this.invulnTimer > 0) this.invulnTimer -= dt;
    if (this.hitFlash > 0) this.hitFlash -= dt;
    if (this.fireTimer > 0) this.fireTimer -= dt;

    if (this.shieldLevel > 0 && this.shieldCharges < this.shieldMax) {
      this.shieldRegenTimer += dt;
      const regenTime = clamp(9 - this.shieldLevel * 0.8, 4, 9);
      if (this.shieldRegenTimer >= regenTime) { this.shieldRegenTimer = 0; this.shieldCharges++; }
    }
    if (this.bombCharge < this.bombMax) this.bombCharge = Math.min(this.bombMax, this.bombCharge + this.bombRegenRate * dt);
  }

  canFire() { return this.fireTimer <= 0; }
  fire() { this.fireTimer = this.fireInterval; }

  takeHit() {
    if (this.invulnTimer > 0) return "invuln";
    if (this.shieldCharges > 0) { this.shieldCharges--; this.invulnTimer = 0.5; this.hitFlash = 0.3; return "shield"; }
    this.lives--;
    this.invulnTimer = 1.6;
    this.hitFlash = 0.4;
    return "hit";
  }

  draw(ctx) {
    const flashing = this.invulnTimer > 0 && Math.floor(this.invulnTimer * 14) % 2 === 0;
    ctx.save();
    ctx.globalAlpha = flashing ? 0.45 : 1;
    ctx.translate(this.x, this.y);
    ctx.rotate(this.tilt);

    const flameLen = 10 + Math.sin(this.thrusterPhase) * 4 + (Math.abs(this.vx) > 10 ? 6 : 0);
    const g = ctx.createLinearGradient(0, this.height * 0.4, 0, this.height * 0.4 + flameLen);
    g.addColorStop(0, hexToRgba(COLORS.gold400, 0.9));
    g.addColorStop(1, hexToRgba(COLORS.coral500, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-6, this.height * 0.38);
    ctx.lineTo(0, this.height * 0.38 + flameLen);
    ctx.lineTo(6, this.height * 0.38);
    ctx.closePath();
    ctx.fill();

    const w = this.width, h = this.height;
    const body = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
    body.addColorStop(0, COLORS.cream100);
    body.addColorStop(1, COLORS.gold400);
    ctx.fillStyle = this.hitFlash > 0 ? COLORS.danger500 : body;
    ctx.strokeStyle = COLORS.navy900;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(0, -h * 0.5);
    ctx.lineTo(w * 0.16, -h * 0.02);
    ctx.lineTo(w * 0.5, h * 0.42);
    ctx.lineTo(w * 0.2, h * 0.28);
    ctx.lineTo(0, h * 0.46);
    ctx.lineTo(-w * 0.2, h * 0.28);
    ctx.lineTo(-w * 0.5, h * 0.42);
    ctx.lineTo(-w * 0.16, -h * 0.02);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = COLORS.navy900;
    sparklePath(ctx, 0, -h * 0.06, 6, 4, 0, 0.35);
    ctx.fill();

    ctx.restore();

    if (this.shieldCharges > 0) {
      ctx.save();
      const pulse = 0.55 + Math.sin(this.thrusterPhase * 0.8) * 0.12;
      ctx.strokeStyle = hexToRgba(COLORS.teal400, pulse);
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.width * 0.72, 0, Math.PI * 2);
      ctx.stroke();
      drawGlow(ctx, this.x, this.y, this.width * 0.9, COLORS.teal400, 0.12);
      ctx.restore();
    }
  }
}

const UFO_VARIANTS = [
  { body: COLORS.navy700, rim: COLORS.gold400, light: COLORS.amber500 },
  { body: COLORS.navy600, rim: COLORS.teal400, light: COLORS.teal400 },
  { body: COLORS.navy700, rim: COLORS.coral500, light: COLORS.coral500 },
];

export class Enemy {
  constructor(x, y, type, variant) {
    this.x = x; this.y = y;
    this.baseX = x; this.baseY = y;
    this.type = type;
    this.variant = UFO_VARIANTS[variant % UFO_VARIANTS.length];
    this.radius = type === "fast" ? 16 : 20;
    this.hp = type === "shooter" ? 2 : 1;
    this.maxHp = this.hp;
    this.alive = true;
    this.animPhase = rand(0, Math.PI * 2);
    this.shootTimer = rand(1.5, 4);
    this.dropOffsetX = 0;
    this.dropOffsetY = 0;
    this.hitFlash = 0;
  }

  update(dt, formationDx, formationDy) {
    this.animPhase += dt * 4;
    this.baseX += formationDx;
    this.baseY += formationDy;
    this.x = this.baseX + Math.sin(this.animPhase * 0.7) * (this.type === "fast" ? 10 : 5);
    this.y = this.baseY;
    if (this.hitFlash > 0) this.hitFlash -= dt;
    if (this.type === "shooter") this.shootTimer -= dt;
  }

  wantsToShoot() {
    if (this.type !== "shooter") return false;
    if (this.shootTimer <= 0) { this.shootTimer = rand(2.2, 4.2); return true; }
    return false;
  }

  hit(dmg) {
    this.hp -= dmg;
    this.hitFlash = 0.12;
    if (this.hp <= 0) this.alive = false;
    return !this.alive;
  }

  draw(ctx) {
    const { body, rim, light } = this.variant;
    const r = this.radius;
    ctx.save();
    ctx.translate(this.x, this.y);

    if (this.hitFlash > 0) { ctx.fillStyle = COLORS.white; ctx.globalAlpha = this.hitFlash / 0.12; ctx.beginPath(); ctx.ellipse(0, 0, r * 1.15, r * 0.55, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; }

    ctx.fillStyle = hexToRgba(COLORS.cream200, 0.85);
    ctx.beginPath();
    ctx.arc(0, -r * 0.12, r * 0.5, Math.PI, 0);
    ctx.fill();

    ctx.beginPath();
    ctx.ellipse(0, r * 0.05, r, r * 0.42, 0, 0, Math.PI * 2);
    ctx.fillStyle = body;
    ctx.strokeStyle = rim;
    ctx.lineWidth = 2;
    ctx.fill();
    ctx.stroke();

    const lightCount = 5;
    for (let i = 0; i < lightCount; i++) {
      const a = (i / lightCount) * Math.PI * 2;
      const lx = Math.cos(a) * r * 0.78;
      const ly = r * 0.05 + Math.sin(a) * r * 0.32;
      const on = Math.sin(this.animPhase + i * 1.3) > 0;
      ctx.fillStyle = on ? light : hexToRgba(light, 0.25);
      ctx.beginPath();
      ctx.arc(lx, ly, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }

    if (this.maxHp > 1) {
      ctx.fillStyle = hexToRgba(COLORS.navy950, 0.5);
      ctx.fillRect(-r, -r * 1.3, r * 2, 4);
      ctx.fillStyle = light;
      ctx.fillRect(-r, -r * 1.3, r * 2 * (this.hp / this.maxHp), 4);
    }

    ctx.restore();
  }
}

export class Boss {
  constructor(x, y, hp) {
    this.x = x; this.y = y;
    this.vx = 90;
    this.hp = hp;
    this.maxHp = hp;
    this.radius = 46;
    this.rotation = 0;
    this.alive = true;
    this.phaseTimer = 0;
    this.attackTimer = 2.5;
    this.hitFlash = 0;
    this.entryY = -80;
    this.targetY = 110;
    this.spawning = true;
  }

  update(dt, bounds) {
    this.rotation += dt * 0.4;
    if (this.spawning) {
      this.y += (this.targetY - this.y) * Math.min(1, dt * 1.5);
      if (Math.abs(this.y - this.targetY) < 2) this.spawning = false;
      return;
    }
    this.x += this.vx * dt;
    if (this.x < bounds.left + this.radius) { this.x = bounds.left + this.radius; this.vx *= -1; }
    if (this.x > bounds.right - this.radius) { this.x = bounds.right - this.radius; this.vx *= -1; }
    this.attackTimer -= dt;
    if (this.hitFlash > 0) this.hitFlash -= dt;
  }

  wantsToAttack() {
    if (this.spawning) return false;
    if (this.attackTimer <= 0) { this.attackTimer = rand(2.4, 3.6); return true; }
    return false;
  }

  hit(dmg) {
    this.hp -= dmg;
    this.hitFlash = 0.08;
    if (this.hp <= 0) this.alive = false;
    return !this.alive;
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    drawGlow(ctx, 0, 0, this.radius * 2.1, COLORS.gold400, 0.16);

    ctx.rotate(this.rotation);
    const g = ctx.createRadialGradient(0, 0, this.radius * 0.2, 0, 0, this.radius);
    g.addColorStop(0, COLORS.cream100);
    g.addColorStop(1, COLORS.gold500);
    ctx.fillStyle = this.hitFlash > 0 ? COLORS.white : g;
    ctx.strokeStyle = COLORS.navy900;
    ctx.lineWidth = 3;
    sparklePath(ctx, 0, 0, this.radius, 8, 0, 0.42);
    ctx.fill();
    ctx.stroke();
    ctx.rotate(-this.rotation);

    const corePulse = 0.6 + Math.sin(Date.now() * 0.006) * 0.15;
    ctx.fillStyle = COLORS.navy900;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius * 0.32, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = hexToRgba(COLORS.coral500, corePulse);
    ctx.beginPath();
    ctx.arc(0, 0, this.radius * 0.16, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}

export class Bullet {
  constructor(x, y, vx, vy, owner, opts = {}) {
    this.x = x; this.y = y; this.vx = vx; this.vy = vy;
    this.owner = owner;
    this.radius = opts.radius || (owner === "player" ? 4 : 5);
    this.damage = opts.damage || 1;
    this.color = opts.color || (owner === "player" ? COLORS.gold400 : COLORS.coral500);
    this.alive = true;
    this.trail = [];
  }

  update(dt) {
    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > 5) this.trail.shift();
    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }

  draw(ctx) {
    ctx.save();
    for (let i = 0; i < this.trail.length; i++) {
      const p = this.trail[i];
      const a = (i / this.trail.length) * 0.35;
      ctx.fillStyle = hexToRgba(this.color, a);
      ctx.beginPath();
      ctx.arc(p.x, p.y, this.radius * (i / this.trail.length), 0, Math.PI * 2);
      ctx.fill();
    }
    drawGlow(ctx, this.x, this.y, this.radius * 3, this.color, 0.5);
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.ellipse(this.x, this.y, this.radius, this.radius * 1.7, Math.atan2(this.vy, this.vx) + Math.PI / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

export class Particle {
  constructor(x, y, vx, vy, color, life, size) {
    this.x = x; this.y = y; this.vx = vx; this.vy = vy;
    this.color = color;
    this.life = life; this.maxLife = life;
    this.size = size;
    this.alive = true;
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.vx *= 0.94;
    this.vy *= 0.94;
    this.life -= dt;
    if (this.life <= 0) this.alive = false;
  }

  draw(ctx) {
    const t = clamp(this.life / this.maxLife, 0, 1);
    ctx.fillStyle = hexToRgba(this.color, t);
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size * t, 0, Math.PI * 2);
    ctx.fill();
  }
}

export class Pickup {
  constructor(x, y, value) {
    this.x = x; this.y = y;
    this.vy = rand(60, 90);
    this.value = value;
    this.phase = rand(0, Math.PI * 2);
    this.alive = true;
    this.magnetized = false;
  }

  update(dt, target) {
    this.phase += dt * 6;
    if (this.magnetized && target) {
      const dx = target.x - this.x, dy = target.y - this.y;
      const d = Math.max(1, Math.hypot(dx, dy));
      const speed = 620;
      this.x += (dx / d) * speed * dt;
      this.y += (dy / d) * speed * dt;
    } else {
      this.x += Math.sin(this.phase) * 22 * dt;
      this.y += this.vy * dt;
    }
  }

  draw(ctx) {
    ctx.save();
    drawGlow(ctx, this.x, this.y, 14, COLORS.gold400, 0.35);
    ctx.fillStyle = COLORS.gold400;
    ctx.strokeStyle = COLORS.gold600;
    ctx.lineWidth = 1;
    sparklePath(ctx, this.x, this.y, 7, 4, this.phase, 0.4);
    ctx.fill();
    ctx.restore();
  }
}
