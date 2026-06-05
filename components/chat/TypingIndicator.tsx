'use client';

// components/chat/TypingIndicator.tsx — Indicador animado de resposta em andamento

import { motion } from 'framer-motion';
import { Bot } from 'lucide-react';

export function TypingIndicator() {
  return (
    <motion.div
      className="flex items-end gap-3"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.3 }}
    >
      {/* Avatar do agente com glow celeste */}
      <div className="relative flex-shrink-0">
        <div className="absolute inset-0 rounded-full bg-sky-500/20 blur-md scale-125 animate-pulse" />
        <div className="relative flex h-8 w-8 items-center justify-center rounded-full border border-sky-500/35 bg-[#050c14] shadow-[0_0_15px_rgba(14,165,233,0.4)]">
          <Bot className="h-4 w-4 text-sky-400" />
        </div>
      </div>

      {/* Balão com dots pulsando - Dark Glassmorphism */}
      <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-sm border border-slate-200 bg-slate-50 px-4 py-3 shadow-sm">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="h-2 w-2 rounded-full bg-[#0ea5e9] shadow-[0_0_8px_rgba(14,165,233,0.8)]"
            animate={{
              y: [0, -6, 0],
              opacity: [0.4, 1, 0.4],
            }}
            transition={{
              duration: 0.8,
              repeat: Infinity,
              delay: i * 0.15,
              ease: 'easeInOut',
            }}
          />
        ))}
      </div>

      {/* Label discreto */}
      <span className="mb-1 text-[11px] font-medium text-slate-400 font-display">Processando...</span>
    </motion.div>
  );
}
