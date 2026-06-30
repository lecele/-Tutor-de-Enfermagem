'use client';

// components/chat/MessageInput.tsx — Input pill estilo InterAtiva, azul

import { useState, useRef, useCallback, KeyboardEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2 } from 'lucide-react';

interface MessageInputProps {
  onSend: (message: string) => void;
  isLoading: boolean;
  disabled?: boolean;
}

export function MessageInput({ onSend, isLoading, disabled }: MessageInputProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
      {/* Pill container — igual ao InterAtiva */}
      <div className="
        flex items-center gap-2
        bg-[#1573C2] dark:bg-[#0D3A6E]
        rounded-[2rem] p-1 md:p-2 pl-4 md:pl-8
        shadow-[0_10px_20px_rgba(0,0,0,0.15)] dark:shadow-[0_10px_20px_rgba(0,0,0,0.4)]
        focus-within:shadow-[0_0_20px_rgba(21,115,194,0.3)]
        transition-all
        border border-transparent focus-within:border-blue-400/50
      ">
        {/* Input / Textarea */}
        <textarea
          ref={textareaRef}
          rows={1}
          value={value}
          onChange={(e) => { setValue(e.target.value); handleInput(); }}
          onKeyDown={handleKeyDown}
          disabled={isLoading || disabled}
          placeholder="Pergunte ao Tutor..."
          className="
            w-full bg-transparent border-none focus:outline-none
            text-white placeholder-white/70 dark:placeholder-white/50
            font-medium text-base
            py-2.5 md:py-3 resize-none disabled:opacity-50
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
            border border-white/10 dark:border-blue-300/30
            ${canSend
              ? 'bg-[#0d4a87] dark:bg-gradient-to-r dark:from-[#1573C2] dark:to-[#0d4a87] hover:brightness-110 text-white cursor-pointer'
              : 'bg-[#0d4a87]/60 text-white/40 cursor-not-allowed'
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
