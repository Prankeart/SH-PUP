import React from 'react';
import { Compass, Globe, Pickaxe, Play, Ship } from 'lucide-react';

interface TitleOverlayProps {
  hasSavedProgress: boolean;
  savedGold: number;
  discoveredCount: number;
  inviteRoomCode?: string;
  language?: 'tr' | 'en';
  onStart: () => void;
  onOpenOnline: () => void;
}

export const TitleOverlay: React.FC<TitleOverlayProps> = ({
  hasSavedProgress,
  savedGold,
  discoveredCount,
  inviteRoomCode,
  language = 'tr',
  onStart,
  onOpenOnline,
}) => {
  const isEn = language === 'en';
  return (
    <div className="fixed inset-0 z-40 bg-slate-950/55 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="w-full max-w-xl max-h-[92dvh] overflow-y-auto bg-[#0F2936]/95 border border-white/15 rounded-2xl p-4 sm:p-8 shadow-2xl text-center">
        <h1 className="font-display text-2xl sm:text-4xl font-extrabold text-amber-300 tracking-tight text-balance">
          {isEn ? 'Tropical Island: Treasure Hunt' : 'Tropik Ada: Hazine Avı'}
        </h1>
        <p className="mt-2 text-xs sm:text-base text-slate-200 max-w-md mx-auto">
          {isEn
            ? 'Dig across procedural islands, track buried chests with the hot-cold radar, and command your fleet across open seas.'
            : 'Prosedürel adalarda kazı yap, sıcak-soğuk radarıyla gömülü hazineleri bul ve teknenle açık denizleri keşfet.'}
        </p>

        {/* Quick 3-step visual guide */}
        <div className="mt-4 sm:mt-6 grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3 text-left">
          <div className="p-2.5 sm:p-3 rounded-xl bg-slate-950/35 border border-white/10 flex sm:block items-center gap-3">
            <Compass className="w-5 h-5 text-sky-300 sm:mb-1.5 shrink-0" />
            <div>
              <div className="text-xs font-semibold text-slate-100">
                {isEn ? 'Scan Treasures' : 'Hazineyi Tara'}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                {isEn
                  ? 'Measure distance with hot-cold radar'
                  : 'Radar ile sıcak-soğuk mesafesini ölç'}
              </div>
            </div>
          </div>
          <div className="p-2.5 sm:p-3 rounded-xl bg-slate-950/35 border border-white/10 flex sm:block items-center gap-3">
            <Pickaxe className="w-5 h-5 text-amber-400 sm:mb-1.5 shrink-0" />
            <div>
              <div className="text-xs font-semibold text-slate-100">
                {isEn ? 'Dig the Sand' : 'Toprağı Kaz'}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                {isEn
                  ? 'Unearth chests and ancient relics'
                  : 'Adada iz bırakarak sandığı çıkar'}
              </div>
            </div>
          </div>
          <div className="p-2.5 sm:p-3 rounded-xl bg-slate-950/35 border border-white/10 flex sm:block items-center gap-3">
            <Ship className="w-5 h-5 text-emerald-400 sm:mb-1.5 shrink-0" />
            <div>
              <div className="text-xs font-semibold text-slate-100">
                {isEn ? 'Set Sail' : 'Yelken Aç'}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                {isEn
                  ? 'Board your ship to conquer new islands'
                  : 'Tekneye binip yeni adalar ve tüccarlar bul'}
              </div>
            </div>
          </div>
        </div>

        {hasSavedProgress && (
          <div className="mt-4 sm:mt-5 text-xs text-slate-300 font-mono-num">
            {isEn
              ? `Offline Save: ${savedGold.toLocaleString('en-US')} Gold · ${discoveredCount} Islands`
              : `Offline Kayıt: ${savedGold.toLocaleString('tr-TR')} Altın · ${discoveredCount} Ada`}
          </div>
        )}

        <div className="mt-5 sm:mt-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2.5 sm:gap-3">
          <button
            type="button"
            onClick={onStart}
            className="w-full sm:w-auto justify-center px-6 py-3 sm:py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-bold text-sm sm:text-base flex items-center gap-2 shadow-lg transition-transform duration-100 active:scale-95 cursor-pointer whitespace-nowrap"
          >
            <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
            <span>
              {hasSavedProgress
                ? isEn
                  ? 'Continue Offline'
                  : 'Offline Devam Et'
                : isEn
                ? 'Play Offline'
                : 'Offline Oyna'}
            </span>
          </button>

          <button
            type="button"
            onClick={onOpenOnline}
            className="w-full sm:w-auto justify-center px-6 py-3 sm:py-3.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-display font-bold text-sm sm:text-base flex items-center gap-2 shadow-lg transition-transform duration-100 active:scale-95 cursor-pointer whitespace-nowrap"
          >
            <Globe className="w-4 h-4 sm:w-5 sm:h-5" />
            <span>
              {inviteRoomCode
                ? isEn
                  ? `Join Room (${inviteRoomCode})`
                  : `Odaya Katıl (${inviteRoomCode})`
                : isEn
                ? 'Online Room (P2P)'
                : 'Online Oda (P2P)'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

