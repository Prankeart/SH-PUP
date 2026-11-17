import React, { useState } from 'react';
import { LogOut, RotateCcw, Settings, Volume2, VolumeX, Waves, X } from 'lucide-react';
import { GameSettings } from '../types/game';

interface SettingsModalProps {
  settings: GameSettings;
  onlineMode?: boolean;
  onlineRoomId?: string;
  onUpdateSettings: (next: GameSettings) => void;
  onResetSave: () => void;
  onLeaveToMenu?: () => void;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  settings,
  onlineMode = false,
  onlineRoomId,
  onUpdateSettings,
  onResetSave,
  onLeaveToMenu,
  onClose,
}) => {
  const [confirmReset, setConfirmReset] = useState(false);

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Oyun Ayarları"
    >
      <div className="w-full max-w-lg max-h-[92dvh] bg-[#0F2936] border border-white/15 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-4 sm:px-5 py-3.5 border-b border-white/10 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <Settings className="w-5 h-5 text-slate-200" />
            <h2 className="font-display text-lg font-bold text-slate-50">Ayarlar</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Ayarları Kapat"
            className="w-9 h-9 rounded-lg bg-white/10 hover:bg-white/20 text-slate-100 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 flex flex-col gap-4">
          {/* Sound FX Toggle */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              {settings.soundEnabled ? (
                <Volume2 className="w-5 h-5 text-emerald-300 shrink-0" />
              ) : (
                <VolumeX className="w-5 h-5 text-slate-400 shrink-0" />
              )}
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-100">Ses Efektleri</div>
                <div className="text-xs text-slate-400">Kazı, radar sinyali ve hazine sesleri</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() =>
                onUpdateSettings({ ...settings, soundEnabled: !settings.soundEnabled })
              }
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer shrink-0 ${
                settings.soundEnabled
                  ? 'bg-emerald-500 text-slate-950'
                  : 'bg-white/10 text-slate-300'
              }`}
            >
              {settings.soundEnabled ? 'Açık' : 'Kapalı'}
            </button>
          </div>

          {/* Ocean Waves Toggle */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <Waves className="w-5 h-5 text-sky-300 shrink-0" />
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-100">Dalga ve Kıyı Köpüğü</div>
                <div className="text-xs text-slate-400">Okyanus animasyon detayı</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() =>
                onUpdateSettings({ ...settings, showWaves: !settings.showWaves })
              }
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer shrink-0 ${
                settings.showWaves
                  ? 'bg-sky-500 text-slate-950'
                  : 'bg-white/10 text-slate-300'
              }`}
            >
              {settings.showWaves ? 'Açık' : 'Kapalı'}
            </button>
          </div>

          {/* Touch / Mobile Controls Visibility */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-slate-100">Ekrandaki Mobil Tuşlar</div>
              <div className="text-xs text-slate-400">
                Bilgisayarda joystick ve dokunmatik tuşları gizleyebilirsiniz
              </div>
            </div>
            <div className="flex items-center gap-1 p-1 bg-slate-950/40 rounded-lg border border-white/10 self-start sm:self-auto shrink-0">
              {(
                [
                  { id: 'AUTO', label: 'Otomatik' },
                  { id: 'ALWAYS', label: 'Göster' },
                  { id: 'HIDDEN', label: 'Gizle' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onUpdateSettings({ ...settings, touchControls: opt.id })}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                    settings.touchControls === opt.id
                      ? 'bg-amber-500 text-slate-950'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Joystick Mode */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-slate-100">Joystick Modu</div>
              <div className="text-xs text-slate-400">Dokunmatik kontrol merkezi davranışı</div>
            </div>
            <div className="flex items-center gap-1 p-1 bg-slate-950/40 rounded-lg border border-white/10 self-start sm:self-auto shrink-0">
              <button
                type="button"
                onClick={() => onUpdateSettings({ ...settings, joystickMode: 'FIXED' })}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  settings.joystickMode === 'FIXED'
                    ? 'bg-amber-500 text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Sabit
              </button>
              <button
                type="button"
                onClick={() => onUpdateSettings({ ...settings, joystickMode: 'DYNAMIC' })}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  settings.joystickMode === 'DYNAMIC'
                    ? 'bg-amber-500 text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Dinamik
              </button>
            </div>
          </div>

          {/* Controls Summary */}
          <div className="pt-3 border-t border-white/10 text-xs text-slate-300 space-y-1">
            <div className="font-semibold text-slate-100">Klavye Kısayolları</div>
            <div>WASD / Yön Tuşları: Hareket · Boşluk: Kazı Yap / Yan Top At · F: Silahla Saldır</div>
            <div>E: Tekneye Bin/İn · R: Hazine Radarı · M: Harita · K: Devlet · T: Tüccar</div>
          </div>

          {/* Return to Title / Leave Online Room + Offline Reset Save */}
          <div className="pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-3">
            {onLeaveToMenu && (
              <button
                type="button"
                onClick={onLeaveToMenu}
                className="px-3.5 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-slate-100 text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>
                  {onlineMode && onlineRoomId
                    ? `Odadan Ayrıl (${onlineRoomId})`
                    : 'Ana Menüye Dön'}
                </span>
              </button>
            )}

            {!onlineMode &&
              (!confirmReset ? (
                <button
                  type="button"
                  onClick={() => setConfirmReset(true)}
                  className="px-3.5 py-2 rounded-lg bg-red-500/15 hover:bg-red-500/25 border border-red-400/30 text-red-300 text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>İlerlemeyi Sıfırla</span>
                </button>
              ) : (
                <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 w-full justify-between">
                  <span className="text-xs text-red-300">
                    Yeni rastgele ada haritasıyla sıfırlansın mı?
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setConfirmReset(false)}
                      className="px-3 py-1.5 rounded-lg bg-white/10 text-xs text-slate-200 cursor-pointer"
                    >
                      Vazgeç
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmReset(false);
                        onResetSave();
                      }}
                      className="px-3 py-1.5 rounded-lg bg-red-500 hover:bg-red-400 text-xs font-bold text-white cursor-pointer"
                    >
                      Evet, Sıfırla
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
};
