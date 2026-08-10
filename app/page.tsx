'use client';

// app/page.tsx — Layout principal sem voz e sem sidebar

import { useEffect, useState } from 'react';
import { useChat } from '@/hooks/useChat';
import { MessageInput } from '@/components/chat/MessageInput';
import { MessageBubble } from '@/components/chat/MessageBubble';
import { TypingIndicator } from '@/components/chat/TypingIndicator';
import { AnimatePresence } from 'framer-motion';

export default function HomePage() {
  const {
    messages,
    isLoading,
    error,
    messagesEndRef,
    sendMessage,
    startNewSession,
    clearError,
    isBackendOnline,
  } = useChat();

  const [darkMode, setDarkMode] = useState(false);

  // ── Tema ─────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const saved = localStorage.getItem('theme');
    const isDark = saved === 'dark';
    setDarkMode(isDark);
    document.documentElement.classList.toggle('dark', isDark);
  }, []);

  const toggleTheme = () => {
    const next = !darkMode;
    setDarkMode(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('theme', next ? 'dark' : 'light');
  };

  // ── Sugestões do welcome menu ─────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: Event) => {
      sendMessage((e as CustomEvent<string>).detail);
    };
    window.addEventListener('suggestion-click', handler);
    return () => window.removeEventListener('suggestion-click', handler);
  }, [sendMessage]);

  const isEmpty = messages.length === 0;

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-[#f6fbfa] dark:bg-[#020b18] transition-colors duration-300">
      <main className="flex-1 flex flex-col overflow-hidden relative">

        {/* Blob de fundo sutil */}
        <div className="absolute inset-x-0 -top-40 -z-10 overflow-hidden blur-3xl pointer-events-none" aria-hidden>
          <div className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-[#1573C2] to-[#0d4a87] opacity-[0.06] sm:left-[calc(50%-30rem)] sm:w-[72rem]" />
        </div>

        {/* Marca d'água de fundo */}
        <div className="absolute inset-x-0 top-[26%] md:top-[33%] flex justify-center pointer-events-none z-0 overflow-hidden opacity-[0.07] dark:opacity-[0.04]">
          <img src="/logo.png" alt="Watermark" className="w-[80%] md:w-[450px] object-contain" />
        </div>

        {/* ── Container central compartilhado (header + messages + footer) ──────── */}
        <div className="flex flex-col h-full w-full max-w-3xl mx-auto">

          {/* ── Header — mesmo wrapper e largura que a barra de baixo ────────────── */}
          <div className="shrink-0 px-2 pt-2 md:px-6 md:pt-4 z-50"
            style={{ paddingTop: 'max(0.5rem, env(safe-area-inset-top))' }}>
            <div
              className="
                w-full
                p-1 md:p-2 pl-2 md:pl-3
                flex items-center justify-between gap-2
                tutor-gradient-border
                rounded-[2rem]
                shadow-[0_10px_20px_rgba(0,0,0,0.15)] dark:shadow-[0_10px_20px_rgba(0,0,0,0.4)]
                backdrop-blur-md transition-colors duration-300
              "
              style={{
                '--tutor-border-bg-img': darkMode
                  ? 'linear-gradient(to right, rgba(21, 115, 194, 0.95), rgba(13, 74, 135, 0.95))'
                  : 'linear-gradient(#1573C2, #1573C2)'
              } as React.CSSProperties}
            >
              {/* Logo + Título */}
              <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                <div className="flex items-center justify-center w-14 h-14 md:w-16 md:h-16 shrink-0 rounded-2xl transition-transform duration-300 hover:scale-105">
                  <img src="/logo.png" alt="Logo Tutor" className="w-full h-full object-contain tutor-logo-premium" />
                </div>
                <h1 className="text-base sm:text-lg md:text-xl font-bold tracking-wide text-white dark:text-blue-50 whitespace-nowrap tutor-title-outline">
                  Tutor de Enfermagem
                </h1>
              </div>

              {/* Botão tema — pequeno e discreto */}
              <button
                onClick={toggleTheme}
                className="
                  text-white/90 hover:text-white
                  flex items-center justify-center
                  w-8 h-8 md:w-9 md:h-9
                  rounded-full
                  bg-white/10 hover:bg-white/20
                  transition-all active:scale-90
                  cursor-pointer shrink-0
                "
                title="Alternar Tema"
              >
                <span className="material-symbols-outlined text-[18px] md:text-[20px] select-none">
                  {darkMode ? 'light_mode' : 'dark_mode'}
                </span>
              </button>
            </div>
          </div>

          {/* ── Mensagens ──────────────────────────────────────────────────────────── */}
          <section className="flex-1 overflow-y-auto px-2 py-2 md:px-6 md:py-4 scroll-smooth z-10 relative">
            <div className="relative z-10 w-full flex flex-col gap-4">
              {isEmpty ? (
                <WelcomeMenu onSelect={sendMessage} />
              ) : (
                <>
                  {messages.map((msg, i) => (
                    <MessageBubble key={msg.id} message={msg} index={i} />
                  ))}
                  <AnimatePresence>
                    {isLoading && <TypingIndicator key="typing" />}
                  </AnimatePresence>
                </>
              )}
              <div ref={messagesEndRef} className="h-4" />
            </div>
          </section>

          {/* ── Banner de erro ─────────────────────────────────────────────────── */}
          {error && (
            <div className="px-2 md:px-6 mb-2">
              <div className="flex items-center justify-between gap-3 rounded-xl border border-red-900 bg-red-950/20 px-4 py-2.5">
                <p className="text-xs font-semibold text-red-400">{error}</p>
                <button onClick={clearError} className="text-xs font-bold text-red-400 hover:text-red-300 cursor-pointer">
                  Fechar
                </button>
              </div>
            </div>
          )}

          {/* ── Footer com input — mesma largura que o header ─────────────────────── */}
          <footer
            className="shrink-0 px-2 pt-2 pb-4 md:px-6 md:pt-2 md:pb-6"
            style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
          >
            <MessageInput
              onSend={sendMessage}
              onNewSession={startNewSession}
              isLoading={isLoading}
              disabled={isBackendOnline === false}
            />
          </footer>
        </div>
      </main>
    </div>
  );
}

