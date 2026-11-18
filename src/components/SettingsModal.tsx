import React, { useEffect, useRef, useState } from 'react';
import {
  Check,
  Copy,
  Download,
  Eye,
  HelpCircle,
  Keyboard,
  Languages,
  LogOut,
  RotateCcw,
  Save,
  Settings,
  Sparkles,
  Upload,
  Volume2,
  VolumeX,
  Waves,
  X,
} from 'lucide-react';
import { GameSettings, KeybindingsConfig } from '../types/game';
import { DEFAULT_KEYBINDINGS, listSaveSlots, SaveSlotSummary } from '../engine/storage';

interface SettingsModalProps {
  settings: GameSettings;
  worldSeed: number;
  onlineMode?: boolean;
  onlineRoomId?: string;
  onUpdateSettings: (next: GameSettings) => void;
  onResetSave: () => void;
  onQuickSave: () => void;
  onSaveToSlot: (slot: number) => void;
  onLoadFromSlot: (slot: number) => void;
  onStartWithSeed: (seed: number) => void;
  onExportSave: () => string;
  onImportSave: (jsonStr: string) => boolean;
  onLeaveToMenu?: () => void;
  onClose: () => void;
}

const KEY_LABELS_TR: Array<{ key: keyof KeybindingsConfig; label: string }> = [
  { key: 'digOrFire', label: 'Kazı Yap / Top At' },
  { key: 'attack', label: 'Silahla Saldır' },
  { key: 'boat', label: 'Tekneye Bin / İn' },
  { key: 'radar', label: 'Hazine Radarı' },
  { key: 'ability', label: 'Savaş Emri (Yetenek)' },
  { key: 'fish', label: 'Balık Tutma (Olta)' },
  { key: 'stance', label: 'Ordu Düzeni Değiştir' },
  { key: 'map', label: 'Dünya Haritası' },
  { key: 'shop', label: 'Tüccar & Mağaza' },
  { key: 'kingdom', label: 'Devlet & Ordu' },
  { key: 'journal', label: 'Kaptan Defteri' },
];

const KEY_LABELS_EN: Array<{ key: keyof KeybindingsConfig; label: string }> = [
  { key: 'digOrFire', label: 'Dig / Fire Cannons' },
  { key: 'attack', label: 'Weapon Attack' },
  { key: 'boat', label: 'Board / Disembark' },
  { key: 'radar', label: 'Treasure Radar' },
  { key: 'ability', label: 'Tactical War Cry' },
  { key: 'fish', label: 'Cast / Reel Fishing' },
  { key: 'stance', label: 'Cycle Army Stance' },
  { key: 'map', label: 'World Map' },
  { key: 'shop', label: 'Merchant Shop' },
  { key: 'kingdom', label: 'Kingdom & Army' },
  { key: 'journal', label: "Captain's Journal" },
];

