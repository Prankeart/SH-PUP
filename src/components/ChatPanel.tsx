import React, { useEffect, useRef, useState } from 'react';
import { ArrowDown, MessageCircle, Send, Smile, X as XIcon } from 'lucide-react';
import { OnlineChatMessage } from '../types/online';

const QUICK_EMOTES = ['👋', '⚔️', '💰', '🏴‍☠️', '🆘', '❤️'] as const;

interface ChatPanelProps {
  messages: OnlineChatMessage[];
  currentPlayerId: string;
  playerCount: number;
  chatInput: string;
  onChatInputChange: (value: string) => void;
  onSendChat: (text: string) => void;
  onSendEmote: (emote: string) => void;
  onClose: () => void;
  language: 'tr' | 'en';
  isTouchOrMobile: boolean;
  keyboardOpen?: boolean;
  compactHeight?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

function formatMessageTime(ts: number): string {
  if (!Number.isFinite(ts) || ts <= 0) return '';
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function getInitial(name: string): string {
  const trimmed = name.trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() : '?';
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
  messages,
  currentPlayerId,
  playerCount,
  chatInput,
  onChatInputChange,
  onSendChat,
  onSendEmote,
  onClose,
  language,
  isTouchOrMobile,
  keyboardOpen = false,
  compactHeight = false,
  className = '',
  style,
}) => {
  const listRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [emotesOpen, setEmotesOpen] = useState(false);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [hasUnseenBelow, setHasUnseenBelow] = useState(false);
  const prevLenRef = useRef(messages.length);

  const isEn = language === 'en';
  const trimmedInput = chatInput.trim();
  const canSend = trimmedInput.length > 0;
  const showCompactHeader = keyboardOpen && compactHeight;

  const scrollToBottom = (behavior: ScrollBehavior = 'auto') => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
    setIsNearBottom(true);
    setHasUnseenBelow(false);
  };

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    setIsNearBottom(true);
    setHasUnseenBelow(false);
  }, [compactHeight, emotesOpen]);

  useEffect(() => {
    const grew = messages.length !== prevLenRef.current;
    prevLenRef.current = messages.length;
    if (!grew) return;

    const lastMsg = messages[messages.length - 1];
    const sentByMe = lastMsg?.senderId === currentPlayerId;
    if (isNearBottom || sentByMe) {
      scrollToBottom('auto');
    } else {
      setHasUnseenBelow(true);
    }
  }, [messages, currentPlayerId, isNearBottom]);

  const handleListScroll = () => {
    const el = listRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const near = distanceFromBottom < 36;
    setIsNearBottom(near);
    if (near) {
      setHasUnseenBelow(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSend) return;
    onSendChat(trimmedInput);
    onChatInputChange('');
    setEmotesOpen(false);
  };

  return (
    <div
      style={style}
      className={`pointer-events-auto rounded-[20px] bg-[#081A24]/92 backdrop-blur-xl border border-white/12 ring-1 ring-inset ring-white/[0.05] shadow-[0_22px_54px_rgba(2,10,18,0.68)] text-slate-100 flex flex-col overflow-hidden ${className}`}
    >
      {/* Minimal Single-Row Header */}
      <div
        className={`flex items-center justify-between shrink-0 ${
          showCompactHeader ? 'px-3 pt-2 pb-1' : 'px-3.5 pt-2.5 pb-1.5'
        }`}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <h2 className="font-display font-semibold text-[13px] text-slate-50 tracking-tight truncate">
            {isEn ? 'Fleet Chat' : 'Filo Sohbeti'}
          </h2>
          {playerCount > 0 && (
            <>
              <span className="text-slate-500 text-xs" aria-hidden="true">
                ·
              </span>
              <span className="text-[11px] text-slate-400 font-mono-num whitespace-nowrap">
                {isEn ? `${playerCount} online` : `${playerCount} kaptan`}
              </span>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label={isEn ? 'Close chat' : 'Sohbeti kapat'}
          className={`flex items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-white/10 active:scale-95 transition cursor-pointer shrink-0 ${
            isTouchOrMobile ? 'w-9 h-9 -mr-1' : 'w-7 h-7 -mr-0.5'
          }`}
        >
          <XIcon className="w-4 h-4" />
        </button>
      </div>

      {/* Scrollable Message Feed */}
      <div className="relative flex-1 min-h-0 flex flex-col">
        <div
          ref={listRef}
          onScroll={handleListScroll}
          className="flex-1 min-h-0 overflow-y-auto overscroll-contain touch-pan-y px-3 py-1.5 space-y-2"
        >
          {messages.length === 0 ? (
            <div className="h-full min-h-[76px] flex flex-col items-center justify-center text-center px-4 py-3 select-none">
              <MessageCircle className="w-5 h-5 text-slate-500/70 mb-1.5" strokeWidth={1.6} />
              <p className="text-xs font-medium text-slate-300/90">
                {isEn ? 'No messages yet' : 'Henüz mesaj yok'}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {isEn ? 'Send a quick message or emote to your fleet.' : 'Filodaki kaptanlara ilk mesajı gönder.'}
              </p>
            </div>
          ) : (
            messages.map((m, idx) => {
              const prev = idx > 0 ? messages[idx - 1] : null;
              const next = idx < messages.length - 1 ? messages[idx + 1] : null;

              if (m.senderId === 'SYSTEM') {
                return (
                  <div
                    key={m.id}
                    className="text-[11px] text-amber-200/75 text-center px-2 py-0.5 leading-relaxed break-words"
                  >
                    {m.text}
                  </div>
                );
              }

              const isMe = m.senderId === currentPlayerId;
              const groupedWithPrev =
                Boolean(prev) &&
                prev!.senderId === m.senderId &&
                m.ts - prev!.ts < 90_000;
              const groupedWithNext =
                Boolean(next) &&
                next!.senderId === m.senderId &&
                next!.ts - m.ts < 90_000;
              const accentColor = m.bannerColor || '#38BDF8';
              const timeLabel = formatMessageTime(m.ts);

              if (isMe) {
                return (
                  <div
                    key={m.id}
                    className={`flex flex-col items-end ${groupedWithPrev ? '-mt-1' : ''}`}
                  >
                    <div
                      className={`max-w-[85%] px-3 py-1.5 text-[13px] leading-snug break-words select-text bg-sky-500/20 border border-sky-400/25 text-slate-50 ${
                        groupedWithPrev && groupedWithNext
                          ? 'rounded-2xl rounded-r-md'
                          : groupedWithPrev
                          ? 'rounded-2xl rounded-tr-md rounded-br-sm'
                          : 'rounded-2xl rounded-br-sm'
                      }`}
                    >
                      {m.text}
                    </div>
                    {!groupedWithNext && timeLabel && (
                      <span className="text-[10px] text-slate-500 font-mono-num mt-0.5 px-1">
                        {timeLabel}
                      </span>
                    )}
                  </div>
                );
              }

              return (
                <div
                  key={m.id}
                  className={`flex items-start gap-2 ${groupedWithPrev ? '-mt-1' : ''}`}
                >
                  {!groupedWithPrev ? (
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 mt-0.5 select-none"
                      style={{
                        backgroundColor: `${accentColor}22`,
                        border: `1px solid ${accentColor}55`,
                        color: accentColor,
                      }}
                      aria-hidden="true"
                    >
                      {getInitial(m.senderName)}
                    </div>
                  ) : (
                    <div className="w-6 shrink-0" aria-hidden="true" />
                  )}

                  <div className="flex flex-col items-start min-w-0 max-w-[82%]">
                    {!groupedWithPrev && (
                      <div className="flex items-baseline gap-1.5 px-0.5 mb-0.5 max-w-full">
                        <span
                          className="text-[11px] font-semibold truncate"
                          style={{ color: accentColor }}
                        >
                          {m.senderName}
                        </span>
                        {timeLabel && (
                          <span className="text-[10px] text-slate-500 font-mono-num shrink-0">
                            {timeLabel}
                          </span>
                        )}
                      </div>
                    )}

                    <div
                      className={`px-3 py-1.5 text-[13px] leading-snug break-words select-text bg-white/[0.07] border border-white/[0.06] text-slate-100 ${
                        groupedWithPrev && groupedWithNext
                          ? 'rounded-2xl rounded-l-md'
                          : groupedWithPrev
                          ? 'rounded-2xl rounded-tl-md rounded-bl-sm'
                          : 'rounded-2xl rounded-bl-sm'
                      }`}
                    >
                      {m.text}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {hasUnseenBelow && (
          <button
            type="button"
            onClick={() => scrollToBottom('smooth')}
            aria-label={isEn ? 'Scroll to latest messages' : 'En yeni mesajlara git'}
            className="absolute bottom-2 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-full bg-slate-900/95 border border-sky-400/40 text-sky-200 text-[11px] font-medium flex items-center gap-1 shadow-lg hover:bg-slate-800 cursor-pointer"
          >
            <ArrowDown className="w-3 h-3" />
            <span>{isEn ? 'New messages' : 'Yeni mesajlar'}</span>
          </button>
        )}
      </div>

      {/* Optional Collapsible Quick Emote Drawer */}
      {emotesOpen && !showCompactHeader && (
        <div className="mx-2.5 mt-1 p-1 rounded-xl bg-white/[0.05] border border-white/[0.07] flex items-center justify-between gap-1 shrink-0">
          {QUICK_EMOTES.map((em) => (
            <button
              key={em}
              type="button"
              onClick={() => {
                onSendEmote(em);
                setEmotesOpen(false);
              }}
              aria-label={isEn ? `Send ${em} emote` : `${em} ifadesi gönder`}
              className="flex-1 py-1.5 rounded-lg hover:bg-white/12 active:scale-90 transition text-base leading-none cursor-pointer"
            >
              {em}
            </button>
          ))}
        </div>
      )}

      {/* Unified Composer */}
      <form
        onSubmit={handleSubmit}
        className="mx-2.5 mb-2.5 mt-1.5 flex items-center gap-1 rounded-2xl bg-slate-950/75 border border-white/12 px-1.5 py-1 focus-within:border-sky-400/60 focus-within:bg-slate-950/90 transition-colors shrink-0"
      >
        {!showCompactHeader && (
          <button
            type="button"
            onClick={() => setEmotesOpen((prev) => !prev)}
            aria-label={isEn ? 'Quick emotes' : 'Hızlı ifadeler'}
            aria-expanded={emotesOpen}
            className={`flex items-center justify-center rounded-xl transition cursor-pointer shrink-0 ${
              isTouchOrMobile ? 'w-9 h-9' : 'w-8 h-8'
            } ${
              emotesOpen
                ? 'bg-sky-500/20 text-sky-300'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.07]'
            }`}
          >
            <Smile className="w-4 h-4" />
          </button>
        )}

        <input
          ref={inputRef}
          type="text"
          value={chatInput}
          maxLength={140}
          enterKeyHint="send"
          autoComplete="off"
          onChange={(e) => onChatInputChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.stopPropagation();
              inputRef.current?.blur();
              onClose();
            }
          }}
          placeholder={isEn ? 'Message fleet...' : 'Filoya mesaj yaz...'}
          className={`flex-1 min-w-0 bg-transparent px-1.5 py-1 text-slate-100 placeholder:text-slate-500 focus:outline-none select-text touch-manipulation ${
            isTouchOrMobile ? 'text-[16px] leading-5' : 'text-[13px] leading-5'
          }`}
        />

        {chatInput.length >= 100 && (
          <span className="text-[10px] font-mono-num text-amber-300/85 px-1 shrink-0">
            {140 - chatInput.length}
          </span>
        )}

        <button
          type="submit"
          disabled={!canSend}
          aria-label={isEn ? 'Send message' : 'Mesaj gönder'}
          className={`flex items-center justify-center rounded-xl transition shrink-0 ${
            isTouchOrMobile ? 'w-9 h-9' : 'w-8 h-8'
          } ${
            canSend
              ? 'bg-sky-400 hover:bg-sky-300 active:scale-95 text-slate-950 shadow-sm cursor-pointer'
              : 'bg-white/[0.06] text-slate-500 cursor-default'
          }`}
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