// ── Menu de Boas-vindas ────────────────────────────────────────────────────────
function WelcomeMenu({ onSelect }: { onSelect: (text: string) => void }) {
  const options = [
    {
      label: 'Resumo de Conteúdo',
      icon: 'menu_book',
      description: 'Revise os temas da disciplina com explicações e exemplos clínicos',
    },
    {
      label: 'Quiz da Disciplina',
      icon: 'quiz',
      description: 'Pratique com questões de múltipla escolha e feedback imediato',
    },
    {
      label: 'Informações da Disciplina',
      icon: 'info',
      description: 'Consulte o conteúdo programático, calendário e critérios de avaliação',
    },
    {
      label: 'Encerrar Sessão',
      icon: 'logout',
      description: 'Encerre a sessão atual',
    },
  ];

  return (
    <div className="flex flex-col items-center justify-start text-center px-1 mt-2 relative z-10 w-full gap-3 md:gap-4">
      {/* Ícone e texto da Seção 7.1 do Prompt 10Aug2026 */}
      <div className="flex flex-col items-center gap-2 max-w-xl text-left bg-white/60 dark:bg-blue-950/40 p-4 md:p-5 rounded-2xl border border-blue-200/60 dark:border-blue-800/40 shadow-sm backdrop-blur-sm">
        <div className="flex items-center gap-2.5 w-full border-b border-blue-100 dark:border-blue-900/60 pb-2.5 mb-1">
          <span className="material-symbols-outlined text-[28px] md:text-[32px] text-[#1573C2] dark:text-blue-400 shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>
            medical_information
          </span>
          <h2 className="text-xs md:text-sm font-bold text-[#1573C2] dark:text-blue-200 leading-snug">
            Assistente de Estudos da INT 5224 – O cuidado no processo de viver humano II: a condição cirúrgica
          </h2>
        </div>
        
        <p className="text-[12px] md:text-xs text-gray-700 dark:text-blue-100/90 leading-relaxed">
          Este espaço foi pensado para facilitar sua jornada de aprendizagem sobre o cuidado no processo de viver humano em condição cirúrgica. Aqui você revisa conteúdos, pratica com simulados e acessa informações essenciais da disciplina.
        </p>

        <div className="w-full text-[11px] md:text-xs text-gray-600 dark:text-blue-200/80 space-y-1 pt-1 border-t border-gray-100 dark:border-blue-900/40">
          <p><strong>Como usar:</strong> Fale comigo como se estivesse conversando com um tutor. Peça explicações, tire dúvidas ou escolha uma das opções abaixo.</p>
          <p><strong>O que esperar:</strong> Clareza, objetividade e apoio contínuo — sempre dentro dos limites da disciplina.</p>
        </div>
      </div>

      {/* Botões do menu */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 md:gap-3 w-full">
        {options.map((opt) => (
          <button
            key={opt.label}
            onClick={() => onSelect(opt.label)}
            className="
              flex items-start gap-3 text-left
              rounded-xl px-3 py-2.5 md:px-4 md:py-3
              tutor-gradient-border
              [--tutor-border-bg:#1573C2]
              dark:[--tutor-border-bg:#0D3A6E]
              hover:[--tutor-border-bg:#0d4a87]
              dark:hover:[--tutor-border-bg:#0a2a50]
              shadow-[0_4px_12px_rgba(0,0,0,0.1)]
              dark:shadow-[0_4px_12px_rgba(0,0,0,0.4)]
              transition-all duration-200
              hover:scale-[1.02] active:scale-[0.98]
              cursor-pointer group
            "
          >
            <span
              className="material-symbols-outlined text-[20px] md:text-[22px] text-white shrink-0 mt-0.5 transition-transform duration-200 group-hover:scale-110"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              {opt.icon}
            </span>
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="text-xs md:text-sm font-semibold text-white leading-tight">{opt.label}</span>
              <span className="text-[10px] md:text-[11px] text-white/70 leading-snug">{opt.description}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
