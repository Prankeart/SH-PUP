import {
  ActiveCaveState,
  CaveChest,
  CaveEnemy,
  FloatingText,
  LandProjectile,
  Particle,
  WeaponId,
} from '../types/game';
import { WEAPONS } from './weapons';
import { clamp, dist } from '../utils/prng';

export interface CaveRenderState {
  timeSec: number;
  screenShake: number;
  screenShakeIntensity?: number;
  activeCave: ActiveCaveState;
  playerHitFlash: boolean;
  equippedWeapon: WeaponId | null;
  attackAnimProgress: number;
  landProjectiles: LandProjectile[];
  particles: Particle[];
  floatingTexts: FloatingText[];
  nearChest: CaveChest | null;
  nearAltar: boolean;
  nearExit: boolean;
  language?: 'tr' | 'en';
}

function drawPromptTag(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  label: string,
  accent: string
) {
  ctx.save();
  ctx.font = '700 12px "Outfit", system-ui, sans-serif';
  const w = ctx.measureText(label).width + 20;
  ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
  ctx.strokeStyle = accent;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.roundRect(x - w / 2, y - 13, w, 24, 12);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#F8FAFC';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x, y - 1);
  ctx.restore();
}

function drawCaveCreature(ctx: CanvasRenderingContext2D, e: CaveEnemy, nowMs: number) {
  const isFlashing = nowMs - e.hitFlashTime < 120;
  ctx.save();
  ctx.translate(e.x, e.y);

  if (e.isBoss) {
    // Boss aura pulse
    const pulse = 30 + Math.sin(nowMs * 0.005) * 4;
    ctx.strokeStyle = 'rgba(168, 85, 247, 0.65)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, pulse, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.save();
  ctx.rotate(e.angle);

  ctx.fillStyle = 'rgba(2, 6, 23, 0.45)';
  ctx.beginPath();
  ctx.ellipse(3, 4, e.radius * 1.05, e.radius * 0.85, 0, 0, Math.PI * 2);
  ctx.fill();

  if (e.kind === 'BAT') {
    const flap = Math.sin(e.walkPhase * 1.8) * 6;
    ctx.fillStyle = isFlashing ? '#FCA5A5' : '#4C1D95';
    ctx.strokeStyle = '#C084FC';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(4, 0);
    ctx.quadraticCurveTo(-4, -14 - flap, -12, -8);
    ctx.lineTo(-7, 0);
    ctx.lineTo(-12, 8);
    ctx.quadraticCurveTo(-4, 14 + flap, 4, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#F43F5E';
    ctx.beginPath();
    ctx.arc(5, -3, 1.8, 0, Math.PI * 2);
    ctx.arc(5, 3, 1.8, 0, Math.PI * 2);
    ctx.fill();
  } else if (e.kind === 'CRAB') {
    const legOff = Math.sin(e.walkPhase) * 2.5;
    ctx.strokeStyle = '#FB7185';
    ctx.lineWidth = 2;
    for (let s = -1; s <= 1; s += 2) {
      for (let l = -1; l <= 1; l++) {
        ctx.beginPath();
        ctx.moveTo(l * 4, s * 7);
        ctx.lineTo(l * 6 + legOff * s, s * 15);
        ctx.stroke();
      }
    }
    ctx.fillStyle = isFlashing ? '#FECACA' : '#9F1239';
    ctx.strokeStyle = '#FDA4AF';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.ellipse(0, 0, 12, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Claws
    ctx.fillStyle = '#E11D48';
    ctx.beginPath();
    ctx.arc(12, -8, 4.5, 0, Math.PI * 2);
    ctx.arc(12, 8, 4.5, 0, Math.PI * 2);
    ctx.fill();
  } else if (e.kind === 'SCORPION') {
    ctx.fillStyle = isFlashing ? '#FDE68A' : '#1E293B';
    ctx.strokeStyle = '#22D3EE';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(0, 0, 14, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Stinger tail
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.moveTo(-10, 0);
    ctx.quadraticCurveTo(-20, -6, -15, -13);
    ctx.stroke();
    ctx.fillStyle = '#22D3EE';
    ctx.beginPath();
    ctx.arc(-15, -13, 3.2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // CRYSTAL_GOLEM Boss
    ctx.fillStyle = isFlashing ? '#FFFFFF' : '#334155';
    ctx.strokeStyle = '#A855F7';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const r = i % 2 === 0 ? 25 : 20;
      if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Glowing crystal core
    ctx.fillStyle = '#E879F9';
    ctx.beginPath();
    ctx.arc(0, 0, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#22D3EE';
    ctx.beginPath();
    ctx.arc(10, -8, 3.5, 0, Math.PI * 2);
    ctx.arc(10, 8, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();

  // HP Bar
  if (e.hp < e.maxHp || e.isBoss) {
    const bw = e.isBoss ? 58 : 28;
    const bh = e.isBoss ? 6 : 4;
    const by = -e.radius - 13;
    ctx.fillStyle = 'rgba(2, 6, 23, 0.85)';
    ctx.fillRect(-bw / 2 - 1, by - 1, bw + 2, bh + 2);
    ctx.fillStyle = e.isBoss ? '#C084FC' : '#F43F5E';
    ctx.fillRect(-bw / 2, by, bw * clamp(e.hp / e.maxHp, 0, 1), bh);
  }
  if (e.isBoss) {
    ctx.font = '700 11px "Outfit", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#F5D0FE';
    ctx.fillText(e.name, 0, -e.radius - 20);
  }

  ctx.restore();
}

export function renderCaveFrame(
  ctx: CanvasRenderingContext2D,
  viewportW: number,
  viewportH: number,
  state: CaveRenderState
) {
  const { activeCave, timeSec } = state;
  const cave = activeCave.cave;
  const nowMs = timeSec * 1000;
  const isEn = state.language === 'en';

  // Deep subterranean bedrock background
  ctx.fillStyle = '#090B12';
  ctx.fillRect(0, 0, viewportW, viewportH);

  const shakeScale = (state.screenShakeIntensity ?? 100) / 100;
  const shakeX =
    state.screenShake > 0.1
      ? (Math.random() - 0.5) * state.screenShake * 1.8 * shakeScale
      : 0;
  const shakeY =
    state.screenShake > 0.1
      ? (Math.random() - 0.5) * state.screenShake * 1.8 * shakeScale
      : 0;

  ctx.save();
  ctx.translate(viewportW / 2 + shakeX, viewportH / 2 + shakeY);
  ctx.scale(1.06, 1.06);
  ctx.translate(-activeCave.playerX, -activeCave.playerY);

  // Outer carved cavern rock rim
  ctx.fillStyle = '#1E1B2E';
  ctx.strokeStyle = '#0F172A';
  ctx.lineWidth = 14;
  for (const cor of cave.corridors) {
    ctx.fillRect(
      Math.min(cor.x1, cor.x2) - 34,
      (cor.y1 + cor.y2) * 0.5 - cor.width * 0.5 - 12,
      Math.abs(cor.x2 - cor.x1) + 68,
      cor.width + 24
    );
  }
  for (const ch of cave.chambers) {
    ctx.beginPath();
    ctx.ellipse(ch.cx, ch.cy, ch.rx + 14, ch.ry + 14, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Walkable cavern stone floor
  ctx.fillStyle = '#2B2D42';
  for (const cor of cave.corridors) {
    ctx.fillRect(
      Math.min(cor.x1, cor.x2) - 24,
      (cor.y1 + cor.y2) * 0.5 - cor.width * 0.5,
      Math.abs(cor.x2 - cor.x1) + 48,
      cor.width
    );
  }
  for (const ch of cave.chambers) {
    ctx.beginPath();
    ctx.ellipse(ch.cx, ch.cy, ch.rx, ch.ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Subtle floor stone rings
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.08)';
  ctx.lineWidth = 2;
  for (const ch of cave.chambers) {
    ctx.beginPath();
    ctx.ellipse(ch.cx, ch.cy, ch.rx * 0.72, ch.ry * 0.72, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Underground glowing pools
  for (const pool of cave.pools) {
    ctx.fillStyle = 'rgba(14, 116, 144, 0.75)';
    ctx.strokeStyle = 'rgba(34, 211, 238, 0.45)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(pool.x, pool.y, pool.rx, pool.ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // Exit Portal (West Chamber)
  {
    const ex = cave.exitPos.x;
    const ey = cave.exitPos.y;
    const pulse = 22 + Math.sin(timeSec * 3.5) * 3;
    const grad = ctx.createRadialGradient(ex, ey, 4, ex, ey, pulse + 12);
    grad.addColorStop(0, 'rgba(125, 211, 252, 0.9)');
    grad.addColorStop(0.6, 'rgba(56, 189, 248, 0.35)');
    grad.addColorStop(1, 'rgba(56, 189, 248, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(ex, ey, pulse + 12, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#7DD3FC';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(ex, ey, 18, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Rock Pillars
  for (const p of cave.pillars) {
    ctx.fillStyle = 'rgba(2, 6, 23, 0.45)';
    ctx.beginPath();
    ctx.arc(p.x + 4, p.y + 5, p.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#475569';
    ctx.strokeStyle = '#1E293B';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#64748B';
    ctx.beginPath();
    ctx.arc(p.x - 4, p.y - 4, p.radius * 0.55, 0, Math.PI * 2);
    ctx.fill();
  }

  // Glowing Crystals
  for (const cr of cave.crystals) {
    ctx.save();
    ctx.translate(cr.x, cr.y);
    ctx.rotate(cr.angle);
    ctx.fillStyle = `${cr.color}33`;
    ctx.beginPath();
    ctx.arc(0, 0, cr.size * 1.9, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = cr.color;
    ctx.strokeStyle = '#F8FAFC';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -cr.size);
    ctx.lineTo(cr.size * 0.55, 0);
    ctx.lineTo(0, cr.size);
    ctx.lineTo(-cr.size * 0.55, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // Flickering Wall Torches
  for (const t of cave.torches) {
    const fl = 1 + Math.sin(timeSec * 9 + t.phase) * 0.16;
    const glow = ctx.createRadialGradient(t.x, t.y, 2, t.x, t.y, 68 * fl);
    glow.addColorStop(0, 'rgba(251, 146, 60, 0.36)');
    glow.addColorStop(1, 'rgba(251, 146, 60, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(t.x, t.y, 68 * fl, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#F97316';
    ctx.beginPath();
    ctx.arc(t.x, t.y, 5 * fl, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FEF08A';
    ctx.beginPath();
    ctx.arc(t.x, t.y, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Treasure Chests
  for (const ch of cave.chests) {
    ctx.save();
    ctx.translate(ch.x, ch.y);
    if (!ch.opened) {
      const aura = 20 + Math.sin(timeSec * 4) * 3;
      ctx.strokeStyle = ch.tier === 'BOSS' ? '#FBBF24' : '#38BDF8';
      ctx.globalAlpha = 0.6;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, aura, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    ctx.fillStyle = ch.opened ? '#451A03' : ch.tier === 'BOSS' ? '#B45309' : '#78350F';
    ctx.strokeStyle = ch.opened ? '#64748B' : '#FDE047';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-14, -11, 28, 22, 4);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = ch.opened ? '#334155' : '#FBBF24';
    ctx.fillRect(-14, -2, 28, 4);
    ctx.beginPath();
    ctx.arc(0, 0, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Secret Weapon Altar
  if (cave.weaponAltar) {
    const wa = cave.weaponAltar;
    const def = WEAPONS[wa.weaponId];
    ctx.save();
    ctx.translate(wa.x, wa.y);
    ctx.fillStyle = '#334155';
    ctx.strokeStyle = wa.claimed ? '#64748B' : def.color;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(0, 0, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    if (!wa.claimed) {
      const bob = Math.sin(timeSec * 4) * 3;
      ctx.fillStyle = `${def.color}44`;
      ctx.beginPath();
      ctx.arc(0, 0, 29, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = def.color;
      ctx.beginPath();
      ctx.arc(0, bob, 7, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // Cave Enemies
  for (const enemy of cave.enemies) {
    if (enemy.hp <= 0) continue;
    drawCaveCreature(ctx, enemy, nowMs);
  }

  // Player Captain inside Cave
  {
    ctx.save();
    ctx.translate(activeCave.playerX, activeCave.playerY);
    ctx.rotate(activeCave.playerAngle);

    ctx.fillStyle = 'rgba(2, 6, 23, 0.45)';
    ctx.beginPath();
    ctx.ellipse(3, 4, 13, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    // Pirate Coat
    ctx.fillStyle = state.playerHitFlash ? '#FCA5A5' : '#1E3A5F';
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.ellipse(0, 0, 10, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Equipped Weapon
    if (state.equippedWeapon) {
      const wDef = WEAPONS[state.equippedWeapon];
      const swingAngle =
        state.attackAnimProgress > 0 && wDef.kind === 'MELEE'
          ? Math.sin(state.attackAnimProgress * Math.PI) * 1.4 - 0.5
          : 0.12;
      ctx.save();
      ctx.rotate(swingAngle);
      if (wDef.kind === 'MELEE') {
        ctx.strokeStyle = wDef.color;
        ctx.lineWidth = 3.4;
        ctx.beginPath();
        ctx.moveTo(8, 5);
        ctx.lineTo(26, -2);
        ctx.stroke();
      } else {
        ctx.fillStyle = wDef.color;
        ctx.fillRect(9, 3, 14, 3.6);
      }
      ctx.restore();
    }

    // Tricorn Hat
    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.moveTo(10, 0);
    ctx.lineTo(-7, -9);
    ctx.lineTo(-5, 0);
    ctx.lineTo(-7, 9);
    ctx.closePath();
    ctx.fill();

    // Lantern glow hand
    ctx.fillStyle = '#FDE047';
    ctx.beginPath();
    ctx.arc(8, -7, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Land Projectiles
  for (const lp of state.landProjectiles) {
    ctx.fillStyle = lp.color;
    ctx.beginPath();
    ctx.arc(lp.x, lp.y, 4.2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Particles
  for (const p of state.particles) {
    ctx.fillStyle = p.color;
    ctx.globalAlpha = clamp(p.alpha, 0, 1);
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Floating Texts
  ctx.textAlign = 'center';
  ctx.font = '700 13px "Outfit", system-ui, sans-serif';
  for (const ft of state.floatingTexts) {
    ctx.globalAlpha = clamp(ft.life / Math.max(0.1, ft.maxLife), 0, 1);
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(2, 6, 23, 0.85)';
    ctx.strokeText(ft.text, ft.x, ft.y);
    ctx.fillStyle = ft.color;
    ctx.fillText(ft.text, ft.x, ft.y);
  }
  ctx.globalAlpha = 1;

  // Contextual [E] Prompts inside Cave
  if (state.nearChest) {
    drawPromptTag(
      ctx,
      state.nearChest.x,
      state.nearChest.y - 24,
      isEn ? '[E] Open Chest' : '[E] Sandığı Aç',
      '#FBBF24'
    );
  } else if (state.nearAltar && cave.weaponAltar) {
    const wName = WEAPONS[cave.weaponAltar.weaponId].name;
    drawPromptTag(
      ctx,
      cave.weaponAltar.x,
      cave.weaponAltar.y - 28,
      isEn ? `[E] Take ${wName}` : `[E] ${wName} Al`,
      WEAPONS[cave.weaponAltar.weaponId].color
    );
  } else if (state.nearExit) {
    drawPromptTag(
      ctx,
      cave.exitPos.x,
      cave.exitPos.y - 28,
      isEn ? '[E] Exit Cave' : '[E] Mağaradan Çık',
      '#7DD3FC'
    );
  }

  ctx.restore();

  // Radial Torchlight Vignette centered on Viewport
  const lanternGrad = ctx.createRadialGradient(
    viewportW * 0.5,
    viewportH * 0.5,
    Math.min(viewportW, viewportH) * 0.22,
    viewportW * 0.5,
    viewportH * 0.5,
    Math.max(viewportW, viewportH) * 0.62
  );
  lanternGrad.addColorStop(0, 'rgba(9, 11, 18, 0)');
  lanternGrad.addColorStop(0.65, 'rgba(9, 11, 18, 0.42)');
  lanternGrad.addColorStop(1, 'rgba(5, 7, 13, 0.86)');
  ctx.fillStyle = lanternGrad;
  ctx.fillRect(0, 0, viewportW, viewportH);

  // Subtle Cave Exploration Status Top Center
  const chestsOpen = cave.chests.filter((c) => c.opened).length;
  const mobsLeft = cave.enemies.filter((e) => e.hp > 0).length;
  const dExit = dist(activeCave.playerX, activeCave.playerY, cave.exitPos.x, cave.exitPos.y);
  const summary = isEn
    ? `${cave.name} · Chests ${chestsOpen}/${cave.chests.length} · Foes ${mobsLeft}${dExit > 120 ? ' · Exit West' : ''}`
    : `${cave.name} · Sandık ${chestsOpen}/${cave.chests.length} · Yaratık ${mobsLeft}${dExit > 120 ? ' · Çıkış Batıda' : ''}`;
  ctx.save();
  ctx.font = '600 12px "Plus Jakarta Sans", system-ui, sans-serif';
  const tw = ctx.measureText(summary).width + 24;
  ctx.fillStyle = 'rgba(15, 23, 42, 0.84)';
  ctx.strokeStyle = 'rgba(168, 85, 247, 0.5)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.roundRect(viewportW / 2 - tw / 2, 14, tw, 28, 14);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#F3E8FF';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(summary, viewportW / 2, 28);
  ctx.restore();
}
