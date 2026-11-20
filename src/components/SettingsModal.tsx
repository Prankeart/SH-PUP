import React, { useEffect, useRef, useState } from 'react';
import {
  Check,
  Copy,
  Download,
  Eye,
  Gamepad2,
  HardDrive,
  HelpCircle,
  Keyboard,
  Languages,
  LogOut,
  Map as MapIcon,
  Maximize2,
  Minimize2,
  Monitor,
  Move,
  RotateCcw,
  Save,
  Settings,
  Sliders,
  Smartphone,
  Sparkles,
  Upload,
  Volume2,
  VolumeX,
  Waves,
  X,
} from 'lucide-react';
import { GameSettings, KeybindingsConfig } from '../types/game';
import { DEFAULT_KEYBINDINGS, listSaveSlots, SaveSlotSummary } from '../engine/storage';
import { soundEngine } from '../engine/audio';
import {
  exitAppFullscreen,
  isCurrentlyFullscreen,
  isFullscreenSupported,
  requestAppFullscreen,
} from '../utils/fullscreen';

interface SettingsModalProps {
  settings: GameSettings;
  worldSeed: number;
  onlineMode?: boolean;
  onlineRoomId?: string;
  isTouchDevice?: boolean;
  onUpdateSettings: (next: GameSettings) => void;
  onResetSave: () => void;
  onQuickSave: () => void;
  onSaveToSlot: (slot: number) => void;
  onLoadFromSlot: (slot: number) => void;
  onStartWithSeed: (seed: number) => void;
  onExportSave: () => string;
  onImportSave: (jsonStr: string) => boolean;
  onLeaveToMenu?: () => void;
  onOpenLayoutEditor?: () => void;
  onClose: () => void;
}

type SettingsTab = 'GENERAL' | 'AUDIO' | 'CONTROLS' | 'SAVE';

const KEY_LABELS_TR: Array<{ key: keyof KeybindingsConfig; label: string }> = [
  { key: 'digOrFire', label: 'Kazı Yap / Top At' },
  { key: 'attack', label: 'Silahla Saldır' },
  { key: 'reload', label: 'Mermi Yenile' },
  { key: 'switchWeapon', label: 'Silah Değiştir' },
  { key: 'boat', label: 'Tekneye Bin / İn' },
  { key: 'radar', label: 'Hazine Radarı' },
  { key: 'ability', label: 'Savaş Emri (Yetenek)' },
  { key: 'fish', label: 'Balık Tutma (Olta)' },
  { key: 'stance', label: 'Ordu Düzeni Değiştir' },
  { key: 'repair', label: 'Tamir Kiti Kullan' },
  { key: 'chat', label: 'Filo Sohbeti (Online)' },
  { key: 'voiceMute', label: 'Mikrofon Aç/Kapat (Online)' },
  { key: 'map', label: 'Dünya Haritası' },
  { key: 'shop', label: 'Tüccar & Mağaza' },
  { key: 'kingdom', label: 'Devlet & Ordu' },
  { key: 'journal', label: 'Kaptan Defteri' },
];

