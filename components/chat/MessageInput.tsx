'use client';

// components/chat/MessageInput.tsx — Input pill sem botões de voz

import { useState, useRef, useCallback, useEffect, KeyboardEvent } from 'react';
import { Loader2 } from 'lucide-react';

interface MessageInputProps {
  onSend: (message: string) => void;
  isLoading: boolean;
  disabled?: boolean;
}

export function MessageInput({
  onSend,
  isLoading,
  disabled,
}: MessageInputProps) {
  const [value, setValue] = useState('');
  const [placeholder, setPlaceholder] = useState('Pergunte...');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Ajusta o placeholder dinamicamente para não quebrar linha no celular
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const updatePlaceholder = () => {
      setPlaceholder(window.innerWidth < 640 ? 'Pergunte...' : 'Pergunte ao Tutor...');
    };
    updatePlaceholder();
    window.addEventListener('resize', updatePlaceholder);
    return () => window.removeEventListener('resize', updatePlaceholder);
  }, []);

  const canSend = value.trim().length > 0 && !isLoading && !disabled;

  const handleSend = useCallback(() => {
    if (!canSend) return;
    onSend(value.trim());
    setValue('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  }, [canSend, onSend, value]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const handleInput = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 144)}px`;
  }, []);

  return (
    <form
      id="chat-form"
      className="relative group w-full"
      onSubmit={(e) => { e.preventDefault(); handleSend(); }}
    >
      {/* Pill container */}
      <div className="
        flex items-center gap-2
        rounded-[2rem] p-1 md:p-2 pl-4 md:pl-6
        shadow-[0_10px_20px_rgba(0,0,0,0.15)] dark:shadow-[0_10px_20px_rgba(0,0,0,0.4)]
        focus-within:shadow-[0_0_20px_rgba(21,115,194,0.3)]
        transition-all
        tutor-gradient-border
        [--tutor-border-bg:#1573C2]
        dark:[--tutor-border-bg:#0D3A6E]
      ">
        {/* Input / Textarea */}
        <textarea
          ref={textareaRef}
          rows={1}
          value={value}
          onChange={(e) => { setValue(e.target.value); handleInput(); }}
          onKeyDown={handleKeyDown}
          disabled={isLoading || disabled}
          placeholder={placeholder}
          className="
            w-full bg-transparent border-none focus:outline-none
            text-white placeholder-white/70 dark:placeholder-white/50
            font-medium text-sm sm:text-base
            py-2 md:py-3 resize-none disabled:opacity-50
          "
          style={{ maxHeight: '144px' }}
          autoComplete="off"
        />

        {/* Botão Enviar */}
        <button
          type="submit"
          disabled={!canSend}
          className={`
            flex items-center justify-center
            w-11 h-11 md:w-14 md:h-14
            rounded-2xl md:rounded-[1.2rem]
            shadow-md transition-all active:scale-95 shrink-0
            tutor-gradient-border
            ${canSend
              ? 'text-white cursor-pointer [--tutor-border-bg:#0d4a87] hover:[--tutor-border-bg:#0a3a6b]'
              : 'text-white/40 cursor-not-allowed [--tutor-border-bg:#0d4a87] opacity-50'
            }
          `}
        >
          {isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin text-white" />
          ) : (
            <span className="material-symbols-outlined text-[24px] md:text-[28px] select-none">
              send
            </span>
          )}
        </button>
      </div>
    </form>
  );
}
