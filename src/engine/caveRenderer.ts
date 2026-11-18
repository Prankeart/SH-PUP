import {
  ActiveCaveState,
  CaveChamber,
  CaveChest,
  CaveEnemy,
  CaveTheme,
  FloatingText,
  LandProjectile,
  Particle,
  Vec2,
  WeaponId,
} from '../types/game';
import { OnlineCaveProjectileSnapshot, RemotePlayerView } from '../types/online';
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
  onlineCaveProjectiles?: OnlineCaveProjectileSnapshot[];
  remoteCavePlayers?: RemotePlayerView[];
  activeSpeakerIds?: Set<string>;
  particles: Particle[];
  floatingTexts: FloatingText[];
  nearChest: CaveChest | null;
  nearAltar: boolean;
  nearExit: boolean;
  language?: 'tr' | 'en';
}

interface ThemeVisuals {
  voidBg: string;
  rockOuter: string;
  rockBevel: string;
  floorBase: string;
  floorInner: string;
  ambientDarkness: string;
  accentColor: string;
}

const THEME_PALETTES: Record<CaveTheme, ThemeVisuals> = {
  CRYSTAL_GROTTO: {
    voidBg: '#060813',
    rockOuter: '#17152B',
    rockBevel: '#272343',
    floorBase: '#23263E',
    floorInner: '#2D3252',
    ambientDarkness: 'rgba(6, 8, 22, 0.72)',
    accentColor: '#C084FC',
  },
  VOLCANIC_CALDERA: {
    voidBg: '#0E0605',
    rockOuter: '#231410',
    rockBevel: '#3C2018',
    floorBase: '#281C19',
    floorInner: '#3A2620',
    ambientDarkness: 'rgba(18, 7, 5, 0.68)',
    accentColor: '#FB923C',
  },
  SMUGGLER_COVE: {
    voidBg: '#040C14',
    rockOuter: '#132433',
    rockBevel: '#1E384C',
    floorBase: '#24343D',
    floorInner: '#2F4650',
    ambientDarkness: 'rgba(4, 12, 20, 0.72)',
    accentColor: '#38BDF8',
  },
  ANCIENT_TOMB: {
    voidBg: '#090B08',
    rockOuter: '#24261B',
    rockBevel: '#3B3D2C',
    floorBase: '#333428',
    floorInner: '#444636',
    ambientDarkness: 'rgba(9, 11, 8, 0.72)',
    accentColor: '#2DD4BF',
  },
  FUNGAL_ABYSS: {
    voidBg: '#040E0C',
    rockOuter: '#112924',
    rockBevel: '#193D36',
    floorBase: '#18302B',
    floorInner: '#21423B',
    ambientDarkness: 'rgba(4, 14, 12, 0.68)',
    accentColor: '#34D399',
  },
};

function traceRockPoly(ctx: CanvasRenderingContext2D, ch: CaveChamber, scaleOffset = 1) {
  if (!ch.rockPoly || ch.rockPoly.length < 3) {
    ctx.ellipse(ch.cx, ch.cy, ch.rx * scaleOffset, ch.ry * scaleOffset, 0, 0, Math.PI * 2);
    return;
  }
  const pts = ch.rockPoly;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const next = pts[(i + 1) % pts.length];
    const px = ch.cx + (p.x - ch.cx) * scaleOffset;
    const py = ch.cy + (p.y - ch.cy) * scaleOffset;
    const nx = ch.cx + (next.x - ch.cx) * scaleOffset;
    const ny = ch.cy + (next.y - ch.cy) * scaleOffset;
    const mx = (px + nx) * 0.5;
    const my = (py + ny) * 0.5;
    if (i === 0) {
      const prev = pts[pts.length - 1];
      const prx = ch.cx + (prev.x - ch.cx) * scaleOffset;
      const pry = ch.cy + (prev.y - ch.cy) * scaleOffset;
      ctx.moveTo((prx + px) * 0.5, (pry + py) * 0.5);
    }
    ctx.quadraticCurveTo(px, py, mx, my);
  }
  ctx.closePath();
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
  ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
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

