'use client';

// app/page.tsx — Layout principal sem voz e sem sidebar

import { useEffect, useCallback, useState } from 'react';
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

      {/* ── Área principal ───────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#f6fbfa] dark:bg-[#020b18] relative transition-colors duration-300">

        {/* Blob de fundo sutil */}
        <div className="absolute inset-x-0 -top-40 -z-10 overflow-hidden blur-3xl pointer-events-none" aria-hidden>
          <div className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-[#1573C2] to-[#0d4a87] opacity-[0.06] sm:left-[calc(50%-30rem)] sm:w-[72rem]" />
        </div>

        {/* Marca d'água de fundo */}
        <div className="absolute inset-x-0 top-[26%] md:top-[33%] flex justify-center pointer-events-none z-0 overflow-hidden opacity-[0.07] dark:opacity-[0.04]">
          <img src="/logo.png" alt="Watermark" className="w-[80%] md:w-[450px] object-contain" />
        </div>

        {/* ── Header ──────────────────────────────────────────────────────────── */}
        <header
          className="
            fixed top-2 left-2 right-2
            mt-[env(safe-area-inset-top)]
            md:relative md:top-auto md:left-auto md:right-auto
            md:mx-8 md:mt-10 md:mb-4
            px-4 sm:px-6 py-3
            flex items-center justify-between
            z-50
            tutor-gradient-border
            rounded-[1.5rem] md:rounded-[2rem]
            shadow-[0_10px_20px_rgba(0,0,0,0.15)] dark:shadow-[0_15px_30px_rgba(0,0,0,0.5),0_0_20px_rgba(21,115,194,0.2)]
            backdrop-blur-md shrink-0 transition-colors duration-300
          "
          style={{
            '--tutor-border-bg-img': darkMode
              ? 'linear-gradient(to right, rgba(21, 115, 194, 0.95), rgba(13, 74, 135, 0.95))'
              : 'linear-gradient(#1573C2, #1573C2)'
          } as React.CSSProperties}
        >
          <div className="flex items-center gap-2 sm:gap-4 md:gap-5 flex-1 min-w-0">
            {/* Logo */}
            <div className="flex items-center justify-center w-16 h-16 sm:w-[76px] sm:h-[76px] md:w-[110px] md:h-[110px] shrink-0 -my-3 sm:-my-4 md:-my-6 overflow-visible rounded-2xl transition-transform duration-300 hover:scale-105">
              <img src="/logo.png" alt="Logo Tutor" className="w-full h-full object-contain tutor-logo-premium" />
            </div>

            {/* Título */}
            <h1 className="text-sm min-[360px]:text-base sm:text-xl md:text-3xl font-bold tracking-wide text-white dark:text-blue-50 whitespace-nowrap overflow-visible tutor-title-outline">
              Tutor de Enfermagem
            </h1>
          </div>

          {/* Ações */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={startNewSession}
              className="
                text-white p-1 md:p-2 rounded-xl md:rounded-2xl
                tutor-gradient-border shadow-sm transition-all
                flex items-center justify-center
                w-7 h-7 sm:w-8 sm:h-8 md:w-12 md:h-12
                cursor-pointer
                [--tutor-border-bg:#105ba3]
                hover:[--tutor-border-bg:#0d4a87]
                dark:[--tutor-border-bg:#0d3a6e]
                dark:hover:[--tutor-border-bg:#0a2a50]
              "
              title="Nova Conversa"
            >
              <span className="material-symbols-outlined text-[16px] sm:text-[18px] md:text-[24px]">cleaning_services</span>
            </button>
            <button
              onClick={toggleTheme}
              className="
                text-white p-1 md:p-2 rounded-xl md:rounded-2xl
                tutor-gradient-border shadow-sm transition-all
                flex items-center justify-center
                w-7 h-7 sm:w-8 sm:h-8 md:w-12 md:h-12
                cursor-pointer
                [--tutor-border-bg:#105ba3]
                hover:[--tutor-border-bg:#0d4a87]
                dark:[--tutor-border-bg:#0d3a6e]
                dark:hover:[--tutor-border-bg:#0a2a50]
              "
              title="Alternar Tema"
            >
              <span className="material-symbols-outlined text-[16px] sm:text-[18px] md:text-[24px]">
                {darkMode ? 'light_mode' : 'dark_mode'}
              </span>
            </button>
          </div>
        </header>

        {/* ── Mensagens ─────────────────────────────────────────────────────────── */}
        <section className="flex-1 overflow-y-auto px-3 py-4 md:px-12 md:py-8 scroll-smooth z-10 w-full max-w-4xl mx-auto flex flex-col gap-4 md:gap-6 pt-24 mt-[env(safe-area-inset-top)] md:mt-0 md:pt-2 relative">
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
          <div className="mx-auto max-w-3xl w-full px-4 md:px-8 mb-2">
            <div className="flex items-center justify-between gap-3 rounded-xl border border-red-900 bg-red-950/20 px-4 py-2.5">
              <p className="text-xs font-semibold text-red-400">{error}</p>
              <button onClick={clearError} className="text-xs font-bold text-red-400 hover:text-red-300 cursor-pointer">
                Fechar
              </button>
            </div>
          </div>
        )}

        {/* ── Footer com input ─────────────────────────────────────────────────── */}
        <footer
          className="px-2 pt-2 pb-4 md:p-6 w-full max-w-3xl mx-auto z-10 mt-auto flex flex-col gap-2 shrink-0"
          style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
        >
          <MessageInput
            onSend={sendMessage}
            isLoading={isLoading}
            disabled={isBackendOnline === false}
          />
        </footer>
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
      label: 'Simulado de Prova',
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
    <div className="flex flex-col items-center justify-start text-center px-2 md:px-6 mt-2 md:mt-4 relative z-10 w-full gap-4 md:gap-6">
      {/* Ícone e título */}
      <div className="flex flex-col items-center gap-2">
        <span className="material-symbols-outlined text-[40px] md:text-[56px] text-[#1573C2] dark:text-blue-300 drop-shadow-md" style={{ fontVariationSettings: "'FILL' 1" }}>
          medical_information
        </span>
        <h2 className="text-base md:text-xl font-bold text-[#1573C2] dark:text-white leading-tight max-w-lg">
          Bem-vindo(a) ao Assistente de Estudos da INT 5224
        </h2>
        <p className="text-xs md:text-sm text-gray-500 dark:text-blue-200/70 max-w-md">
          O cuidado no processo de viver humano II – a condição cirúrgica · UFSC
        </p>
        <p className="text-xs md:text-sm text-gray-400 dark:text-blue-200/50 max-w-sm mt-1">
          Escolha uma opção abaixo ou envie uma pergunta diretamente no chat.
        </p>
      </div>

      {/* Botões do menu */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-2xl">
        {options.map((opt) => (
          <button
            key={opt.label}
            onClick={() => onSelect(opt.label)}
            className="
              flex items-start gap-3 text-left
              rounded-2xl px-4 py-3 md:px-5 md:py-4
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
              className="material-symbols-outlined text-[22px] md:text-[26px] text-white shrink-0 mt-0.5 transition-transform duration-200 group-hover:scale-110"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              {opt.icon}
            </span>
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="text-sm md:text-base font-semibold text-white leading-tight">{opt.label}</span>
              <span className="text-[11px] md:text-xs text-white/70 leading-snug">{opt.description}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
