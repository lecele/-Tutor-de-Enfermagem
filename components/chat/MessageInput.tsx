'use client';

// components/chat/MessageInput.tsx — Barra de digitação premium de alto contraste (SaaS/Healthtech style)

import { useState, useRef, useCallback, KeyboardEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowUp, Loader2 } from 'lucide-react';

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
    // Reseta altura do textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [canSend, onSend, value]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      // Enter envia por padrão, Shift+Enter pula linha
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  // Auto-resize do textarea (máx 6 linhas)
  const handleInput = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 144)}px`;
  }, []);

  return (
    <div className="w-full">
      {/* Container do Input com glassmorphism escuro e glow celeste */}
      <motion.div
        className="relative w-full bg-[#0b334c] border border-sky-500/30 shadow-[0_4px_20px_rgba(0,0,0,0.3)] rounded-2xl p-2 pl-4 flex items-end gap-2 transition-all focus-within:border-sky-400/70 focus-within:shadow-[0_0_0_3px_rgba(14,165,233,0.2)]"
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* Textarea que cresce */}
        <textarea
          ref={textareaRef}
          rows={1}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            handleInput();
          }}
          onKeyDown={handleKeyDown}
          disabled={isLoading || disabled}
          placeholder="Faça uma pergunta sobre enfermagem..."
          className="flex-1 resize-none bg-transparent py-2.5 text-[13.5px] leading-relaxed text-slate-100 placeholder:text-sky-200/50 focus:outline-none disabled:opacity-50"
          style={{ maxHeight: '144px' }}
        />

        {/* Botão de envio com degradê celeste e ícone escuro */}
        <div className="flex-shrink-0">
          <SendButton canSend={canSend} isLoading={isLoading} onSend={handleSend} />
        </div>
      </motion.div>
    </div>
  );
}

// ── Botão de Envio com presença visual e contraste ──────────────────────────

function SendButton({
  canSend,
  isLoading,
  onSend,
}: {
  canSend: boolean;
  isLoading: boolean;
  onSend: () => void;
}) {
  return (
    <motion.button
      onClick={onSend}
      disabled={!canSend}
      className={`
        relative flex h-9 w-9 items-center justify-center rounded-xl
        transition-all duration-300 cursor-pointer
        ${
          canSend
            ? 'bg-gradient-to-r from-[#0ea5e9] to-[#38bdf8] text-slate-950 shadow-md shadow-sky-500/25 border border-sky-400/20 hover:brightness-110'
            : 'bg-[#04090f] text-slate-600 border border-white/5 cursor-not-allowed'
        }
      `}
      whileHover={canSend ? { scale: 1.04 } : {}}
      whileTap={canSend ? { scale: 0.96 } : {}}
      title="Enviar pergunta"
    >
      <AnimatePresence mode="wait">
        {isLoading ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0, rotate: -90 }}
            animate={{ opacity: 1, rotate: 0 }}
            exit={{ opacity: 0 }}
          >
            <Loader2 className={`h-4 w-4 animate-spin ${canSend ? 'text-slate-950' : 'text-slate-600'}`} />
          </motion.div>
        ) : (
          <motion.div
            key="send"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
          >
            <ArrowUp className={`h-4.5 w-4.5 ${canSend ? 'text-slate-950' : 'text-slate-600'}`} strokeWidth={3} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  );
}
