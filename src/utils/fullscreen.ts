type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitFullscreenEnabled?: boolean;
  webkitExitFullscreen?: () => Promise<void> | void;
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

export async function requestAppFullscreen(): Promise<boolean> {
  if (!isFullscreenSupported() || isCurrentlyFullscreen()) {
    return isCurrentlyFullscreen();
  }
  const el = document.documentElement as FullscreenElement;
  try {
    if (el.requestFullscreen) {
      await el.requestFullscreen({ navigationUI: 'hide' });
      return true;
    }
    if (el.webkitRequestFullscreen) {
      await Promise.resolve(el.webkitRequestFullscreen());
      return true;
    }
  } catch {
    // Browser blocked fullscreen outside a direct user gesture or iframe policy; ignore safely
  }
  return false;
}

export async function exitAppFullscreen(): Promise<void> {
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
