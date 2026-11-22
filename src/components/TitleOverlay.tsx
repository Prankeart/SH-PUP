import React, { useState } from 'react';
import {
  Anchor,
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
import { usePlatformProfile } from '../utils/platform';
import crestImg from '../assets/images/pirate_compass_crest_1795020662166.jpg';
import keyartImg from '../assets/images/tropical_cove_keyart_1795020662703.jpg';

const CREST_IMAGE_SRC = crestImg;
const KEYART_IMAGE_SRC = keyartImg;

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
  const { profile, isPortrait } = usePlatformProfile();
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

  const progressSummary = hasSavedProgress
    ? isEn
      ? `${savedGold.toLocaleString('en-US')} Gold · ${discoveredCount} Islands · Lv.${boatLevel}`
      : `${savedGold.toLocaleString('tr-TR')} Altın · ${discoveredCount} Ada · Sv.${boatLevel}`
    : isEn
    ? 'New Expedition Ready'
    : 'Yeni Sefer Hazır';

  const utilityBar = (
    <header className="w-full flex items-center justify-between gap-3 shrink-0">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg overflow-hidden border border-white/15 bg-[#08131B] flex items-center justify-center shrink-0">
          {!crestError ? (
            <img
              src={CREST_IMAGE_SRC}
              alt={isEn ? 'Captain compass crest' : 'Kaptan pusula arması'}
              referrerPolicy="no-referrer"
              onError={() => setCrestError(true)}
              className="w-full h-full object-cover"
            />
          ) : (
            <Compass className="w-4 h-4 text-amber-400" />
          )}
        </div>
        <div className="min-w-0">
          <div className="text-xs sm:text-sm font-semibold text-slate-100 truncate">
            {captainName}
          </div>
          <div className="text-[11px] text-slate-400 font-mono-num truncate">
            {progressSummary}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0 rounded-lg bg-[#08131B]/80 backdrop-blur-md border border-white/[0.08] p-1">
        {onToggleLanguage && (
          <button
            type="button"
            onClick={onToggleLanguage}
            aria-label={isEn ? 'Switch language' : 'Dili değiştir'}
            className="min-h-[36px] sm:min-h-[38px] px-2.5 rounded-md hover:bg-white/[0.07] active:bg-white/10 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Languages className="w-3.5 h-3.5 text-amber-400 shrink-0" />
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
            className="min-h-[36px] min-w-[36px] sm:min-h-[38px] sm:min-w-[38px] rounded-md hover:bg-white/[0.07] active:bg-white/10 text-slate-200 flex items-center justify-center transition-colors cursor-pointer"
          >
            {soundEnabled ? (
              <Volume2 className="w-4 h-4 text-slate-200" />
            ) : (
              <VolumeX className="w-4 h-4 text-slate-500" />
            )}
          </button>
        )}

        {onOpenSettings && (
          <button
            type="button"
            onClick={onOpenSettings}
            aria-label={isEn ? 'Open Settings' : 'Ayarları Aç'}
            className="min-h-[36px] min-w-[36px] sm:min-h-[38px] sm:px-3 rounded-md hover:bg-white/[0.07] active:bg-white/10 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Settings className="w-4 h-4 text-slate-300 shrink-0" />
            <span className="hidden md:inline">{isEn ? 'Settings' : 'Ayarlar'}</span>
          </button>
        )}
      </div>
    </header>
  );

  const launchCtaLabel =
    selectedMode === 'ONLINE'
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
        : 'Seferi Sürdür'
      : isEn
      ? 'Start Expedition'
      : 'Denize Açıl';

  // Backdrop layers shared across all platforms
  const backdrop = (
    <>
      {!keyartError && (
        <img
          src={KEYART_IMAGE_SRC}
          alt={isEn ? 'Tropical island cove scene' : 'Tropik ada koyu manzarası'}
          referrerPolicy="no-referrer"
          onError={() => setKeyartError(true)}
          className="pointer-events-none fixed inset-0 w-full h-full object-cover opacity-30"
        />
      )}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 bg-gradient-to-b from-[#061017]/90 via-[#061017]/65 to-[#040B11]/96"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 bg-gradient-to-r from-[#061017]/88 via-transparent to-[#061017]/85"
      />
    </>
  );

  // 1. MOBILE PORTRAIT: Atmospheric Hero + Thumb-Zone Docked Bottom Command Drawer
  if (profile === 'mobile-portrait') {
    return (
      <div className="fixed inset-0 z-30 flex flex-col justify-between bg-[#061017]/70 select-none overflow-hidden">
        {backdrop}
        <div className="relative z-10 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] flex flex-col gap-4">
          {utilityBar}

          <div className="pt-2 space-y-2">
            <h1 className="font-display text-3xl font-extrabold text-slate-50 tracking-tight leading-[1.1] text-balance">
              {isEn ? 'Tropical Island:' : 'Tropik Ada:'}
              <span className="block text-amber-400">
                {isEn ? 'Treasure Hunt' : 'Hazine Avı'}
              </span>
            </h1>
            <p className="text-xs text-slate-300 leading-relaxed max-w-sm">
              {isEn
                ? 'Scan buried chests with the hot-cold radar, raid caves, and command your fleet.'
                : 'Sıcak-soğuk radarıyla hazineleri bul, mağaralara dal ve filonu kur.'}
            </p>
          </div>

          {hasSavedProgress && (
            <div className="grid grid-cols-4 gap-2 pt-3 border-t border-white/[0.1] text-left">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-400">
                  {isEn ? 'Gold' : 'Altın'}
                </div>
                <div className="font-mono-num text-sm font-bold text-amber-300">
                  {savedGold.toLocaleString(isEn ? 'en-US' : 'tr-TR')}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-400">
                  {isEn ? 'Islands' : 'Ada'}
                </div>
                <div className="font-mono-num text-sm font-bold text-slate-100">
                  {discoveredCount}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-400">
                  {isEn ? 'Chests' : 'Hazine'}
                </div>
                <div className="font-mono-num text-sm font-bold text-emerald-300">
                  {treasuresFoundCount}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-400">
                  {isEn ? 'Ship' : 'Gemi'}
                </div>
                <div className="font-mono-num text-sm font-bold text-slate-100">
                  {isEn ? `Lv.${boatLevel}` : `Sv.${boatLevel}`}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Thumb-Zone Sheet */}
        <section className="relative z-10 w-full rounded-t-2xl bg-[#0A1720]/94 backdrop-blur-xl border-t border-white/12 px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] space-y-3 shadow-[0_-18px_50px_rgba(0,0,0,0.65)]">
          <div className="grid grid-cols-2 rounded-xl bg-[#061017] border border-white/[0.08] p-1 gap-1">
            <button
              type="button"
              onClick={() => setSelectedMode('OFFLINE')}
              aria-pressed={selectedMode === 'OFFLINE'}
              className={`min-h-[46px] px-3 rounded-lg flex items-center justify-center gap-2 text-xs font-bold transition-colors cursor-pointer ${
                selectedMode === 'OFFLINE'
                  ? 'bg-[#122634] text-amber-300 border border-amber-400/35'
                  : 'text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
            >
              <Ship className="w-4 h-4 shrink-0" />
              <span>{isEn ? 'Solo World' : 'Tek Kişilik'}</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedMode('ONLINE')}
              aria-pressed={selectedMode === 'ONLINE'}
              className={`min-h-[46px] px-3 rounded-lg flex items-center justify-center gap-2 text-xs font-bold transition-colors cursor-pointer ${
                selectedMode === 'ONLINE'
                  ? 'bg-[#122634] text-sky-300 border border-sky-400/35'
                  : 'text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
            >
              <Users className="w-4 h-4 shrink-0" />
              <span>{isEn ? 'Online P2P' : 'Online Oda'}</span>
            </button>
          </div>

          <p className="text-[11px] text-slate-400 text-center">
            {selectedMode === 'OFFLINE'
              ? hasSavedProgress
                ? isEn
                  ? 'Resume your saved open-world voyage.'
                  : 'Kayıtlı açık dünya seferine devam et.'
                : isEn
                ? 'Explore procedural islands at your own pace.'
                : 'Prosedürel adalarda kendi hızında keşfe çık.'
              : inviteRoomCode
              ? isEn
                ? `Room invite ready: ${inviteRoomCode}`
                : `Oda davet kodu hazır: ${inviteRoomCode}`
              : isEn
              ? 'Co-op or PvP rooms with built-in voice chat.'
              : 'Dahili sesli sohbetle Co-op veya PvP oyna.'}
          </p>

          <button
            type="button"
            onClick={handlePrimaryLaunch}
            className={`w-full min-h-[52px] px-5 rounded-xl font-display font-bold text-sm flex items-center justify-center gap-2 transition-transform active:scale-[0.985] cursor-pointer ${
              selectedMode === 'ONLINE'
                ? 'bg-sky-400 hover:bg-sky-300 text-slate-950'
                : 'bg-amber-400 hover:bg-amber-300 text-slate-950'
            }`}
          >
            {selectedMode === 'ONLINE' ? (
              <Globe className="w-4 h-4 shrink-0" />
            ) : (
              <Play className="w-4 h-4 fill-current shrink-0" />
            )}
            <span>{launchCtaLabel}</span>
          </button>
        </section>
      </div>
    );
  }

  // 2. MOBILE LANDSCAPE: Compact Side-by-Side Split (Zero vertical clipping)
  if (profile === 'mobile-landscape') {
    return (
      <div className="fixed inset-0 z-30 bg-[#061017]/75 select-none overflow-y-auto px-4 pt-[max(0.5rem,env(safe-area-inset-top))] pb-[max(0.625rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]">
        {backdrop}
        <div className="relative z-10 w-full max-w-5xl mx-auto min-h-full flex flex-col justify-between gap-2">
          {utilityBar}

          <div className="flex-1 min-h-0 grid grid-cols-12 items-center gap-5">
            <section className="col-span-6 space-y-2.5 min-w-0">
              <h1 className="font-display text-2xl font-extrabold text-slate-50 tracking-tight leading-tight">
                {isEn ? 'Tropical Island:' : 'Tropik Ada:'}{' '}
                <span className="text-amber-400">
                  {isEn ? 'Treasure Hunt' : 'Hazine Avı'}
                </span>
              </h1>
              <p className="text-xs text-slate-300 leading-relaxed line-clamp-2">
                {isEn
                  ? 'Scan buried chests with hot-cold radar, raid ancient caves, and build your fleet.'
                  : 'Sıcak-soğuk radarıyla gömülü hazineleri bul, mağaralara dal ve filonu kur.'}
              </p>

              {hasSavedProgress && (
                <div className="grid grid-cols-4 gap-2 pt-2 border-t border-white/[0.1]">
                  <div>
                    <div className="text-[10px] text-slate-400">{isEn ? 'Gold' : 'Altın'}</div>
                    <div className="font-mono-num text-xs font-bold text-amber-300">
                      {savedGold.toLocaleString(isEn ? 'en-US' : 'tr-TR')}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400">{isEn ? 'Islands' : 'Ada'}</div>
                    <div className="font-mono-num text-xs font-bold text-slate-100">
                      {discoveredCount}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400">{isEn ? 'Chests' : 'Hazine'}</div>
                    <div className="font-mono-num text-xs font-bold text-emerald-300">
                      {treasuresFoundCount}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400">{isEn ? 'Ship' : 'Gemi'}</div>
                    <div className="font-mono-num text-xs font-bold text-slate-100">
                      {isEn ? `Lv.${boatLevel}` : `Sv.${boatLevel}`}
                    </div>
                  </div>
                </div>
              )}
            </section>

            <section className="col-span-6 rounded-xl bg-[#0A1720]/90 backdrop-blur-xl border border-white/10 p-3 space-y-2.5">
              <div className="divide-y divide-white/[0.08] rounded-lg border border-white/[0.08] bg-[#061017]/65 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setSelectedMode('OFFLINE')}
                  className={`w-full px-3 py-2 flex items-center justify-between gap-2 text-left cursor-pointer transition-colors ${
                    selectedMode === 'OFFLINE' ? 'bg-amber-400/12' : 'hover:bg-white/[0.04]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Ship
                      className={`w-4 h-4 shrink-0 ${
                        selectedMode === 'OFFLINE' ? 'text-amber-400' : 'text-slate-400'
                      }`}
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-100 truncate">
                        {isEn ? 'Offline Expedition' : 'Offline Sefer'}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate">
                        {isEn ? 'Single player open world' : 'Tek kişilik açık dünya'}
                      </div>
                    </div>
                  </div>
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      selectedMode === 'OFFLINE' ? 'bg-amber-400' : 'bg-white/15'
                    }`}
                  />
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedMode('ONLINE')}
                  className={`w-full px-3 py-2 flex items-center justify-between gap-2 text-left cursor-pointer transition-colors ${
                    selectedMode === 'ONLINE' ? 'bg-sky-400/12' : 'hover:bg-white/[0.04]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Users
                      className={`w-4 h-4 shrink-0 ${
                        selectedMode === 'ONLINE' ? 'text-sky-400' : 'text-slate-400'
                      }`}
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-100 truncate">
                        {isEn ? 'Online Room (P2P)' : 'Online Oda (P2P)'}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate">
                        {inviteRoomCode
                          ? `Kod: ${inviteRoomCode}`
                          : isEn
                          ? 'Co-op / PvP + Voice'
                          : 'Co-op / PvP + Sesli Sohbet'}
                      </div>
                    </div>
                  </div>
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      selectedMode === 'ONLINE' ? 'bg-sky-400' : 'bg-white/15'
                    }`}
                  />
                </button>
              </div>

              <button
                type="button"
                onClick={handlePrimaryLaunch}
                className={`w-full min-h-[44px] px-4 rounded-lg font-display font-bold text-xs flex items-center justify-center gap-2 transition-transform active:scale-[0.985] cursor-pointer ${
                  selectedMode === 'ONLINE'
                    ? 'bg-sky-400 hover:bg-sky-300 text-slate-950'
                    : 'bg-amber-400 hover:bg-amber-300 text-slate-950'
                }`}
              >
                {selectedMode === 'ONLINE' ? (
                  <Globe className="w-4 h-4 shrink-0" />
                ) : (
                  <Play className="w-4 h-4 fill-current shrink-0" />
                )}
                <span>{launchCtaLabel}</span>
              </button>
            </section>
          </div>
        </div>
      </div>
    );
  }

  // 3. TABLET & DESKTOP: Widescreen Editorial Command Screen
  const isTablet = profile === 'tablet';
  const isTabletPortrait = isTablet && isPortrait;

  return (
    <div className="fixed inset-0 z-30 overflow-y-auto bg-[#061017]/68 select-none">
      {backdrop}

      <div className="relative z-10 min-h-full w-full max-w-6xl mx-auto px-6 lg:px-10 py-6 lg:py-8 flex flex-col justify-between gap-6">
        {utilityBar}

        <main
          className={
            isTabletPortrait
              ? 'flex-1 min-h-0 flex flex-col justify-center gap-6 max-w-2xl w-full mx-auto py-2'
              : 'flex-1 min-h-0 grid grid-cols-12 items-center gap-8 lg:gap-12 py-2'
          }
        >
          {/* Left Editorial Showcase */}
          <section className={`${isTabletPortrait ? '' : 'col-span-7'} space-y-5 min-w-0`}>
            <div className="space-y-2.5">
              <h1
                className={`font-display ${
                  isTablet ? 'text-3xl lg:text-4xl' : 'text-4xl lg:text-5xl'
                } font-extrabold text-slate-50 tracking-tight leading-[1.08] text-balance`}
              >
                {isEn ? 'Tropical Island:' : 'Tropik Ada:'}{' '}
                <span className="text-amber-400">
                  {isEn ? 'Treasure Hunt' : 'Hazine Avı'}
                </span>
              </h1>
              <p className="text-sm lg:text-base text-slate-300 max-w-xl leading-relaxed">
                {isEn
                  ? 'Scan buried chests with the hot-cold radar, raid ancient caves, upgrade your vessel, and command uncharted islands.'
                  : 'Sıcak-soğuk radarıyla gömülü hazineleri tara, antik mağaralara dal, gemini geliştir ve keşfedilmemiş adalarda hüküm sür.'}
              </p>
            </div>

            {/* Clean Framed Keyart */}
            <div className="relative rounded-xl overflow-hidden border border-white/10 bg-[#08131B] shadow-[0_24px_60px_rgba(0,0,0,0.55)]">
              {!keyartError ? (
                <img
                  src={KEYART_IMAGE_SRC}
                  alt={
                    isEn
                      ? 'Tropical treasure island cove with pirate ship'
                      : 'Tropik hazine adası koyu ve korsan gemisi'
                  }
                  referrerPolicy="no-referrer"
                  onError={() => setKeyartError(true)}
                  className={`w-full ${isTablet ? 'h-44' : 'h-52 lg:h-60'} object-cover`}
                />
              ) : (
                <div className="w-full h-52 bg-gradient-to-br from-[#0D2B3D] to-[#061017] flex items-center justify-center">
                  <Ship className="w-12 h-12 text-amber-400/50" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-[#061017]/95 via-[#061017]/20 to-transparent" />
              <div className="absolute bottom-0 inset-x-0 px-4 py-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-slate-200">
                <span className="flex items-center gap-1.5 font-medium whitespace-nowrap">
                  <Compass className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                  {isEn ? 'Hot-Cold Radar' : 'Hazine Radarı'}
                </span>
                <span className="flex items-center gap-1.5 font-medium whitespace-nowrap">
                  <Pickaxe className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  {isEn ? 'Caves & Relics' : 'Kazı & Mağaralar'}
                </span>
                <span className="flex items-center gap-1.5 font-medium whitespace-nowrap">
                  <Crown className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  {isEn ? 'Fleet & Kingdom' : 'Filo & Krallık'}
                </span>
              </div>
            </div>

            {hasSavedProgress && (
              <div className="grid grid-cols-4 gap-4 pt-3 border-t border-white/[0.08]">
                <div>
                  <div className="text-[11px] text-slate-400">{isEn ? 'Gold' : 'Altın'}</div>
                  <div className="font-mono-num text-base font-bold text-amber-300 mt-0.5">
                    {savedGold.toLocaleString(isEn ? 'en-US' : 'tr-TR')}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-400">{isEn ? 'Islands' : 'Adalar'}</div>
                  <div className="font-mono-num text-base font-bold text-slate-100 mt-0.5">
                    {discoveredCount}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-400">{isEn ? 'Treasures' : 'Hazine'}</div>
                  <div className="font-mono-num text-base font-bold text-emerald-300 mt-0.5">
                    {treasuresFoundCount}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-400">{isEn ? 'Ship' : 'Gemi'}</div>
                  <div className="font-mono-num text-base font-bold text-slate-100 mt-0.5">
                    {isEn ? `Lv.${boatLevel}` : `Sv.${boatLevel}`}
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Right Mode Command Panel */}
          <section
            className={`${
              isTabletPortrait ? '' : 'col-span-5'
            } rounded-2xl bg-[#0A1720]/90 backdrop-blur-xl border border-white/10 p-6 space-y-5 shadow-[0_24px_64px_rgba(0,0,0,0.6)]`}
          >
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3.5">
              <h2 className="font-display text-base font-bold text-slate-100">
                {isEn ? 'Select Expedition' : 'Sefer Modu'}
              </h2>
              <span className="text-xs text-slate-400">
                {selectedMode === 'OFFLINE'
                  ? isEn
                    ? 'Single Player'
                    : 'Tek Oyunculu'
                  : isEn
                  ? 'Multiplayer P2P'
                  : 'Çok Oyunculu'}
              </span>
            </div>

            <div className="divide-y divide-white/[0.08] rounded-xl border border-white/[0.08] bg-[#061017]/60 overflow-hidden">
              <button
                type="button"
                onClick={() => setSelectedMode('OFFLINE')}
                aria-pressed={selectedMode === 'OFFLINE'}
                className={`w-full min-h-[68px] px-4 py-3.5 text-left flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                  selectedMode === 'OFFLINE' ? 'bg-amber-400/10' : 'hover:bg-white/[0.03]'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                      selectedMode === 'OFFLINE'
                        ? 'bg-amber-400 text-slate-950'
                        : 'bg-white/[0.06] text-slate-300'
                    }`}
                  >
                    <Ship className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-display text-sm font-bold text-slate-50 truncate">
                      {isEn ? 'Offline Expedition' : 'Offline Sefer'}
                    </div>
                    <div className="text-xs text-slate-400 truncate mt-0.5">
                      {hasSavedProgress
                        ? isEn
                          ? 'Resume saved world & progress'
                          : 'Kayıtlı dünyana devam et'
                        : isEn
                        ? 'Solo open-world survival'
                        : 'Tek kişilik açık dünya'}
                    </div>
                  </div>
                </div>
                <span
                  className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                    selectedMode === 'OFFLINE' ? 'bg-amber-400' : 'border border-white/25'
                  }`}
                />
              </button>

              <button
                type="button"
                onClick={() => setSelectedMode('ONLINE')}
                aria-pressed={selectedMode === 'ONLINE'}
                className={`w-full min-h-[68px] px-4 py-3.5 text-left flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                  selectedMode === 'ONLINE' ? 'bg-sky-400/10' : 'hover:bg-white/[0.03]'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                      selectedMode === 'ONLINE'
                        ? 'bg-sky-400 text-slate-950'
                        : 'bg-white/[0.06] text-slate-300'
                    }`}
                  >
                    <Users className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-display text-sm font-bold text-slate-50 truncate">
                      {isEn ? 'Online Room (P2P)' : 'Online Oda'}
                    </div>
                    <div className="text-xs text-slate-400 truncate mt-0.5">
                      {inviteRoomCode
                        ? isEn
                          ? `Invite code: ${inviteRoomCode}`
                          : `Davet kodu: ${inviteRoomCode}`
                        : isEn
                        ? 'Co-op & PvP · Built-in voice chat'
                        : 'Co-op / PvP · Dahili sesli sohbet'}
                    </div>
                  </div>
                </div>
                <span
                  className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                    selectedMode === 'ONLINE' ? 'bg-sky-400' : 'border border-white/25'
                  }`}
                />
              </button>
            </div>

            <button
              type="button"
              onClick={handlePrimaryLaunch}
              className={`w-full min-h-[52px] px-5 py-3 rounded-xl font-display font-bold text-sm lg:text-base flex items-center justify-center gap-2.5 transition-all active:scale-[0.985] cursor-pointer whitespace-nowrap ${
                selectedMode === 'ONLINE'
                  ? 'bg-sky-400 hover:bg-sky-300 text-slate-950'
                  : 'bg-amber-400 hover:bg-amber-300 text-slate-950'
              }`}
            >
              {selectedMode === 'ONLINE' ? (
                <Globe className="w-5 h-5 shrink-0" />
              ) : (
                <Play className="w-5 h-5 fill-current shrink-0" />
              )}
              <span>{launchCtaLabel}</span>
            </button>

            <div className="pt-1 flex items-center justify-between text-[11px] text-slate-500">
              <span>{isEn ? 'Procedural Archipelago' : 'Prosedürel Takımadalar'}</span>
              <span className="flex items-center gap-1">
                <Anchor className="w-3 h-3" />
                {isEn ? 'Local + P2P Saves' : 'Yerel + P2P Kayıt'}
              </span>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
};
