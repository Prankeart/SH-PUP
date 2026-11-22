import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { PlatformProfile, usePlatformProfile } from '../utils/platform';

export interface ModalTabItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  badge?: string | number;
  alert?: boolean;
}

interface ResponsiveModalShellProps {
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  headerRight?: React.ReactNode;
  tabs?: ModalTabItem[];
  activeTab?: string;
  onTabChange?: (id: string) => void;
  railFooter?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
  maxWidthClass?: string;
  zIndexClass?: string;
  profileOverride?: PlatformProfile;
  bodyRef?: React.RefObject<HTMLDivElement | null>;
}

export const ResponsiveModalShell: React.FC<ResponsiveModalShellProps> = ({
  onClose,
  title,
  subtitle,
  icon,
  headerRight,
  tabs,
  activeTab,
  onTabChange,
  railFooter,
  footer,
  children,
  maxWidthClass = 'max-w-5xl',
  zIndexClass = 'z-50',
  profileOverride,
  bodyRef,
}) => {
  const detected = usePlatformProfile();
  const profile = profileOverride ?? detected.profile;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const hasTabs = Boolean(tabs && tabs.length > 0 && onTabChange);

  // 1. MOBILE PORTRAIT: Native Thumb-Zone Bottom Sheet
  if (profile === 'mobile-portrait') {
    return (
      <div
        className={`fixed inset-0 ${zIndexClass} flex items-end justify-center bg-[#040B11]/78 backdrop-blur-sm`}
        onClick={onClose}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label={title}
          onClick={(e) => e.stopPropagation()}
          className="w-full h-[90dvh] max-h-[90dvh] rounded-t-2xl bg-[#0A1720] border-t border-x border-white/10 shadow-[0_-18px_50px_rgba(0,0,0,0.65)] flex flex-col overflow-hidden"
        >
          <div className="pt-2 pb-1 flex justify-center shrink-0">
            <div className="w-9 h-1 rounded-full bg-white/20" />
          </div>

          <div className="px-4 pb-3 pt-1 border-b border-white/[0.08] flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              {icon && <div className="text-amber-400 shrink-0">{icon}</div>}
              <div className="min-w-0">
                <h2 className="font-display text-base font-bold text-slate-50 truncate">{title}</h2>
                {subtitle && <p className="text-[11px] text-slate-400 truncate">{subtitle}</p>}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {headerRight}
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="w-10 h-10 rounded-lg hover:bg-white/[0.07] active:bg-white/10 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {hasTabs && tabs && (
            <div className="flex items-center border-b border-white/[0.08] px-3 overflow-x-auto no-scrollbar shrink-0 bg-[#08131B]">
              {tabs.map((tab) => {
                const active = tab.id === activeTab;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => onTabChange?.(tab.id)}
                    className={`relative min-h-[44px] px-3.5 py-2 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                      active ? 'text-amber-300' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {tab.icon}
                    <span>{tab.label}</span>
                    {tab.badge !== undefined && tab.badge !== null && tab.badge !== '' && (
                      <span
                        className={`font-mono-num text-[11px] ${
                          tab.alert ? 'text-amber-400 font-bold' : 'text-slate-500'
                        }`}
                      >
                        {tab.badge}
                      </span>
                    )}
                    {active && (
                      <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-amber-400 rounded-full" />
                    )}
                  </button>
                );
              })}
            </div>
          )}

          <div
            ref={bodyRef}
            className="flex-1 overflow-y-auto px-4 py-4 space-y-4 overscroll-contain"
          >
            {children}
          </div>

          {footer && (
            <div className="px-4 pt-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] border-t border-white/[0.08] bg-[#08131B] shrink-0">
              {footer}
            </div>
          )}
        </div>
      </div>
    );
  }

  // 2. MOBILE LANDSCAPE: Full-Height Split Sheet (Slim Left Rail + Scrollable Body)
  if (profile === 'mobile-landscape') {
    return (
      <div
        className={`fixed inset-0 ${zIndexClass} flex items-center justify-center bg-[#040B11]/82 backdrop-blur-sm p-2`}
        onClick={onClose}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label={title}
          onClick={(e) => e.stopPropagation()}
          className="w-full h-full max-w-4xl rounded-xl bg-[#0A1720] border border-white/10 shadow-[0_24px_60px_rgba(0,0,0,0.72)] flex overflow-hidden"
        >
          {/* Left Compact Navigation Rail */}
          <aside className="w-44 shrink-0 border-r border-white/[0.08] bg-[#08131B] flex flex-col justify-between">
            <div className="p-3 border-b border-white/[0.08] flex items-center gap-2 min-w-0">
              {icon && <div className="text-amber-400 shrink-0">{icon}</div>}
              <div className="min-w-0">
                <h2 className="font-display text-sm font-bold text-slate-50 truncate">{title}</h2>
                {subtitle && <p className="text-[10px] text-slate-400 truncate">{subtitle}</p>}
              </div>
            </div>

            {hasTabs && tabs ? (
              <nav className="flex-1 overflow-y-auto p-1.5 space-y-0.5 no-scrollbar">
                {tabs.map((tab) => {
                  const active = tab.id === activeTab;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => onTabChange?.(tab.id)}
                      className={`w-full min-h-[40px] px-2.5 py-2 rounded-lg text-xs font-semibold flex items-center justify-between gap-1.5 cursor-pointer transition-colors ${
                        active
                          ? 'bg-amber-400/12 text-amber-300'
                          : 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.04]'
                      }`}
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <span className="shrink-0">{tab.icon}</span>
                        <span className="truncate">{tab.label}</span>
                      </span>
                      {tab.badge !== undefined && tab.badge !== null && tab.badge !== '' && (
                        <span
                          className={`font-mono-num text-[10px] shrink-0 ${
                            tab.alert ? 'text-amber-400 font-bold' : 'text-slate-500'
                          }`}
                        >
                          {tab.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>
            ) : (
              <div className="flex-1" />
            )}

            {railFooter && (
              <div className="p-2.5 border-t border-white/[0.08] text-[11px] text-slate-400">
                {railFooter}
              </div>
            )}
          </aside>

          {/* Right Main Viewport */}
          <div className="flex-1 min-w-0 flex flex-col">
            <div className="px-4 py-2 border-b border-white/[0.08] flex items-center justify-between gap-3 shrink-0 bg-[#0A1720]">
              <div className="flex items-center gap-2 min-w-0">{headerRight}</div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="w-9 h-9 rounded-lg hover:bg-white/[0.07] text-slate-400 hover:text-white flex items-center justify-center cursor-pointer transition-colors shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div
              ref={bodyRef}
              className="flex-1 overflow-y-auto px-4 py-3.5 space-y-3.5 overscroll-contain"
            >
              {children}
            </div>

            {footer && (
              <div className="px-4 py-2 border-t border-white/[0.08] bg-[#08131B] shrink-0">
                {footer}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // 3. TABLET & DESKTOP: Architectural Left-Rail Command Dialog
  const isTablet = profile === 'tablet';

  return (
    <div
      className={`fixed inset-0 ${zIndexClass} flex items-center justify-center bg-[#040B11]/78 backdrop-blur-sm p-4 lg:p-6`}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className={`w-full ${maxWidthClass} ${
          isTablet ? 'h-[86dvh] max-h-[820px]' : 'h-[84vh] max-h-[760px]'
        } rounded-2xl bg-[#0A1720] border border-white/10 shadow-[0_28px_72px_rgba(0,0,0,0.72)] flex overflow-hidden`}
      >
        {/* Left Navigation Rail (when tabs present) */}
        {hasTabs && tabs && (
          <aside
            className={`${
              isTablet ? 'w-48' : 'w-56'
            } shrink-0 border-r border-white/[0.08] bg-[#08131B] flex flex-col justify-between`}
          >
            <div>
              <div className="px-5 py-4 border-b border-white/[0.08] flex items-center gap-2.5">
                {icon && <div className="text-amber-400 shrink-0">{icon}</div>}
                <div className="min-w-0">
                  <h2 className="font-display text-base font-bold text-slate-50 truncate leading-tight">
                    {title}
                  </h2>
                  {subtitle && (
                    <p className="text-[11px] text-slate-400 truncate mt-0.5">{subtitle}</p>
                  )}
                </div>
              </div>

              <nav className="p-2.5 space-y-1">
                {tabs.map((tab) => {
                  const active = tab.id === activeTab;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => onTabChange?.(tab.id)}
                      className={`w-full ${
                        isTablet ? 'min-h-[44px]' : 'min-h-[40px]'
                      } px-3 py-2 rounded-lg text-[13px] font-semibold flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                        active
                          ? 'bg-amber-400/12 text-amber-300'
                          : 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.04]'
                      }`}
                    >
                      <span className="flex items-center gap-2.5 min-w-0">
                        <span className={active ? 'text-amber-400 shrink-0' : 'text-slate-400 shrink-0'}>
                          {tab.icon}
                        </span>
                        <span className="truncate">{tab.label}</span>
                      </span>
                      {tab.badge !== undefined && tab.badge !== null && tab.badge !== '' && (
                        <span
                          className={`font-mono-num text-[11px] shrink-0 ${
                            tab.alert ? 'text-amber-400 font-bold' : 'text-slate-500'
                          }`}
                        >
                          {tab.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>
            </div>

            {railFooter && (
              <div className="p-4 border-t border-white/[0.08] text-xs text-slate-400">
                {railFooter}
              </div>
            )}
          </aside>
        )}

        {/* Main Content Pane */}
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="px-6 py-4 border-b border-white/[0.08] flex items-center justify-between gap-4 shrink-0">
            {hasTabs ? (
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                  {tabs?.find((t) => t.id === activeTab)?.label ?? title}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2.5 min-w-0">
                {icon && <div className="text-amber-400 shrink-0">{icon}</div>}
                <div className="min-w-0">
                  <h2 className="font-display text-lg font-bold text-slate-50 truncate">{title}</h2>
                  {subtitle && <p className="text-xs text-slate-400 truncate">{subtitle}</p>}
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 shrink-0">
              {headerRight}
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="w-9 h-9 rounded-lg hover:bg-white/[0.07] text-slate-400 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div
            ref={bodyRef}
            className="flex-1 overflow-y-auto px-6 py-5 space-y-5 overscroll-contain"
          >
            {children}
          </div>

          {footer && (
            <div className="px-6 py-3.5 border-t border-white/[0.08] bg-[#08131B] shrink-0">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