function drawCaptainFigure(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  coatColor: string,
  accentColor: string,
  hitFlash: boolean,
  equippedWeapon: WeaponId | null,
  attackAnimProgress: number,
  nameLabel?: string,
  isSpeaking?: boolean
) {
  ctx.save();
  ctx.translate(x, y);

  if (isSpeaking) {
    ctx.strokeStyle = '#34D399';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 17, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.save();
  ctx.rotate(angle);

  ctx.fillStyle = 'rgba(2, 6, 23, 0.48)';
  ctx.beginPath();
  ctx.ellipse(3, 4, 13, 12, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = hitFlash ? '#FCA5A5' : coatColor;
  ctx.strokeStyle = accentColor;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.ellipse(0, 0, 10, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  if (equippedWeapon) {
    const wDef = WEAPONS[equippedWeapon];
    const swingAngle =
      attackAnimProgress > 0 && wDef.kind === 'MELEE'
        ? Math.sin(attackAnimProgress * Math.PI) * 1.6 - 0.6
        : 0.12;
    ctx.save();
    ctx.rotate(swingAngle);
    if (wDef.kind === 'MELEE') {
      ctx.strokeStyle = wDef.color;
      ctx.lineWidth = equippedWeapon === 'SHADOW_SCYTHE' ? 4 : 3.4;
      ctx.beginPath();
      ctx.moveTo(8, 5);
      ctx.lineTo(equippedWeapon === 'SHADOW_SCYTHE' ? 30 : 26, -2);
      ctx.stroke();
      if (equippedWeapon === 'SHADOW_SCYTHE') {
        ctx.strokeStyle = '#E879F9';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(26, -2, 8, -0.4, 1.4);
        ctx.stroke();
      }
    } else {
      ctx.fillStyle = wDef.color;
      ctx.fillRect(8, 2.5, equippedWeapon === 'MAGMA_CANNON' ? 18 : 15, 4);
    }
    ctx.restore();
  }

  ctx.fillStyle = '#0F172A';
  ctx.beginPath();
  ctx.moveTo(10, 0);
  ctx.lineTo(-7, -9);
  ctx.lineTo(-5, 0);
  ctx.lineTo(-7, 9);
  ctx.closePath();
  ctx.fill();

  // Warm lantern glow
  ctx.fillStyle = '#FDE047';
  ctx.beginPath();
  ctx.arc(8, -7, 3.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  if (nameLabel) {
    ctx.font = '700 11px "Outfit", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(2, 6, 23, 0.85)';
    ctx.strokeText(nameLabel, 0, -20);
    ctx.fillStyle = accentColor;
    ctx.fillText(nameLabel, 0, -20);
  }

  ctx.restore();
}

function drawCaveCreature(ctx: CanvasRenderingContext2D, e: CaveEnemy, nowMs: number) {
  const isFlashing = nowMs - e.hitFlashTime < 120;
  ctx.save();
  ctx.translate(e.x, e.y);

  if (e.isBoss) {
    const pulse = 32 + Math.sin(nowMs * 0.005) * 4;
    ctx.strokeStyle =
      e.kind === 'LAVA_ELEMENTAL'
        ? 'rgba(249, 115, 22, 0.72)'
        : e.kind === 'TOMB_GUARDIAN'
        ? 'rgba(45, 212, 191, 0.72)'
        : 'rgba(168, 85, 247, 0.72)';
    ctx.lineWidth = 2.6;
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
  } else if (e.kind === 'SPIDER') {
    const wiggle = Math.sin(e.walkPhase * 1.4) * 2.5;
    ctx.strokeStyle = '#94A3B8';
    ctx.lineWidth = 1.8;
    for (let s = -1; s <= 1; s += 2) {
      for (let l = -1.5; l <= 1.5; l += 1) {
        ctx.beginPath();
        ctx.moveTo(l * 3, s * 5);
        ctx.lineTo(l * 5 + wiggle * s, s * 14);
        ctx.stroke();
      }
    }
    ctx.fillStyle = isFlashing ? '#FCA5A5' : '#1E1B4B';
    ctx.strokeStyle = '#A855F7';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(-3, 0, 8, 0, Math.PI * 2);
    ctx.arc(6, 0, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#34D399';
    ctx.beginPath();
    ctx.arc(9, -2.5, 1.5, 0, Math.PI * 2);
    ctx.arc(9, 2.5, 1.5, 0, Math.PI * 2);
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
  } else if (e.kind === 'LAVA_ELEMENTAL') {
    ctx.fillStyle = isFlashing ? '#FFFFFF' : '#431407';
    ctx.strokeStyle = '#F97316';
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const r = i % 2 === 0 ? 27 : 21;
      if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#FDBA74';
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.fill();
  } else if (e.kind === 'TOMB_GUARDIAN') {
    ctx.fillStyle = isFlashing ? '#FFFFFF' : '#365314';
    ctx.strokeStyle = '#2DD4BF';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.roundRect(-20, -22, 40, 44, 8);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#FBBF24';
    ctx.beginPath();
    ctx.arc(6, -8, 3.8, 0, Math.PI * 2);
    ctx.arc(6, 8, 3.8, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // CRYSTAL_GOLEM
    ctx.fillStyle = isFlashing ? '#FFFFFF' : '#334155';
    ctx.strokeStyle = '#A855F7';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const r = i % 2 === 0 ? 26 : 20;
      if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

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

  if (e.hp < e.maxHp || e.isBoss) {
    const bw = e.isBoss ? 64 : 28;
    const bh = e.isBoss ? 6 : 4;
    const by = -e.radius - 13;
    ctx.fillStyle = 'rgba(2, 6, 23, 0.85)';
    ctx.fillRect(-bw / 2 - 1, by - 1, bw + 2, bh + 2);
    ctx.fillStyle = e.isBoss ? '#F59E0B' : '#F43F5E';
    ctx.fillRect(-bw / 2, by, bw * clamp(e.hp / e.maxHp, 0, 1), bh);
  }
  if (e.isBoss) {
    ctx.font = '700 11px "Outfit", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#FEF3C7';
    ctx.fillText(e.name, 0, -e.radius - 21);
  }

  ctx.restore();
}

function drawCaveMinimap(
  ctx: CanvasRenderingContext2D,
  viewportW: number,
  viewportH: number,
  state: CaveRenderState
) {
  const { activeCave } = state;
  const cave = activeCave.cave;
  const palette = THEME_PALETTES[cave.theme];
  const isShort = viewportH < 540;
  const mapW = viewportW < 640 ? 108 : isShort ? 120 : 148;
  const mapH = Math.round(mapW * (cave.height / cave.width));
  const mx = viewportW - mapW - (isShort || viewportW < 640 ? 10 : 14);
  const my = isShort || viewportW < 640 ? 50 : 66;
  const scale = mapW / cave.width;

  ctx.save();
  ctx.translate(mx, my);
  ctx.fillStyle = 'rgba(7, 13, 24, 0.78)';
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.roundRect(0, 0, mapW, mapH, 10);
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = palette.floorInner;
  ctx.lineCap = 'round';
  for (const cor of cave.corridors) {
    ctx.lineWidth = Math.max(3, cor.width * scale);
    ctx.beginPath();
    ctx.moveTo(cor.x1 * scale, cor.y1 * scale);
    ctx.lineTo(cor.x2 * scale, cor.y2 * scale);
    ctx.stroke();
  }
  ctx.fillStyle = palette.floorInner;
  for (const ch of cave.chambers) {
    ctx.beginPath();
    ctx.ellipse(
      ch.cx * scale,
      ch.cy * scale,
      ch.rx * scale,
      ch.ry * scale,
      0,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }

  // Exit marker
  ctx.fillStyle = '#38BDF8';
  ctx.beginPath();
  ctx.arc(cave.exitPos.x * scale, cave.exitPos.y * scale, 3, 0, Math.PI * 2);
  ctx.fill();

  // Unopened chests
  ctx.fillStyle = '#FBBF24';
  for (const ch of cave.chests) {
    if (ch.opened) continue;
    ctx.beginPath();
    ctx.arc(ch.x * scale, ch.y * scale, ch.tier === 'BOSS' ? 3 : 2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Remote allies in cave
  for (const rp of state.remoteCavePlayers ?? []) {
    if (rp.caveX === undefined || rp.caveY === undefined) continue;
    ctx.fillStyle = rp.bannerColor || '#38BDF8';
    ctx.beginPath();
    ctx.arc(rp.caveX * scale, rp.caveY * scale, 2.8, 0, Math.PI * 2);
    ctx.fill();
  }

  // Self dot
  ctx.fillStyle = '#10B981';
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(activeCave.playerX * scale, activeCave.playerY * scale, 3.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

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
  const palette = THEME_PALETTES[cave.theme];
  const nowMs = timeSec * 1000;
  const isEn = state.language === 'en';

  ctx.fillStyle = palette.voidBg;
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
  const camZoom = viewportW < 640 ? 0.92 : 1.0;
  ctx.scale(camZoom, camZoom);
  ctx.translate(-activeCave.cameraX, -activeCave.cameraY);

  // Layer 1: Outer rugged rock cliff rim
  ctx.strokeStyle = palette.rockOuter;
  ctx.lineCap = 'round';
  for (const cor of cave.corridors) {
    ctx.lineWidth = cor.width + 34;
    ctx.beginPath();
    ctx.moveTo(cor.x1, cor.y1);
    ctx.lineTo(cor.x2, cor.y2);
    ctx.stroke();
  }
  ctx.fillStyle = palette.rockOuter;
  for (const ch of cave.chambers) {
    ctx.beginPath();
    traceRockPoly(ctx, ch, 1.09);
    ctx.fill();
  }

  // Layer 2: Inner bevel shelf
  ctx.strokeStyle = palette.rockBevel;
  for (const cor of cave.corridors) {
    ctx.lineWidth = cor.width + 14;
    ctx.beginPath();
    ctx.moveTo(cor.x1, cor.y1);
    ctx.lineTo(cor.x2, cor.y2);
    ctx.stroke();
  }
  ctx.fillStyle = palette.rockBevel;
  for (const ch of cave.chambers) {
    ctx.beginPath();
    traceRockPoly(ctx, ch, 1.04);
    ctx.fill();
  }

  // Layer 3: Walkable cavern floor
  ctx.strokeStyle = palette.floorBase;
  for (const cor of cave.corridors) {
    ctx.lineWidth = cor.width;
    ctx.beginPath();
    ctx.moveTo(cor.x1, cor.y1);
    ctx.lineTo(cor.x2, cor.y2);
    ctx.stroke();
  }
  ctx.fillStyle = palette.floorBase;
  for (const ch of cave.chambers) {
    ctx.beginPath();
    traceRockPoly(ctx, ch, 1);
    ctx.fill();
  }

  // Subtle floor depth rings & stratified stonework
  for (const ch of cave.chambers) {
    ctx.fillStyle = palette.floorInner;
    ctx.beginPath();
    ctx.ellipse(ch.cx, ch.cy, ch.rx * 0.72, ch.ry * 0.72, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(ch.cx, ch.cy, ch.rx * 0.45, ch.ry * 0.45, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Underground Pools (Water / Lava / Spore)
  for (const pool of cave.pools) {
    ctx.save();
    const grad = ctx.createRadialGradient(pool.x, pool.y, 4, pool.x, pool.y, Math.max(pool.rx, pool.ry));
    if (pool.kind === 'LAVA') {
      grad.addColorStop(0, '#FDE047');
      grad.addColorStop(0.55, '#EA580C');
      grad.addColorStop(1, '#7C2D12');
      ctx.strokeStyle = 'rgba(251, 146, 60, 0.8)';
    } else if (pool.kind === 'SPORE') {
      grad.addColorStop(0, '#5EEAD4');
      grad.addColorStop(0.65, '#0F766E');
      grad.addColorStop(1, '#064E3B');
      ctx.strokeStyle = 'rgba(52, 211, 153, 0.65)';
    } else {
      grad.addColorStop(0, 'rgba(34, 211, 238, 0.65)');
      grad.addColorStop(0.7, 'rgba(14, 116, 144, 0.85)');
      grad.addColorStop(1, 'rgba(8, 51, 68, 0.95)');
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.55)';
    }
    ctx.fillStyle = grad;
    ctx.lineWidth = 3;
    ctx.beginPath();
    if (pool.points && pool.points.length >= 3) {
      pool.points.forEach((p: Vec2, idx: number) => {
        if (idx === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.closePath();
    } else {
      ctx.ellipse(pool.x, pool.y, pool.rx, pool.ry, 0, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // Wooden or Stone Bridges across pools
  for (const br of cave.bridges) {
    const ang = Math.atan2(br.y2 - br.y1, br.x2 - br.x1);
    const len = dist(br.x1, br.y1, br.x2, br.y2);
    ctx.save();
    ctx.translate((br.x1 + br.x2) * 0.5, (br.y1 + br.y2) * 0.5);
    ctx.rotate(ang);
    ctx.fillStyle = br.material === 'STONE' ? '#57534E' : '#78350F';
    ctx.strokeStyle = br.material === 'STONE' ? '#292524' : '#451A03';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-len * 0.5, -br.width * 0.5, len, br.width, 4);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = br.material === 'STONE' ? 'rgba(255,255,255,0.12)' : '#92400E';
    ctx.lineWidth = 1.5;
    for (let px = -len * 0.45; px <= len * 0.45; px += 14) {
      ctx.beginPath();
      ctx.moveTo(px, -br.width * 0.46);
      ctx.lineTo(px, br.width * 0.46);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Environmental Props
  for (const pr of cave.props) {
    ctx.save();
    ctx.translate(pr.x, pr.y);
    ctx.rotate(pr.angle);
    if (pr.kind === 'RUNE_CIRCLE') {
      ctx.strokeStyle = `${pr.color}44`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, pr.size, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, pr.size * 0.68, 0, Math.PI * 2);
      ctx.stroke();
    } else if (pr.kind === 'MUSHROOM') {
      ctx.fillStyle = `${pr.color}33`;
      ctx.beginPath();
      ctx.arc(0, 0, pr.size * 1.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = pr.color;
      ctx.beginPath();
      ctx.arc(0, 0, pr.size * 0.72, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ECFDF5';
      ctx.beginPath();
      ctx.arc(-pr.size * 0.22, -pr.size * 0.18, pr.size * 0.18, 0, Math.PI * 2);
      ctx.fill();
    } else if (pr.kind === 'CRATE') {
      ctx.fillStyle = '#78350F';
      ctx.strokeStyle = '#B45309';
      ctx.lineWidth = 1.6;
      ctx.fillRect(-pr.size * 0.6, -pr.size * 0.6, pr.size * 1.2, pr.size * 1.2);
      ctx.strokeRect(-pr.size * 0.6, -pr.size * 0.6, pr.size * 1.2, pr.size * 1.2);
    } else if (pr.kind === 'SHIP_RIB') {
      ctx.strokeStyle = '#78350F';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, pr.size, -0.9, 0.9);
      ctx.stroke();
    } else if (pr.kind === 'BONES') {
      ctx.strokeStyle = '#CBD5E1';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(-pr.size * 0.6, -3);
      ctx.lineTo(pr.size * 0.6, 3);
      ctx.moveTo(-pr.size * 0.5, 4);
      ctx.lineTo(pr.size * 0.5, -4);
      ctx.stroke();
    } else {
      ctx.fillStyle = pr.color;
      ctx.beginPath();
      ctx.arc(0, 0, pr.size * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // Exit Portal
  {
    const ex = cave.exitPos.x;
    const ey = cave.exitPos.y;
    const pulse = 24 + Math.sin(timeSec * 3.5) * 3;
    const grad = ctx.createRadialGradient(ex, ey, 4, ex, ey, pulse + 14);
    grad.addColorStop(0, 'rgba(125, 211, 252, 0.92)');
    grad.addColorStop(0.6, 'rgba(56, 189, 248, 0.35)');
    grad.addColorStop(1, 'rgba(56, 189, 248, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(ex, ey, pulse + 14, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#7DD3FC';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.arc(ex, ey, 19, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Jagged Rock Pillars
  for (const p of cave.pillars) {
    ctx.fillStyle = 'rgba(2, 6, 23, 0.5)';
    ctx.beginPath();
    ctx.arc(p.x + 5, p.y + 6, p.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#475569';
    ctx.strokeStyle = '#1E293B';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    if (p.jaggedPoly && p.jaggedPoly.length >= 3) {
      p.jaggedPoly.forEach((pt, idx) => {
        if (idx === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      });
      ctx.closePath();
    } else {
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#64748B';
    ctx.beginPath();
    ctx.arc(p.x - 4, p.y - 4, p.radius * 0.48, 0, Math.PI * 2);
    ctx.fill();
  }

  // Glowing Crystals
  for (const cr of cave.crystals) {
    ctx.save();
    ctx.translate(cr.x, cr.y);
    ctx.rotate(cr.angle);
    ctx.fillStyle = `${cr.color}33`;
    ctx.beginPath();
    ctx.arc(0, 0, cr.size * 2.0, 0, Math.PI * 2);
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

  // Flickering Torches / Braziers
  for (const t of cave.torches) {
    const fl = 1 + Math.sin(timeSec * 9 + t.phase) * 0.16;
    const tCol = t.color || '#F97316';
    const glow = ctx.createRadialGradient(t.x, t.y, 2, t.x, t.y, 82 * fl);
    glow.addColorStop(0, `${tCol}55`);
    glow.addColorStop(1, `${tCol}00`);
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(t.x, t.y, 82 * fl, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = tCol;
    ctx.beginPath();
    ctx.arc(t.x, t.y, 5.2 * fl, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FEF9C3';
    ctx.beginPath();
    ctx.arc(t.x, t.y, 2.4, 0, Math.PI * 2);
    ctx.fill();
  }

  // Chests
  for (const ch of cave.chests) {
    ctx.save();
    ctx.translate(ch.x, ch.y);
    if (!ch.opened) {
      const aura = 21 + Math.sin(timeSec * 4) * 3;
      ctx.strokeStyle = ch.tier === 'BOSS' ? '#FBBF24' : '#38BDF8';
      ctx.globalAlpha = 0.65;
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
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.arc(0, 0, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    if (!wa.claimed) {
      const bob = Math.sin(timeSec * 4) * 3;
      ctx.fillStyle = `${def.color}44`;
      ctx.beginPath();
      ctx.arc(0, 0, 31, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = def.color;
      ctx.beginPath();
      ctx.arc(0, bob, 7.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // Cave Enemies
  for (const enemy of cave.enemies) {
    if (enemy.hp <= 0) continue;
    drawCaveCreature(ctx, enemy, nowMs);
  }

  // Co-op Remote Players inside the same Cave
  for (const rp of state.remoteCavePlayers ?? []) {
    if (!rp.connected || rp.inCaveId !== cave.caveId) continue;
    const rx = rp.caveX ?? cave.entryPos.x;
    const ry = rp.caveY ?? cave.entryPos.y;
    const rAng = rp.caveAngle ?? 0;
    const speaking = state.activeSpeakerIds?.has(rp.id) ?? false;
    drawCaptainFigure(
      ctx,
      rx,
      ry,
      rAng,
      rp.bannerColor || '#0284C7',
      '#F8FAFC',
      rp.hitFlash,
      rp.equippedWeapon,
      rp.attackAnimProgress,
      rp.name,
      speaking
    );
  }

  // Local Captain inside Cave
  drawCaptainFigure(
    ctx,
    activeCave.playerX,
    activeCave.playerY,
    activeCave.playerAngle,
    '#1E3A5F',
    '#38BDF8',
    state.playerHitFlash,
    state.equippedWeapon,
    state.attackAnimProgress
  );

  // Local + Online Cave Projectiles
  for (const lp of state.landProjectiles) {
    ctx.fillStyle = lp.color;
    ctx.beginPath();
    ctx.arc(lp.x, lp.y, 4.4, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const op of state.onlineCaveProjectiles ?? []) {
    ctx.fillStyle = op.color;
    ctx.beginPath();
    ctx.arc(op.x, op.y, 4.4, 0, Math.PI * 2);
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
    const wDef = WEAPONS[cave.weaponAltar.weaponId];
    const wName = isEn ? wDef.nameEn : wDef.name;
    drawPromptTag(
      ctx,
      cave.weaponAltar.x,
      cave.weaponAltar.y - 28,
      isEn ? `[E] Take ${wName}` : `[E] ${wName} Al`,
      wDef.color
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

  // Ambient Cave Vignette centered on player screen position
  const playerScreenX =
    viewportW * 0.5 + (activeCave.playerX - activeCave.cameraX) * camZoom;
  const playerScreenY =
    viewportH * 0.5 + (activeCave.playerY - activeCave.cameraY) * camZoom;
  const lanternGrad = ctx.createRadialGradient(
    playerScreenX,
    playerScreenY,
    Math.min(viewportW, viewportH) * 0.24,
    playerScreenX,
    playerScreenY,
    Math.max(viewportW, viewportH) * 0.68
  );
  lanternGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
  lanternGrad.addColorStop(0.62, 'rgba(6, 9, 18, 0.36)');
  lanternGrad.addColorStop(1, palette.ambientDarkness);
  ctx.fillStyle = lanternGrad;
  ctx.fillRect(0, 0, viewportW, viewportH);

  // Subtle Cave Exploration Status Top Center (compact on mobile so it never overlaps HUD badges)
  const chestsOpen = cave.chests.filter((c) => c.opened).length;
  const mobsLeft = cave.enemies.filter((e) => e.hp > 0).length;
  const alliesCount = (state.remoteCavePlayers ?? []).filter(
    (rp) => rp.connected && rp.inCaveId === cave.caveId
  ).length;
  const dExit = dist(activeCave.playerX, activeCave.playerY, cave.exitPos.x, cave.exitPos.y);
  const isCompactView = viewportW < 920 || viewportH < 540;
  const allyPart =
    alliesCount > 0 ? ` · ${alliesCount + 1} ${isEn ? 'Explorers' : 'Kâşif'}` : '';
  const summary = isCompactView
    ? isEn
      ? `Chests ${chestsOpen}/${cave.chests.length} · Foes ${mobsLeft}${allyPart}${dExit > 150 ? ' · Exit ←' : ''}`
      : `Sandık ${chestsOpen}/${cave.chests.length} · Yaratık ${mobsLeft}${allyPart}${dExit > 150 ? ' · Çıkış ←' : ''}`
    : isEn
    ? `${cave.name} · Chests ${chestsOpen}/${cave.chests.length} · Foes ${mobsLeft}${allyPart}${dExit > 150 ? ' · Exit West' : ''}`
    : `${cave.name} · Sandık ${chestsOpen}/${cave.chests.length} · Yaratık ${mobsLeft}${allyPart}${dExit > 150 ? ' · Çıkış Batıda' : ''}`;

  // Branching Cave Minimap
  drawCaveMinimap(ctx, viewportW, viewportH, state);

  ctx.save();
  ctx.font = isCompactView
    ? '600 11px "Plus Jakarta Sans", system-ui, sans-serif'
    : '600 12px "Plus Jakarta Sans", system-ui, sans-serif';
  const tw = ctx.measureText(summary).width + (isCompactView ? 20 : 26);
  const pillH = isCompactView ? 24 : 28;
  const isTinyPortrait = viewportW < 560;
  const isShort = viewportH < 540;
  const mapW = viewportW < 640 ? 108 : isShort ? 120 : 148;
  const mapH = Math.round(mapW * (cave.height / cave.width));
  const mapRight = viewportW - (isShort || viewportW < 640 ? 10 : 14);
  const mapTop = isShort || viewportW < 640 ? 50 : 66;
  const pillX = isTinyPortrait ? mapRight - tw : viewportW / 2 - tw / 2;
  const pillY = isTinyPortrait ? mapTop + mapH + 8 : isCompactView ? 10 : 14;

  ctx.fillStyle = 'rgba(15, 23, 42, 0.86)';
  ctx.strokeStyle = `${palette.accentColor}88`;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.roundRect(pillX, pillY, tw, pillH, pillH / 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#F8FAFC';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(summary, pillX + tw / 2, pillY + pillH / 2);
  ctx.restore();
}