const KEY_LABELS_EN: Array<{ key: keyof KeybindingsConfig; label: string }> = [
  { key: 'digOrFire', label: 'Dig / Fire Cannons' },
  { key: 'attack', label: 'Weapon Attack' },
  { key: 'reload', label: 'Reload Weapon' },
  { key: 'switchWeapon', label: 'Switch Weapon' },
  { key: 'boat', label: 'Board / Disembark' },
  { key: 'radar', label: 'Treasure Radar' },
  { key: 'ability', label: 'Tactical War Cry' },
  { key: 'fish', label: 'Cast / Reel Fishing' },
  { key: 'stance', label: 'Cycle Army Stance' },
  { key: 'repair', label: 'Use Repair Kit' },
  { key: 'chat', label: 'Fleet Chat (Online)' },
  { key: 'voiceMute', label: 'Toggle Voice Mic (Online)' },
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
  isTouchDevice = false,
  onUpdateSettings,
  onResetSave,
  onQuickSave,
  onSaveToSlot,
  onLoadFromSlot,
  onStartWithSeed,
  onExportSave,
  onImportSave,
  onLeaveToMenu,
  onOpenLayoutEditor,
  onClose,
}) => {
  const isEn = settings.language === 'en';
  const isTouchInterfaceActive =
    settings.touchControls === 'ALWAYS' ||
    (settings.touchControls === 'AUTO' && isTouchDevice);
  const [activeTab, setActiveTab] = useState<SettingsTab>('GENERAL');
  const [confirmReset, setConfirmReset] = useState(false);
  const [listeningKey, setListeningKey] = useState<keyof KeybindingsConfig | null>(null);
  const [slots, setSlots] = useState<Array<SaveSlotSummary | null>>(() => listSaveSlots());
  const [seedInput, setSeedInput] = useState(String(worldSeed));
  const [copiedSeed, setCopiedSeed] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(() => isCurrentlyFullscreen());
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const copyTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
      if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const syncFs = () => setIsFullscreen(isCurrentlyFullscreen());
    document.addEventListener('fullscreenchange', syncFs);
    document.addEventListener('webkitfullscreenchange', syncFs);
    return () => {
      document.removeEventListener('fullscreenchange', syncFs);
      document.removeEventListener('webkitfullscreenchange', syncFs);
    };
  }, []);

  useEffect(() => {
    setSeedInput(String(worldSeed));
  }, [worldSeed]);

  useEffect(() => {
    if (onlineMode && activeTab === 'SAVE') {
      setActiveTab('GENERAL');
    }
  }, [onlineMode, activeTab]);

  useEffect(() => {
    if (!listeningKey) return;
    const IGNORED_CODES = new Set([
      'ShiftLeft',
      'ShiftRight',
      'ControlLeft',
      'ControlRight',
      'AltLeft',
      'AltRight',
      'MetaLeft',
      'MetaRight',
      'CapsLock',
      'NumLock',
      'ScrollLock',
      'Tab',
      'PrintScreen',
      'ContextMenu',
      'Pause',
      'Unidentified',
    ]);
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.code === 'Escape') {
        setListeningKey(null);
        return;
      }
      if (!e.code || IGNORED_CODES.has(e.code) || /^F([1-9]|1[0-2])$/.test(e.code)) {
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
    const onBlur = () => setListeningKey(null);
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('blur', onBlur);
    };
  }, [listeningKey, onUpdateSettings, settings]);

  const showToast = (msg: string) => {
    setStatusMsg(msg);
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setStatusMsg(null);
      toastTimerRef.current = null;
    }, 2600);
  };

  const handleCopySeed = () => {
    if (navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(String(worldSeed));
    }
    setCopiedSeed(true);
    if (copyTimerRef.current !== null) {
      window.clearTimeout(copyTimerRef.current);
    }
    copyTimerRef.current = window.setTimeout(() => {
      setCopiedSeed(false);
      copyTimerRef.current = null;
    }, 1800);
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

  const tabs: Array<{
    id: SettingsTab;
    label: string;
    shortLabel: string;
    icon: React.ReactNode;
  }> = [
    {
      id: 'GENERAL',
      label: isEn ? 'General & Display' : 'Genel & Görüntü',
      shortLabel: isEn ? 'General' : 'Genel',
      icon: <Sliders className="w-4 h-4 shrink-0" />,
    },
    {
      id: 'AUDIO',
      label: isEn ? 'Audio Settings' : 'Ses Ayarları',
      shortLabel: isEn ? 'Audio' : 'Ses',
      icon: <Volume2 className="w-4 h-4 shrink-0" />,
    },
    {
      id: 'CONTROLS',
      label: isEn ? 'Controls' : 'Kontroller',
      shortLabel: isEn ? 'Controls' : 'Kontroller',
      icon: <Gamepad2 className="w-4 h-4 shrink-0" />,
    },
    ...(!onlineMode
      ? [
          {
            id: 'SAVE' as const,
            label: isEn ? 'Saves & World' : 'Kayıt & Dünya',
            shortLabel: isEn ? 'Saves' : 'Kayıt',
            icon: <HardDrive className="w-4 h-4 shrink-0" />,
          },
        ]
      : []),
  ];

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-end sm:items-center justify-center pt-[max(0.5rem,env(safe-area-inset-top))] sm:p-5 overscroll-none"
      role="dialog"
      aria-modal="true"
      aria-label={isEn ? 'Game Settings' : 'Oyun Ayarları'}
    >
      <div className="w-full max-w-3xl max-h-[94dvh] sm:max-h-[92dvh] bg-[#0A1F2B]/96 backdrop-blur-xl border-t sm:border border-white/12 ring-1 ring-inset ring-white/[0.05] rounded-t-3xl sm:rounded-2xl shadow-[0_24px_64px_rgba(2,10,18,0.78)] flex flex-col overflow-hidden">
        {/* Top Modal Header */}
        <div className="px-4 sm:px-5 py-3 border-b border-white/10 flex items-center justify-between gap-3 shrink-0 bg-[#081A24]/95">
          <div className="flex items-center gap-2.5 min-w-0">
            <Settings className="w-5 h-5 text-amber-300 shrink-0" />
            <h2 className="font-display text-base sm:text-lg font-bold text-slate-50 truncate">
              {isEn ? 'Settings' : 'Ayarlar'}
            </h2>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {statusMsg && (
              <span className="text-xs font-semibold text-emerald-300 bg-emerald-500/15 border border-emerald-400/30 px-2.5 py-1 rounded-lg">
                {statusMsg}
              </span>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label={isEn ? 'Close Settings' : 'Ayarları Kapat'}
              className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 text-slate-100 flex items-center justify-center transition-all active:scale-95 cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-400"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Categorized Body: Mobile top tabs + Desktop/Tablet/Landscape left sidebar */}
        <div className="flex-1 min-h-0 flex flex-col sm:flex-row overflow-hidden">
          {/* Category Navigation */}
          <nav
            aria-label={isEn ? 'Settings categories' : 'Ayar kategorileri'}
            className={`shrink-0 bg-[#06141D]/90 border-b sm:border-b-0 sm:border-r border-white/10 p-2 sm:p-3 sm:w-48 grid ${
              tabs.length === 4 ? 'grid-cols-4' : 'grid-cols-3'
            } sm:flex sm:flex-col gap-1.5`}
          >
            {tabs.map((item) => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(item.id);
                    setListeningKey(null);
                  }}
                  aria-current={active ? 'page' : undefined}
                  className={`min-h-[42px] sm:min-h-[44px] px-2 sm:px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold flex flex-col sm:flex-row items-center justify-center sm:justify-start gap-1 sm:gap-2.5 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-400 ${
                    active
                      ? 'bg-amber-500 text-slate-950 shadow-sm'
                      : 'text-slate-300 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {item.icon}
                  <span className="sm:hidden text-[11px] leading-none truncate">
                    {item.shortLabel}
                  </span>
                  <span className="hidden sm:inline truncate">{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Active Tab Content */}
          <div
            className={`flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 flex flex-col gap-3.5 ${
              onLeaveToMenu ? '' : 'pb-[max(1.25rem,env(safe-area-inset-bottom))]'
            }`}
          >
            {/* TAB 1: GENERAL & DISPLAY */}
            {activeTab === 'GENERAL' && (
              <>
                {/* Language Toggle */}
                <div className="p-3.5 rounded-xl bg-slate-950/35 border border-white/10 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Languages className="w-5 h-5 text-amber-300 shrink-0" />
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-100">
                        {isEn ? 'Language / Dil' : 'Oyun Dili / Language'}
                      </div>
                      <div className="text-xs text-slate-400">
                        {isEn ? 'Interface text language' : 'Arayüz dilini seçin'}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 p-1 bg-slate-950/60 rounded-lg border border-white/10 shrink-0">
                    <button
                      type="button"
                      onClick={() => onUpdateSettings({ ...settings, language: 'tr' })}
                      className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer ${
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
                      className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer ${
                        settings.language === 'en'
                          ? 'bg-amber-500 text-slate-950'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      English
                    </button>
                  </div>
                </div>

                {/* Auto Fullscreen Toggle */}
                {isFullscreenSupported() && (
                  <div className="p-3.5 rounded-xl bg-slate-950/35 border border-white/10 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {settings.autoFullscreen ? (
                        <Maximize2 className="w-5 h-5 text-emerald-300 shrink-0" />
                      ) : (
                        <Minimize2 className="w-5 h-5 text-slate-400 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-100">
                          {isEn ? 'Auto Fullscreen' : 'Tam Ekran Modu'}
                        </div>
                        <div className="text-xs text-slate-400">
                          {isEn
                            ? 'Automatically launch in fullscreen (turn off to stay windowed)'
                            : 'Site açıldığında otomatik tam ekrana geçer'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 ml-auto">
                      {settings.autoFullscreen && !isFullscreen && (
                        <button
                          type="button"
                          onClick={() => void requestAppFullscreen()}
                          className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-100 text-xs font-semibold cursor-pointer whitespace-nowrap"
                        >
                          {isEn ? 'Enter Now' : 'Tam Ekrana Geç'}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          const next = !settings.autoFullscreen;
                          onUpdateSettings({ ...settings, autoFullscreen: next });
                          if (next) {
                            void requestAppFullscreen();
                          } else {
                            void exitAppFullscreen();
                          }
                        }}
                        className={`min-w-[72px] px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer shrink-0 ${
                          settings.autoFullscreen
                            ? 'bg-emerald-500 text-slate-950'
                            : 'bg-white/10 text-slate-300'
                        }`}
                      >
                        {settings.autoFullscreen
                          ? isEn
                            ? 'On'
                            : 'Açık'
                          : isEn
                          ? 'Off'
                          : 'Kapalı'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Ocean Waves Visual Toggle */}
                <div className="p-3.5 rounded-xl bg-slate-950/35 border border-white/10 flex items-center justify-between gap-3">
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
                    className={`min-w-[72px] px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer shrink-0 ${
                      settings.showWaves
                        ? 'bg-sky-500 text-slate-950'
                        : 'bg-white/10 text-slate-300'
                    }`}
                  >
                    {settings.showWaves ? (isEn ? 'On' : 'Açık') : isEn ? 'Off' : 'Kapalı'}
                  </button>
                </div>

                {/* Colorblind Mode */}
                <div className="p-3.5 rounded-xl bg-slate-950/35 border border-white/10 flex items-center justify-between gap-3">
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
                      onUpdateSettings({
                        ...settings,
                        colorblindMode: !settings.colorblindMode,
                      })
                    }
                    className={`min-w-[72px] px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer shrink-0 ${
                      settings.colorblindMode
                        ? 'bg-pink-400 text-slate-950'
                        : 'bg-white/10 text-slate-300'
                    }`}
                  >
                    {settings.colorblindMode ? (isEn ? 'On' : 'Açık') : isEn ? 'Off' : 'Kapalı'}
                  </button>
                </div>

                {/* Tutorial Hints */}
                <div className="p-3.5 rounded-xl bg-slate-950/35 border border-white/10 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <HelpCircle className="w-5 h-5 text-amber-300 shrink-0" />
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-100">
                        {isEn ? 'Onboarding Tutorial Hints' : 'Eğitim İpuçları'}
                      </div>
                      <div className="text-xs text-slate-400">
                        {isEn ? 'Show step-by-step guidance banner' : 'Adım adım başlangıç rehberi'}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateSettings({
                        ...settings,
                        showTutorialHints: !settings.showTutorialHints,
                      })
                    }
                    className={`min-w-[72px] px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer shrink-0 ${
                      settings.showTutorialHints
                        ? 'bg-amber-500 text-slate-950'
                        : 'bg-white/10 text-slate-300'
                    }`}
                  >
                    {settings.showTutorialHints ? (isEn ? 'On' : 'Açık') : isEn ? 'Off' : 'Kapalı'}
                  </button>
                </div>

                {/* Screen Shake Intensity */}
                <div className="p-3.5 rounded-xl bg-slate-950/35 border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div>
                    <div className="text-sm font-semibold text-slate-100">
                      {isEn ? 'Screen Shake Intensity' : 'Ekran Sarsıntı Şiddeti'}
                    </div>
                    <div className="text-xs text-slate-400">
                      {isEn
                        ? 'Reduce or disable camera shake on cannon hits'
                        : 'Top ve kazı sarsıntılarını ayarlayın'}
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
                      className="w-32 accent-amber-400 cursor-pointer"
                    />
                    <span className="font-mono-num text-xs font-semibold text-slate-200 w-10 text-right">
                      %{settings.screenShakeIntensity}
                    </span>
                  </div>
                </div>
              </>
            )}

            {/* TAB 2: AUDIO SETTINGS */}
            {activeTab === 'AUDIO' && (
              <>
                {/* Master Volume & Quick Mute */}
                <div className="p-4 rounded-xl bg-slate-950/35 border border-white/10 flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {settings.soundEnabled && settings.masterVolume > 0 ? (
                        <Volume2 className="w-5 h-5 text-amber-300 shrink-0" />
                      ) : (
                        <VolumeX className="w-5 h-5 text-slate-400 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-100">
                          {isEn ? 'Master Audio' : 'Ana Ses (Genel)'}
                        </div>
                        <div className="text-xs text-slate-400">
                          {isEn
                            ? 'Global volume level for all game audio'
                            : 'Tüm oyun seslerinin ana ses seviyesi'}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const nextEnabled = !(settings.soundEnabled && settings.masterVolume > 0);
                        onUpdateSettings({
                          ...settings,
                          soundEnabled: nextEnabled,
                          masterVolume:
                            nextEnabled && settings.masterVolume === 0
                              ? 100
                              : settings.masterVolume,
                        });
                        if (nextEnabled) {
                          soundEngine.ensureAmbientOcean();
                        }
                      }}
                      className={`min-w-[80px] px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer shrink-0 ${
                        settings.soundEnabled && settings.masterVolume > 0
                          ? 'bg-amber-500 text-slate-950'
                          : 'bg-white/10 text-slate-300'
                      }`}
                    >
                      {settings.soundEnabled && settings.masterVolume > 0
                        ? isEn
                          ? 'On'
                          : 'Açık'
                        : isEn
                        ? 'Muted'
                        : 'Kapalı'}
                    </button>
                  </div>

                  <div className="flex items-center gap-3 pt-1">
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      aria-label={isEn ? 'Master volume' : 'Ana ses yüksekliği'}
                      value={settings.soundEnabled ? settings.masterVolume : 0}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        onUpdateSettings({
                          ...settings,
                          soundEnabled: val > 0,
                          masterVolume: val,
                        });
                        if (val > 0) soundEngine.ensureAmbientOcean();
                      }}
                      className="flex-1 accent-amber-400 cursor-pointer"
                    />
                    <span className="font-mono-num text-xs font-bold text-amber-300 w-11 text-right">
                      %{settings.soundEnabled ? settings.masterVolume : 0}
                    </span>
                  </div>
                </div>

                {/* Sound Effects Volume */}
                <div className="p-4 rounded-xl bg-slate-950/35 border border-white/10 flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <Volume2 className="w-5 h-5 text-emerald-300 shrink-0" />
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-100">
                          {isEn ? 'Sound Effects (SFX)' : 'Ses Efektleri'}
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
                      disabled={!settings.soundEnabled || settings.masterVolume === 0 || settings.sfxVolume === 0}
                      onClick={() => soundEngine.playRadarPing('HOT')}
                      className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/35 disabled:opacity-40 border border-emerald-400/35 text-emerald-200 text-xs font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed shrink-0"
                    >
                      {isEn ? 'Test' : 'Test Et'}
                    </button>
                  </div>

                  <div className="flex items-center gap-3 pt-1">
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      disabled={!settings.soundEnabled}
                      aria-label={isEn ? 'Sound effects volume' : 'Ses efektleri yüksekliği'}
                      value={settings.sfxVolume}
                      onChange={(e) =>
                        onUpdateSettings({
                          ...settings,
                          sfxVolume: Number(e.target.value),
                        })
                      }
                      className="flex-1 accent-emerald-400 cursor-pointer disabled:opacity-40"
                    />
                    <span className="font-mono-num text-xs font-bold text-emerald-300 w-11 text-right">
                      %{settings.sfxVolume}
                    </span>
                  </div>
                </div>

                {/* Ocean Surf Ambience Volume & Toggle */}
                <div className="p-4 rounded-xl bg-slate-950/35 border border-white/10 flex flex-col gap-3">
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
                      onClick={() => {
                        const nextAmbient = !(settings.ambientEnabled && settings.ambientVolume > 0);
                        onUpdateSettings({
                          ...settings,
                          ambientEnabled: nextAmbient,
                          ambientVolume:
                            nextAmbient && settings.ambientVolume === 0
                              ? 80
                              : settings.ambientVolume,
                        });
                        if (nextAmbient && settings.soundEnabled) {
                          soundEngine.ensureAmbientOcean();
                        }
                      }}
                      className={`min-w-[80px] px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer shrink-0 ${
                        settings.ambientEnabled && settings.ambientVolume > 0
                          ? 'bg-cyan-500 text-slate-950'
                          : 'bg-white/10 text-slate-300'
                      }`}
                    >
                      {settings.ambientEnabled && settings.ambientVolume > 0
                        ? isEn
                          ? 'On'
                          : 'Açık'
                        : isEn
                        ? 'Off'
                        : 'Kapalı'}
                    </button>
                  </div>

                  <div className="flex items-center gap-3 pt-1">
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      disabled={!settings.soundEnabled || !settings.ambientEnabled}
                      aria-label={isEn ? 'Ocean ambience volume' : 'Okyanus dalga sesi yüksekliği'}
                      value={settings.ambientEnabled ? settings.ambientVolume : 0}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        onUpdateSettings({
                          ...settings,
                          ambientEnabled: val > 0,
                          ambientVolume: val,
                        });
                        if (val > 0 && settings.soundEnabled) {
                          soundEngine.ensureAmbientOcean();
                        }
                      }}
                      className="flex-1 accent-cyan-400 cursor-pointer disabled:opacity-40"
                    />
                    <span className="font-mono-num text-xs font-bold text-cyan-300 w-11 text-right">
                      %{settings.ambientEnabled ? settings.ambientVolume : 0}
                    </span>
                  </div>
                </div>
              </>
            )}

            {/* TAB 3: CONTROLS (Device-Specific Panel) */}
            {activeTab === 'CONTROLS' && (
              <>
                {/* Active Device / Control Profile Banner */}
                <div className="px-3.5 py-2.5 rounded-xl bg-slate-950/50 border border-white/10 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {isTouchInterfaceActive ? (
                      <Smartphone className="w-4 h-4 text-amber-300 shrink-0" />
                    ) : (
                      <Monitor className="w-4 h-4 text-sky-300 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-100 truncate">
                        {isTouchInterfaceActive
                          ? isEn
                            ? 'Mobile / Touch Controls Active'
                            : 'Mobil / Dokunmatik Kontrol Paneli'
                          : isEn
                          ? 'PC / Keyboard Controls Active'
                          : 'Bilgisayar / Klavye Kontrol Paneli'}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate">
                        {isTouchInterfaceActive
                          ? isEn
                            ? 'Hide touch buttons to switch to keyboard keybindings'
                            : 'Klavye atamaları için mobil tuşları "Gizle" yapabilirsiniz'
                          : isEn
                          ? 'Showing desktop HUD visibility & keyboard keybindings'
                          : 'Bilgisayara özel arayüz ve klavye ayarları gösteriliyor'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Touch Controls Visibility */}
                <div className="p-3.5 rounded-xl bg-slate-950/35 border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-100">
                      {isEn ? 'On-Screen Touch Controls' : 'Ekrandaki Mobil Tuşlar'}
                    </div>
                    <div className="text-xs text-slate-400">
                      {isEn
                        ? 'Show or hide joystick and touch buttons'
                        : 'Joystick ve dokunmatik tuş görünürlüğü'}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 p-1 bg-slate-950/60 rounded-lg border border-white/10 self-start sm:self-auto shrink-0">
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
                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                          settings.touchControls === opt.id
                            ? 'bg-amber-500 text-slate-950 font-semibold'
                            : 'text-slate-300 hover:text-white'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Mini Map Size Adjustment */}
                {(() => {
                  const mmLayout = settings.touchLayout?.minimap;
                  const mmScale = mmLayout?.scale ?? 1;
                  const mmPct = Math.round(mmScale * 100);
                  return (
                    <div className="p-3.5 rounded-xl bg-slate-950/35 border border-white/10 space-y-2.5">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <MapIcon className="w-4 h-4 text-sky-300 shrink-0" />
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-slate-100">
                              {isEn ? 'Mini Map Size' : 'Mini Harita Boyutu'}
                            </div>
                            <div className="text-xs text-slate-400">
                              {isEn
                                ? 'Scale the top-left minimap radar'
                                : 'Sol üstteki mini haritanın boyutunu ayarlayın'}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="font-mono-num text-xs font-bold text-amber-300 w-11 text-right">
                            %{mmPct}
                          </span>
                          {mmScale !== 1 && (
                            <button
                              type="button"
                              onClick={() => {
                                const nextLayout = { ...(settings.touchLayout ?? {}) };
                                if (
                                  mmLayout &&
                                  (mmLayout.dx !== 0 ||
                                    mmLayout.dy !== 0 ||
                                    (mmLayout.opacity !== undefined && mmLayout.opacity !== 1))
                                ) {
                                  nextLayout.minimap = { ...mmLayout, scale: 1 };
                                } else {
                                  delete nextLayout.minimap;
                                }
                                onUpdateSettings({ ...settings, touchLayout: nextLayout });
                              }}
                              title={isEn ? 'Reset Size' : 'Boyutu Sıfırla'}
                              aria-label={isEn ? 'Reset Mini Map Size' : 'Mini Harita Boyutunu Sıfırla'}
                              className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 text-sky-300 flex items-center justify-center cursor-pointer"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                      <input
                        type="range"
                        min={65}
                        max={160}
                        step={5}
                        value={mmPct}
                        aria-label={isEn ? 'Mini Map Size' : 'Mini Harita Boyutu'}
                        onChange={(e) => {
                          const nextScale = Math.max(0.65, Math.min(1.6, Number(e.target.value) / 100));
                          const nextLayout = { ...(settings.touchLayout ?? {}) };
                          const prevMm = nextLayout.minimap ?? { dx: 0, dy: 0 };
                          const hasCustomOpacity =
                            prevMm.opacity !== undefined && prevMm.opacity !== 1;
                          if (nextScale === 1 && prevMm.dx === 0 && prevMm.dy === 0 && !hasCustomOpacity) {
                            delete nextLayout.minimap;
                          } else {
                            nextLayout.minimap = { ...prevMm, scale: nextScale };
                          }
                          onUpdateSettings({ ...settings, touchLayout: nextLayout });
                        }}
                        className="w-full accent-amber-500 cursor-pointer"
                      />
                    </div>
                  );
                })()}

                {/* MOBILE / TOUCH-ONLY CONTROLS */}
                {isTouchInterfaceActive && (
                  <>
                    {/* Joystick Mode */}
                    <div className="p-3.5 rounded-xl bg-slate-950/35 border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-100">
                          {isEn ? 'Joystick Mode' : 'Joystick Modu'}
                        </div>
                        <div className="text-xs text-slate-400">
                          {isEn
                            ? 'Touch thumbstick center behavior'
                            : 'Dokunmatik kontrol merkezi davranışı'}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 p-1 bg-slate-950/60 rounded-lg border border-white/10 self-start sm:self-auto shrink-0">
                        <button
                          type="button"
                          onClick={() => onUpdateSettings({ ...settings, joystickMode: 'FIXED' })}
                          className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                            settings.joystickMode === 'FIXED'
                              ? 'bg-amber-500 text-slate-950 font-semibold'
                              : 'text-slate-300 hover:text-white'
                          }`}
                        >
                          {isEn ? 'Fixed' : 'Sabit'}
                        </button>
                        <button
                          type="button"
                          onClick={() => onUpdateSettings({ ...settings, joystickMode: 'DYNAMIC' })}
                          className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                            settings.joystickMode === 'DYNAMIC'
                              ? 'bg-amber-500 text-slate-950 font-semibold'
                              : 'text-slate-300 hover:text-white'
                          }`}
                        >
                          {isEn ? 'Dynamic' : 'Dinamik'}
                        </button>
                      </div>
                    </div>

                  </>
                )}

                {/* HUD Layout Customization: Position, Size & Opacity (in-game) */}
                {onOpenLayoutEditor && (
                  <div className="p-3.5 rounded-xl bg-slate-950/35 border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-100">
                        {isEn
                          ? 'Controls, Weapon & Map Layout'
                          : 'Tuş, Silah ve Harita Düzeni'}
                      </div>
                      <div className="text-xs text-slate-400">
                        {isEn
                          ? 'Adjust position, size, and opacity of controls, weapon panel, and mini map'
                          : 'Tuşlar, silah paneli ve mini haritanın konumunu, boyutunu ve opaklığını ayarlayın'}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 self-start sm:self-auto shrink-0">
                      {Object.keys(settings.touchLayout ?? {}).length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            onUpdateSettings({ ...settings, touchLayout: {} });
                            showToast(
                              isEn ? 'Controls layout reset.' : 'Kontrol düzeni sıfırlandı.'
                            );
                          }}
                          className="px-2.5 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-slate-200 text-xs font-medium flex items-center gap-1 cursor-pointer whitespace-nowrap"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>{isEn ? 'Reset' : 'Sıfırla'}</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={onOpenLayoutEditor}
                        className="px-3.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 shadow cursor-pointer whitespace-nowrap"
                      >
                        <Move className="w-3.5 h-3.5" />
                        <span>{isEn ? 'Edit Layout' : 'Düzenle'}</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* PC / KEYBOARD-ONLY CONTROLS (Desktop OR Mobile when touch buttons disabled) */}
                {!isTouchInterfaceActive && (
                  <>
                    {/* Desktop HUD Element Visibility (PC devices only) */}
                    {!isTouchDevice && (
                      <div className="p-3.5 rounded-xl bg-slate-950/35 border border-white/10 space-y-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 text-xs font-semibold text-slate-100">
                            <Monitor className="w-4 h-4 text-sky-300 shrink-0" />
                            <span>
                              {isEn
                                ? 'Desktop HUD Visibility'
                                : 'Bilgisayar Arayüzü Görünümü'}
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-400">
                            {isEn ? 'Press ESC for Settings' : 'Ayarlar: ESC'}
                          </span>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-3 px-2.5 py-2 rounded-lg bg-slate-950/55 border border-white/10">
                            <div className="min-w-0">
                              <div className="text-xs font-semibold text-slate-100">
                                {isEn ? 'Bottom-Right Controls Bar' : 'Sağ Alt Kontrol Menüsü'}
                              </div>
                              <div className="text-[11px] text-slate-400 truncate">
                                {isEn
                                  ? 'Show or hide bottom-right action dock on PC'
                                  : 'Sağ alttaki aksiyon çubuğunu göster / gizle'}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                onUpdateSettings({
                                  ...settings,
                                  desktopShowActionBar: !settings.desktopShowActionBar,
                                })
                              }
                              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer shrink-0 ${
                                settings.desktopShowActionBar
                                  ? 'bg-emerald-500 text-slate-950'
                                  : 'bg-slate-800 text-slate-300 border border-white/10'
                              }`}
                            >
                              {settings.desktopShowActionBar
                                ? isEn
                                  ? 'Shown'
                                  : 'Açık'
                                : isEn
                                ? 'Hidden'
                                : 'Gizli'}
                            </button>
                          </div>

                          <div className="flex items-center justify-between gap-3 px-2.5 py-2 rounded-lg bg-slate-950/55 border border-white/10">
                            <div className="min-w-0">
                              <div className="text-xs font-semibold text-slate-100">
                                {isEn ? 'Top-Right Settings Button' : 'Ayarlar Butonu'}
                              </div>
                              <div className="text-[11px] text-slate-400 truncate">
                                {isEn
                                  ? 'Hide settings gear (ESC always opens settings)'
                                  : 'Gizlendiğinde ESC tuşuyla ayarları açabilirsiniz'}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                onUpdateSettings({
                                  ...settings,
                                  desktopShowSettingsButton: !settings.desktopShowSettingsButton,
                                })
                              }
                              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer shrink-0 ${
                                settings.desktopShowSettingsButton
                                  ? 'bg-emerald-500 text-slate-950'
                                  : 'bg-slate-800 text-slate-300 border border-white/10'
                              }`}
                            >
                              {settings.desktopShowSettingsButton
                                ? isEn
                                  ? 'Shown'
                                  : 'Açık'
                                : isEn
                                ? 'Hidden'
                                : 'Gizli'}
                            </button>
                          </div>

                          <div className="flex items-center justify-between gap-3 px-2.5 py-2 rounded-lg bg-slate-950/55 border border-white/10">
                            <div className="min-w-0">
                              <div className="text-xs font-semibold text-slate-100">
                                {isEn ? 'Top-Right Menu Buttons' : 'Diğer Menü Butonları'}
                              </div>
                              <div className="text-[11px] text-slate-400 truncate">
                                {isEn
                                  ? 'Journal, Nation, Gold/Bag & Trader buttons (J, K, T)'
                                  : 'Defter, Devlet, Altın/Çanta ve Tüccar butonları (J, K, T)'}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                onUpdateSettings({
                                  ...settings,
                                  desktopShowHudButtons: !settings.desktopShowHudButtons,
                                })
                              }
                              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer shrink-0 ${
                                settings.desktopShowHudButtons
                                  ? 'bg-emerald-500 text-slate-950'
                                  : 'bg-slate-800 text-slate-300 border border-white/10'
                              }`}
                            >
                              {settings.desktopShowHudButtons
                                ? isEn
                                  ? 'Shown'
                                  : 'Açık'
                                : isEn
                                ? 'Hidden'
                                : 'Gizli'}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Remappable Keybindings */}
                    <div className="p-3.5 rounded-xl bg-slate-950/35 border border-white/10 space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-xs font-semibold text-slate-100">
                          <Keyboard className="w-4 h-4 text-sky-300 shrink-0" />
                          <span>
                            {isEn
                              ? 'Keyboard Keybindings (WASD / Arrows · F5 Save · ESC Settings)'
                              : 'Klavye Tuşları (WASD/Yön · F5 Kayıt · ESC Ayarlar)'}
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
                          className="text-[11px] font-semibold text-sky-300 hover:text-sky-200 cursor-pointer shrink-0"
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
                              className="flex items-center justify-between px-2.5 py-2 rounded-lg bg-slate-950/55 border border-white/10 text-xs"
                            >
                              <span className="text-slate-300 truncate">{item.label}</span>
                              <button
                                type="button"
                                onClick={() => setListeningKey(active ? null : item.key)}
                                className={`px-2.5 py-1 rounded font-mono-num text-[11px] font-bold cursor-pointer ${
                                  active
                                    ? 'bg-amber-400 text-slate-950 ring-2 ring-amber-300/75 shadow-sm'
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
                  </>
                )}
              </>
            )}

            {/* TAB 4: SAVES & WORLD */}
            {activeTab === 'SAVE' && !onlineMode && (
              <>
                <div className="p-3.5 rounded-xl bg-slate-950/35 border border-white/10 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-100">
                      {isEn ? 'Quick Save & File Backup' : 'Hızlı Kayıt & Dosya Yedeği'}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          onQuickSave();
                          showToast(isEn ? 'Quick saved!' : 'Hızlı kayıt alındı!');
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 text-emerald-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>{isEn ? 'QuickSave (F5)' : 'Hızlı Kayıt (F5)'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleDownloadJson}
                        className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>JSON</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                      >
                        <Upload className="w-3.5 h-3.5" />
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
                  <div className="flex flex-wrap items-center gap-2 p-2.5 rounded-xl bg-slate-950/55 border border-white/10 text-xs">
                    <span className="text-slate-400">Seed:</span>
                    <span className="font-mono-num font-bold text-amber-300">{worldSeed}</span>
                    <button
                      type="button"
                      onClick={handleCopySeed}
                      className="p-1.5 rounded bg-white/10 hover:bg-white/20 text-slate-200 cursor-pointer"
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
                        className="w-28 min-h-[38px] sm:min-h-[32px] px-2.5 py-1.5 rounded-lg bg-slate-900 border border-white/15 text-slate-100 font-mono-num text-[16px] sm:text-xs"
                        placeholder="123456"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const n = parseInt(seedInput, 10);
                          if (!Number.isNaN(n) && n > 0) {
                            onStartWithSeed(n);
                            showToast(
                              isEn ? `New world #${n}` : `Yeni dünya #${n} oluşturuldu!`
                            );
                          }
                        }}
                        className="min-h-[38px] sm:min-h-[32px] px-3 py-1.5 rounded-lg bg-sky-500/25 hover:bg-sky-500/35 border border-sky-400/40 text-sky-200 text-xs font-semibold cursor-pointer"
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
                          className="p-3 rounded-xl bg-slate-950/55 border border-white/10 flex flex-col justify-between gap-2 text-xs"
                        >
                          <div>
                            <div className="font-semibold text-slate-100">
                              {isEn ? `Slot ${slotNum}` : `Yuva ${slotNum}`}
                            </div>
                            {summary ? (
                              <div className="text-[11px] text-slate-400 font-mono-num mt-0.5">
                                {summary.gold}G · {summary.discoveredCount}{' '}
                                {isEn ? 'Isl' : 'Ada'} · Sv.{summary.boatLevel}
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
                                  isEn
                                    ? `Saved to Slot ${slotNum}`
                                    : `Yuva ${slotNum}'e kaydedildi!`
                                );
                              }}
                              className="flex-1 py-1.5 rounded bg-amber-500/20 hover:bg-amber-500/35 border border-amber-400/40 text-amber-200 text-[11px] font-semibold cursor-pointer"
                            >
                              {isEn ? 'Save' : 'Kaydet'}
                            </button>
                            <button
                              type="button"
                              disabled={!summary}
                              onClick={() => {
                                onLoadFromSlot(slotNum);
                                showToast(
                                  isEn
                                    ? `Loaded Slot ${slotNum}`
                                    : `Yuva ${slotNum} yüklendi!`
                                );
                              }}
                              className={`flex-1 py-1.5 rounded text-[11px] font-semibold border ${
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

                {/* Reset Progress */}
                <div className="p-3.5 rounded-xl bg-red-950/20 border border-red-400/20 flex items-center justify-between gap-3">
                  {!confirmReset ? (
                    <>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-red-200">
                          {isEn ? 'Reset Progress' : 'İlerlemeyi Sıfırla'}
                        </div>
                        <div className="text-xs text-slate-400">
                          {isEn
                            ? 'Start fresh on a new random ocean map'
                            : 'Yeni rastgele ada haritasıyla sıfırdan başla'}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setConfirmReset(true)}
                        className="px-3.5 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-400/35 text-red-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>{isEn ? 'Reset' : 'Sıfırla'}</span>
                      </button>
                    </>
                  ) : (
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 w-full justify-between">
                      <span className="text-xs text-red-200">
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
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Footer Action Bar when in-game */}
        {onLeaveToMenu && (
          <div className="px-4 sm:px-5 pt-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:py-3 border-t border-white/10 bg-[#081A24]/95 flex items-center justify-between gap-3 shrink-0">
            <button
              type="button"
              onClick={onLeaveToMenu}
              className="min-h-[42px] sm:min-h-[38px] px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-100 text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
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

            <button
              type="button"
              onClick={onClose}
              className="min-h-[42px] sm:min-h-[38px] px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold cursor-pointer whitespace-nowrap"
            >
              {isEn ? 'Done' : 'Tamam'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
