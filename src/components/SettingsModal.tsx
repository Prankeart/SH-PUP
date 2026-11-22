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
  Upload,
  Volume2,
  VolumeX,
  Waves,
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
import { ModalTabItem, ResponsiveModalShell } from './ResponsiveModalShell';

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

  const tabs: ModalTabItem[] = [
    {
      id: 'GENERAL',
      label: isEn ? 'General' : 'Genel',
      icon: <Sliders className="w-4 h-4 shrink-0" />,
    },
    {
      id: 'AUDIO',
      label: isEn ? 'Audio' : 'Ses',
      icon: <Volume2 className="w-4 h-4 shrink-0" />,
    },
    {
      id: 'CONTROLS',
      label: isEn ? 'Controls' : 'Kontroller',
      icon: <Gamepad2 className="w-4 h-4 shrink-0" />,
    },
    ...(!onlineMode
      ? [
          {
            id: 'SAVE',
            label: isEn ? 'Saves' : 'Kayıt',
            icon: <HardDrive className="w-4 h-4 shrink-0" />,
          },
        ]
      : []),
  ];

  const headerToast = statusMsg ? (
    <span className="text-xs font-semibold text-emerald-300 bg-emerald-500/12 border border-emerald-400/30 px-2.5 py-1 rounded-lg">
      {statusMsg}
    </span>
  ) : undefined;

  const footerBar = onLeaveToMenu ? (
    <div className="flex items-center justify-between gap-3">
      <button
        type="button"
        onClick={onLeaveToMenu}
        className="min-h-[42px] sm:min-h-[38px] px-3.5 py-2 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.08] text-slate-200 text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
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
        className="min-h-[42px] sm:min-h-[38px] px-5 py-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold cursor-pointer whitespace-nowrap"
      >
        {isEn ? 'Done' : 'Tamam'}
      </button>
    </div>
  ) : undefined;

  return (
    <ResponsiveModalShell
      onClose={onClose}
      title={isEn ? 'Settings' : 'Ayarlar'}
      subtitle={isEn ? 'Display, Audio & Controls' : 'Görüntü, Ses ve Kontroller'}
      icon={<Settings className="w-5 h-5" />}
      headerRight={headerToast}
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={(id) => {
        setActiveTab(id as SettingsTab);
        setListeningKey(null);
      }}
      footer={footerBar}
      maxWidthClass="max-w-4xl"
    >
      {/* TAB 1: GENERAL & DISPLAY */}
      {activeTab === 'GENERAL' && (
        <div className="rounded-xl border border-white/[0.08] bg-[#0F212C]/65 divide-y divide-white/[0.06]">
          {/* Language Toggle */}
          <div className="p-3.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <Languages className="w-4 h-4 text-amber-300 shrink-0" />
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-100">
                  {isEn ? 'Language / Dil' : 'Oyun Dili / Language'}
                </div>
                <div className="text-xs text-slate-400">
                  {isEn ? 'Interface text language' : 'Arayüz dilini seçin'}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1 p-0.5 bg-[#061017] rounded-lg border border-white/[0.08] shrink-0">
              <button
                type="button"
                onClick={() => onUpdateSettings({ ...settings, language: 'tr' })}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer ${
                  settings.language === 'tr'
                    ? 'bg-amber-400 text-slate-950'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Türkçe
              </button>
              <button
                type="button"
                onClick={() => onUpdateSettings({ ...settings, language: 'en' })}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer ${
                  settings.language === 'en'
                    ? 'bg-amber-400 text-slate-950'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                English
              </button>
            </div>
          </div>

          {/* Auto Fullscreen Toggle */}
          {isFullscreenSupported() && (
            <div className="p-3.5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                {settings.autoFullscreen ? (
                  <Maximize2 className="w-4 h-4 text-emerald-300 shrink-0" />
                ) : (
                  <Minimize2 className="w-4 h-4 text-slate-400 shrink-0" />
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
                    className="px-3 py-1.5 rounded-lg bg-white/[0.08] hover:bg-white/[0.14] text-slate-100 text-xs font-semibold cursor-pointer whitespace-nowrap"
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
                      : 'bg-white/[0.06] text-slate-300 hover:bg-white/10'
                  }`}
                >
                  {settings.autoFullscreen ? (isEn ? 'On' : 'Açık') : isEn ? 'Off' : 'Kapalı'}
                </button>
              </div>
            </div>
          )}

          {/* Ocean Waves Visual Toggle */}
          <div className="p-3.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <Waves className="w-4 h-4 text-sky-300 shrink-0" />
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
              onClick={() => onUpdateSettings({ ...settings, showWaves: !settings.showWaves })}
              className={`min-w-[72px] px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer shrink-0 ${
                settings.showWaves
                  ? 'bg-sky-400 text-slate-950'
                  : 'bg-white/[0.06] text-slate-300 hover:bg-white/10'
              }`}
            >
              {settings.showWaves ? (isEn ? 'On' : 'Açık') : isEn ? 'Off' : 'Kapalı'}
            </button>
          </div>

          {/* Colorblind Mode */}
          <div className="p-3.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <Eye className="w-4 h-4 text-pink-300 shrink-0" />
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
                  : 'bg-white/[0.06] text-slate-300 hover:bg-white/10'
              }`}
            >
              {settings.colorblindMode ? (isEn ? 'On' : 'Açık') : isEn ? 'Off' : 'Kapalı'}
            </button>
          </div>

          {/* Tutorial Hints */}
          <div className="p-3.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <HelpCircle className="w-4 h-4 text-amber-300 shrink-0" />
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
                  ? 'bg-amber-400 text-slate-950'
                  : 'bg-white/[0.06] text-slate-300 hover:bg-white/10'
              }`}
            >
              {settings.showTutorialHints ? (isEn ? 'On' : 'Açık') : isEn ? 'Off' : 'Kapalı'}
            </button>
          </div>

          {/* Screen Shake Intensity */}
          <div className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
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
        </div>
      )}

      {/* TAB 2: AUDIO SETTINGS */}
      {activeTab === 'AUDIO' && (
        <div className="rounded-xl border border-white/[0.08] bg-[#0F212C]/65 divide-y divide-white/[0.06]">
          {/* Master Volume & Quick Mute */}
          <div className="p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                {settings.soundEnabled && settings.masterVolume > 0 ? (
                  <Volume2 className="w-4 h-4 text-amber-300 shrink-0" />
                ) : (
                  <VolumeX className="w-4 h-4 text-slate-400 shrink-0" />
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
                      nextEnabled && settings.masterVolume === 0 ? 100 : settings.masterVolume,
                  });
                  if (nextEnabled) {
                    soundEngine.ensureAmbientOcean();
                  }
                }}
                className={`min-w-[80px] px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer shrink-0 ${
                  settings.soundEnabled && settings.masterVolume > 0
                    ? 'bg-amber-400 text-slate-950'
                    : 'bg-white/[0.06] text-slate-300 hover:bg-white/10'
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
          <div className="p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <Volume2 className="w-4 h-4 text-emerald-300 shrink-0" />
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
                disabled={
                  !settings.soundEnabled || settings.masterVolume === 0 || settings.sfxVolume === 0
                }
                onClick={() => soundEngine.playRadarPing('HOT')}
                className="px-3 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 disabled:opacity-40 border border-emerald-400/30 text-emerald-200 text-xs font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed shrink-0"
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
          <div className="p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <Waves className="w-4 h-4 text-cyan-300 shrink-0" />
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
                      nextAmbient && settings.ambientVolume === 0 ? 80 : settings.ambientVolume,
                  });
                  if (nextAmbient && settings.soundEnabled) {
                    soundEngine.ensureAmbientOcean();
                  }
                }}
                className={`min-w-[80px] px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer shrink-0 ${
                  settings.ambientEnabled && settings.ambientVolume > 0
                    ? 'bg-cyan-400 text-slate-950'
                    : 'bg-white/[0.06] text-slate-300 hover:bg-white/10'
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
        </div>
      )}

      {/* TAB 3: CONTROLS */}
      {activeTab === 'CONTROLS' && (
        <div className="flex flex-col gap-4">
          {/* Active Control Profile Header */}
          <div className="px-3.5 py-2.5 rounded-xl bg-[#0F212C]/65 border border-white/[0.08] flex items-center gap-3">
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
                    : 'Mobil / Dokunmatik Kontrol Profili'
                  : isEn
                  ? 'PC / Keyboard Controls Active'
                  : 'Bilgisayar / Klavye Kontrol Profili'}
              </div>
              <div className="text-[11px] text-slate-400 truncate">
                {isTouchInterfaceActive
                  ? isEn
                    ? 'Hide touch buttons to configure keyboard keybindings'
                    : 'Klavye atamaları için mobil tuşları "Gizle" yapabilirsiniz'
                  : isEn
                  ? 'Showing desktop HUD visibility & keyboard keybindings'
                  : 'Bilgisayara özel arayüz ve klavye ayarları gösteriliyor'}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-white/[0.08] bg-[#0F212C]/65 divide-y divide-white/[0.06]">
            {/* Touch Controls Visibility */}
            <div className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4">
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
              <div className="flex items-center gap-1 p-0.5 bg-[#061017] rounded-lg border border-white/[0.08] self-start sm:self-auto shrink-0">
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
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                      settings.touchControls === opt.id
                        ? 'bg-amber-400 text-slate-950'
                        : 'text-slate-400 hover:text-white'
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
                <div className="p-3.5 space-y-2.5">
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
                          aria-label={
                            isEn ? 'Reset Mini Map Size' : 'Mini Harita Boyutunu Sıfırla'
                          }
                          className="w-7 h-7 rounded-lg bg-white/[0.08] hover:bg-white/[0.15] text-sky-300 flex items-center justify-center cursor-pointer"
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
                      const nextScale = Math.max(
                        0.65,
                        Math.min(1.6, Number(e.target.value) / 100)
                      );
                      const nextLayout = { ...(settings.touchLayout ?? {}) };
                      const prevMm = nextLayout.minimap ?? { dx: 0, dy: 0 };
                      const hasCustomOpacity =
                        prevMm.opacity !== undefined && prevMm.opacity !== 1;
                      if (
                        nextScale === 1 &&
                        prevMm.dx === 0 &&
                        prevMm.dy === 0 &&
                        !hasCustomOpacity
                      ) {
                        delete nextLayout.minimap;
                      } else {
                        nextLayout.minimap = { ...prevMm, scale: nextScale };
                      }
                      onUpdateSettings({ ...settings, touchLayout: nextLayout });
                    }}
                    className="w-full accent-amber-400 cursor-pointer"
                  />
                </div>
              );
            })()}

            {/* Touch-Only Joystick Mode */}
            {isTouchInterfaceActive && (
              <div className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4">
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
                <div className="flex items-center gap-1 p-0.5 bg-[#061017] rounded-lg border border-white/[0.08] self-start sm:self-auto shrink-0">
                  <button
                    type="button"
                    onClick={() => onUpdateSettings({ ...settings, joystickMode: 'FIXED' })}
                    className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                      settings.joystickMode === 'FIXED'
                        ? 'bg-amber-400 text-slate-950'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {isEn ? 'Fixed' : 'Sabit'}
                  </button>
                  <button
                    type="button"
                    onClick={() => onUpdateSettings({ ...settings, joystickMode: 'DYNAMIC' })}
                    className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                      settings.joystickMode === 'DYNAMIC'
                        ? 'bg-amber-400 text-slate-950'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {isEn ? 'Dynamic' : 'Dinamik'}
                  </button>
                </div>
              </div>
            )}

            {/* HUD Layout Editor */}
            {onOpenLayoutEditor && (
              <div className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-100">
                    {isEn ? 'Controls, Weapon & Map Layout' : 'Tuş, Silah ve Harita Düzeni'}
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
                      className="px-2.5 py-2 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-slate-200 text-xs font-semibold flex items-center gap-1 cursor-pointer whitespace-nowrap"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>{isEn ? 'Reset' : 'Sıfırla'}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={onOpenLayoutEditor}
                    className="px-3.5 py-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                  >
                    <Move className="w-3.5 h-3.5" />
                    <span>{isEn ? 'Edit Layout' : 'Düzenle'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* PC / KEYBOARD-ONLY CONTROLS */}
          {!isTouchInterfaceActive && (
            <>
              {!isTouchDevice && (
                <div className="rounded-xl bg-[#0F212C]/65 border border-white/[0.08] overflow-hidden">
                  <div className="px-3.5 py-2.5 border-b border-white/[0.06] flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-100">
                      <Monitor className="w-4 h-4 text-sky-300 shrink-0" />
                      <span>
                        {isEn ? 'Desktop HUD Visibility' : 'Bilgisayar Arayüzü Görünümü'}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400">
                      {isEn ? 'ESC opens Settings' : 'Ayarlar: ESC'}
                    </span>
                  </div>

                  <div className="divide-y divide-white/[0.06]">
                    <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
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
                        className={`min-w-[68px] px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer shrink-0 ${
                          settings.desktopShowActionBar
                            ? 'bg-emerald-500 text-slate-950'
                            : 'bg-white/[0.06] text-slate-300'
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

                    <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
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
                        className={`min-w-[68px] px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer shrink-0 ${
                          settings.desktopShowSettingsButton
                            ? 'bg-emerald-500 text-slate-950'
                            : 'bg-white/[0.06] text-slate-300'
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

                    <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
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
                        className={`min-w-[68px] px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer shrink-0 ${
                          settings.desktopShowHudButtons
                            ? 'bg-emerald-500 text-slate-950'
                            : 'bg-white/[0.06] text-slate-300'
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
              <div className="rounded-xl bg-[#0F212C]/65 border border-white/[0.08] overflow-hidden">
                <div className="px-3.5 py-2.5 border-b border-white/[0.06] flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-100">
                    <Keyboard className="w-4 h-4 text-sky-300 shrink-0" />
                    <span>
                      {isEn
                        ? 'Keybindings (WASD / Arrows · F5 Save · ESC Settings)'
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

                <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {keyLabels.map((item) => {
                    const active = listeningKey === item.key;
                    return (
                      <div
                        key={item.key}
                        className="flex items-center justify-between px-3 py-2 rounded-lg bg-[#08131B] border border-white/[0.06] text-xs"
                      >
                        <span className="text-slate-300 truncate">{item.label}</span>
                        <button
                          type="button"
                          onClick={() => setListeningKey(active ? null : item.key)}
                          className={`px-2.5 py-1 rounded font-mono-num text-[11px] font-bold cursor-pointer transition-colors ${
                            active
                              ? 'bg-amber-400 text-slate-950'
                              : 'bg-white/[0.08] hover:bg-white/[0.14] text-amber-200 border border-white/10'
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
        </div>
      )}

      {/* TAB 4: SAVES & WORLD */}
      {activeTab === 'SAVE' && !onlineMode && (
        <div className="flex flex-col gap-4">
          <div className="rounded-xl bg-[#0F212C]/65 border border-white/[0.08] divide-y divide-white/[0.06]">
            <div className="p-3.5 flex flex-wrap items-center justify-between gap-2">
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
                  className="px-2.5 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/35 text-emerald-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isEn ? 'QuickSave (F5)' : 'Hızlı Kayıt (F5)'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadJson}
                  className="px-2.5 py-1.5 rounded-lg bg-white/[0.07] hover:bg-white/[0.13] text-slate-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>JSON</span>
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-2.5 py-1.5 rounded-lg bg-white/[0.07] hover:bg-white/[0.13] text-slate-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
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

            {/* World Seed row */}
            <div className="p-3.5 flex flex-wrap items-center gap-2 text-xs">
              <span className="text-slate-400">Seed:</span>
              <span className="font-mono-num font-bold text-amber-300">{worldSeed}</span>
              <button
                type="button"
                onClick={handleCopySeed}
                className="p-1.5 rounded-md bg-white/[0.07] hover:bg-white/[0.14] text-slate-200 cursor-pointer"
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
                  className="w-28 min-h-[38px] sm:min-h-[34px] px-2.5 py-1.5 rounded-lg bg-[#061017] border border-white/12 text-slate-100 font-mono-num text-[16px] sm:text-xs"
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
                  className="min-h-[38px] sm:min-h-[34px] px-3 py-1.5 rounded-lg bg-sky-400/20 hover:bg-sky-400/30 border border-sky-400/35 text-sky-200 text-xs font-semibold cursor-pointer whitespace-nowrap"
                >
                  {isEn ? 'Launch Seed' : 'Tohumla Başla'}
                </button>
              </div>
            </div>

            {/* 3 Save Slots */}
            <div className="p-3.5 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {[1, 2, 3].map((slotNum) => {
                const summary = slots[slotNum - 1];
                return (
                  <div
                    key={slotNum}
                    className="p-3 rounded-lg bg-[#08131B] border border-white/[0.07] flex flex-col justify-between gap-2.5 text-xs"
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
                            isEn ? `Saved to Slot ${slotNum}` : `Yuva ${slotNum}'e kaydedildi!`
                          );
                        }}
                        className="flex-1 py-1.5 rounded-md bg-amber-400/15 hover:bg-amber-400/25 border border-amber-400/35 text-amber-200 text-[11px] font-semibold cursor-pointer"
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
                        className={`flex-1 py-1.5 rounded-md text-[11px] font-semibold border ${
                          summary
                            ? 'bg-sky-400/15 hover:bg-sky-400/25 border-sky-400/35 text-sky-200 cursor-pointer'
                            : 'bg-white/[0.03] border-white/[0.05] text-slate-600 cursor-not-allowed'
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
          <div className="p-3.5 rounded-xl bg-rose-500/[0.06] border border-rose-400/25 flex items-center justify-between gap-3">
            {!confirmReset ? (
              <>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-rose-200">
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
                  className="px-3.5 py-2 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-400/35 text-rose-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>{isEn ? 'Reset' : 'Sıfırla'}</span>
                </button>
              </>
            ) : (
              <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 w-full justify-between">
                <span className="text-xs text-rose-200">
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
                    className="px-3 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-400 text-xs font-bold text-slate-950 cursor-pointer"
                  >
                    {isEn ? 'Yes, Reset' : 'Evet, Sıfırla'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </ResponsiveModalShell>
  );
};
