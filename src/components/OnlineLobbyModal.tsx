import React, { useEffect, useRef, useState } from 'react';
import {
  Anchor,
  ArrowLeft,
  Check,
  Compass,
  Copy,
  Crown,
  Download,
  Globe,
  Link2,
  Mic,
  Play,
  RefreshCw,
  Shield,
  Swords,
  Trash2,
  Upload,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import {
  OnlineConnectionStatus,
  OnlineModeRule,
  OnlineRoomInfo,
  PlayerIdentity,
  RemotePlayerSnapshot,
  RoomLedger,
  StarterSlot,
} from '../types/online';
import { PLAYER_BANNER_OPTIONS } from '../engine/factions';
import {
  deleteRoomLedger,
  exportRoomLedgerJson,
  listRoomLedgers,
  parseImportedRoomLedger,
  saveRoomLedger,
} from '../engine/onlineStorage';

const CREST_IMAGE_SRC = '/src/assets/images/pirate_compass_crest_1795020662166.jpg';
const KEYART_IMAGE_SRC = '/src/assets/images/tropical_cove_keyart_1795020662703.jpg';

interface OnlineLobbyModalProps {
  identity: PlayerIdentity;
  onUpdateIdentity: (next: PlayerIdentity) => void;
  status: OnlineConnectionStatus;
  errorMsg: string | null;
  role: 'HOST' | 'CLIENT' | null;
  roomInfo: OnlineRoomInfo | null;
  players: RemotePlayerSnapshot[];
  starterSlots: StarterSlot[];
  initialRoomCode?: string;
  language?: 'tr' | 'en';
  onCreateRoom: (rule: OnlineModeRule, resumeRoomId?: string) => void;
  onJoinRoom: (roomCode: string) => void;
  onHostStartGame: () => void;
  onHostChangeRule: (rule: OnlineModeRule) => void;
  onDisconnect: () => void;
  onClose: () => void;
}

export const OnlineLobbyModal: React.FC<OnlineLobbyModalProps> = ({
  identity,
  onUpdateIdentity,
  status,
  errorMsg,
  role,
  roomInfo,
  players,
  starterSlots,
  initialRoomCode = '',
  language = 'tr',
  onCreateRoom,
  onJoinRoom,
  onHostStartGame,
  onHostChangeRule,
  onDisconnect,
  onClose,
}) => {
  const isEn = language === 'en';
  const [tab, setTab] = useState<'HOST' | 'JOIN'>(initialRoomCode ? 'JOIN' : 'HOST');
  const [selectedRule, setSelectedRule] = useState<OnlineModeRule>('PVP');
  const [joinCode, setJoinCode] = useState(initialRoomCode);
  const [savedRooms, setSavedRooms] = useState<RoomLedger[]>([]);
  const [copiedKind, setCopiedKind] = useState<'CODE' | 'LINK' | null>(null);
  const [importNotice, setImportNotice] = useState<string | null>(null);
  const [crestError, setCrestError] = useState(false);
  const [keyartError, setKeyartError] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const copyTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  const refreshSavedRooms = async () => {
    const rooms = await listRoomLedgers();
    setSavedRooms(rooms);
  };

  useEffect(() => {
    void refreshSavedRooms();
  }, [status]);

  const copyText = async (text: string, kind: 'CODE' | 'LINK') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKind(kind);
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
      }
      copyTimerRef.current = window.setTimeout(() => {
        setCopiedKind(null);
        copyTimerRef.current = null;
      }, 1800);
    } catch {
      // Clipboard blocked in some contexts; ignore cleanly
    }
  };

  const handleExportRoom = (ledger: RoomLedger) => {
    const json = exportRoomLedgerJson(ledger);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tropik-ada-oda-${ledger.roomInfo.roomId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = parseImportedRoomLedger(text);
      if (!parsed) {
        setImportNotice(isEn ? 'Invalid room ledger file.' : 'Geçersiz oda kayıt dosyası.');
        return;
      }
      await saveRoomLedger(parsed);
      await refreshSavedRooms();
      setImportNotice(
        isEn
          ? `Room ${parsed.roomInfo.roomId} imported.`
          : `Oda ${parsed.roomInfo.roomId} içe aktarıldı.`
      );
    } catch {
      setImportNotice(isEn ? 'Could not read file.' : 'Dosya okunamadı.');
    } finally {
      e.target.value = '';
    }
  };

  const isInLobbyOrConnecting =
    status === 'CONNECTING' || status === 'LOBBY' || status === 'RECONNECTING';

  const inviteUrl =
    roomInfo && typeof window !== 'undefined'
      ? `${window.location.origin}${window.location.pathname}?room=${roomInfo.roomId}`
      : '';

  const selectedBanner =
    PLAYER_BANNER_OPTIONS.find((opt) => opt.color === identity.bannerColor) ??
    PLAYER_BANNER_OPTIONS[0];

  const handleExitLobby = () => {
    if (isInLobbyOrConnecting) onDisconnect();
    onClose();
  };

  const emptySquadSlots = Math.max(0, 4 - players.length);

  return (
    <div
      className="fixed inset-0 z-50 bg-[#041824]/92 backdrop-blur-md overflow-hidden select-none"
      role="dialog"
      aria-modal="true"
      aria-label={isEn ? 'Online P2P Lobby' : 'Online P2P Oda Lobisi'}
    >
      {/* Atmospheric Backdrop Keyart */}
      {!keyartError && (
        <img
          src={KEYART_IMAGE_SRC}
          alt=""
          aria-hidden="true"
          referrerPolicy="no-referrer"
          onError={() => setKeyartError(true)}
          className="pointer-events-none fixed inset-0 w-full h-full object-cover opacity-20"
        />
      )}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 bg-gradient-to-b from-[#041824]/90 via-[#062233]/75 to-[#03121b]/95"
      />

      {/* Full-Viewport Container (scrolls on portrait & short landscape phones, single-screen cockpit when >=600x520) */}
      <div className="relative z-10 h-full w-full max-w-6xl mx-auto pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] sm:pl-[max(1.25rem,env(safe-area-inset-left))] sm:pr-[max(1.25rem,env(safe-area-inset-right))] lg:px-8 pt-[max(0.5rem,env(safe-area-inset-top))] pb-[max(0.625rem,env(safe-area-inset-bottom))] flex flex-col gap-2 sm:gap-3 overflow-y-auto [@media(min-width:600px)_and_(min-height:520px)]:overflow-hidden">
        {/* Compact Top Navigation Header */}
        <header className="h-11 sm:h-12 shrink-0 flex items-center justify-between gap-3 border-b border-white/10 pb-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              type="button"
              onClick={handleExitLobby}
              className="h-9 px-2.5 sm:px-3 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 text-slate-100 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 focus-visible:outline-2 focus-visible:outline-amber-400"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">{isEn ? 'Main Menu' : 'Ana Menü'}</span>
            </button>

            <div className="flex items-center gap-2 min-w-0">
              <Globe className="w-4 h-4 sm:w-5 sm:h-5 text-sky-300 shrink-0" />
              <h2 className="font-display text-sm sm:text-lg font-bold text-slate-50 truncate">
                {isEn ? 'Online P2P Lobby' : 'Online P2P Oda Lobisi'}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="hidden md:inline text-xs text-slate-400 font-medium">
              {isEn ? 'Serverless WebRTC P2P' : 'Sunucusuz WebRTC P2P'}
            </span>
            <button
              type="button"
              onClick={handleExitLobby}
              aria-label={isEn ? 'Close Lobby' : 'Lobiyi Kapat'}
              className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-slate-100 flex items-center justify-center transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-400"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Compact Error Bar (when present) */}
        {errorMsg && (
          <div className="shrink-0 px-3 py-2 rounded-xl bg-red-950/75 border border-red-400/45 text-xs text-red-100 flex items-center justify-between gap-2">
            <span className="truncate">{errorMsg}</span>
            {status === 'ERROR' && (
              <button
                type="button"
                onClick={onDisconnect}
                className="px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-slate-50 font-semibold whitespace-nowrap cursor-pointer shrink-0"
              >
                {isEn ? 'Reset' : 'Sıfırla'}
              </button>
            )}
          </div>
        )}

        {/* STATE 1: Active Waiting Room Lobby */}
        {isInLobbyOrConnecting && roomInfo ? (
          <div className="flex-1 min-h-0 grid grid-cols-1 [@media(min-width:600px)]:grid-cols-12 gap-2.5 sm:gap-4">
            {/* Left Zone: Room Spotlight, Rules & Start Action */}
            <section className="[@media(min-width:600px)]:col-span-5 flex flex-col justify-between gap-2.5 bg-[#09202E]/90 border border-white/15 rounded-2xl p-3 sm:p-4 shadow-2xl min-h-0">
              <div className="flex flex-col gap-2.5 sm:gap-3">
                {/* Room Code Card */}
                <div className="p-3 rounded-xl bg-slate-950/50 border border-amber-400/25 flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2 text-[11px] text-slate-400">
                    <span>
                      {role === 'HOST'
                        ? isEn
                          ? 'You are Host'
                          : 'Kurucu Sensin'
                        : isEn
                        ? `Host: ${roomInfo.hostName}`
                        : `Kurucu: ${roomInfo.hostName}`}
                    </span>
                    <span className="text-emerald-300 font-semibold">
                      {isEn ? 'Room Ready' : 'Oda Hazır'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono-num text-2xl sm:text-3xl font-extrabold tracking-widest text-amber-300">
                      {roomInfo.roomId}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => void copyText(roomInfo.roomId, 'CODE')}
                        className="h-9 px-2.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/15 text-xs font-semibold text-slate-100 flex items-center gap-1.5 cursor-pointer"
                      >
                        {copiedKind === 'CODE' ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5 text-slate-300" />
                        )}
                        <span>{copiedKind === 'CODE' ? (isEn ? 'Copied' : 'Kopyalandı') : isEn ? 'Code' : 'Kod'}</span>
                      </button>

                      {inviteUrl && (
                        <button
                          type="button"
                          onClick={() => void copyText(inviteUrl, 'LINK')}
                          className="h-9 px-2.5 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/35 text-xs font-semibold text-sky-200 flex items-center gap-1.5 cursor-pointer"
                        >
                          {copiedKind === 'LINK' ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Link2 className="w-3.5 h-3.5 text-sky-300" />
                          )}
                          <span>{copiedKind === 'LINK' ? (isEn ? 'Copied' : 'Alındı') : isEn ? 'Link' : 'Link'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Rule Switcher */}
                <div className="p-3 rounded-xl bg-slate-950/35 border border-white/10 flex flex-col gap-2">
                  <div className="flex items-center justify-between text-xs text-slate-300">
                    <span className="font-semibold">{isEn ? 'Match Mode' : 'Oyun Kuralı'}</span>
                    <span className="text-[11px] text-slate-400">
                      {isEn ? 'Equal Starter Islands' : 'Eşit Başlangıç Adaları'}
                    </span>
                  </div>

                  {role === 'HOST' ? (
                    <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-slate-950/60 border border-white/10">
                      <button
                        type="button"
                        onClick={() => onHostChangeRule('COOP')}
                        className={`h-9 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                          roomInfo.rule === 'COOP'
                            ? 'bg-emerald-500 text-slate-950'
                            : 'text-slate-300 hover:text-white'
                        }`}
                      >
                        <Shield className="w-3.5 h-3.5" />
                        <span>{isEn ? 'Co-op Team' : 'Co-op Takım'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onHostChangeRule('PVP')}
                        className={`h-9 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                          roomInfo.rule === 'PVP'
                            ? 'bg-red-500 text-slate-950'
                            : 'text-slate-300 hover:text-white'
                        }`}
                      >
                        <Swords className="w-3.5 h-3.5" />
                        <span>{isEn ? 'PvP War' : 'PvP Savaş'}</span>
                      </button>
                    </div>
                  ) : (
                    <div className="h-9 px-3 rounded-lg bg-slate-900/70 border border-white/10 flex items-center gap-2 text-xs font-semibold text-amber-300">
                      {roomInfo.rule === 'COOP' ? (
                        <Shield className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Swords className="w-4 h-4 text-red-400" />
                      )}
                      <span>
                        {roomInfo.rule === 'COOP'
                          ? isEn
                            ? 'Co-op Team (Friendly Fire Off)'
                            : 'Ortak Takım (Co-op)'
                          : isEn
                          ? 'PvP Kingdom War'
                          : 'PvP Devlet Savaşı'}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Footer */}
              <div className="flex items-center gap-2 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={onDisconnect}
                  className="h-11 px-3.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold text-slate-200 whitespace-nowrap cursor-pointer"
                >
                  {isEn ? 'Leave' : 'Ayrıl'}
                </button>

                {role === 'HOST' ? (
                  <button
                    type="button"
                    onClick={onHostStartGame}
                    className="flex-1 h-11 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-display text-sm font-extrabold flex items-center justify-center gap-2 shadow-lg whitespace-nowrap cursor-pointer transition-transform active:scale-[0.98]"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>{isEn ? 'Set Sail (Start)' : 'Denize Açıl (Başlat)'}</span>
                  </button>
                ) : (
                  <div className="flex-1 h-11 px-3 rounded-xl bg-sky-950/50 border border-sky-400/25 text-xs text-sky-200 flex items-center justify-center gap-2">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-sky-300 shrink-0" />
                    <span className="truncate">
                      {isEn ? 'Waiting for host to launch...' : 'Kurucunun başlatması bekleniyor...'}
                    </span>
                  </div>
                )}
              </div>
            </section>

            {/* Right Zone: Squad Roster */}
            <section className="[@media(min-width:600px)]:col-span-7 flex flex-col min-h-0 bg-[#09202E]/90 border border-white/15 rounded-2xl p-3 sm:p-4 shadow-2xl">
              <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-white/10 shrink-0">
                <span className="text-xs sm:text-sm font-bold text-slate-100 flex items-center gap-2">
                  <Users className="w-4 h-4 text-emerald-300" />
                  {isEn ? 'Connected Captains' : 'Bağlı Kaptanlar'} ({players.filter((p) => p.connected).length})
                </span>
                <span className="font-mono-num text-[11px] sm:text-xs text-slate-400">
                  {starterSlots.length} {isEn ? 'Islands Ready' : 'Ada Hazır'}
                </span>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto pt-2.5 grid grid-cols-1 sm:grid-cols-2 gap-2.5 content-start">
                {players.map((p) => (
                  <div
                    key={p.id}
                    className="p-3 rounded-xl bg-slate-950/45 border border-white/12 flex items-center justify-between gap-2.5"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className="w-9 h-9 rounded-xl border-2 flex items-center justify-center shrink-0 bg-slate-900"
                        style={{ borderColor: p.bannerColor }}
                      >
                        {p.isHost ? (
                          <Crown className="w-4 h-4 text-amber-300" />
                        ) : (
                          <Anchor className="w-4 h-4" style={{ color: p.bannerColor }} />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-slate-100 truncate">{p.name}</div>
                        <div className="text-[11px] text-slate-400">
                          {p.isHost ? (isEn ? 'Host' : 'Kurucu') : isEn ? 'Captain' : 'Kaptan'} ·{' '}
                          {isEn ? `Island #${p.starterSlotIndex + 1}` : `Ada #${p.starterSlotIndex + 1}`}
                        </div>
                      </div>
                    </div>
                    <span
                      className={`text-[11px] font-semibold whitespace-nowrap ${
                        p.connected ? 'text-emerald-300' : 'text-slate-500'
                      }`}
                    >
                      {p.connected ? (isEn ? 'Ready' : 'Hazır') : isEn ? 'Offline' : 'Çevrimdışı'}
                    </span>
                  </div>
                ))}

                {Array.from({ length: emptySquadSlots }).map((_, idx) => (
                  <div
                    key={`empty-slot-${idx}`}
                    className="p-3 rounded-xl border border-dashed border-white/10 bg-slate-950/20 flex items-center gap-2.5 text-slate-500"
                  >
                    <div className="w-9 h-9 rounded-xl border border-dashed border-white/10 flex items-center justify-center shrink-0">
                      <UserPlus className="w-4 h-4 text-slate-600" />
                    </div>
                    <div className="text-xs">
                      {isEn ? 'Open Captain Slot' : 'Boş Kaptan Slotu'}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        ) : status === 'CONNECTING' ? (
          /* STATE 2: Connecting Screen */
          <div className="flex-1 min-h-0 flex items-center justify-center">
            <div className="w-full max-w-md p-6 rounded-2xl bg-[#09202E]/90 border border-white/15 shadow-2xl flex flex-col items-center text-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-400/35 flex items-center justify-center">
                <RefreshCw className="w-7 h-7 animate-spin text-amber-300" />
              </div>
              <div className="font-display text-base font-bold text-slate-100">
                {isEn ? 'Establishing P2P Connection...' : 'P2P Bağlantısı Kuruluyor...'}
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                {isEn
                  ? 'Opening direct WebRTC channel between browsers. Initial handshake may take a few seconds.'
                  : 'Tarayıcılar arası doğrudan WebRTC kanalı açılıyor. İlk bağlantı birkaç saniye sürebilir.'}
              </p>
              <button
                type="button"
                onClick={onDisconnect}
                className="mt-1 h-10 px-5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold text-slate-100 cursor-pointer"
              >
                {isEn ? 'Cancel' : 'İptal Et'}
              </button>
            </div>
          </div>
        ) : (
          /* STATE 3: Single-Screen Setup Cockpit (No Outer Scroll!) */
          <div className="flex-1 min-h-0 grid grid-cols-1 [@media(min-width:600px)]:grid-cols-12 gap-2.5 sm:gap-4">
            {/* Left Column: Captain Identity Card */}
            <section className="[@media(min-width:600px)]:col-span-5 flex flex-col justify-between gap-2.5 bg-[#09202E]/90 border border-white/15 rounded-2xl p-3 sm:p-4 shadow-2xl shrink-0 [@media(min-width:600px)]:shrink">
              <div className="flex flex-col gap-2 sm:gap-3.5">
                {/* Captain Profile Header Preview (shown on landscape/tablet/desktop) */}
                <div className="hidden [@media(min-width:600px)]:flex items-center gap-3">
                  <div
                    className="w-11 h-11 sm:w-14 sm:h-14 rounded-xl overflow-hidden border-2 bg-[#061822] shrink-0 flex items-center justify-center shadow-lg"
                    style={{ borderColor: identity.bannerColor }}
                  >
                    {!crestError ? (
                      <img
                        src={CREST_IMAGE_SRC}
                        alt={isEn ? 'Captain crest' : 'Kaptan arması'}
                        referrerPolicy="no-referrer"
                        onError={() => setCrestError(true)}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Compass className="w-6 h-6 text-amber-300" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] text-slate-400 font-medium">
                      {isEn ? 'Captain Profile' : 'Kaptan Kimliği'}
                    </div>
                    <div className="font-display text-sm sm:text-base font-bold text-slate-50 truncate">
                      {identity.name.trim() || (isEn ? 'Unnamed Captain' : 'İsimsiz Kaptan')}
                    </div>
                    <div className="text-[11px] font-semibold" style={{ color: selectedBanner.color }}>
                      {selectedBanner.name}
                    </div>
                  </div>
                </div>

                {/* Captain Name & Banner Swatches */}
                <div className="grid grid-cols-12 [@media(min-width:600px)]:grid-cols-1 gap-2 sm:gap-2.5">
                  <div className="col-span-7 [@media(min-width:600px)]:col-span-1 flex flex-col gap-1">
                    <label
                      htmlFor="captain-name"
                      className="text-[11px] sm:text-xs font-semibold text-slate-300"
                    >
                      {isEn ? 'Captain Name' : 'Kaptan Adın'}
                    </label>
                    <input
                      id="captain-name"
                      type="text"
                      maxLength={20}
                      value={identity.name}
                      onChange={(e) => onUpdateIdentity({ ...identity, name: e.target.value })}
                      placeholder={isEn ? 'e.g. Captain Jack' : 'Örn. Kaptan Ege'}
                      className="h-9 sm:h-10 px-3 rounded-xl bg-slate-950/75 border border-white/15 text-sm text-slate-50 focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div className="col-span-5 [@media(min-width:600px)]:col-span-1 flex flex-col gap-1">
                    <span className="text-[11px] sm:text-xs font-semibold text-slate-300 truncate">
                      {isEn ? 'Banner' : 'Sancak Rengi'}
                    </span>
                    <div className="grid grid-cols-4 gap-1.5 sm:gap-2 h-9 sm:h-10">
                      {PLAYER_BANNER_OPTIONS.map((opt) => {
                        const active = identity.bannerColor === opt.color;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => onUpdateIdentity({ ...identity, bannerColor: opt.color })}
                            title={opt.name}
                            aria-label={opt.name}
                            aria-pressed={active}
                            className={`rounded-xl border flex items-center justify-center cursor-pointer transition-all ${
                              active
                                ? 'bg-white/20 border-white shadow'
                                : 'bg-slate-950/60 border-white/10 hover:bg-white/10'
                            }`}
                          >
                            <span
                              className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full border border-white/30"
                              style={{ backgroundColor: opt.color }}
                            />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Feature Summary (visible on taller screens) */}
              <div className="hidden [@media(min-height:540px)]:flex flex-col gap-1.5 pt-2.5 border-t border-white/10 text-xs text-slate-300">
                <div className="flex items-center gap-2">
                  <Anchor className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                  <span>{isEn ? 'Equal starter island per captain' : 'Her kaptana eşit başlangıç adası'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mic className="w-3.5 h-3.5 text-sky-300 shrink-0" />
                  <span>{isEn ? 'Built-in WebRTC voice & quick chat' : 'Dahili sesli sohbet ve hızlı ifade'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Globe className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
                  <span>{isEn ? 'Host auto-saves all crew progress' : 'Kurucu tüm ekip gelişimini otomatik kaydeder'}</span>
                </div>
              </div>
            </section>

            {/* Right Column: Host / Join Mode Cockpit */}
            <section className="[@media(min-width:600px)]:col-span-7 flex flex-col min-h-0 gap-2 sm:gap-3 bg-[#09202E]/90 border border-white/15 rounded-2xl p-3 sm:p-4 shadow-2xl">
              {/* Segmented Host / Join Switcher */}
              <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-slate-950/60 border border-white/10 shrink-0">
                <button
                  type="button"
                  onClick={() => setTab('HOST')}
                  className={`h-9 sm:h-10 rounded-lg text-xs sm:text-sm font-bold transition-colors whitespace-nowrap cursor-pointer ${
                    tab === 'HOST'
                      ? 'bg-amber-500 text-slate-950 shadow'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {isEn ? 'Host Room' : 'Oda Kur'}
                </button>
                <button
                  type="button"
                  onClick={() => setTab('JOIN')}
                  className={`h-9 sm:h-10 rounded-lg text-xs sm:text-sm font-bold transition-colors whitespace-nowrap cursor-pointer ${
                    tab === 'JOIN'
                      ? 'bg-sky-400 text-slate-950 shadow'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {isEn ? 'Join with Code' : 'Odaya Katıl'}
                </button>
              </div>

              {tab === 'HOST' ? (
                <div className="flex-1 min-h-0 flex flex-col gap-2 sm:gap-3">
                  {/* Co-op vs PvP 2-Column Rule Cards */}
                  <div className="grid grid-cols-2 gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setSelectedRule('COOP')}
                      className={`p-2.5 sm:p-3 rounded-xl border text-left transition-colors cursor-pointer ${
                        selectedRule === 'COOP'
                          ? 'bg-emerald-950/60 border-emerald-400/80 shadow'
                          : 'bg-slate-950/40 border-white/10 hover:bg-white/5'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-slate-100">
                          <Shield className="w-4 h-4 text-emerald-400 shrink-0" />
                          <span className="truncate">{isEn ? 'Co-op' : 'Ortak Takım'}</span>
                        </div>
                        {selectedRule === 'COOP' && (
                          <Check className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
                        )}
                      </div>
                      <p className="mt-1 text-[11px] text-slate-300 line-clamp-2 leading-snug">
                        {isEn
                          ? 'Friendly fire off. Hunt treasures together.'
                          : 'Dost ateşi kapalı. Hazineyi birlikte avla.'}
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedRule('PVP')}
                      className={`p-2.5 sm:p-3 rounded-xl border text-left transition-colors cursor-pointer ${
                        selectedRule === 'PVP'
                          ? 'bg-red-950/55 border-red-400/80 shadow'
                          : 'bg-slate-950/40 border-white/10 hover:bg-white/5'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-slate-100">
                          <Swords className="w-4 h-4 text-red-400 shrink-0" />
                          <span className="truncate">{isEn ? 'PvP War' : 'Devlet Savaşı'}</span>
                        </div>
                        {selectedRule === 'PVP' && (
                          <Check className="w-3.5 h-3.5 text-red-300 shrink-0" />
                        )}
                      </div>
                      <p className="mt-1 text-[11px] text-slate-300 line-clamp-2 leading-snug">
                        {isEn
                          ? 'Equal islands. Build your kingdom & clash.'
                          : 'Eşit adalarda başla, denizlerde çarpış.'}
                      </p>
                    </button>
                  </div>

                  {/* Primary Create Room CTA */}
                  <button
                    type="button"
                    disabled={!identity.name.trim()}
                    onClick={() => onCreateRoom(selectedRule)}
                    className="h-10 sm:h-11 px-5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:bg-white/10 disabled:text-slate-400 text-slate-950 font-display text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-[0.98] cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <Globe className="w-4 h-4" />
                    <span>{isEn ? 'Create New Online Room' : 'Yeni Online Oda Aç'}</span>
                  </button>

                  {/* Saved Rooms Ledger (Self-contained scroll inside flex-1 box so screen never scrolls) */}
                  <div className="flex-1 min-h-0 flex flex-col gap-1.5 pt-2 border-t border-white/10">
                    <div className="flex items-center justify-between gap-2 shrink-0">
                      <span className="text-[11px] sm:text-xs font-semibold text-slate-300 truncate">
                        {isEn
                          ? `Saved Rooms (${savedRooms.length})`
                          : `Kayıtlı Odalar (${savedRooms.length})`}
                      </span>
                      <div className="shrink-0">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="application/json"
                          onChange={(e) => void handleImportFile(e)}
                          className="hidden"
                        />
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="h-7 sm:h-8 px-2.5 rounded-lg bg-white/10 hover:bg-white/20 text-[11px] font-semibold text-slate-200 flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                        >
                          <Upload className="w-3 h-3" />
                          <span>{isEn ? 'Import' : 'Kayıt Yükle'}</span>
                        </button>
                      </div>
                    </div>

                    {importNotice && (
                      <div className="text-[11px] text-sky-300 shrink-0">{importNotice}</div>
                    )}

                    <div className="flex-1 min-h-[120px] [@media(min-width:600px)_and_(min-height:520px)]:min-h-0 overflow-y-auto pr-0.5">
                      {savedRooms.length === 0 ? (
                        <div className="h-full min-h-[60px] px-3 py-2 rounded-xl bg-slate-950/35 border border-white/10 text-[11px] sm:text-xs text-slate-400 flex items-center justify-center text-center">
                          {isEn
                            ? 'No saved online rooms yet. Crew progress is saved here automatically.'
                            : 'Henüz kayıtlı oda yok. Açtığın odaların ilerlemesi burada otomatik saklanır.'}
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 gap-1.5">
                          {savedRooms.map((rm) => (
                            <div
                              key={rm.roomInfo.roomId}
                              className="p-2 sm:p-2.5 rounded-xl bg-slate-950/45 border border-white/10 flex items-center justify-between gap-2"
                            >
                              <div className="min-w-0">
                                <div className="text-xs font-bold text-slate-100 font-mono-num truncate">
                                  {isEn ? 'Room' : 'Oda'} {rm.roomInfo.roomId} ·{' '}
                                  {rm.roomInfo.rule === 'COOP' ? 'Co-op' : 'PvP'}
                                </div>
                                <div className="text-[11px] text-slate-400 truncate">
                                  {Object.keys(rm.playersById).length}{' '}
                                  {isEn ? 'Captains' : 'Kaptan'} · {rm.openedTreasureIds.length}{' '}
                                  {isEn ? 'Treasures' : 'Hazine'}
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => onCreateRoom(selectedRule, rm.roomInfo.roomId)}
                                  className="h-8 px-2.5 sm:px-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-[11px] sm:text-xs font-bold whitespace-nowrap cursor-pointer"
                                >
                                  {isEn ? 'Resume' : 'Devam Et'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleExportRoom(rm)}
                                  title={isEn ? 'Export Room' : 'Oda Kaydını İndir'}
                                  className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-slate-200 flex items-center justify-center cursor-pointer"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    await deleteRoomLedger(rm.roomInfo.roomId);
                                    await refreshSavedRooms();
                                  }}
                                  title={isEn ? 'Delete Room' : 'Oda Kaydını Sil'}
                                  className="w-8 h-8 rounded-lg bg-red-500/20 hover:bg-red-500/35 text-red-200 flex items-center justify-center cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                /* JOIN WITH CODE VIEW */
                <div className="flex-1 min-h-0 flex flex-col justify-between gap-3">
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-col gap-1.5">
                      <label
                        htmlFor="join-room-code"
                        className="text-xs font-semibold text-slate-200"
                      >
                        {isEn
                          ? '6-Character Room Code from Host'
                          : 'Kurucunun Paylaştığı 6 Haneli Oda Kodu'}
                      </label>
                      <input
                        id="join-room-code"
                        type="text"
                        maxLength={8}
                        value={joinCode}
                        onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                        placeholder="AB3K9Z"
                        className="h-12 sm:h-14 px-4 rounded-xl bg-slate-950/75 border border-white/15 font-mono-num text-xl font-extrabold tracking-[0.25em] uppercase text-amber-300 focus:outline-none focus:border-sky-400"
                      />
                    </div>

                    <div className="p-3 rounded-xl bg-slate-950/35 border border-white/10 text-xs text-slate-300 leading-relaxed">
                      {isEn
                        ? 'When you join, a balanced starter island spawns nearby on the water so every captain begins on equal footing.'
                        : 'Katıldığında sana diğer kaptanlara yakın mesafede, su üzerinde eşit şartlarda özel bir başlangıç adası açılır.'}
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={!identity.name.trim() || joinCode.trim().length < 4}
                    onClick={() => onJoinRoom(joinCode.trim().toUpperCase())}
                    className="h-11 sm:h-12 px-6 rounded-xl bg-sky-400 hover:bg-sky-300 disabled:bg-white/10 disabled:text-slate-400 text-slate-950 font-display text-sm font-extrabold flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-[0.98] cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <Users className="w-4 h-4" />
                    <span>{isEn ? 'Connect to Room' : 'Odaya Bağlan'}</span>
                  </button>
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
};
