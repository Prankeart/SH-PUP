import React, { useState } from 'react';
import {
  Anchor,
  Check,
  Compass,
  Crown,
  Globe,
  Languages,
  Pickaxe,
  Play,
  Settings,
  Ship,
  Users,
  Volume2,
  VolumeX,
} from 'lucide-react';

const CREST_IMAGE_SRC = '/src/assets/images/pirate_compass_crest_1795020662166.jpg';
const KEYART_IMAGE_SRC = '/src/assets/images/tropical_cove_keyart_1795020662703.jpg';

interface TitleOverlayProps {
  hasSavedProgress: boolean;
  savedGold: number;
  discoveredCount: number;
  treasuresFoundCount?: number;
  boatLevel?: number;
  captainName?: string;
  inviteRoomCode?: string;
  language?: 'tr' | 'en';
  soundEnabled?: boolean;
  onToggleLanguage?: () => void;
  onToggleSound?: () => void;
  onOpenSettings?: () => void;
  onStart: () => void;
  onOpenOnline: () => void;
}

export const TitleOverlay: React.FC<TitleOverlayProps> = ({
  hasSavedProgress,
  savedGold,
  discoveredCount,
  treasuresFoundCount = 0,
  boatLevel = 1,
  captainName = 'Kaptan',
  inviteRoomCode,
  language = 'tr',
  soundEnabled = true,
  onToggleLanguage,
  onToggleSound,
  onOpenSettings,
  onStart,
  onOpenOnline,
}) => {
  const isEn = language === 'en';
  const [selectedMode, setSelectedMode] = useState<'OFFLINE' | 'ONLINE'>(
    inviteRoomCode ? 'ONLINE' : 'OFFLINE'
  );
  const [crestError, setCrestError] = useState(false);
  const [keyartError, setKeyartError] = useState(false);

  const handlePrimaryLaunch = () => {
    if (selectedMode === 'ONLINE') {
      onOpenOnline();
    } else {
      onStart();
    }
  };

  return (
    <div className="fixed inset-0 z-30 overflow-y-auto overflow-x-hidden touch-pan-y bg-[#041824]/70 select-none">
      {/* Full-viewport atmospheric backdrop art over live animated ocean canvas */}
      {!keyartError && (
        <img
          src={KEYART_IMAGE_SRC}
          alt={isEn ? 'Tropical island cove scene' : 'Tropik ada koyu manzarası'}
          referrerPolicy="no-referrer"
          onError={() => setKeyartError(true)}
          className="pointer-events-none fixed inset-0 w-full h-full object-cover opacity-35"
        />
      )}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 bg-gradient-to-b from-[#041824]/90 via-[#062334]/65 to-[#03131d]/95"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 bg-gradient-to-r from-[#041824]/88 via-transparent to-[#041824]/88"
      />

      {/* Main Responsive Shell */}
      <div className="relative z-10 min-h-full w-full max-w-6xl mx-auto px-3.5 sm:px-6 lg:px-8 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.875rem,env(safe-area-inset-bottom))] flex flex-col justify-between gap-3 sm:gap-5">
        {/* Top Utility Bar */}
        <header className="flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl overflow-hidden border border-amber-400/40 bg-[#0B2535] flex items-center justify-center shrink-0 shadow-md">
              {!crestError ? (
                <img
                  src={CREST_IMAGE_SRC}
                  alt={isEn ? 'Captain compass crest' : 'Kaptan pusula arması'}
                  referrerPolicy="no-referrer"
                  onError={() => setCrestError(true)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <Compass className="w-5 h-5 text-amber-300" />
              )}
            </div>
            <div className="min-w-0">
              <div className="text-xs sm:text-sm font-bold text-slate-100 truncate">
                {captainName}
              </div>
              <div className="text-[11px] sm:text-xs text-slate-300/90 font-mono-num truncate">
                {hasSavedProgress
                  ? isEn
                    ? `${savedGold.toLocaleString('en-US')} Gold · ${discoveredCount} Islands · Ship Lv.${boatLevel}`
                    : `${savedGold.toLocaleString('tr-TR')} Altın · ${discoveredCount} Ada · Gemi Sv.${boatLevel}`
                  : isEn
                  ? 'New Expedition Ready'
                  : 'Yeni Sefer Hazır'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {onToggleLanguage && (
              <button
                type="button"
                onClick={onToggleLanguage}
                aria-label={isEn ? 'Switch language' : 'Dili değiştir'}
                className="min-h-[40px] sm:min-h-[44px] px-3 rounded-xl bg-[#081A24]/88 backdrop-blur-md hover:bg-[#0F2F42] border border-white/12 ring-1 ring-inset ring-white/[0.05] text-slate-100 text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer whitespace-nowrap shadow-md focus-visible:outline-2 focus-visible:outline-amber-400"
              >
                <Languages className="w-4 h-4 text-amber-300 shrink-0" />
                <span>{isEn ? 'EN' : 'TR'}</span>
              </button>
            )}

            {onToggleSound && (
              <button
                type="button"
                onClick={onToggleSound}
                aria-label={
                  soundEnabled
                    ? isEn
                      ? 'Mute sound'
                      : 'Sesi kapat'
                    : isEn
                    ? 'Enable sound'
                    : 'Sesi aç'
                }
                className="min-h-[40px] min-w-[40px] sm:min-h-[44px] sm:min-w-[44px] rounded-xl bg-[#081A24]/88 backdrop-blur-md hover:bg-[#0F2F42] border border-white/12 ring-1 ring-inset ring-white/[0.05] text-slate-100 flex items-center justify-center transition-all active:scale-95 cursor-pointer shadow-md focus-visible:outline-2 focus-visible:outline-amber-400"
              >
                {soundEnabled ? (
                  <Volume2 className="w-4 h-4 text-emerald-300" />
                ) : (
                  <VolumeX className="w-4 h-4 text-slate-400" />
                )}
              </button>
            )}

            {onOpenSettings && (
              <button
                type="button"
                onClick={onOpenSettings}
                aria-label={isEn ? 'Open Settings' : 'Ayarları Aç'}
                className="min-h-[40px] min-w-[40px] sm:min-h-[44px] sm:px-3.5 rounded-xl bg-[#081A24]/88 backdrop-blur-md hover:bg-[#0F2F42] border border-white/12 ring-1 ring-inset ring-white/[0.05] text-slate-100 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer whitespace-nowrap shadow-md focus-visible:outline-2 focus-visible:outline-amber-400"
              >
                <Settings className="w-4 h-4 text-slate-200 shrink-0" />
                <span className="hidden md:inline">{isEn ? 'Settings' : 'Ayarlar'}</span>
              </button>
            )}
          </div>
        </header>

        {/* Center Lobby Grid: Portrait stack on narrow phones, 2-column split on Landscape Mobile, Tablet & Desktop */}
        <main className="flex-1 min-h-0 flex flex-col justify-between sm:grid sm:grid-cols-12 sm:items-end lg:items-center gap-4 sm:gap-6 lg:gap-10 py-1 sm:py-2">
          {/* Left Hero Column */}
          <section className="sm:col-span-6 lg:col-span-7 flex flex-col justify-center gap-3 sm:gap-4 min-w-0">
            <div className="flex items-start sm:items-center gap-3.5 sm:gap-4">
              {/* Featured Crest Emblem on tablets / desktop / landscape mobile */}
              <div className="hidden sm:flex w-14 h-14 sm:w-16 sm:h-16 lg:w-20 lg:h-20 rounded-2xl overflow-hidden border border-amber-400/45 bg-[#0A2230] shrink-0 shadow-xl items-center justify-center">
                {!crestError ? (
                  <img
                    src={CREST_IMAGE_SRC}
                    alt={isEn ? 'Tropical Island Crest' : 'Tropik Ada Arması'}
                    referrerPolicy="no-referrer"
                    onError={() => setCrestError(true)}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Anchor className="w-8 h-8 text-amber-300" />
                )}
              </div>

              <div className="min-w-0">
                <h1 className="font-display text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-extrabold text-amber-300 tracking-tight leading-tight text-balance">
                  {isEn ? 'Tropical Island: Treasure Hunt' : 'Tropik Ada: Hazine Avı'}
                </h1>
                <p className="mt-1 sm:mt-1.5 text-xs sm:text-sm lg:text-base text-slate-200/90 max-w-xl leading-relaxed">
                  {isEn
                    ? 'Scan buried chests with the hot-cold radar, raid ancient caves, upgrade your fleet, and conquer uncharted islands.'
                    : 'Sıcak-soğuk radarıyla gömülü hazineleri bul, mağaralara dal, gemini güçlendir ve yeni adaları fethet.'}
                </p>
              </div>
            </div>

            {/* Framed Key Art Showcase (Visible on tall viewports: Portrait Tablet & Desktop, hidden on short phone landscape so buttons never clip) */}
            <div className="hidden [@media(min-height:580px)]:block">
              <div className="relative rounded-2xl overflow-hidden border border-white/12 ring-1 ring-inset ring-white/[0.05] bg-[#081A24]/90 shadow-[0_20px_50px_rgba(2,10,18,0.65)]">
                {!keyartError ? (
                  <img
                    src={KEYART_IMAGE_SRC}
                    alt={
                      isEn
                        ? 'Tropical treasure island cove with pirate ship and buried chest'
                        : 'Tropik hazine adası koyu, korsan gemisi ve sandık'
                    }
                    referrerPolicy="no-referrer"
                    onError={() => setKeyartError(true)}
                    className="w-full h-36 sm:h-44 lg:h-56 object-cover"
                  />
                ) : (
                  <div className="w-full h-36 sm:h-44 lg:h-56 bg-gradient-to-br from-[#0B354A] to-[#061A27] flex items-center justify-center">
                    <Ship className="w-14 h-14 text-amber-300/60" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[#041824]/95 via-[#041824]/30 to-transparent" />
                <div className="absolute bottom-0 inset-x-0 px-4 py-3 flex items-center justify-between gap-4 text-xs text-slate-200">
                  <div className="flex items-center gap-4 min-w-0">
                    <span className="flex items-center gap-1.5 font-semibold whitespace-nowrap">
                      <Compass className="w-3.5 h-3.5 text-sky-300 shrink-0" />
                      {isEn ? 'Hot-Cold Radar' : 'Hazine Radarı'}
                    </span>
                    <span className="text-white/30" aria-hidden="true">
                      ·
                    </span>
                    <span className="flex items-center gap-1.5 font-semibold whitespace-nowrap">
                      <Pickaxe className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                      {isEn ? 'Caves & Relics' : 'Kazı & Mağaralar'}
                    </span>
                    <span className="hidden md:inline text-white/30" aria-hidden="true">
                      ·
                    </span>
                    <span className="hidden md:flex items-center gap-1.5 font-semibold whitespace-nowrap">
                      <Crown className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
                      {isEn ? 'Fleet & Kingdom' : 'Filo & Krallık'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Clean Tabular Expedition Stats Strip (shown when progress exists) */}
            {hasSavedProgress && (
              <div className="grid grid-cols-4 gap-2 pt-2 border-t border-white/10 text-left">
                <div>
                  <div className="text-[11px] text-slate-400">{isEn ? 'Gold' : 'Altın'}</div>
                  <div className="font-mono-num text-sm sm:text-base font-bold text-amber-300">
                    {savedGold.toLocaleString(isEn ? 'en-US' : 'tr-TR')}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-400">{isEn ? 'Islands' : 'Adalar'}</div>
                  <div className="font-mono-num text-sm sm:text-base font-bold text-sky-300">
                    {discoveredCount}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-400">{isEn ? 'Treasures' : 'Hazine'}</div>
                  <div className="font-mono-num text-sm sm:text-base font-bold text-emerald-300">
                    {treasuresFoundCount}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-400">{isEn ? 'Ship' : 'Gemi'}</div>
                  <div className="font-mono-num text-sm sm:text-base font-bold text-slate-100">
                    {isEn ? `Lv.${boatLevel}` : `Sv.${boatLevel}`}
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Right / Bottom Thumb-Zone Command Panel: Mode Selector + Primary Launch CTA */}
          <section className="sm:col-span-6 lg:col-span-5 w-full flex flex-col gap-2.5 sm:gap-3 bg-[#081A24]/92 backdrop-blur-xl border border-white/12 ring-1 ring-inset ring-white/[0.06] rounded-2xl p-3.5 sm:p-5 shadow-[0_24px_60px_rgba(2,10,18,0.7)]">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-sm sm:text-base font-bold text-slate-100">
                {isEn ? 'Select Mode' : 'Oyun Modunu Seç'}
              </h2>
              <span className="text-[11px] text-slate-400 font-medium whitespace-nowrap">
                {selectedMode === 'OFFLINE'
                  ? isEn
                    ? 'Single Player'
                    : 'Tek Oyunculu'
                  : isEn
                  ? 'Multiplayer P2P'
                  : 'Çok Oyunculu'}
              </span>
            </div>

            {/* Interactive Offline vs Online Mode Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-1 gap-2 sm:gap-2.5">
              <button
                type="button"
                onClick={() => setSelectedMode('OFFLINE')}
                aria-pressed={selectedMode === 'OFFLINE'}
                className={`group text-left min-h-[56px] p-2.5 sm:p-3.5 rounded-xl border transition-all duration-150 active:scale-[0.985] cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-400 ${
                  selectedMode === 'OFFLINE'
                    ? 'bg-amber-500/15 border-amber-400/80 ring-1 ring-inset ring-amber-300/20 shadow-lg'
                    : 'bg-slate-950/40 border-white/10 hover:bg-slate-900/65 hover:border-white/25'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                    <div
                      className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center shrink-0 ${
                        selectedMode === 'OFFLINE'
                          ? 'bg-amber-400 text-slate-950'
                          : 'bg-white/10 text-amber-300'
                      }`}
                    >
                      <Ship className="w-4 h-4 sm:w-5 sm:h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-display text-xs sm:text-sm font-bold text-slate-50 truncate">
                        {isEn ? 'Offline' : 'Offline Sefer'}
                      </div>
                      <div className="text-[10px] sm:text-xs text-slate-300 truncate">
                        {hasSavedProgress
                          ? isEn
                            ? 'Resume saved world'
                            : 'Kayıtlı dünyana devam et'
                          : isEn
                          ? 'Solo open-world survival'
                          : 'Tek kişilik açık dünya'}
                      </div>
                    </div>
                  </div>
                  {selectedMode === 'OFFLINE' && (
                    <Check className="w-4 h-4 text-amber-300 shrink-0 hidden sm:block" />
                  )}
                </div>
              </button>

              <button
                type="button"
                onClick={() => setSelectedMode('ONLINE')}
                aria-pressed={selectedMode === 'ONLINE'}
                className={`group text-left min-h-[56px] p-2.5 sm:p-3.5 rounded-xl border transition-all duration-150 active:scale-[0.985] cursor-pointer focus-visible:outline-2 focus-visible:outline-sky-400 ${
                  selectedMode === 'ONLINE'
                    ? 'bg-sky-500/15 border-sky-400/80 ring-1 ring-inset ring-sky-300/20 shadow-lg'
                    : 'bg-slate-950/40 border-white/10 hover:bg-slate-900/65 hover:border-white/25'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                    <div
                      className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center shrink-0 ${
                        selectedMode === 'ONLINE'
                          ? 'bg-sky-400 text-slate-950'
                          : 'bg-white/10 text-sky-300'
                      }`}
                    >
                      <Users className="w-4 h-4 sm:w-5 sm:h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-display text-xs sm:text-sm font-bold text-slate-50 truncate">
                        {isEn ? 'Online (P2P)' : 'Online Oda'}
                      </div>
                      <div className="text-[10px] sm:text-xs text-slate-300 truncate">
                        {inviteRoomCode
                          ? isEn
                            ? `Invite: ${inviteRoomCode}`
                            : `Davet Kodu: ${inviteRoomCode}`
                          : isEn
                          ? 'Co-op & PvP · Voice chat'
                          : 'Co-op / PvP · Sesli sohbet'}
                      </div>
                    </div>
                  </div>
                  {selectedMode === 'ONLINE' && (
                    <Check className="w-4 h-4 text-sky-300 shrink-0 hidden sm:block" />
                  )}
                </div>
              </button>
            </div>

            {/* Dominant Primary Launch CTA */}
            <button
              type="button"
              onClick={handlePrimaryLaunch}
              className={`w-full min-h-[50px] sm:min-h-[54px] px-5 py-3 rounded-xl font-display font-extrabold text-sm sm:text-base flex items-center justify-center gap-2.5 transition-all duration-150 active:scale-[0.98] cursor-pointer whitespace-nowrap focus-visible:outline-2 focus-visible:outline-white ${
                selectedMode === 'ONLINE'
                  ? 'bg-gradient-to-b from-sky-300 to-sky-400 hover:from-sky-200 hover:to-sky-300 text-slate-950 shadow-[0_12px_28px_rgba(56,189,248,0.28)]'
                  : 'bg-gradient-to-b from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 shadow-[0_12px_28px_rgba(245,158,11,0.28)]'
              }`}
            >
              {selectedMode === 'ONLINE' ? (
                <Globe className="w-5 h-5 shrink-0" />
              ) : (
                <Play className="w-5 h-5 fill-current shrink-0" />
              )}
              <span>
                {selectedMode === 'ONLINE'
                  ? inviteRoomCode
                    ? isEn
                      ? `Join Room (${inviteRoomCode})`
                      : `Odaya Katıl (${inviteRoomCode})`
                    : isEn
                    ? 'Open Online Lobby'
                    : 'Online Lobiye Gir'
                  : hasSavedProgress
                  ? isEn
                    ? 'Continue Expedition'
                    : 'Offline Devam Et'
                  : isEn
                  ? 'Start Expedition'
                  : 'Offline Oyna'}
              </span>
            </button>
          </section>
        </main>
      </div>
    </div>
  );
};
