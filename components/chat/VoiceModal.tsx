'use client';

// components/chat/VoiceModal.tsx — Modal de gravação de voz com animação de ondas

import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface VoiceModalProps {
  isListening: boolean;
  onStop: () => void;
}

export function VoiceModal({ isListening, onStop }: VoiceModalProps) {
  // Fecha o modal com a tecla Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isListening) onStop();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isListening, onStop]);

  return (
    <AnimatePresence>
      {isListening && (
        <motion.div
          key="voice-modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={onStop}
        >
          {/* Card central */}
          <motion.div
            key="voice-modal-card"
            initial={{ scale: 0.85, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.85, opacity: 0, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="
              relative flex flex-col items-center gap-6
              bg-white dark:bg-[#06101e]
              rounded-[2rem] px-10 py-10
              shadow-[0_30px_60px_rgba(0,0,0,0.4)]
              border border-blue-200/40 dark:border-blue-500/20
              w-[320px] max-w-[90vw]
            "
            onClick={(e) => e.stopPropagation()}
          >
            {/* Título */}
            <p className="text-[#1573C2] dark:text-blue-300 font-bold text-sm uppercase tracking-widest">
              Ouvindo você...
            </p>

            {/* Animação de ondas concêntricas */}
            <div className="relative flex items-center justify-center w-28 h-28">
              {/* Onda 1 */}
              <motion.span
                className="absolute rounded-full bg-[#1573C2]/15 dark:bg-[#1573C2]/20"
                animate={{ scale: [1, 1.7, 1], opacity: [0.6, 0, 0.6] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                style={{ width: '112px', height: '112px' }}
              />
              {/* Onda 2 */}
              <motion.span
                className="absolute rounded-full bg-[#1573C2]/20 dark:bg-[#1573C2]/30"
                animate={{ scale: [1, 1.45, 1], opacity: [0.7, 0, 0.7] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut', delay: 0.3 }}
                style={{ width: '84px', height: '84px' }}
              />
              {/* Onda 3 */}
              <motion.span
                className="absolute rounded-full bg-[#1573C2]/30 dark:bg-[#1573C2]/40"
                animate={{ scale: [1, 1.25, 1], opacity: [0.8, 0.2, 0.8] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut', delay: 0.6 }}
                style={{ width: '60px', height: '60px' }}
              />

              {/* Círculo central com ícone de microfone */}
              <motion.div
                className="relative z-10 w-14 h-14 rounded-full bg-[#1573C2] flex items-center justify-center shadow-lg shadow-blue-500/30"
                animate={{ scale: [1, 1.06, 1] }}
                transition={{ duration: 0.8, repeat: Infinity, ease: 'easeInOut' }}
              >
                <span className="material-symbols-outlined text-white text-[28px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                  mic
                </span>
              </motion.div>
            </div>

            {/* Texto auxiliar */}
            <p className="text-slate-500 dark:text-slate-400 text-xs text-center leading-relaxed">
              Fale sua pergunta em português.<br />
              Toque em parar quando terminar.
            </p>

            {/* Botão Parar */}
            <button
              onClick={onStop}
              className="
                flex items-center gap-2
                bg-red-500 hover:bg-red-600
                text-white font-bold text-sm
                px-6 py-3 rounded-full
                shadow-md transition-all active:scale-95 cursor-pointer
              "
            >
              <motion.span
                className="material-symbols-outlined text-[18px]"
                animate={{ scale: [1, 1.15, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
              >
                stop_circle
              </motion.span>
              Parar Gravação
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
