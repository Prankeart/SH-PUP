import { useEffect, useState } from 'react';

export type PlatformProfile = 'mobile-portrait' | 'mobile-landscape' | 'tablet' | 'desktop';

export interface PlatformState {
  profile: PlatformProfile;
  vw: number;
  vh: number;
  isCoarseDevice: boolean;
  isPortrait: boolean;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
}

export function detectIsCoarseDevice(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    const noHover = window.matchMedia('(hover: none)').matches;
    const touchPoints = typeof navigator !== 'undefined' ? navigator.maxTouchPoints ?? 0 : 0;
    return coarse || (noHover && touchPoints > 0);
  } catch {
    return typeof navigator !== 'undefined' && (navigator.maxTouchPoints ?? 0) > 0;
  }
}

export function detectPlatformProfile(
  vw: number,
  vh: number,
  isCoarseDevice: boolean
): PlatformProfile {
  const safeVw = Math.max(240, vw || 1280);
  const safeVh = Math.max(240, vh || 720);
  const minSide = Math.min(safeVw, safeVh);
  const isPortrait = safeVh >= safeVw;

  if (isCoarseDevice) {
    if (minSide >= 600 && safeVw >= 640) {
      return 'tablet';
    }
    return isPortrait ? 'mobile-portrait' : 'mobile-landscape';
  }

  if (safeVw < 640) {
    return isPortrait ? 'mobile-portrait' : 'mobile-landscape';
  }
  if (safeVh < 500 && safeVw > safeVh) {
    return 'mobile-landscape';
  }
  if (safeVw < 1024) {
    return 'tablet';
  }
  return 'desktop';
}

export function readPlatformState(): PlatformState {
  if (typeof window === 'undefined') {
    return {
      profile: 'desktop',
      vw: 1280,
      vh: 720,
      isCoarseDevice: false,
      isPortrait: false,
      isMobile: false,
      isTablet: false,
      isDesktop: true,
    };
  }
  const vv = window.visualViewport;
  const vw = Math.round(vv?.width ?? window.innerWidth);
  const vh = Math.round(vv?.height ?? window.innerHeight);
  const isCoarseDevice = detectIsCoarseDevice();
  const profile = detectPlatformProfile(vw, vh, isCoarseDevice);

  return {
    profile,
    vw,
    vh,
    isCoarseDevice,
    isPortrait: vh >= vw,
    isMobile: profile === 'mobile-portrait' || profile === 'mobile-landscape',
    isTablet: profile === 'tablet',
    isDesktop: profile === 'desktop',
  };
}

export function usePlatformProfile(): PlatformState {
  const [state, setState] = useState<PlatformState>(() => readPlatformState());

  useEffect(() => {
    const sync = () => {
      const next = readPlatformState();
      setState((prev) => {
        if (
          prev.profile === next.profile &&
          prev.vw === next.vw &&
          prev.vh === next.vh &&
          prev.isCoarseDevice === next.isCoarseDevice
        ) {
          return prev;
        }
        return next;
      });
    };

    window.addEventListener('resize', sync);
    window.addEventListener('orientationchange', sync);
    window.visualViewport?.addEventListener('resize', sync);
    return () => {
      window.removeEventListener('resize', sync);
      window.removeEventListener('orientationchange', sync);
      window.visualViewport?.removeEventListener('resize', sync);
    };
  }, []);

  return state;
}
