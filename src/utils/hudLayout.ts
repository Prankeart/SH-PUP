import { TouchButtonId, TouchButtonTransform, TouchLayoutConfig } from '../types/game';

export type ActionButtonKey = Exclude<TouchButtonId, 'joystick' | 'minimap' | 'weaponPanel'>;

export const ALL_ACTION_BUTTON_KEYS: ActionButtonKey[] = [
  'digOrFire',
  'boatOrInteract',
  'radar',
  'attack',
  'ability',
  'fish',
  'stance',
  'repair',
];

export interface ButtonRectSpec {
  left: number;
  top: number;
  w: number;
  h: number;
}

export interface ScreenBox {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface ResolvedButtonGeom {
  rect: ButtonRectSpec;
  dx: number;
  dy: number;
  scale: number;
  opacity: number;
  screenBox: ScreenBox;
}

export interface ResolvedJoystickGeom {
  boxSize: number;
  pad: number;
  dx: number;
  dy: number;
  scale: number;
  opacity: number;
  screenBox: ScreenBox;
}

export interface ResolvedMiniMapGeom {
  baseSize: number;
  effectiveSize: number;
  pad: number;
  dx: number;
  dy: number;
  scale: number;
  opacity: number;
  screenBox: ScreenBox;
}

export interface ResolvedWeaponPanelGeom {
  baseW: number;
  baseH: number;
  baseRight: number;
  baseTop: number;
  dx: number;
  dy: number;
  scale: number;
  opacity: number;
  screenBox: ScreenBox;
}

export const COMPACT_ACTION_CONTAINER = { w: 184, h: 164, pad: 8 };
export const FULL_ACTION_CONTAINER = { w: 232, h: 196, pad: 20 };

// Ergonomic arc layouts with generous base separation (>= 12px gap at 1.0x scale)
export const COMPACT_ACTION_RECTS: Record<ActionButtonKey, ButtonRectSpec> = {
  repair: { left: 12, top: -44, w: 44, h: 44 },
  stance: { left: 72, top: -44, w: 44, h: 44 },
  fish: { left: 132, top: -38, w: 44, h: 44 },
  ability: { left: 56, top: 14, w: 44, h: 44 },
  radar: { left: 128, top: 22, w: 48, h: 48 },
  attack: { left: 2, top: 54, w: 48, h: 48 },
  boatOrInteract: { left: 10, top: 114, w: 48, h: 48 },
  digOrFire: { left: 112, top: 92, w: 72, h: 72 },
};

export const FULL_ACTION_RECTS: Record<ActionButtonKey, ButtonRectSpec> = {
  repair: { left: 34, top: -58, w: 48, h: 48 },
  stance: { left: 102, top: -58, w: 48, h: 48 },
  fish: { left: 168, top: -52, w: 48, h: 48 },
  ability: { left: 68, top: 6, w: 56, h: 56 },
  radar: { left: 158, top: 14, w: 64, h: 64 },
  attack: { left: 4, top: 56, w: 60, h: 60 },
  boatOrInteract: { left: 14, top: 126, w: 64, h: 64 },
  digOrFire: { left: 144, top: 108, w: 88, h: 88 },
};

function clampVal(v: number, min: number, max: number): number {
  if (!Number.isFinite(v)) return min;
  return v < min ? min : v > max ? max : v;
}

export function scaleButtonRect(r: ButtonRectSpec, factor: number, containerW: number, containerH: number): ButtonRectSpec {
  // Scale coordinates relative to bottom-right anchor (containerW, containerH)
  const dxFromRight = containerW - r.left;
  const dyFromBottom = containerH - r.top;
  const newW = Math.round(r.w * factor);
  const newH = Math.round(r.h * factor);
  return {
    left: Math.round(containerW * factor - dxFromRight * factor),
    top: Math.round(containerH * factor - dyFromBottom * factor),
    w: newW,
    h: newH,
  };
}

export interface HudLayoutInput {
  vw: number;
  vh: number;
  isCoarseDevice: boolean;
  controlsDisplayMode: 'TOUCH' | 'DESKTOP' | 'HIDDEN';
  isEditingLayout: boolean;
  touchLayout?: TouchLayoutConfig;
  visibleActionIds: ActionButtonKey[];
  desktopActionButtonCount: number;
  showTopRightHudButtons: boolean;
  showTopRightSettingsButton: boolean;
  gold: number;
  bagCount: number;
  nearDock: boolean;
  hasWeaponPanel: boolean;
  hasMultipleWeapons?: boolean;
  onlineActive: boolean;
  voiceEnabled: boolean;
  chatOpen: boolean;
  hasTutorial: boolean;
  showPortraitHint: boolean;
  hasWorldEvent: boolean;
  activeDragId?: TouchButtonId | null;
}

export interface HudCompassSafeZones {
  tlRight: number;
  tlBottom: number;
  trLeft: number;
  trBottom: number;
  blRight: number;
  blTop: number;
  brLeft: number;
  brTop: number;
}

export interface UnifiedHudLayout {
  pad: number;
  isCompactTouch: boolean;
  isTopRightCompact: boolean;
  clusterScale: number;
  topRightBox: ScreenBox;
  topRightMaxWidth: number;
  topLeftPlacement: {
    left: number;
    top: number;
    maxWidth: number;
    maxHeight: number;
    stackBelowMinimap: boolean;
  };
  compassSafeZones: HudCompassSafeZones;
  showTopCenterEvent: boolean;
  topCenterEventMaxWidth: number;
  minimap: ResolvedMiniMapGeom;
  joystick: ResolvedJoystickGeom;
  weaponPanel: ResolvedWeaponPanelGeom;
  weaponAtDefaultSpot: boolean;
  actionContainer: { w: number; h: number; pad: number };
  actionButtons: Record<ActionButtonKey, ResolvedButtonGeom>;
  actionsBounds: ScreenBox;
  radarToastPlacement: {
    mode: 'ABOVE' | 'LEFT';
    top: number;
    right: number;
    maxWidth: number;
  };
  desktopActionBar: {
    maxWidth: number;
    estWidth: number;
    estHeight: number;
  };
  bottomStackPlacement: {
    bottom: number;
    left: number;
    translateXMinus50: boolean;
    maxWidth: number;
    maxHeight: number;
    align: 'center' | 'start';
  };
  desktopTutorialPlacement: {
    bottom: number;
    left: number;
    maxWidth: number;
  };
  desktopChatPlacement: {
    bottom: number;
    left: number;
    maxWidth: number;
    maxHeight: number;
  };
  editorToolbarPlacement: {
    top: number;
    left: number;
    width: number;
  };
}

interface SolverNode {
  id: TouchButtonId;
  shape: 'circle' | 'rect';
  cx: number;
  cy: number;
  desiredCx: number;
  desiredCy: number;
  baseCx: number;
  baseCy: number;
  radius: number;
  halfW: number;
  halfH: number;
  scale: number;
}

function clampNodeToViewport(node: SolverNode, vw: number, vh: number, margin: number): void {
  const minCx = margin + node.halfW;
  const maxCx = Math.max(minCx, vw - margin - node.halfW);
  const minCy = margin + node.halfH;
  const maxCy = Math.max(minCy, vh - margin - node.halfH);
  node.cx = clampVal(node.cx, minCx, maxCx);
  node.cy = clampVal(node.cy, minCy, maxCy);
}

function pushNodeOutOfBox(
  node: SolverNode,
  box: ScreenBox,
  gap: number,
  vw: number,
  vh: number,
  margin: number
): void {
  const exLeft = box.left - gap;
  const exTop = box.top - gap;
  const exRight = box.right + gap;
  const exBottom = box.bottom + gap;

  if (node.shape === 'rect') {
    const nLeft = node.cx - node.halfW;
    const nRight = node.cx + node.halfW;
    const nTop = node.cy - node.halfH;
    const nBottom = node.cy + node.halfH;
    if (nRight <= exLeft || nLeft >= exRight || nBottom <= exTop || nTop >= exBottom) {
      return;
    }
    const pushLeft = nRight - exLeft;
    const pushDown = exBottom - nTop;
    const pushRight = exRight - nLeft;
    const pushUp = nBottom - exTop;
    const candLeft = node.cx - pushLeft >= margin + node.halfW ? pushLeft : Infinity;
    const candDown = node.cy + pushDown <= vh - margin - node.halfH ? pushDown : Infinity;
    const candRight = node.cx + pushRight <= vw - margin - node.halfW ? pushRight : Infinity;
    const candUp = node.cy - pushUp >= margin + node.halfH ? pushUp : Infinity;
    const minPen = Math.min(candLeft, candDown, candRight, candUp);
    if (minPen === candLeft && Number.isFinite(candLeft)) node.cx -= candLeft;
    else if (minPen === candDown && Number.isFinite(candDown)) node.cy += candDown;
    else if (minPen === candRight && Number.isFinite(candRight)) node.cx += candRight;
    else if (minPen === candUp && Number.isFinite(candUp)) node.cy -= candUp;
    else {
      const fallback = Math.min(pushLeft, pushDown, pushRight, pushUp);
      if (fallback === pushDown) node.cy += pushDown;
      else if (fallback === pushLeft) node.cx -= pushLeft;
      else if (fallback === pushRight) node.cx += pushRight;
      else node.cy -= pushUp;
    }
    return;
  }

  // Circle vs expanded obstacle rect
  const closestX = clampVal(node.cx, box.left, box.right);
  const closestY = clampVal(node.cy, box.top, box.bottom);
  const dx = node.cx - closestX;
  const dy = node.cy - closestY;
  const dist = Math.hypot(dx, dy);
  const minReq = node.radius + gap;

  if (dist >= minReq) return;

  if (dist > 0.001) {
    const push = minReq - dist;
    node.cx += (dx / dist) * push;
    node.cy += (dy / dist) * push;
  } else {
    // Center is inside the box; push out via shortest feasible axis
    const toLeft = node.cx - box.left + minReq;
    const toBottom = box.bottom - node.cy + minReq;
    const toRight = box.right - node.cx + minReq;
    const toTop = node.cy - box.top + minReq;
    const candLeft = node.cx - toLeft >= margin + node.halfW ? toLeft : Infinity;
    const candDown = node.cy + toBottom <= vh - margin - node.halfH ? toBottom : Infinity;
    const candRight = node.cx + toRight <= vw - margin - node.halfW ? toRight : Infinity;
    const candUp = node.cy - toTop >= margin + node.halfH ? toTop : Infinity;
    const minAxis = Math.min(candLeft, candDown, candRight, candUp);
    if (minAxis === candLeft && Number.isFinite(candLeft)) node.cx -= candLeft;
    else if (minAxis === candDown && Number.isFinite(candDown)) node.cy += candDown;
    else if (minAxis === candRight && Number.isFinite(candRight)) node.cx += candRight;
    else if (minAxis === candUp && Number.isFinite(candUp)) node.cy -= candUp;
    else node.cy = box.bottom + minReq;
  }
}

function doesNodesOverlap(a: SolverNode, b: SolverNode, gap: number): boolean {
  if (a.shape === 'circle' && b.shape === 'circle') {
    const d = Math.hypot(a.cx - b.cx, a.cy - b.cy);
    return d < a.radius + b.radius + gap - 0.5;
  }
  const rectNode = a.shape === 'rect' ? a : b;
  const other = a.shape === 'rect' ? b : a;
  const rLeft = rectNode.cx - rectNode.halfW;
  const rRight = rectNode.cx + rectNode.halfW;
  const rTop = rectNode.cy - rectNode.halfH;
  const rBottom = rectNode.cy + rectNode.halfH;

  if (other.shape === 'rect') {
    return !(
      other.cx + other.halfW <= rLeft - gap ||
      other.cx - other.halfW >= rRight + gap ||
      other.cy + other.halfH <= rTop - gap ||
      other.cy - other.halfH >= rBottom + gap
    );
  }

  const closestX = clampVal(other.cx, rLeft, rRight);
  const closestY = clampVal(other.cy, rTop, rBottom);
  const d = Math.hypot(other.cx - closestX, other.cy - closestY);
  return d < other.radius + gap - 0.5;
}

function separatePair(a: SolverNode, b: SolverNode, gap: number, weightA: number, weightB: number, pairIdx: number): void {
  const totalW = weightA + weightB;
  if (totalW <= 0) return;

  if (a.shape === 'circle' && b.shape === 'circle') {
    let dx = a.cx - b.cx;
    let dy = a.cy - b.cy;
    let dist = Math.hypot(dx, dy);
    const minDist = a.radius + b.radius + gap;
    if (dist >= minDist) return;

    if (dist < 0.001) {
      const fallbackAngle = ((pairIdx * 137.5) % 360) * (Math.PI / 180);
      dx = Math.cos(fallbackAngle);
      dy = Math.sin(fallbackAngle);
      dist = 1;
    }
    const overlap = minDist - dist;
    const ux = dx / dist;
    const uy = dy / dist;
    a.cx += ux * overlap * (weightA / totalW);
    a.cy += uy * overlap * (weightA / totalW);
    b.cx -= ux * overlap * (weightB / totalW);
    b.cy -= uy * overlap * (weightB / totalW);
    return;
  }

  // Rect vs Circle (or Rect vs Rect)
  const rectNode = a.shape === 'rect' ? a : b;
  const other = a.shape === 'rect' ? b : a;
  const wRect = a.shape === 'rect' ? weightA : weightB;
  const wOther = a.shape === 'rect' ? weightB : weightA;

  const rLeft = rectNode.cx - rectNode.halfW;
  const rRight = rectNode.cx + rectNode.halfW;
  const rTop = rectNode.cy - rectNode.halfH;
  const rBottom = rectNode.cy + rectNode.halfH;

  const closestX = clampVal(other.cx, rLeft, rRight);
  const closestY = clampVal(other.cy, rTop, rBottom);
  let dx = other.cx - closestX;
  let dy = other.cy - closestY;
  let dist = Math.hypot(dx, dy);
  const minDist = other.radius + gap;

  if (dist >= minDist) return;

  if (dist < 0.001) {
    dx = other.cx - rectNode.cx;
    dy = other.cy - rectNode.cy;
    dist = Math.hypot(dx, dy);
    if (dist < 0.001) {
      dx = 0;
      dy = 1;
      dist = 1;
    }
    const overlap = Math.max(rectNode.halfW, rectNode.halfH) + other.radius + gap;
    const ux = dx / dist;
    const uy = dy / dist;
    other.cx += ux * overlap * (wOther / totalW);
    other.cy += uy * overlap * (wOther / totalW);
    rectNode.cx -= ux * overlap * (wRect / totalW);
    rectNode.cy -= uy * overlap * (wRect / totalW);
    return;
  }

  const overlap = minDist - dist;
  const ux = dx / dist;
  const uy = dy / dist;
  other.cx += ux * overlap * (wOther / totalW);
  other.cy += uy * overlap * (wOther / totalW);
  rectNode.cx -= ux * overlap * (wRect / totalW);
  rectNode.cy -= uy * overlap * (wRect / totalW);
}

function nodeToScreenBox(n: SolverNode): ScreenBox {
  return {
    left: Math.round(n.cx - n.halfW),
    top: Math.round(n.cy - n.halfH),
    right: Math.round(n.cx + n.halfW),
    bottom: Math.round(n.cy + n.halfH),
  };
}

function hasAnyObstacleCollision(
  node: SolverNode,
  others: SolverNode[],
  obstacles: ScreenBox[],
  gap: number,
  vw: number,
  vh: number,
  margin: number
): boolean {
  if (
    node.cx - node.halfW < margin - 0.5 ||
    node.cx + node.halfW > vw - margin + 0.5 ||
    node.cy - node.halfH < margin - 0.5 ||
    node.cy + node.halfH > vh - margin + 0.5
  ) {
    return true;
  }
  for (const box of obstacles) {
    if (box.right <= box.left || box.bottom <= box.top) continue;
    if (node.shape === 'rect') {
      if (
        !(
          node.cx + node.halfW <= box.left - gap + 0.5 ||
          node.cx - node.halfW >= box.right + gap - 0.5 ||
          node.cy + node.halfH <= box.top - gap + 0.5 ||
          node.cy - node.halfH >= box.bottom + gap - 0.5
        )
      ) {
        return true;
      }
    } else {
      const cx = clampVal(node.cx, box.left, box.right);
      const cy = clampVal(node.cy, box.top, box.bottom);
      if (Math.hypot(node.cx - cx, node.cy - cy) < node.radius + gap - 0.5) {
        return true;
      }
    }
  }
  for (const o of others) {
    if (o.id === node.id) continue;
    if (doesNodesOverlap(node, o, gap)) return true;
  }
  return false;
}

export function computeUnifiedHudLayout(input: HudLayoutInput): UnifiedHudLayout {
  const vw = Math.max(280, Math.round(input.vw || 800));
  const vh = Math.max(280, Math.round(input.vh || 600));
  const isCompactTouch = input.isCoarseDevice || vw < 640 || vh < 540;
  const pad = isCompactTouch ? 8 : 20;
  const isTopRightCompact = input.isCoarseDevice || vw < 760 || vh < 500;

  // 1. Phone-screen-adaptive baseline scale & Top-Right Row 1 HUD geometry
  const shortSide = Math.min(vw, vh);
  let deviceAdaptiveScale = 1;
  if (input.isCoarseDevice || isCompactTouch) {
    if (shortSide <= 340) {
      deviceAdaptiveScale = 0.68;
    } else if (shortSide <= 440) {
      deviceAdaptiveScale = 0.68 + ((shortSide - 340) / 100) * 0.12;
    } else if (shortSide <= 660) {
      deviceAdaptiveScale = 0.8 + ((shortSide - 440) / 220) * 0.14;
    } else {
      deviceAdaptiveScale = 0.96;
    }
  }

  let topRightEstW = 0;
  let topRightRow1H = 0;
  let topRightEstH = 0;
  const topRightMaxWidth = isTopRightCompact
    ? Math.max(150, vw - 2 * pad - 88)
    : Math.max(220, Math.floor((vw - 2 * pad) * 0.54));

  if (input.showTopRightHudButtons || input.showTopRightSettingsButton) {
    if (isTopRightCompact) {
      const goldDigits = Math.max(1, String(Math.max(0, Math.round(input.gold))).length);
      const goldW = 54 + goldDigits * 7 + (input.bagCount > 0 ? 34 : 0);
      const row1W =
        (input.showTopRightHudButtons ? 36 + 6 + goldW : 0) +
        (input.showTopRightSettingsButton ? (input.showTopRightHudButtons ? 6 : 0) + 36 : 0);
      topRightRow1H = 36;
      topRightEstW = Math.min(topRightMaxWidth, row1W);
      topRightEstH = topRightRow1H;
    } else {
      const singleRowW =
        (input.showTopRightHudButtons ? 390 + (input.bagCount > 0 ? 38 : 0) : 0) +
        (input.showTopRightSettingsButton ? 48 : 0);
      const wraps = singleRowW > topRightMaxWidth;
      topRightEstW = Math.min(singleRowW, topRightMaxWidth);
      topRightRow1H = wraps ? 88 : 40;
      const hasDesktopTraderRow = input.nearDock && input.showTopRightHudButtons;
      topRightEstH = topRightRow1H + (hasDesktopTraderRow ? 46 : 0);
    }
  }

  const topRightBox: ScreenBox = {
    left: vw - pad - topRightEstW,
    top: pad,
    right: vw - pad,
    bottom: pad + topRightEstH,
  };

  // 2. Compute viewport-adaptive auto scale so phone buttons shrink neatly to fit each screen
  const miniMapBaseSize = isCompactTouch
    ? Math.round(clampVal(shortSide * 0.195, 62, 86))
    : 124;

  const baseJoystickSize = isCompactTouch ? 112 : 160;
  const baseActionSpec = isCompactTouch ? COMPACT_ACTION_CONTAINER : FULL_ACTION_CONTAINER;
  const baseActionReachH = isCompactTouch ? 208 : 254;

  let clusterScale = 1;
  if (input.controlsDisplayMode === 'TOUCH') {
    const availTouchW = vw - 2 * pad - 16;
    const scaleW = availTouchW / (baseJoystickSize + baseActionSpec.w);
    const availTouchH = vh - 2 * pad - miniMapBaseSize - 14;
    const scaleH = availTouchH / baseActionReachH;
    clusterScale = clampVal(Math.min(deviceAdaptiveScale, scaleW, scaleH), 0.58, 1);
  }

  const joystickBoxSize = Math.round(baseJoystickSize * clusterScale);
  const actionContainer = {
    w: Math.round(baseActionSpec.w * clusterScale),
    h: Math.round(baseActionSpec.h * clusterScale),
    pad,
  };
  const baseRects = isCompactTouch ? COMPACT_ACTION_RECTS : FULL_ACTION_RECTS;
  const scaledActionRects: Record<ActionButtonKey, ButtonRectSpec> = {
    digOrFire: scaleButtonRect(baseRects.digOrFire, clusterScale, baseActionSpec.w, baseActionSpec.h),
    boatOrInteract: scaleButtonRect(
      baseRects.boatOrInteract,
      clusterScale,
      baseActionSpec.w,
      baseActionSpec.h
    ),
    radar: scaleButtonRect(baseRects.radar, clusterScale, baseActionSpec.w, baseActionSpec.h),
    attack: scaleButtonRect(baseRects.attack, clusterScale, baseActionSpec.w, baseActionSpec.h),
    ability: scaleButtonRect(baseRects.ability, clusterScale, baseActionSpec.w, baseActionSpec.h),
    fish: scaleButtonRect(baseRects.fish, clusterScale, baseActionSpec.w, baseActionSpec.h),
    stance: scaleButtonRect(baseRects.stance, clusterScale, baseActionSpec.w, baseActionSpec.h),
    repair: scaleButtonRect(baseRects.repair, clusterScale, baseActionSpec.w, baseActionSpec.h),
  };

  // 3. Build solver nodes for MiniMap + (when TOUCH) Joystick & visible Action Buttons
  const layout = input.touchLayout ?? {};
  const edgeMargin = 6;
  const minGap = 6;

  const miniRaw = layout.minimap;
  const miniScale = clampVal(miniRaw?.scale ?? 1, 0.65, 1.6);
  const miniMaxScaleForScreen = Math.min(
    1.6,
    (vw - 2 * edgeMargin) / Math.max(1, miniMapBaseSize),
    (vh - 2 * edgeMargin) / Math.max(1, miniMapBaseSize)
  );
  const clampedMiniScale = Math.max(0.65, Math.min(miniScale, miniMaxScaleForScreen));
  const miniEffSize = Math.round(miniMapBaseSize * clampedMiniScale);
  const miniBaseCx = pad + miniEffSize / 2;
  const miniBaseCy = pad + miniEffSize / 2;

  const miniNode: SolverNode = {
    id: 'minimap',
    shape: 'rect',
    cx: miniBaseCx + (miniRaw?.dx ?? 0),
    cy: miniBaseCy + (miniRaw?.dy ?? 0),
    desiredCx: miniBaseCx + (miniRaw?.dx ?? 0),
    desiredCy: miniBaseCy + (miniRaw?.dy ?? 0),
    baseCx: miniBaseCx,
    baseCy: miniBaseCy,
    radius: miniEffSize * 0.5,
    halfW: miniEffSize * 0.5,
    halfH: miniEffSize * 0.5,
    scale: clampedMiniScale,
  };

  const joyRaw = layout.joystick;
  const joyScale = clampVal(joyRaw?.scale ?? 1, 0.75, 1.35);
  const joyBaseCx = pad + joystickBoxSize / 2;
  const joyBaseCy = vh - pad - joystickBoxSize / 2;
  const joyHalf = (joystickBoxSize * joyScale) / 2;

  const joyNode: SolverNode = {
    id: 'joystick',
    shape: 'circle',
    cx: joyBaseCx + (joyRaw?.dx ?? 0),
    cy: joyBaseCy + (joyRaw?.dy ?? 0),
    desiredCx: joyBaseCx + (joyRaw?.dx ?? 0),
    desiredCy: joyBaseCy + (joyRaw?.dy ?? 0),
    baseCx: joyBaseCx,
    baseCy: joyBaseCy,
    radius: joyHalf,
    halfW: joyHalf,
    halfH: joyHalf,
    scale: joyScale,
  };

  const activeButtonSet = new Set<ActionButtonKey>(
    input.isEditingLayout ? ALL_ACTION_BUTTON_KEYS : input.visibleActionIds
  );

  const actionNodes: Record<ActionButtonKey, SolverNode> = {} as Record<ActionButtonKey, SolverNode>;
  const containerLeft = vw - pad - actionContainer.w;
  const containerTop = vh - pad - actionContainer.h;

  for (const key of ALL_ACTION_BUTTON_KEYS) {
    const r = scaledActionRects[key];
    const raw = layout[key];
    const scale = clampVal(raw?.scale ?? 1, 0.75, 1.35);
    const baseCx = containerLeft + r.left + r.w / 2;
    const baseCy = containerTop + r.top + r.h / 2;
    const halfW = (r.w * scale) / 2;
    const halfH = (r.h * scale) / 2;
    actionNodes[key] = {
      id: key,
      shape: 'circle',
      cx: baseCx + (raw?.dx ?? 0),
      cy: baseCy + (raw?.dy ?? 0),
      desiredCx: baseCx + (raw?.dx ?? 0),
      desiredCy: baseCy + (raw?.dy ?? 0),
      baseCx,
      baseCy,
      radius: Math.max(halfW, halfH),
      halfW,
      halfH,
      scale,
    };
  }

  const wpRaw = layout.weaponPanel;
  const wpScale = clampVal(wpRaw?.scale ?? 1, 0.65, 1.45);
  const wpBaseW = isTopRightCompact ? Math.round(clampVal(vw * 0.52, 184, 212)) : 256;
  const multiWep = Boolean(input.hasMultipleWeapons);
  const wpBaseH = isTopRightCompact ? (multiWep ? 104 : 78) : (multiWep ? 112 : 84);
  const wpBaseRight = pad;
  const wpBaseTop = pad + (topRightRow1H > 0 ? topRightRow1H + (isTopRightCompact ? 6 : 8) : 0);
  const wpBaseCx = vw - wpBaseRight - wpBaseW / 2;
  const wpBaseCy = wpBaseTop + wpBaseH / 2;
  const wpNode: SolverNode = {
    id: 'weaponPanel',
    shape: 'rect',
    cx: wpBaseCx + (wpRaw?.dx ?? 0),
    cy: wpBaseCy + (wpRaw?.dy ?? 0),
    desiredCx: wpBaseCx + (wpRaw?.dx ?? 0),
    desiredCy: wpBaseCy + (wpRaw?.dy ?? 0),
    baseCx: wpBaseCx,
    baseCy: wpBaseCy,
    radius: Math.max(wpBaseW, wpBaseH) * wpScale * 0.5,
    halfW: (wpBaseW * wpScale) / 2,
    halfH: (wpBaseH * wpScale) / 2,
    scale: wpScale,
  };

  // Fixed exclusion zones: TopRightHud Row 1 (+ desktop action bar when in DESKTOP mode)
  const fixedObstacles: ScreenBox[] = [];
  if (topRightEstW > 0 && topRightRow1H > 0) {
    fixedObstacles.push({
      left: topRightBox.left,
      top: topRightBox.top,
      right: topRightBox.right,
      bottom: pad + topRightRow1H,
    });
  }

  // Estimate desktop action bar dimensions first so minimap also stays clear of it
  const desktopActionMaxW = Math.min(
    720,
    Math.max(240, vw - 2 * pad - (input.onlineActive ? 220 : 0))
  );
  const desktopEstSingleW = Math.max(92, input.desktopActionButtonCount * 86 + 16);
  const desktopWraps =
    input.controlsDisplayMode === 'DESKTOP' && desktopEstSingleW > desktopActionMaxW;
  const desktopActionEstW =
    input.controlsDisplayMode === 'DESKTOP' ? Math.min(desktopEstSingleW, desktopActionMaxW) : 0;
  const desktopActionEstH =
    input.controlsDisplayMode === 'DESKTOP' ? (desktopWraps ? 88 : 48) : 0;

  if (input.controlsDisplayMode === 'DESKTOP' && !input.isEditingLayout) {
    fixedObstacles.push({
      left: vw - pad - desktopActionEstW,
      top: vh - pad - desktopActionEstH,
      right: vw - pad,
      bottom: vh - pad,
    });
  }

  const activeNodes: SolverNode[] = [miniNode];
  if (input.hasWeaponPanel || input.isEditingLayout) {
    activeNodes.push(wpNode);
  }
  if (input.controlsDisplayMode === 'TOUCH') {
    activeNodes.push(joyNode);
    for (const key of ALL_ACTION_BUTTON_KEYS) {
      if (activeButtonSet.has(key)) {
        activeNodes.push(actionNodes[key]);
      }
    }
  }

  // Initial clamp of all active nodes
  for (const n of activeNodes) {
    clampNodeToViewport(n, vw, vh, edgeMargin);
  }

  const dragId = input.activeDragId ?? null;
  const draggedNode = dragId ? activeNodes.find((n) => n.id === dragId) ?? null : null;

  if (draggedNode) {
    // Active drag mode: keep stationary nodes anchored; resolve ONLY draggedNode cleanly
    const others = activeNodes.filter((n) => n.id !== draggedNode.id);
    for (let iter = 0; iter < 28; iter++) {
      for (let i = 0; i < others.length; i++) {
        separatePair(draggedNode, others[i], minGap, 1, 0, i);
      }
      for (const box of fixedObstacles) {
        pushNodeOutOfBox(draggedNode, box, minGap, vw, vh, edgeMargin);
      }
      clampNodeToViewport(draggedNode, vw, vh, edgeMargin);
    }

    // If still colliding (e.g. wedged), spiral-search nearest strictly valid spot around desiredCx/Cy
    if (
      hasAnyObstacleCollision(
        draggedNode,
        others,
        fixedObstacles,
        minGap,
        vw,
        vh,
        edgeMargin
      )
    ) {
      let bestCx = draggedNode.cx;
      let bestCy = draggedNode.cy;
      let found = false;
      const probe: SolverNode = { ...draggedNode };
      for (let r = 8; r <= 180 && !found; r += 10) {
        for (let a = 0; a < 20; a++) {
          const ang = (a / 20) * Math.PI * 2;
          probe.cx = draggedNode.desiredCx + Math.cos(ang) * r;
          probe.cy = draggedNode.desiredCy + Math.sin(ang) * r;
          clampNodeToViewport(probe, vw, vh, edgeMargin);
          if (
            !hasAnyObstacleCollision(probe, others, fixedObstacles, minGap, vw, vh, edgeMargin)
          ) {
            bestCx = probe.cx;
            bestCy = probe.cy;
            found = true;
            break;
          }
        }
      }
      if (found) {
        draggedNode.cx = bestCx;
        draggedNode.cy = bestCy;
      }
    }
  } else {
    // Passive resolution (render / resize / rotation / button scale change):
    // Symmetric iterative relaxation so NO pair can overlap on any screen!
    for (let iter = 0; iter < 32; iter++) {
      let pairIdx = 0;
      for (let i = 0; i < activeNodes.length; i++) {
        for (let j = i + 1; j < activeNodes.length; j++) {
          const a = activeNodes[i];
          const b = activeNodes[j];
          // Give MiniMap slightly higher positional stability unless clamped
          const wA = a.id === 'minimap' ? 0.35 : 0.5;
          const wB = b.id === 'minimap' ? 0.35 : 0.5;
          separatePair(a, b, minGap, wA, wB, pairIdx++);
        }
      }
      for (const n of activeNodes) {
        for (const box of fixedObstacles) {
          pushNodeOutOfBox(n, box, minGap, vw, vh, edgeMargin);
        }
        clampNodeToViewport(n, vw, vh, edgeMargin);
      }
    }
  }

  // Clamp hidden/inactive action buttons only to viewport so their stored geometry stays valid
  for (const key of ALL_ACTION_BUTTON_KEYS) {
    if (!activeButtonSet.has(key)) {
      clampNodeToViewport(actionNodes[key], vw, vh, edgeMargin);
    }
  }

  const minimapBox = nodeToScreenBox(miniNode);
  const minimap: ResolvedMiniMapGeom = {
    baseSize: miniMapBaseSize,
    effectiveSize: miniEffSize,
    pad,
    dx: Math.round(miniNode.cx - miniNode.baseCx),
    dy: Math.round(miniNode.cy - miniNode.baseCy),
    scale: clampedMiniScale,
    opacity: clampVal(miniRaw?.opacity ?? 1, 0.25, 1),
    screenBox: minimapBox,
  };

  const joystickBox = nodeToScreenBox(joyNode);
  const joystick: ResolvedJoystickGeom = {
    boxSize: joystickBoxSize,
    pad,
    dx: Math.round(joyNode.cx - joyNode.baseCx),
    dy: Math.round(joyNode.cy - joyNode.baseCy),
    scale: joyNode.scale,
    opacity: clampVal(joyRaw?.opacity ?? 1, 0.25, 1),
    screenBox: joystickBox,
  };

  const weaponBox = nodeToScreenBox(wpNode);
  const weaponPanel: ResolvedWeaponPanelGeom = {
    baseW: wpBaseW,
    baseH: wpBaseH,
    baseRight: wpBaseRight,
    baseTop: wpBaseTop,
    dx: Math.round(wpNode.cx - wpNode.baseCx),
    dy: Math.round(wpNode.cy - wpNode.baseCy),
    scale: wpNode.scale,
    opacity: clampVal(wpRaw?.opacity ?? 1, 0.25, 1),
    screenBox: weaponBox,
  };
  const weaponAtDefaultSpot =
    (input.hasWeaponPanel || input.isEditingLayout) &&
    Math.abs(weaponPanel.dx) < 28 &&
    Math.abs(weaponPanel.dy) < 28;

  const actionButtons: Record<ActionButtonKey, ResolvedButtonGeom> = {} as Record<
    ActionButtonKey,
    ResolvedButtonGeom
  >;
  let actionsLeft = vw;
  let actionsTop = vh;
  let actionsRight = 0;
  let actionsBottom = 0;

  for (const key of ALL_ACTION_BUTTON_KEYS) {
    const n = actionNodes[key];
    const box = nodeToScreenBox(n);
    actionButtons[key] = {
      rect: scaledActionRects[key],
      dx: Math.round(n.cx - n.baseCx),
      dy: Math.round(n.cy - n.baseCy),
      scale: n.scale,
      opacity: clampVal(layout[key]?.opacity ?? 1, 0.25, 1),
      screenBox: box,
    };
    if (activeButtonSet.has(key)) {
      if (box.left < actionsLeft) actionsLeft = box.left;
      if (box.top < actionsTop) actionsTop = box.top;
      if (box.right > actionsRight) actionsRight = box.right;
      if (box.bottom > actionsBottom) actionsBottom = box.bottom;
    }
  }

  if (actionsLeft > actionsRight) {
    actionsLeft = vw - pad - actionContainer.w;
    actionsTop = vh - pad - actionContainer.h;
    actionsRight = vw - pad;
    actionsBottom = vh - pad;
  }

  const actionsBounds: ScreenBox = {
    left: actionsLeft,
    top: actionsTop,
    right: actionsRight,
    bottom: actionsBottom,
  };

  // 4. Top-Left Status Stack placement (NEVER collides with MiniMap or TopRightHud or Bottom Controls!)
  const minimapInTopLeft =
    minimapBox.left < pad + miniMapBaseSize + 50 && minimapBox.top < pad + 60;
  const rightOfMinimapW = topRightBox.left - minimapBox.right - 12;
  const stackBelowMinimap = minimapInTopLeft && rightOfMinimapW < 156;

  const statusLeft = minimapInTopLeft
    ? stackBelowMinimap
      ? pad
      : minimapBox.right + 10
    : pad;
  const statusTop = minimapInTopLeft && stackBelowMinimap ? minimapBox.bottom + 8 : pad;
  const rightObstacles: number[] = [];
  if (statusTop < topRightBox.bottom + 6 && topRightBox.left > statusLeft + 60) {
    rightObstacles.push(topRightBox.left - 10);
  }
  if (
    (input.hasWeaponPanel || input.isEditingLayout) &&
    weaponBox.top < statusTop + 102 &&
    weaponBox.bottom > statusTop - 4 &&
    weaponBox.left > statusLeft + 76
  ) {
    rightObstacles.push(weaponBox.left - 10);
  }
  const statusRightLimit = rightObstacles.length > 0 ? Math.min(...rightObstacles) : vw - pad;
  const statusMaxWidth = Math.max(115, statusRightLimit - statusLeft);

  const bottomLimitForTopLeft =
    input.controlsDisplayMode === 'TOUCH'
      ? Math.min(joystickBox.top, actionsBounds.top) - 10
      : input.onlineActive
      ? vh - 120
      : vh - 64;
  const statusMaxHeight = Math.max(64, bottomLimitForTopLeft - statusTop);

  const hasMiniTL = minimapBox.top < vh * 0.45 && minimapBox.left < vw * 0.45;
  const hasWeaponTR =
    (input.hasWeaponPanel || input.isEditingLayout) &&
    weaponBox.right > vw * 0.52 &&
    weaponBox.top < vh * 0.45;
  const compassSafeZones: HudCompassSafeZones = {
    tlRight: Math.max(
      hasMiniTL ? minimapBox.right + 16 : 0,
      statusLeft < vw * 0.48 && statusTop < vh * 0.45
        ? Math.min(vw * 0.55, statusLeft + Math.min(statusMaxWidth, 230)) + 16
        : 0
    ),
    tlBottom: Math.max(
      hasMiniTL ? minimapBox.bottom + 16 : 0,
      statusTop < vh * 0.45 ? statusTop + Math.min(statusMaxHeight, 96) + 16 : 0
    ),
    trLeft: Math.min(
      topRightEstW > 0 ? topRightBox.left - 18 : vw,
      hasWeaponTR ? weaponBox.left - 18 : vw
    ),
    trBottom: Math.max(
      topRightEstW > 0 ? topRightBox.bottom + 18 : 0,
      hasWeaponTR ? weaponBox.bottom + 18 : 0
    ),
    blRight:
      input.controlsDisplayMode === 'TOUCH' &&
      joystickBox.left < vw * 0.45 &&
      joystickBox.bottom > vh * 0.55
        ? joystickBox.right + 18
        : input.onlineActive
        ? Math.min(vw * 0.42, 220)
        : 0,
    blTop:
      input.controlsDisplayMode === 'TOUCH' &&
      joystickBox.left < vw * 0.45 &&
      joystickBox.bottom > vh * 0.55
        ? joystickBox.top - 18
        : input.onlineActive
        ? vh - 76
        : vh,
    brLeft:
      input.controlsDisplayMode === 'TOUCH'
        ? actionsBounds.left - 18
        : input.controlsDisplayMode === 'DESKTOP'
        ? vw - pad - desktopActionEstW - 18
        : vw,
    brTop:
      input.controlsDisplayMode === 'TOUCH'
        ? actionsBounds.top - 18
        : input.controlsDisplayMode === 'DESKTOP'
        ? vh - pad - desktopActionEstH - 18
        : vh,
  };

  // Top-Center World Event fits cleanly only if wide gap between Top-Left and Top-Right
  const topLeftOccupiedRight = minimapInTopLeft
    ? stackBelowMinimap
      ? minimapBox.right
      : Math.min(statusRightLimit, statusLeft + Math.min(statusMaxWidth, 230))
    : statusLeft + 210;
  const topCenterGap = topRightBox.left - topLeftOccupiedRight - 24;
  const showTopCenterEvent = input.hasWorldEvent && vw >= 768 && topCenterGap >= 220;
  const topCenterEventMaxWidth = Math.max(200, Math.min(420, topCenterGap));

  // 5. Radar Toast placement in TOUCH mode (above highest visible action button, or to its left if near top)
  const toastNeededTop = actionsBounds.top - 42;
  const topClearRightSide = Math.max(
    pad + 8,
    topRightBox.bottom + 8,
    weaponAtDefaultSpot ? weaponBox.bottom + 8 : 0
  );
  const radarFitsAbove = toastNeededTop >= topClearRightSide;
  const radarToastPlacement = radarFitsAbove
    ? {
        mode: 'ABOVE' as const,
        top: actionsBounds.top - (vh - pad - actionContainer.h) - 40,
        right: 0,
        maxWidth: Math.max(160, vw - pad * 2),
      }
    : {
        mode: 'LEFT' as const,
        top: Math.max(0, actionsBounds.top - (vh - pad - actionContainer.h)),
        right: vw - pad - actionsBounds.left + 10,
        maxWidth: Math.max(140, actionsBounds.left - joystickBox.right - 20),
      };

  // 6. Unified Bottom Stack (TOUCH mode: PortraitHint + Tutorial + OnlineChat/Voice)
  //    and Desktop Placements (DESKTOP / HIDDEN mode)
  const topHudEstBottom = Math.max(
    minimapInTopLeft ? minimapBox.bottom : pad + 72,
    topRightBox.bottom,
    weaponAtDefaultSpot ? weaponBox.bottom : 0,
    statusTop + Math.min(statusMaxHeight, 92)
  );

  let bottomStackPlacement: UnifiedHudLayout['bottomStackPlacement'];
  if (input.controlsDisplayMode === 'TOUCH') {
    const laneLeft = joystickBox.right + 10;
    const laneRight = actionsBounds.left - 10;
    const laneWidth = laneRight - laneLeft;

    if (laneWidth >= 220) {
      bottomStackPlacement = {
        bottom: pad,
        left: Math.round((laneLeft + laneRight) / 2),
        translateXMinus50: true,
        maxWidth: Math.max(200, Math.round(laneWidth)),
        maxHeight: Math.max(110, vh - topHudEstBottom - pad - 10),
        align: 'center',
      };
    } else {
      // Narrow portrait screen or close touch clusters: stack cleanly ABOVE both touch clusters!
      const touchTopY = Math.min(joystickBox.top, actionsBounds.top);
      const availAbove = touchTopY - topHudEstBottom - 16;
      if (availAbove >= 84) {
        bottomStackPlacement = {
          bottom: Math.max(pad, vh - touchTopY + 8),
          left: Math.round(vw / 2),
          translateXMinus50: true,
          maxWidth: Math.max(220, vw - pad * 2),
          maxHeight: Math.max(96, availAbove),
          align: 'center',
        };
      } else {
        // Extreme case (e.g. user dragged an action button up high): use lane above joystick
        const joyClearTop = Math.max(topHudEstBottom + 8, joystickBox.top - 140);
        bottomStackPlacement = {
          bottom: Math.max(pad, vh - joystickBox.top + 8),
          left: pad,
          translateXMinus50: false,
          maxWidth: Math.max(180, actionsBounds.left - pad - 10),
          maxHeight: Math.max(84, joystickBox.top - joyClearTop),
          align: 'start',
        };
      }
    }
  } else {
    // DESKTOP or HIDDEN
    const chatReservedW = input.onlineActive
      ? Math.min(vw * 0.45, input.voiceEnabled ? 390 : 230)
      : 0;
    const rightReserve =
      input.controlsDisplayMode === 'DESKTOP' ? desktopActionEstW + 14 : 0;
    const availMid = vw - 2 * pad - chatReservedW - rightReserve - (input.onlineActive ? 14 : 0);

    bottomStackPlacement = {
      bottom: pad,
      left: Math.round(vw / 2),
      translateXMinus50: true,
      maxWidth: Math.max(220, Math.min(520, availMid > 240 ? availMid : vw - pad * 2)),
      maxHeight: Math.max(120, vh - topHudEstBottom - pad - 12),
      align: 'center',
    };
  }

  // Desktop separate Chat (bottom-left) + Tutorial (bottom-center or stacked above)
  const chatMaxW = Math.max(
    200,
    Math.min(
      430,
      vw -
        2 * pad -
        (input.controlsDisplayMode === 'DESKTOP' ? desktopActionEstW + 16 : 0)
    )
  );
  const desktopChatPlacement = {
    bottom: pad,
    left: pad,
    maxWidth: chatMaxW,
    maxHeight: Math.max(120, vh - topHudEstBottom - pad - 14),
  };

  const chatLaneRight = input.onlineActive
    ? pad +
      Math.max(
        input.chatOpen ? 288 : 0,
        Math.min(chatMaxW, input.voiceEnabled ? 370 : 225)
      ) +
      12
    : pad;
  const actionLaneLeft =
    input.controlsDisplayMode === 'DESKTOP' ? vw - pad - desktopActionEstW - 12 : vw - pad;
  const desktopCenterGap = actionLaneLeft - chatLaneRight;

  const fallbackLeftBound = input.onlineActive && input.chatOpen ? pad + 300 : pad;
  const fallbackSpan = vw - pad - fallbackLeftBound;
  const desktopTutorialPlacement =
    desktopCenterGap >= 260
      ? {
          bottom: pad,
          left: Math.round((chatLaneRight + actionLaneLeft) / 2),
          maxWidth: Math.min(512, desktopCenterGap),
        }
      : fallbackSpan >= 240
      ? {
          bottom: pad + Math.max(desktopActionEstH, input.onlineActive ? 46 : 0) + 10,
          left: Math.round(fallbackLeftBound + fallbackSpan / 2),
          maxWidth: Math.min(512, fallbackSpan),
        }
      : {
          bottom: pad + Math.max(desktopActionEstH, input.onlineActive ? 46 : 0) + 10,
          left: Math.round(vw / 2),
          maxWidth: Math.min(512, vw - 2 * pad),
        };

  // 7. Editor Toolbar Placement during LAYOUT_EDIT:
  // Always keeps MiniMap, TopRightHud, Joystick, and ActionButtons uncovered & draggable!
  let editorToolbarPlacement: UnifiedHudLayout['editorToolbarPlacement'];
  const toolbarWidth = Math.min(460, vw - 16);
  if (vw >= 780) {
    const centerLeft = pad + miniMapBaseSize + 14;
    const centerRight = topRightBox.left - 14;
    const centerW = Math.min(460, Math.max(260, centerRight - centerLeft));
    editorToolbarPlacement = {
      top: pad,
      left: Math.round((centerLeft + centerRight - centerW) / 2),
      width: centerW,
    };
  } else if (vh >= 520) {
    // Portrait phone/tablet: sit cleanly BELOW MiniMap & TopRightHud, ABOVE Bottom Touch Controls!
    const belowTopY = Math.max(pad + miniMapBaseSize + 12, topRightBox.bottom + 12);
    editorToolbarPlacement = {
      top: belowTopY,
      left: Math.round((vw - toolbarWidth) / 2),
      width: toolbarWidth,
    };
  } else {
    // Short landscape phone: sit in open horizontal center band between MiniMap (left) & ActionControls/TopRightHud (right)
    const leftBound = pad + miniMapBaseSize + 10;
    const rightBound = Math.min(topRightBox.left, vw - pad - actionContainer.w) - 10;
    const laneW = rightBound - leftBound;
    if (laneW >= 220) {
      const w = Math.min(420, laneW);
      editorToolbarPlacement = {
        top: pad,
        left: Math.round(leftBound + (laneW - w) / 2),
        width: w,
      };
    } else {
      const w = Math.min(380, vw - 16);
      editorToolbarPlacement = {
        top: Math.max(pad, Math.round((vh - 108) / 2)),
        left: Math.round((vw - w) / 2),
        width: w,
      };
    }
  }

  return {
    pad,
    isCompactTouch,
    isTopRightCompact,
    clusterScale,
    topRightBox,
    topRightMaxWidth,
    topLeftPlacement: {
      left: statusLeft,
      top: statusTop,
      maxWidth: statusMaxWidth,
      maxHeight: statusMaxHeight,
      stackBelowMinimap,
    },
    compassSafeZones,
    showTopCenterEvent,
    topCenterEventMaxWidth,
    minimap,
    joystick,
    weaponPanel,
    weaponAtDefaultSpot,
    actionContainer,
    actionButtons,
    actionsBounds,
    radarToastPlacement,
    desktopActionBar: {
      maxWidth: desktopActionMaxW,
      estWidth: desktopActionEstW,
      estHeight: desktopActionEstH,
    },
    bottomStackPlacement,
    desktopTutorialPlacement,
    desktopChatPlacement,
    editorToolbarPlacement,
  };
}

/**
 * Helper used during LAYOUT_EDIT dragging to clamp & resolve ONLY the dragged element
 * against all other elements, TopRightHud, and screen bounds so dragging can NEVER overlap.
 */
export function resolveDraggedTouchTransform(
  id: TouchButtonId,
  candidate: TouchButtonTransform,
  baseInput: Omit<HudLayoutInput, 'touchLayout' | 'activeDragId'>,
  currentTouchLayout: TouchLayoutConfig | undefined
): TouchButtonTransform {
  const nextLayout: TouchLayoutConfig = {
    ...(currentTouchLayout ?? {}),
    [id]: candidate,
  };
  const solved = computeUnifiedHudLayout({
    ...baseInput,
    touchLayout: nextLayout,
    activeDragId: id,
  });
  const preservedOpacity = clampVal(candidate.opacity ?? currentTouchLayout?.[id]?.opacity ?? 1, 0.25, 1);
  if (id === 'minimap') {
    return {
      dx: solved.minimap.dx,
      dy: solved.minimap.dy,
      scale: solved.minimap.scale,
      opacity: preservedOpacity,
    };
  }
  if (id === 'joystick') {
    return {
      dx: solved.joystick.dx,
      dy: solved.joystick.dy,
      scale: solved.joystick.scale,
      opacity: preservedOpacity,
    };
  }
  if (id === 'weaponPanel') {
    return {
      dx: solved.weaponPanel.dx,
      dy: solved.weaponPanel.dy,
      scale: solved.weaponPanel.scale,
      opacity: preservedOpacity,
    };
  }
  const btn = solved.actionButtons[id];
  return {
    dx: btn.dx,
    dy: btn.dy,
    scale: btn.scale,
    opacity: preservedOpacity,
  };
}
