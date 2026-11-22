import { detectIsCoarseDevice } from './platform';

type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitFullscreenEnabled?: boolean;
  webkitExitFullscreen?: () => Promise<void> | void;
};

type OrientationLockableScreen = Screen & {
  orientation?: ScreenOrientation & {
    lock?: (
      orientation:
        | 'any'
        | 'natural'
        | 'landscape'
        | 'portrait'
        | 'portrait-primary'
        | 'portrait-secondary'
        | 'landscape-primary'
        | 'landscape-secondary'
    ) => Promise<void>;
    unlock?: () => void;
  };
  lockOrientation?: (orientation: string | string[]) => boolean;
  mozLockOrientation?: (orientation: string | string[]) => boolean;
  msLockOrientation?: (orientation: string | string[]) => boolean;
  unlockOrientation?: () => boolean;
  mozUnlockOrientation?: () => boolean;
  msUnlockOrientation?: () => boolean;
};

export function isFullscreenSupported(): boolean {
  if (typeof document === 'undefined') return false;
  const doc = document as FullscreenDocument;
  const el = document.documentElement as FullscreenElement;
  const hasRequest = Boolean(el?.requestFullscreen || el?.webkitRequestFullscreen);
  if (!hasRequest) return false;
  if (typeof doc.fullscreenEnabled === 'boolean') return doc.fullscreenEnabled;
  if (typeof doc.webkitFullscreenEnabled === 'boolean') return doc.webkitFullscreenEnabled;
  return true;
}

export function isCurrentlyFullscreen(): boolean {
  if (typeof document === 'undefined') return false;
  const doc = document as FullscreenDocument;
  return Boolean(doc.fullscreenElement || doc.webkitFullscreenElement);
}

export async function lockLandscapeOrientation(): Promise<boolean> {
  if (typeof window === 'undefined' || typeof screen === 'undefined') return false;
  const scr = screen as OrientationLockableScreen;

  if (scr.orientation && typeof scr.orientation.lock === 'function') {
    for (const target of ['landscape', 'landscape-primary'] as const) {
      try {
        await scr.orientation.lock(target);
        return true;
      } catch {
        // Try fallback orientation target or legacy API
      }
    }
  }

  try {
    const legacyLock =
      scr.lockOrientation || scr.mozLockOrientation || scr.msLockOrientation;
    if (typeof legacyLock === 'function') {
      return Boolean(legacyLock.call(scr, ['landscape-primary', 'landscape-secondary']));
    }
  } catch {
    // Browser blocked orientation lock outside fullscreen or iframe policy
  }

  return false;
}

export function unlockOrientation(): void {
  if (typeof screen === 'undefined') return;
  const scr = screen as OrientationLockableScreen;
  try {
    if (scr.orientation && typeof scr.orientation.unlock === 'function') {
      scr.orientation.unlock();
      return;
    }
    const legacyUnlock =
      scr.unlockOrientation || scr.mozUnlockOrientation || scr.msUnlockOrientation;
    if (typeof legacyUnlock === 'function') {
      legacyUnlock.call(scr);
    }
  } catch {
    // Ignore unlock errors
  }
}

export async function requestAppFullscreen(options?: {
  lockLandscape?: boolean;
}): Promise<boolean> {
  const shouldLockLandscape = options?.lockLandscape ?? detectIsCoarseDevice();

  if (isCurrentlyFullscreen()) {
    if (shouldLockLandscape) {
      await lockLandscapeOrientation();
    }
    return true;
  }

  if (!isFullscreenSupported()) {
    if (shouldLockLandscape) {
      await lockLandscapeOrientation();
    }
    return false;
  }

  const el = document.documentElement as FullscreenElement;
  let entered = false;
  try {
    if (el.requestFullscreen) {
      await el.requestFullscreen({ navigationUI: 'hide' });
      entered = true;
    } else if (el.webkitRequestFullscreen) {
      await Promise.resolve(el.webkitRequestFullscreen());
      entered = true;
    }
  } catch {
    // Browser blocked fullscreen outside a direct user gesture or iframe policy; ignore safely
  }

  if (entered && shouldLockLandscape) {
    await lockLandscapeOrientation();
  }

  return entered;
}

export async function enterLandscapeGameMode(): Promise<{
  fullscreen: boolean;
  locked: boolean;
}> {
  const fullscreen = await requestAppFullscreen({ lockLandscape: true });
  const locked = await lockLandscapeOrientation();
  return { fullscreen, locked };
}

export async function exitAppFullscreen(): Promise<void> {
  unlockOrientation();
  if (typeof document === 'undefined' || !isCurrentlyFullscreen()) return;
  const doc = document as FullscreenDocument;
  try {
    if (doc.exitFullscreen) {
      await doc.exitFullscreen();
    } else if (doc.webkitExitFullscreen) {
      await Promise.resolve(doc.webkitExitFullscreen());
    }
  } catch {
    // Ignore browser exit errors
  }
}
