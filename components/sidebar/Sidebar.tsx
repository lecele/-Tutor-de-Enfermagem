'use client';

// components/sidebar/Sidebar.tsx — Painel lateral premium minimalista (Healthtech style)

import { motion } from 'framer-motion';
import { Plus } from 'lucide-react';
import { Logo } from './Logo';

interface SidebarProps {
  onNewSession: () => void;
}

export function Sidebar({ onNewSession }: SidebarProps) {
  return (
    <motion.aside
      className="flex h-[calc(100vh-2rem)] w-64 flex-shrink-0 flex-col justify-between border border-sky-400/35 bg-[#0b334c]/95 p-6 m-4 mr-2 rounded-[24px] relative z-20 shadow-2xl backdrop-blur-xl"
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Top Section */}
      <div className="flex flex-col gap-8">
        {/* Logo */}
        <div className="px-2">
          <Logo />
        </div>

        {/* Action Button: Nova Conversa (Botão degradê celeste tecnológico) */}
        <motion.button
          onClick={onNewSession}
          className="flex w-full items-center justify-start gap-2.5 rounded-xl bg-gradient-to-r from-[#0ea5e9] via-[#38bdf8] to-[#60a5fa] text-[#02080f] px-4 py-2.5 transition-all font-black text-[13px] tracking-wide cursor-pointer hover:shadow-[0_0_20px_rgba(14,165,233,0.45)] relative overflow-hidden"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          {/* Efeito de brilho flutuante no hover */}
          <span className="absolute top-0 h-full w-[40%] pointer-events-none" style={{
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.45), transparent)'
          }}></span>
          <Plus className="h-4 w-4 text-[#02080f]" strokeWidth={3} />
          Nova Conversa
        </motion.button>
      </div>


    </motion.aside>
  );
}
