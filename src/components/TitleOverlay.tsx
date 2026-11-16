import React from 'react';
import { Compass, Pickaxe, Play, Ship } from 'lucide-react';

interface TitleOverlayProps {
  hasSavedProgress: boolean;
  savedGold: number;
  discoveredCount: number;
  onStart: () => void;
}

export const TitleOverlay: React.FC<TitleOverlayProps> = ({
  hasSavedProgress,
  savedGold,
  discoveredCount,
  onStart,
}) => {
  return (
    <div className="fixed inset-0 z-40 bg-slate-950/55 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-xl bg-[#0F2936]/95 border border-white/15 rounded-2xl p-6 sm:p-8 shadow-2xl text-center">
        <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-amber-300 tracking-tight text-balance">
          Tropik Ada: Hazine Avı
        </h1>
        <p className="mt-2.5 text-sm sm:text-base text-slate-200 max-w-md mx-auto">
          Prosedürel adalarda kazı yap, sıcak-soğuk radarıyla gömülü hazineleri bul ve teknenle açık denizleri keşfet.
        </p>

        {/* Quick 3-step visual guide */}
        <div className="mt-6 grid grid-cols-3 gap-3 text-left">
          <div className="p-3 rounded-xl bg-slate-950/35 border border-white/10">
            <Compass className="w-5 h-5 text-sky-300 mb-1.5" />
            <div className="text-xs font-semibold text-slate-100">Hazineyi Tara</div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              Radar ile sıcak-soğuk mesafesini ölç
            </div>
          </div>
          <div className="p-3 rounded-xl bg-slate-950/35 border border-white/10">
            <Pickaxe className="w-5 h-5 text-amber-400 mb-1.5" />
            <div className="text-xs font-semibold text-slate-100">Toprağı Kaz</div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              Adada iz bırakarak sandığı çıkar
            </div>
          </div>
          <div className="p-3 rounded-xl bg-slate-950/35 border border-white/10">
            <Ship className="w-5 h-5 text-emerald-400 mb-1.5" />
            <div className="text-xs font-semibold text-slate-100">Yelken Aç</div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              Tekneye binip yeni adalar ve tüccarlar bul
            </div>
          </div>
        </div>

        {hasSavedProgress && (
          <div className="mt-5 text-xs text-slate-300 font-mono-num">
            Kayıtlı İlerleme: {savedGold.toLocaleString('tr-TR')} Altın · {discoveredCount} Ada
          </div>
        )}

        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={onStart}
            className="px-8 py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-bold text-base flex items-center gap-2.5 shadow-lg transition-transform duration-100 active:scale-95 cursor-pointer whitespace-nowrap"
          >
            <Play className="w-5 h-5 fill-current" />
            <span>{hasSavedProgress ? 'Kaldığın Yerden Devam Et' : 'Oyuna Başla'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
