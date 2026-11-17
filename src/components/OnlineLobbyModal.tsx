import React, { useEffect, useRef, useState } from 'react';
import {
  Check,
  Copy,
  Download,
  Globe,
  Link2,
  Play,
  RefreshCw,
  Shield,
  Swords,
  Trash2,
  Upload,
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
  onCreateRoom,
  onJoinRoom,
  onHostStartGame,
  onHostChangeRule,
  onDisconnect,
  onClose,
}) => {
  const [tab, setTab] = useState<'HOST' | 'JOIN'>(initialRoomCode ? 'JOIN' : 'HOST');
  const [selectedRule, setSelectedRule] = useState<OnlineModeRule>('PVP');
  const [joinCode, setJoinCode] = useState(initialRoomCode);
  const [savedRooms, setSavedRooms] = useState<RoomLedger[]>([]);
  const [copiedKind, setCopiedKind] = useState<'CODE' | 'LINK' | null>(null);
  const [importNotice, setImportNotice] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
      window.setTimeout(() => setCopiedKind(null), 1800);
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
        setImportNotice('Geçersiz oda kayıt dosyası.');
        return;
      }
      await saveRoomLedger(parsed);
      await refreshSavedRooms();
      setImportNotice(`Oda ${parsed.roomInfo.roomId} başarıyla içe aktarıldı.`);
    } catch {
      setImportNotice('Dosya okunamadı.');
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

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Online Oda Lobisi"
    >
      <div className="w-full max-w-3xl max-h-[90dvh] bg-[#0F2936] border border-white/15 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-4 sm:px-5 py-3.5 border-b border-white/10 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <Globe className="w-5 h-5 text-sky-300 shrink-0" />
            <h2 className="font-display text-base sm:text-lg font-bold text-slate-50 truncate">
              Online P2P Oda Lobisi
            </h2>
          </div>
          <button
            type="button"
            onClick={() => {
              if (isInLobbyOrConnecting) onDisconnect();
              onClose();
            }}
            aria-label="Lobiyi Kapat"
            className="w-9 h-9 rounded-lg bg-white/10 hover:bg-white/20 text-slate-100 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col gap-5">
          {/* Error / Reconnect Banner */}
          {errorMsg && (
            <div className="px-4 py-2.5 rounded-xl bg-red-950/60 border border-red-400/40 text-xs text-red-200 flex items-center justify-between gap-2">
              <span>{errorMsg}</span>
              {status === 'ERROR' && (
                <button
                  type="button"
                  onClick={onDisconnect}
                  className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-slate-100 font-semibold whitespace-nowrap cursor-pointer"
                >
                  Sıfırla
                </button>
              )}
            </div>
          )}

          {/* Active Room / Waiting Lobby */}
          {isInLobbyOrConnecting && roomInfo ? (
            <div className="flex flex-col gap-5">
              {/* Room Info & Share Bar */}
              <div className="p-4 rounded-xl bg-slate-950/40 border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="text-xs text-slate-400">
                    {role === 'HOST' ? 'Kurucu Sensin' : `Kurucu: ${roomInfo.hostName}`} · Sunucusuz WebRTC P2P
                  </div>
                  <div className="mt-1 flex items-center gap-3">
                    <span className="font-mono-num text-2xl sm:text-3xl font-extrabold tracking-widest text-amber-300">
                      {roomInfo.roomId}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void copyText(roomInfo.roomId, 'CODE')}
                    className="h-10 px-3.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-semibold text-slate-100 flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                  >
                    {copiedKind === 'CODE' ? (
                      <Check className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Copy className="w-4 h-4 text-slate-300" />
                    )}
                    <span>{copiedKind === 'CODE' ? 'Kopyalandı' : 'Kodu Kopyala'}</span>
                  </button>

                  {inviteUrl && (
                    <button
                      type="button"
                      onClick={() => void copyText(inviteUrl, 'LINK')}
                      className="h-10 px-3.5 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/35 text-xs font-semibold text-sky-200 flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                    >
                      {copiedKind === 'LINK' ? (
                        <Check className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Link2 className="w-4 h-4 text-sky-300" />
                      )}
                      <span>{copiedKind === 'LINK' ? 'Link Kopyalandı' : 'Davet Linki'}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Rule Selector (Host interactive, Client read-only) */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1">
                <div className="text-xs text-slate-300">
                  Oyun Kuralı · Dinamik Eşit Başlangıç Adaları · Tarafsız Köylüler
                </div>
                {role === 'HOST' ? (
                  <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-950/50 border border-white/10 self-start">
                    <button
                      type="button"
                      onClick={() => onHostChangeRule('COOP')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition-colors ${
                        roomInfo.rule === 'COOP'
                          ? 'bg-emerald-500 text-slate-950'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      <Shield className="w-3.5 h-3.5" />
                      <span>Co-op Takım</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onHostChangeRule('PVP')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition-colors ${
                        roomInfo.rule === 'PVP'
                          ? 'bg-red-500 text-slate-950'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      <Swords className="w-3.5 h-3.5" />
                      <span>PvP Devlet Savaşı</span>
                    </button>
                  </div>
                ) : (
                  <div className="text-xs font-semibold text-amber-300">
                    {roomInfo.rule === 'COOP' ? 'Ortak Takım (Co-op)' : 'PvP Devlet Savaşı'}
                  </div>
                )}
              </div>

              {/* Connected Captains List */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs text-slate-300">
                  <span className="font-semibold flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-emerald-300" />
                    Bağlı Kaptanlar ({players.filter((p) => p.connected).length})
                  </span>
                  <span className="font-mono-num text-slate-400">
                    {starterSlots.length} Eşit Başlangıç Adası Hazır
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {players.map((p) => (
                    <div
                      key={p.id}
                      className="p-3 rounded-xl bg-slate-950/35 border border-white/10 flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className="w-3.5 h-3.5 rounded-full shrink-0 border border-white/40"
                          style={{ backgroundColor: p.bannerColor }}
                        />
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-slate-100 truncate">
                            {p.name}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {p.isHost ? 'Oda Kurucu' : 'Kaptan'} · Ada #{p.starterSlotIndex + 1}
                          </div>
                        </div>
                      </div>
                      <span
                        className={`text-[11px] font-semibold whitespace-nowrap ${
                          p.connected ? 'text-emerald-300' : 'text-slate-500'
                        }`}
                      >
                        {p.connected ? 'Bağlı' : 'Çevrimdışı'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Lobby Actions */}
              <div className="pt-2 border-t border-white/10 flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={onDisconnect}
                  className="h-11 px-4 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-slate-200 whitespace-nowrap cursor-pointer"
                >
                  Odadan Ayrıl
                </button>

                {role === 'HOST' ? (
                  <button
                    type="button"
                    onClick={onHostStartGame}
                    className="h-11 px-6 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-display text-sm font-bold flex items-center gap-2 shadow-lg whitespace-nowrap cursor-pointer"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>Denize Açıl (Oyunu Başlat)</span>
                  </button>
                ) : (
                  <div className="text-xs text-sky-200 flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-sky-300" />
                    <span>Kurucu oyunu başlattığında otomatik giriş yapılacak...</span>
                  </div>
                )}
              </div>
            </div>
          ) : status === 'CONNECTING' ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-center">
              <RefreshCw className="w-8 h-8 animate-spin text-amber-300" />
              <div className="text-sm font-semibold text-slate-100">
                P2P Bağlantısı Kuruluyor...
              </div>
              <div className="text-xs text-slate-400 max-w-sm">
                Tarayıcılar arası doğrudan WebRTC kanalı açılıyor. İlk bağlantı birkaç saniye sürebilir.
              </div>
              <button
                type="button"
                onClick={onDisconnect}
                className="mt-2 h-10 px-4 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-slate-200 cursor-pointer"
              >
                İptal Et
              </button>
            </div>
          ) : (
            /* Setup View: Captain Profile + Host / Join Tabs */
            <>
              {/* Captain Identity */}
              <div className="p-4 rounded-xl bg-slate-950/35 border border-white/10 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="captain-name" className="text-xs font-semibold text-slate-200">
                    Kaptan Adın
                  </label>
                  <input
                    id="captain-name"
                    type="text"
                    maxLength={20}
                    value={identity.name}
                    onChange={(e) =>
                      onUpdateIdentity({ ...identity, name: e.target.value })
                    }
                    placeholder="Örn. Kaptan Ege"
                    className="h-10 px-3 rounded-xl bg-slate-900/90 border border-white/15 text-sm text-slate-50 focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-semibold text-slate-200">Sancak Rengi</span>
                  <div className="grid grid-cols-4 gap-2 h-10">
                    {PLAYER_BANNER_OPTIONS.map((opt) => {
                      const active = identity.bannerColor === opt.color;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() =>
                            onUpdateIdentity({ ...identity, bannerColor: opt.color })
                          }
                          title={opt.name}
                          className={`rounded-xl border flex items-center justify-center cursor-pointer transition-colors ${
                            active
                              ? 'bg-white/20 border-white'
                              : 'bg-slate-900/70 border-white/10 hover:bg-white/10'
                          }`}
                        >
                          <span
                            className="w-4 h-4 rounded-full"
                            style={{ backgroundColor: opt.color }}
                          />
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Mode Switch Tabs */}
              <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-950/45 border border-white/10">
                <button
                  type="button"
                  onClick={() => setTab('HOST')}
                  className={`flex-1 h-10 rounded-lg text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                    tab === 'HOST'
                      ? 'bg-amber-500 text-slate-950'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  Oda Kur (Kurucu Ol)
                </button>
                <button
                  type="button"
                  onClick={() => setTab('JOIN')}
                  className={`flex-1 h-10 rounded-lg text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                    tab === 'JOIN'
                      ? 'bg-sky-500 text-slate-950'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  Odaya Katıl (Kod Gir)
                </button>
              </div>

              {tab === 'HOST' ? (
                <div className="flex flex-col gap-4">
                  {/* Co-op vs PvP Selection */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setSelectedRule('COOP')}
                      className={`p-3.5 rounded-xl border text-left transition-colors cursor-pointer ${
                        selectedRule === 'COOP'
                          ? 'bg-emerald-950/50 border-emerald-400/70'
                          : 'bg-slate-950/35 border-white/10 hover:bg-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-2 text-sm font-bold text-slate-100">
                        <Shield className="w-4 h-4 text-emerald-400" />
                        <span>Ortak Takım (Co-op)</span>
                      </div>
                      <p className="mt-1 text-xs text-slate-300">
                        Dost ateşi kapalı. Arkadaşlarınla beraber hazine arayıp adaları paylaşın.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedRule('PVP')}
                      className={`p-3.5 rounded-xl border text-left transition-colors cursor-pointer ${
                        selectedRule === 'PVP'
                          ? 'bg-red-950/45 border-red-400/70'
                          : 'bg-slate-950/35 border-white/10 hover:bg-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-2 text-sm font-bold text-slate-100">
                        <Swords className="w-4 h-4 text-red-400" />
                        <span>Devlet Savaşı (PvP)</span>
                      </div>
                      <p className="mt-1 text-xs text-slate-300">
                        Herkes eşit başlangıç adasında başlar, devletini kurup denizlerde çarpışır.
                      </p>
                    </button>
                  </div>

                  <button
                    type="button"
                    disabled={!identity.name.trim()}
                    onClick={() => onCreateRoom(selectedRule)}
                    className="h-12 px-6 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:bg-white/10 disabled:text-slate-400 text-slate-950 font-display text-sm font-bold flex items-center justify-center gap-2 shadow-lg transition-transform duration-100 active:scale-95 cursor-pointer whitespace-nowrap"
                  >
                    <Globe className="w-4 h-4" />
                    <span>Yeni Online Oda Aç</span>
                  </button>

                  {/* Saved Rooms Ledger */}
                  <div className="pt-3 border-t border-white/10 flex flex-col gap-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-300">
                        Kayıtlı Odalar ({savedRooms.length}) · Oyuncu Gelişimleri Kurucuda Saklanır
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
                          className="h-8 px-2.5 rounded-lg bg-white/10 hover:bg-white/15 text-[11px] font-semibold text-slate-200 flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          <span>Kayıt Yükle</span>
                        </button>
                      </div>
                    </div>

                    {importNotice && (
                      <div className="text-xs text-sky-300">{importNotice}</div>
                    )}

                    {savedRooms.length === 0 ? (
                      <div className="py-4 px-3 rounded-xl bg-slate-950/25 border border-white/10 text-xs text-slate-400 text-center">
                        Henüz kayıtlı online oda yok. Yeni oda açtığında arkadaşlarının altın ve ilerlemeleri buraya otomatik kaydedilir.
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2 max-h-44 overflow-y-auto pr-1">
                        {savedRooms.map((rm) => (
                          <div
                            key={rm.roomInfo.roomId}
                            className="p-3 rounded-xl bg-slate-950/35 border border-white/10 flex flex-wrap items-center justify-between gap-2"
                          >
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-slate-100 font-mono-num">
                                Oda {rm.roomInfo.roomId} ·{' '}
                                {rm.roomInfo.rule === 'COOP' ? 'Co-op' : 'PvP'}
                              </div>
                              <div className="text-[11px] text-slate-400">
                                {Object.keys(rm.playersById).length} Kaptan ·{' '}
                                {rm.openedTreasureIds.length} Hazine
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => onCreateRoom(selectedRule, rm.roomInfo.roomId)}
                                className="h-8 px-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold whitespace-nowrap cursor-pointer"
                              >
                                Devam Et
                              </button>
                              <button
                                type="button"
                                onClick={() => handleExportRoom(rm)}
                                title="Oda Kaydını İndir"
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
                                title="Oda Kaydını Sil"
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
              ) : (
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="join-room-code" className="text-xs font-semibold text-slate-200">
                      Kurucunun Paylaştığı 6 Haneli Oda Kodu
                    </label>
                    <input
                      id="join-room-code"
                      type="text"
                      maxLength={8}
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                      placeholder="Örn. AB3K9Z"
                      className="h-12 px-4 rounded-xl bg-slate-900/90 border border-white/15 font-mono-num text-lg font-bold tracking-widest uppercase text-amber-300 focus:outline-none focus:border-sky-400"
                    />
                  </div>

                  <button
                    type="button"
                    disabled={!identity.name.trim() || joinCode.trim().length < 4}
                    onClick={() => onJoinRoom(joinCode.trim().toUpperCase())}
                    className="h-12 px-6 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:bg-white/10 disabled:text-slate-400 text-slate-950 font-display text-sm font-bold flex items-center justify-center gap-2 shadow-lg transition-transform duration-100 active:scale-95 cursor-pointer whitespace-nowrap"
                  >
                    <Users className="w-4 h-4" />
                    <span>Odaya Bağlan</span>
                  </button>

                  <p className="text-xs text-slate-400 leading-relaxed">
                    Katıldığında sana diğer kaptanlara yakın mesafede, su üzerinde eşit şartlarda özel bir başlangıç adası açılır.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
