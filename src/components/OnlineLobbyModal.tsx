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
import { usePlatformProfile } from '../utils/platform';
import crestImg from '../assets/images/pirate_compass_crest.webp';
import keyartImg from '../assets/images/tropical_cove_keyart.webp';

const CREST_IMAGE_SRC = crestImg;
const KEYART_IMAGE_SRC = keyartImg;

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
  const { profile } = usePlatformProfile();
  const isMobilePortrait = profile === 'mobile-portrait';
  const isMobileLandscape = profile === 'mobile-landscape';

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
      // Clipboard blocked in some contexts
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

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (isInLobbyOrConnecting) onDisconnect();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isInLobbyOrConnecting, onDisconnect, onClose]);

  const emptySquadSlots = Math.max(0, 4 - players.length);

  return (
    <div
      className="fixed inset-0 z-50 bg-[#061017]/94 backdrop-blur-md overflow-hidden select-none"
      role="dialog"
      aria-modal="true"
      aria-label={isEn ? 'Online P2P Lobby' : 'Online P2P Oda Lobisi'}
    >
      {!keyartError && (
        <img
          src={KEYART_IMAGE_SRC}
          alt=""
          aria-hidden="true"
          referrerPolicy="no-referrer"
          onError={() => setKeyartError(true)}
          className="pointer-events-none fixed inset-0 w-full h-full object-cover opacity-15"
        />
      )}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 bg-gradient-to-b from-[#061017]/90 via-[#061017]/75 to-[#040B11]/98"
      />

      <div
        className={`relative z-10 h-full w-full max-w-6xl mx-auto flex flex-col ${
          isMobileLandscape
            ? 'px-4 py-2 gap-2 overflow-y-auto'
            : isMobilePortrait
            ? 'px-3.5 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))] gap-3 overflow-y-auto'
            : 'px-6 lg:px-8 py-5 gap-4 overflow-hidden'
        }`}
      >
        {/* Top Bar */}
        <header className="h-11 shrink-0 flex items-center justify-between gap-3 border-b border-white/[0.08] pb-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={handleExitLobby}
              className="h-9 px-3 rounded-lg hover:bg-white/[0.07] border border-white/[0.08] text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">{isEn ? 'Main Menu' : 'Ana Menü'}</span>
            </button>

            <div className="flex items-center gap-2 min-w-0">
              <Globe className="w-4 h-4 text-sky-400 shrink-0" />
              <h2 className="font-display text-sm sm:text-base font-bold text-slate-50 truncate">
                {isEn ? 'Online P2P Lobby' : 'Online P2P Oda Lobisi'}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <span className="hidden md:inline text-[11px] text-slate-400">
              {isEn ? 'Direct WebRTC Peer Connection' : 'Doğrudan WebRTC P2P'}
            </span>
            <button
              type="button"
              onClick={handleExitLobby}
              aria-label={isEn ? 'Close Lobby' : 'Lobiyi Kapat'}
              className="w-9 h-9 rounded-lg hover:bg-white/[0.07] text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </header>

        {errorMsg && (
          <div className="shrink-0 px-3.5 py-2.5 rounded-xl bg-red-950/60 border border-red-400/35 text-xs text-red-100 flex items-center justify-between gap-3">
            <span className="truncate">{errorMsg}</span>
            {status === 'ERROR' && (
              <button
                type="button"
                onClick={onDisconnect}
                className="px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-slate-50 font-semibold whitespace-nowrap cursor-pointer shrink-0"
              >
                {isEn ? 'Reset' : 'Sıfırla'}
              </button>
            )}
          </div>
        )}

        {/* STATE 1: Active Waiting Room */}
        {isInLobbyOrConnecting && roomInfo ? (
          <div
            className={`${
              isMobilePortrait
                ? 'flex flex-col gap-3 pb-2'
                : isMobileLandscape
                ? 'flex-1 min-h-0 grid grid-cols-12 gap-3'
                : 'flex-1 min-h-0 grid grid-cols-12 gap-4'
            }`}
          >
            {/* Left Zone: Room Code, Mode & Start */}
            <section
              className={`${
                isMobilePortrait
                  ? 'shrink-0'
                  : 'col-span-5 min-h-0 overflow-y-auto'
              } rounded-2xl bg-[#0A1720]/94 border border-white/10 flex flex-col justify-between`}
            >
              <div className="divide-y divide-white/[0.08]">
                <div className={isMobileLandscape ? 'p-3 space-y-2' : 'p-4 space-y-2.5'}>
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>
                      {role === 'HOST'
                        ? isEn
                          ? 'You are Host'
                          : 'Kurucu Sensin'
                        : isEn
                        ? `Host: ${roomInfo.hostName}`
                        : `Kurucu: ${roomInfo.hostName}`}
                    </span>
                    <span className="text-emerald-400 font-semibold">
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
                        className="h-9 px-2.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-xs font-semibold text-slate-100 flex items-center gap-1.5 cursor-pointer"
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
                          className="h-9 px-2.5 rounded-lg bg-sky-400/15 hover:bg-sky-400/25 border border-sky-400/30 text-xs font-semibold text-sky-200 flex items-center gap-1.5 cursor-pointer"
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

                <div className="p-4 space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-200">
                      {isEn ? 'Match Mode' : 'Oyun Kuralı'}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {isEn ? 'Equal Starter Islands' : 'Eşit Başlangıç Adaları'}
                    </span>
                  </div>

                  {role === 'HOST' ? (
                    <div className="grid grid-cols-2 rounded-xl bg-[#061017] border border-white/[0.08] p-1 gap-1">
                      <button
                        type="button"
                        onClick={() => onHostChangeRule('COOP')}
                        className={`h-9 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                          roomInfo.rule === 'COOP'
                            ? 'bg-emerald-400 text-slate-950'
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
                            ? 'bg-red-500 text-white'
                            : 'text-slate-300 hover:text-white'
                        }`}
                      >
                        <Swords className="w-3.5 h-3.5" />
                        <span>{isEn ? 'PvP War' : 'PvP Savaş'}</span>
                      </button>
                    </div>
                  ) : (
                    <div className="py-2 flex items-center gap-2 text-xs font-semibold text-amber-300">
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

              <div className="p-4 border-t border-white/[0.08] bg-[#08131B] flex items-center gap-2">
                <button
                  type="button"
                  onClick={onDisconnect}
                  className="h-11 px-4 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-xs font-semibold text-slate-200 whitespace-nowrap cursor-pointer"
                >
                  {isEn ? 'Leave' : 'Ayrıl'}
                </button>

                {role === 'HOST' ? (
                  <button
                    type="button"
                    onClick={onHostStartGame}
                    className="flex-1 h-11 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-display text-sm font-bold flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer transition-transform active:scale-[0.985]"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>{isEn ? 'Set Sail' : 'Denize Açıl'}</span>
                  </button>
                ) : (
                  <div className="flex-1 h-11 px-3 rounded-xl bg-sky-400/10 border border-sky-400/25 text-xs text-sky-200 flex items-center justify-center gap-2">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-sky-300 shrink-0" />
                    <span className="truncate">
                      {isEn ? 'Waiting for host...' : 'Kurucu bekleniyor...'}
                    </span>
                  </div>
                )}
              </div>
            </section>

            {/* Right Zone: Squad Roster */}
            <section
              className={`${
                isMobilePortrait ? 'shrink-0' : 'col-span-7 min-h-0'
              } rounded-2xl bg-[#0A1720]/94 border border-white/10 flex flex-col overflow-hidden`}
            >
              <div className="px-4 py-3 border-b border-white/[0.08] flex items-center justify-between gap-2 shrink-0">
                <span className="text-xs sm:text-sm font-bold text-slate-100 flex items-center gap-2">
                  <Users className="w-4 h-4 text-emerald-400" />
                  {isEn ? 'Connected Captains' : 'Bağlı Kaptanlar'}
                  <span className="font-mono-num text-slate-400">
                    ({players.filter((p) => p.connected).length})
                  </span>
                </span>
                <span className="font-mono-num text-xs text-slate-400">
                  {starterSlots.length} {isEn ? 'Islands' : 'Ada'}
                </span>
              </div>

              <div
                className={`overflow-y-auto divide-y divide-white/[0.06] ${
                  isMobilePortrait ? 'max-h-60' : 'flex-1 min-h-0'
                }`}
              >
                {players.map((p) => (
                  <div
                    key={p.id}
                    className="px-4 py-3 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="w-9 h-9 rounded-lg border-2 flex items-center justify-center shrink-0 bg-[#061017]"
                        style={{ borderColor: p.bannerColor }}
                      >
                        {p.isHost ? (
                          <Crown className="w-4 h-4 text-amber-300" />
                        ) : (
                          <Anchor className="w-4 h-4" style={{ color: p.bannerColor }} />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-100 truncate">{p.name}</div>
                        <div className="text-[11px] text-slate-400 font-mono-num">
                          {p.isHost ? (isEn ? 'Host' : 'Kurucu') : isEn ? 'Captain' : 'Kaptan'} ·{' '}
                          {isEn ? `Island #${p.starterSlotIndex + 1}` : `Ada #${p.starterSlotIndex + 1}`}
                        </div>
                      </div>
                    </div>
                    <span
                      className={`text-xs font-semibold whitespace-nowrap ${
                        p.connected ? 'text-emerald-400' : 'text-slate-500'
                      }`}
                    >
                      {p.connected ? (isEn ? 'Ready' : 'Hazır') : isEn ? 'Offline' : 'Çevrimdışı'}
                    </span>
                  </div>
                ))}

                {Array.from({ length: emptySquadSlots }).map((_, idx) => (
                  <div
                    key={`empty-slot-${idx}`}
                    className="px-4 py-3 flex items-center gap-3 text-slate-500"
                  >
                    <div className="w-9 h-9 rounded-lg border border-dashed border-white/10 flex items-center justify-center shrink-0">
                      <UserPlus className="w-4 h-4 text-slate-600" />
                    </div>
                    <span className="text-xs">
                      {isEn ? 'Open Captain Slot' : 'Boş Kaptan Slotu'}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        ) : status === 'CONNECTING' ? (
          /* STATE 2: Connecting Screen */
          <div className="flex-1 min-h-0 flex items-center justify-center">
            <div className="w-full max-w-md p-6 rounded-2xl bg-[#0A1720]/96 border border-white/10 flex flex-col items-center text-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-amber-400/12 border border-amber-400/30 flex items-center justify-center">
                <RefreshCw className="w-6 h-6 animate-spin text-amber-400" />
              </div>
              <div className="font-display text-base font-bold text-slate-100">
                {isEn ? 'Establishing P2P Connection...' : 'P2P Bağlantısı Kuruluyor...'}
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                {isEn
                  ? 'Opening direct WebRTC channel between browsers.'
                  : 'Tarayıcılar arası doğrudan WebRTC kanalı açılıyor.'}
              </p>
              <button
                type="button"
                onClick={onDisconnect}
                className="mt-1 h-10 px-5 rounded-xl bg-white/[0.07] hover:bg-white/[0.14] text-xs font-semibold text-slate-100 cursor-pointer"
              >
                {isEn ? 'Cancel' : 'İptal Et'}
              </button>
            </div>
          </div>
        ) : (
          /* STATE 3: Setup Cockpit (Platform-adapted) */
          <div
            className={`${
              isMobilePortrait
                ? 'flex flex-col gap-3 pb-2'
                : isMobileLandscape
                ? 'flex-1 min-h-0 grid grid-cols-12 gap-3'
                : 'flex-1 min-h-0 grid grid-cols-12 gap-4'
            }`}
          >
            {/* Left Column: Captain Identity */}
            <section
              className={`${
                isMobilePortrait
                  ? 'shrink-0'
                  : 'col-span-5 min-h-0 overflow-y-auto'
              } rounded-2xl bg-[#0A1720]/94 border border-white/10 flex flex-col justify-between`}
            >
              <div className={isMobileLandscape ? 'p-3 space-y-3' : 'p-4 space-y-4'}>
                {!isMobilePortrait && (
                  <div className="flex items-center gap-3 pb-3 border-b border-white/[0.08]">
                    <div
                      className="w-12 h-12 rounded-xl overflow-hidden border-2 bg-[#061017] shrink-0 flex items-center justify-center"
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
                        <Compass className="w-5 h-5 text-amber-400" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="text-[11px] text-slate-400">
                        {isEn ? 'Captain Profile' : 'Kaptan Kimliği'}
                      </div>
                      <div className="font-display text-base font-bold text-slate-50 truncate">
                        {identity.name.trim() || (isEn ? 'Unnamed Captain' : 'İsimsiz Kaptan')}
                      </div>
                      <div className="text-[11px] font-semibold" style={{ color: selectedBanner.color }}>
                        {selectedBanner.name}
                      </div>
                    </div>
                  </div>
                )}

                <div className={isMobilePortrait ? 'grid grid-cols-12 gap-2.5' : 'space-y-3.5'}>
                  <div className={isMobilePortrait ? 'col-span-7 space-y-1' : 'space-y-1.5'}>
                    <label
                      htmlFor="captain-name"
                      className="block text-xs font-semibold text-slate-300"
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
                      className="w-full h-10 px-3 rounded-lg bg-[#061017] border border-white/12 text-[15px] sm:text-sm text-slate-50 focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div className={isMobilePortrait ? 'col-span-5 space-y-1' : 'space-y-1.5'}>
                    <span className="block text-xs font-semibold text-slate-300 truncate">
                      {isEn ? 'Banner Color' : 'Sancak Rengi'}
                    </span>
                    <div className="grid grid-cols-4 gap-1.5 h-10">
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
                            className={`rounded-lg border flex items-center justify-center cursor-pointer transition-colors ${
                              active
                                ? 'bg-white/15 border-white'
                                : 'bg-[#061017] border-white/10 hover:bg-white/[0.06]'
                            }`}
                          >
                            <span
                              className="w-3.5 h-3.5 rounded-full"
                              style={{ backgroundColor: opt.color }}
                            />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {!isMobilePortrait && !isMobileLandscape && (
                <div className="px-4 py-3.5 border-t border-white/[0.08] bg-[#08131B] space-y-2 text-xs text-slate-400">
                  <div className="flex items-center gap-2">
                    <Anchor className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>{isEn ? 'Equal starter island per captain' : 'Her kaptana eşit başlangıç adası'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mic className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                    <span>{isEn ? 'Built-in WebRTC voice & quick chat' : 'Dahili sesli sohbet ve hızlı ifade'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Globe className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>{isEn ? 'Host auto-saves crew progress' : 'Kurucu ekip gelişimini otomatik kaydeder'}</span>
                  </div>
                </div>
              )}
            </section>

            {/* Right Column: Host / Join */}
            <section
              className={`${
                isMobilePortrait ? 'shrink-0' : 'col-span-7 min-h-0'
              } rounded-2xl bg-[#0A1720]/94 border border-white/10 flex flex-col overflow-hidden`}
            >
              {/* Clean Underline Segmented Header */}
              <div className="grid grid-cols-2 border-b border-white/[0.08] bg-[#08131B] shrink-0">
                <button
                  type="button"
                  onClick={() => setTab('HOST')}
                  className={`relative min-h-[44px] text-xs sm:text-sm font-bold transition-colors cursor-pointer ${
                    tab === 'HOST' ? 'text-amber-300' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {isEn ? 'Host Room' : 'Oda Kur'}
                  {tab === 'HOST' && (
                    <span className="absolute bottom-0 inset-x-4 h-0.5 bg-amber-400 rounded-full" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setTab('JOIN')}
                  className={`relative min-h-[44px] text-xs sm:text-sm font-bold transition-colors cursor-pointer ${
                    tab === 'JOIN' ? 'text-sky-300' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {isEn ? 'Join with Code' : 'Odaya Katıl'}
                  {tab === 'JOIN' && (
                    <span className="absolute bottom-0 inset-x-4 h-0.5 bg-sky-400 rounded-full" />
                  )}
                </button>
              </div>

              {tab === 'HOST' ? (
                <div
                  className={`flex-1 min-h-0 flex flex-col ${
                    isMobileLandscape
                      ? 'p-3 gap-2.5 overflow-y-auto'
                      : isMobilePortrait
                      ? 'p-3.5 gap-3'
                      : 'p-4 gap-3.5'
                  }`}
                >
                  <div className="grid grid-cols-2 gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setSelectedRule('COOP')}
                      className={`p-3 rounded-xl border text-left transition-colors cursor-pointer ${
                        selectedRule === 'COOP'
                          ? 'bg-emerald-500/12 border-emerald-400/60'
                          : 'bg-[#061017]/60 border-white/[0.08] hover:bg-white/[0.03]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-slate-100">
                          <Shield className="w-4 h-4 text-emerald-400 shrink-0" />
                          <span>{isEn ? 'Co-op' : 'Ortak Takım'}</span>
                        </span>
                        {selectedRule === 'COOP' && (
                          <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        )}
                      </div>
                      <p className="mt-1 text-[11px] text-slate-400 line-clamp-2">
                        {isEn
                          ? 'Friendly fire off. Hunt treasures together.'
                          : 'Dost ateşi kapalı. Hazineyi birlikte avla.'}
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedRule('PVP')}
                      className={`p-3 rounded-xl border text-left transition-colors cursor-pointer ${
                        selectedRule === 'PVP'
                          ? 'bg-red-500/12 border-red-400/60'
                          : 'bg-[#061017]/60 border-white/[0.08] hover:bg-white/[0.03]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-slate-100">
                          <Swords className="w-4 h-4 text-red-400 shrink-0" />
                          <span>{isEn ? 'PvP War' : 'Devlet Savaşı'}</span>
                        </span>
                        {selectedRule === 'PVP' && (
                          <Check className="w-3.5 h-3.5 text-red-400 shrink-0" />
                        )}
                      </div>
                      <p className="mt-1 text-[11px] text-slate-400 line-clamp-2">
                        {isEn
                          ? 'Equal islands. Build your kingdom & clash.'
                          : 'Eşit adalarda başla, denizlerde çarpış.'}
                      </p>
                    </button>
                  </div>

                  <button
                    type="button"
                    disabled={!identity.name.trim()}
                    onClick={() => onCreateRoom(selectedRule)}
                    className="min-h-[44px] px-5 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:bg-white/10 disabled:text-slate-500 text-slate-950 font-display text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-transform active:scale-[0.985] cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <Globe className="w-4 h-4" />
                    <span>{isEn ? 'Create New Online Room' : 'Yeni Online Oda Aç'}</span>
                  </button>

                  {/* Saved Rooms Ledger */}
                  <div className="flex-1 min-h-0 flex flex-col gap-2 pt-3 border-t border-white/[0.08]">
                    <div className="flex items-center justify-between gap-2 shrink-0">
                      <span className="text-xs font-semibold text-slate-300">
                        {isEn
                          ? `Saved Rooms (${savedRooms.length})`
                          : `Kayıtlı Odalar (${savedRooms.length})`}
                      </span>
                      <div>
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
                          className="min-h-[34px] px-2.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-[11px] font-semibold text-slate-200 flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          <span>{isEn ? 'Import' : 'Kayıt Yükle'}</span>
                        </button>
                      </div>
                    </div>

                    {importNotice && (
                      <div className="text-[11px] text-sky-300 shrink-0">{importNotice}</div>
                    )}

                    <div
                      className={`overflow-y-auto divide-y divide-white/[0.06] rounded-xl border border-white/[0.08] bg-[#061017]/50 ${
                        isMobilePortrait
                          ? 'max-h-52 min-h-[72px]'
                          : isMobileLandscape
                          ? 'flex-1 min-h-[68px]'
                          : 'flex-1 min-h-[100px]'
                      }`}
                    >
                      {savedRooms.length === 0 ? (
                        <div className="h-full min-h-[72px] px-4 py-3 text-xs text-slate-400 flex items-center justify-center text-center">
                          {isEn
                            ? 'No saved online rooms yet.'
                            : 'Henüz kayıtlı oda yok.'}
                        </div>
                      ) : (
                        savedRooms.map((rm) => (
                          <div
                            key={rm.roomInfo.roomId}
                            className="px-3.5 py-2.5 flex items-center justify-between gap-2"
                          >
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-slate-100 font-mono-num truncate">
                                {isEn ? 'Room' : 'Oda'} {rm.roomInfo.roomId} ·{' '}
                                {rm.roomInfo.rule === 'COOP' ? 'Co-op' : 'PvP'}
                              </div>
                              <div className="text-[11px] text-slate-400 font-mono-num truncate">
                                {Object.keys(rm.playersById).length}{' '}
                                {isEn ? 'Captains' : 'Kaptan'} · {rm.openedTreasureIds.length}{' '}
                                {isEn ? 'Treasures' : 'Hazine'}
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => onCreateRoom(selectedRule, rm.roomInfo.roomId)}
                                className="min-h-[34px] px-3 rounded-lg bg-emerald-400 hover:bg-emerald-300 text-slate-950 text-xs font-bold whitespace-nowrap cursor-pointer"
                              >
                                {isEn ? 'Resume' : 'Devam Et'}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleExportRoom(rm)}
                                title={isEn ? 'Export Room' : 'Oda Kaydını İndir'}
                                aria-label={isEn ? 'Export Room' : 'Oda Kaydını İndir'}
                                className="w-8 h-8 rounded-lg bg-white/[0.06] hover:bg-white/[0.14] text-slate-200 flex items-center justify-center cursor-pointer"
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
                                aria-label={isEn ? 'Delete Room' : 'Oda Kaydını Sil'}
                                className="w-8 h-8 rounded-lg bg-red-500/15 hover:bg-red-500/30 text-red-300 flex items-center justify-center cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  className={`flex-1 min-h-0 flex flex-col justify-between overflow-y-auto ${
                    isMobileLandscape ? 'p-3 gap-3' : 'p-4 gap-4'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <label
                        htmlFor="join-room-code"
                        className="block text-xs font-semibold text-slate-200"
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
                        className="w-full h-12 sm:h-14 px-4 rounded-xl bg-[#061017] border border-white/12 font-mono-num text-xl font-extrabold tracking-[0.25em] uppercase text-amber-300 focus:outline-none focus:border-sky-400"
                      />
                    </div>

                    <p className="text-xs text-slate-400 leading-relaxed pt-1 border-t border-white/[0.08]">
                      {isEn
                        ? 'When you join, a balanced starter island spawns nearby on the water so every captain begins on equal footing.'
                        : 'Katıldığında sana diğer kaptanlara yakın mesafede, su üzerinde eşit şartlarda özel bir başlangıç adası açılır.'}
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled={!identity.name.trim() || joinCode.trim().length < 4}
                    onClick={() => onJoinRoom(joinCode.trim().toUpperCase())}
                    className="min-h-[46px] px-6 rounded-xl bg-sky-400 hover:bg-sky-300 disabled:bg-white/10 disabled:text-slate-500 text-slate-950 font-display text-sm font-bold flex items-center justify-center gap-2 transition-transform active:scale-[0.985] cursor-pointer whitespace-nowrap shrink-0"
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
