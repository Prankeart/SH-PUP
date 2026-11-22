import React, { useState } from 'react';
import { Maximize2, RotateCw, Smartphone } from 'lucide-react';
import { enterLandscapeGameMode } from '../utils/fullscreen';

interface LandscapeGateOverlayProps {
  language: 'tr' | 'en';
  onContinuePortrait: () => void;
}

export const LandscapeGateOverlay: React.FC<LandscapeGateOverlayProps> = ({
  language,
  onContinuePortrait,
}) => {
  const isEn = language === 'en';
  const [tryingLock, setTryingLock] = useState(false);

  const handleLockLandscape = async () => {
    if (tryingLock) return;
    setTryingLock(true);
    try {
      await enterLandscapeGameMode();
    } finally {
      setTryingLock(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={isEn ? 'Landscape orientation required' : 'Yatay ekran gerekli'}
      className="fixed inset-0 z-50 ui-scrim flex items-center justify-center p-5 select-none"
    >
      <div className="w-full max-w-sm rounded-2xl ui-shell border border-white/12 p-6 text-center shadow-[0_24px_64px_rgba(0,0,0,0.7)] space-y-5">
        <div className="mx-auto w-14 h-14 rounded-xl bg-[#0F212C] border border-amber-400/30 flex items-center justify-center relative">
          <Smartphone className="w-7 h-7 text-amber-400 -rotate-90" />
          <RotateCw className="w-4 h-4 text-sky-300 absolute -top-1.5 -right-1.5 bg-[#0A1720] rounded-full p-0.5" />
        </div>

        <div className="space-y-2">
          <h2 className="font-display text-lg font-bold text-slate-50 tracking-tight">
            {isEn ? 'Rotate to Landscape' : 'Yatay Ekrana Geçin'}
          </h2>
          <p className="text-xs text-slate-300 leading-relaxed">
            {isEn
              ? 'This game runs best in landscape on phones and tablets. Rotate your device sideways or lock landscape fullscreen below.'
              : 'Oyun mobil cihazlarda ve tabletlerde yatay ekran için tasarlanmıştır. Cihazınızı yan çevirin veya aşağıdan yatay tam ekrana geçin.'}
          </p>
        </div>

        <div className="space-y-2.5 pt-1">
          <button
            type="button"
            onClick={() => void handleLockLandscape()}
            disabled={tryingLock}
            className="w-full min-h-[48px] px-4 rounded-xl bg-amber-400 hover:bg-amber-300 active:scale-[0.985] disabled:opacity-60 text-slate-950 font-display font-bold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <Maximize2 className="w-4 h-4 shrink-0" />
            <span>
              {tryingLock
                ? isEn
                  ? 'Switching...'
                  : 'Geçiliyor...'
                : isEn
                ? 'Switch to Landscape Fullscreen'
                : 'Yatay Tam Ekrana Geç'}
            </span>
          </button>

          <button
            type="button"
            onClick={onContinuePortrait}
            className="w-full min-h-[40px] px-3 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-white/[0.04] transition-colors cursor-pointer"
          >
            {isEn ? 'Continue in Portrait Anyway' : 'Yine de Dikey Devam Et'}
          </button>
        </div>
      </div>
    </div>
  );
};