export function formatKeyCode(code: string): string {
  if (code === 'Space') return 'Space';
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  return code;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  settings,
  worldSeed,
  onlineMode = false,
  onlineRoomId,
  onUpdateSettings,
  onResetSave,
  onQuickSave,
  onSaveToSlot,
  onLoadFromSlot,
  onStartWithSeed,
  onExportSave,
  onImportSave,
  onLeaveToMenu,
  onClose,
}) => {
  const isEn = settings.language === 'en';
  const [confirmReset, setConfirmReset] = useState(false);
  const [listeningKey, setListeningKey] = useState<keyof KeybindingsConfig | null>(null);
  const [slots, setSlots] = useState<Array<SaveSlotSummary | null>>(() => listSaveSlots());
  const [seedInput, setSeedInput] = useState(String(worldSeed));
  const [copiedSeed, setCopiedSeed] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setSeedInput(String(worldSeed));
  }, [worldSeed]);

  useEffect(() => {
    if (!listeningKey) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.code === 'Escape') {
        setListeningKey(null);
        return;
      }
      onUpdateSettings({
        ...settings,
        keybindings: {
          ...settings.keybindings,
          [listeningKey]: e.code,
        },
      });
      setListeningKey(null);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [listeningKey, onUpdateSettings, settings]);

  const showToast = (msg: string) => {
    setStatusMsg(msg);
    setTimeout(() => setStatusMsg(null), 2600);
  };

  const handleCopySeed = () => {
    if (navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(String(worldSeed));
    }
    setCopiedSeed(true);
    setTimeout(() => setCopiedSeed(false), 1800);
  };

  const handleDownloadJson = () => {
    const jsonStr = onExportSave();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tropik_ada_save_${worldSeed}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast(isEn ? 'Save file exported!' : 'Kayıt dosyası indirildi!');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const ok = onImportSave(String(reader.result || ''));
      showToast(
        ok
          ? isEn
            ? 'Save imported successfully!'
            : 'Kayıt başarıyla yüklendi!'
          : isEn
          ? 'Invalid save JSON file.'
          : 'Geçersiz kayıt dosyası.'
      );
      setSlots(listSaveSlots());
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const keyLabels = isEn ? KEY_LABELS_EN : KEY_LABELS_TR;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={isEn ? 'Game Settings' : 'Oyun Ayarları'}
    >
      <div className="w-full max-w-2xl max-h-[92dvh] bg-[#0F2936] border border-white/15 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-4 sm:px-5 py-3.5 border-b border-white/10 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <Settings className="w-5 h-5 text-slate-200" />
            <h2 className="font-display text-lg font-bold text-slate-50">
              {isEn ? 'Settings & Saves' : 'Ayarlar & Kayıt Yönetimi'}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {statusMsg && (
              <span className="text-xs font-semibold text-emerald-300 bg-emerald-500/15 border border-emerald-400/30 px-2.5 py-1 rounded-lg">
                {statusMsg}
              </span>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label={isEn ? 'Close Settings' : 'Ayarları Kapat'}
              className="w-9 h-9 rounded-lg bg-white/10 hover:bg-white/20 text-slate-100 flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 flex flex-col gap-4">
          {/* Language Toggle */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <Languages className="w-5 h-5 text-amber-300 shrink-0" />
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-100">
                  {isEn ? 'Language / Dil' : 'Oyun Dili / Language'}
                </div>
                <div className="text-xs text-slate-400">
                  {isEn ? 'Switch interface text between Turkish & English' : 'Arayüz dilini seçin'}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1 p-1 bg-slate-950/40 rounded-lg border border-white/10 shrink-0">
              <button
                type="button"
                onClick={() => onUpdateSettings({ ...settings, language: 'tr' })}
                className={`px-3 py-1 rounded-md text-xs font-semibold cursor-pointer ${
                  settings.language === 'tr'
                    ? 'bg-amber-500 text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Türkçe
              </button>
              <button
                type="button"
                onClick={() => onUpdateSettings({ ...settings, language: 'en' })}
                className={`px-3 py-1 rounded-md text-xs font-semibold cursor-pointer ${
                  settings.language === 'en'
                    ? 'bg-amber-500 text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                English
              </button>
            </div>
          </div>

          {/* Sound FX Toggle */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              {settings.soundEnabled ? (
                <Volume2 className="w-5 h-5 text-emerald-300 shrink-0" />
              ) : (
                <VolumeX className="w-5 h-5 text-slate-400 shrink-0" />
              )}
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-100">
                  {isEn ? 'Sound Effects' : 'Ses Efektleri'}
                </div>
                <div className="text-xs text-slate-400">
                  {isEn
                    ? 'Digging, radar pings, cannon & combat audio'
                    : 'Kazı, radar sinyali, top ve savaş sesleri'}
                </div>
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
              {settings.soundEnabled ? (isEn ? 'On' : 'Açık') : isEn ? 'Off' : 'Kapalı'}
            </button>
          </div>

          {/* Ambient Ocean Audio */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <Waves className="w-5 h-5 text-cyan-300 shrink-0" />
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-100">
                  {isEn ? 'Ocean Surf Ambience' : 'Okyanus Dalga Sesi (Ambiyans)'}
                </div>
                <div className="text-xs text-slate-400">
                  {isEn
                    ? 'Gentle synthesized ocean waves background sound'
                    : 'Arka planda sakin dalga ve rüzgar sesi'}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() =>
                onUpdateSettings({ ...settings, ambientEnabled: !settings.ambientEnabled })
              }
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer shrink-0 ${
                settings.ambientEnabled
                  ? 'bg-cyan-500 text-slate-950'
                  : 'bg-white/10 text-slate-300'
              }`}
            >
              {settings.ambientEnabled ? (isEn ? 'On' : 'Açık') : isEn ? 'Off' : 'Kapalı'}
            </button>
          </div>

          {/* Ocean Waves Visual Toggle */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <Sparkles className="w-5 h-5 text-sky-300 shrink-0" />
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-100">
                  {isEn ? 'Waves & Shore Foam' : 'Dalga ve Kıyı Köpüğü'}
                </div>
                <div className="text-xs text-slate-400">
                  {isEn ? 'Ocean surface animation detail' : 'Okyanus animasyon detayı'}
                </div>
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
              {settings.showWaves ? (isEn ? 'On' : 'Açık') : isEn ? 'Off' : 'Kapalı'}
            </button>
          </div>

          {/* Colorblind Mode */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <Eye className="w-5 h-5 text-pink-300 shrink-0" />
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-100">
                  {isEn ? 'Colorblind Friendly Radar' : 'Renk Körü Dostu Radar'}
                </div>
                <div className="text-xs text-slate-400">
                  {isEn
                    ? 'High-contrast colors & distinct ring patterns'
                    : 'Yüksek kontrastlı palet ve belirgin halka desenleri'}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() =>
                onUpdateSettings({ ...settings, colorblindMode: !settings.colorblindMode })
              }
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer shrink-0 ${
                settings.colorblindMode
                  ? 'bg-pink-400 text-slate-950'
                  : 'bg-white/10 text-slate-300'
              }`}
            >
              {settings.colorblindMode ? (isEn ? 'On' : 'Açık') : isEn ? 'Off' : 'Kapalı'}
            </button>
          </div>

          {/* Tutorial Hints */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <HelpCircle className="w-5 h-5 text-amber-300 shrink-0" />
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-100">
                  {isEn ? 'Onboarding Tutorial Hints' : 'Eğitim İpuçları'}
                </div>
                <div className="text-xs text-slate-400">
                  {isEn ? 'Show step-by-step guidance banner' : 'Adım adım başlangıç rehberi çubuğu'}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() =>
                onUpdateSettings({ ...settings, showTutorialHints: !settings.showTutorialHints })
              }
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer shrink-0 ${
                settings.showTutorialHints
                  ? 'bg-amber-500 text-slate-950'
                  : 'bg-white/10 text-slate-300'
              }`}
            >
              {settings.showTutorialHints ? (isEn ? 'On' : 'Açık') : isEn ? 'Off' : 'Kapalı'}
            </button>
          </div>

          {/* Screen Shake Intensity */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div>
              <div className="text-sm font-semibold text-slate-100">
                {isEn ? 'Screen Shake Intensity' : 'Ekran Sarsıntı Şiddeti'}
              </div>
              <div className="text-xs text-slate-400">
                {isEn
                  ? 'Reduce or disable camera shake on cannon hits'
                  : 'Top ve kazı sarsıntılarını azaltın veya kapatın'}
              </div>
            </div>
            <div className="flex items-center gap-2.5 shrink-0">
              <input
                type="range"
                min={0}
                max={100}
                step={10}
                value={settings.screenShakeIntensity}
                onChange={(e) =>
                  onUpdateSettings({
                    ...settings,
                    screenShakeIntensity: Number(e.target.value),
                  })
                }
                className="w-28 accent-amber-400 cursor-pointer"
              />
              <span className="font-mono-num text-xs font-semibold text-slate-200 w-10 text-right">
                %{settings.screenShakeIntensity}
              </span>
            </div>
          </div>

          {/* Touch / Mobile Controls Visibility */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-slate-100">
                {isEn ? 'On-Screen Touch Controls' : 'Ekrandaki Mobil Tuşlar'}
              </div>
              <div className="text-xs text-slate-400">
                {isEn
                  ? 'Hide joystick and touch buttons on desktop'
                  : 'Bilgisayarda joystick ve dokunmatik tuşları gizleyebilirsiniz'}
              </div>
            </div>
            <div className="flex items-center gap-1 p-1 bg-slate-950/40 rounded-lg border border-white/10 self-start sm:self-auto shrink-0">
              {(
                [
                  { id: 'AUTO', label: isEn ? 'Auto' : 'Otomatik' },
                  { id: 'ALWAYS', label: isEn ? 'Show' : 'Göster' },
                  { id: 'HIDDEN', label: isEn ? 'Hide' : 'Gizle' },
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
              <div className="text-sm font-semibold text-slate-100">
                {isEn ? 'Joystick Mode' : 'Joystick Modu'}
              </div>
              <div className="text-xs text-slate-400">
                {isEn ? 'Touch thumbstick center behavior' : 'Dokunmatik kontrol merkezi davranışı'}
              </div>
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
                {isEn ? 'Fixed' : 'Sabit'}
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
                {isEn ? 'Dynamic' : 'Dinamik'}
              </button>
            </div>
          </div>

          {/* Remappable Keybindings */}
          <div className="pt-3 border-t border-white/10 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-100">
                <Keyboard className="w-4 h-4 text-sky-300" />
                <span>
                  {isEn
                    ? 'Keybindings (WASD / Arrows move · F5 QuickSave)'
                    : 'Klavye Tuşları (WASD/Yön Hareket · F5 Hızlı Kayıt)'}
                </span>
              </div>
              <button
                type="button"
                onClick={() =>
                  onUpdateSettings({
                    ...settings,
                    keybindings: { ...DEFAULT_KEYBINDINGS },
                  })
                }
                className="text-[11px] font-semibold text-sky-300 hover:text-sky-200 cursor-pointer"
              >
                {isEn ? 'Reset Keys' : 'Varsayılanlar'}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {keyLabels.map((item) => {
                const active = listeningKey === item.key;
                return (
                  <div
                    key={item.key}
                    className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-slate-950/40 border border-white/10 text-xs"
                  >
                    <span className="text-slate-300 truncate">{item.label}</span>
                    <button
                      type="button"
                      onClick={() => setListeningKey(active ? null : item.key)}
                      className={`px-2 py-0.5 rounded font-mono-num text-[11px] font-bold cursor-pointer ${
                        active
                          ? 'bg-amber-500 text-slate-950 animate-pulse'
                          : 'bg-white/10 hover:bg-white/20 text-amber-200'
                      }`}
                    >
                      {active
                        ? isEn
                          ? 'Press key...'
                          : 'Tuşa bas...'
                        : formatKeyCode(settings.keybindings[item.key])}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Offline Save Slots, World Seed & Export/Import */}
          {!onlineMode && (
            <div className="pt-3 border-t border-white/10 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-100">
                  {isEn ? 'Save Slots & World Seed' : 'Kayıt Yuvaları & Dünya Tohumu (Seed)'}
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      onQuickSave();
                      showToast(isEn ? 'Quick saved!' : 'Hızlı kayıt alındı!');
                    }}
                    className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 text-emerald-200 text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <Save className="w-3 h-3" />
                    <span>{isEn ? 'QuickSave (F5)' : 'Hızlı Kayıt (F5)'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadJson}
                    className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-slate-200 text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <Download className="w-3 h-3" />
                    <span>JSON</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-slate-200 text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <Upload className="w-3 h-3" />
                    <span>{isEn ? 'Import' : 'Yükle'}</span>
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/json"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </div>
              </div>

              {/* World Seed box */}
              <div className="flex flex-wrap items-center gap-2 p-2.5 rounded-xl bg-slate-950/40 border border-white/10 text-xs">
                <span className="text-slate-400">Seed:</span>
                <span className="font-mono-num font-bold text-amber-300">{worldSeed}</span>
                <button
                  type="button"
                  onClick={handleCopySeed}
                  className="p-1 rounded bg-white/10 hover:bg-white/20 text-slate-200 cursor-pointer"
                  title={isEn ? 'Copy Seed' : 'Tohumu Kopyala'}
                >
                  {copiedSeed ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
                <div className="flex items-center gap-1.5 ml-auto">
                  <input
                    type="number"
                    value={seedInput}
                    onChange={(e) => setSeedInput(e.target.value)}
                    className="w-24 px-2 py-1 rounded-md bg-slate-900 border border-white/15 text-slate-100 font-mono-num text-xs"
                    placeholder="123456"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const n = parseInt(seedInput, 10);
                      if (!Number.isNaN(n) && n > 0) {
                        onStartWithSeed(n);
                        showToast(isEn ? `New world #${n}` : `Yeni dünya #${n} oluşturuldu!`);
                      }
                    }}
                    className="px-2.5 py-1 rounded-md bg-sky-500/25 hover:bg-sky-500/35 border border-sky-400/40 text-sky-200 text-[11px] font-semibold cursor-pointer"
                  >
                    {isEn ? 'Launch Seed' : 'Tohumla Başla'}
                  </button>
                </div>
              </div>

              {/* 3 Save Slots */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {[1, 2, 3].map((slotNum) => {
                  const summary = slots[slotNum - 1];
                  return (
                    <div
                      key={slotNum}
                      className="p-2.5 rounded-xl bg-slate-950/40 border border-white/10 flex flex-col justify-between gap-2 text-xs"
                    >
                      <div>
                        <div className="font-semibold text-slate-100">
                          {isEn ? `Slot ${slotNum}` : `Yuva ${slotNum}`}
                        </div>
                        {summary ? (
                          <div className="text-[11px] text-slate-400 font-mono-num mt-0.5">
                            {summary.gold}G · {summary.discoveredCount} {isEn ? 'Isl' : 'Ada'} · Sv.
                            {summary.boatLevel}
                          </div>
                        ) : (
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            {isEn ? 'Empty' : 'Boş'}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            onSaveToSlot(slotNum);
                            setSlots(listSaveSlots());
                            showToast(
                              isEn ? `Saved to Slot ${slotNum}` : `Yuva ${slotNum}'e kaydedildi!`
                            );
                          }}
                          className="flex-1 py-1 rounded bg-amber-500/20 hover:bg-amber-500/35 border border-amber-400/40 text-amber-200 text-[11px] font-semibold cursor-pointer"
                        >
                          {isEn ? 'Save' : 'Kaydet'}
                        </button>
                        <button
                          type="button"
                          disabled={!summary}
                          onClick={() => {
                            onLoadFromSlot(slotNum);
                            showToast(
                              isEn ? `Loaded Slot ${slotNum}` : `Yuva ${slotNum} yüklendi!`
                            );
                          }}
                          className={`flex-1 py-1 rounded text-[11px] font-semibold border ${
                            summary
                              ? 'bg-sky-500/20 hover:bg-sky-500/35 border-sky-400/40 text-sky-200 cursor-pointer'
                              : 'bg-white/5 border-white/5 text-slate-600 cursor-not-allowed'
                          }`}
                        >
                          {isEn ? 'Load' : 'Yükle'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

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
                    ? isEn
                      ? `Leave Room (${onlineRoomId})`
                      : `Odadan Ayrıl (${onlineRoomId})`
                    : isEn
                    ? 'Main Menu'
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
                  <span>{isEn ? 'Reset Progress' : 'İlerlemeyi Sıfırla'}</span>
                </button>
              ) : (
                <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 w-full justify-between">
                  <span className="text-xs text-red-300">
                    {isEn
                      ? 'Reset progress with a brand new random world?'
                      : 'Yeni rastgele ada haritasıyla sıfırlansın mı?'}
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setConfirmReset(false)}
                      className="px-3 py-1.5 rounded-lg bg-white/10 text-xs text-slate-200 cursor-pointer"
                    >
                      {isEn ? 'Cancel' : 'Vazgeç'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmReset(false);
                        onResetSave();
                      }}
                      className="px-3 py-1.5 rounded-lg bg-red-500 hover:bg-red-400 text-xs font-bold text-white cursor-pointer"
                    >
                      {isEn ? 'Yes, Reset' : 'Evet, Sıfırla'}
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

