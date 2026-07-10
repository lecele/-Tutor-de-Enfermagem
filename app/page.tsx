'use client';

// app/page.tsx — Layout principal com suporte a voz (STT + TTS)

import { useEffect, useCallback, useState } from 'react';
import { useChat } from '@/hooks/useChat';
import { useVoice } from '@/hooks/useVoice';
import { Sidebar } from '@/components/sidebar/Sidebar';
import { MessageInput } from '@/components/chat/MessageInput';
import { MessageBubble } from '@/components/chat/MessageBubble';
import { TypingIndicator } from '@/components/chat/TypingIndicator';
import { VoiceModal } from '@/components/chat/VoiceModal';
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

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  // ── Transcription handler: quando o usuário fala, envia como mensagem ────────
  const handleTranscript = useCallback(
    (text: string) => {
      sendMessage(text);
    },
    [sendMessage]
  );

  // ── Hook de voz ───────────────────────────────────────────────────────────────
  const {
    isListening,
    isSpeaking,
    isMuted,
    interimText,
    toggleListening,
    stopListening,
    speak,
    stopSpeaking,
    toggleMute,
    unlockAudio,
  } = useVoice(handleTranscript);

  // ── Lê a última resposta da IA em voz alta automaticamente ───────────────────
  useEffect(() => {
    const lastMsg = messages[messages.length - 1];
    if (lastMsg?.role === 'assistant' && lastMsg.content) {
      speak(lastMsg.content);
    }
  }, [messages, speak]);

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

  // ── Sugestões do sidebar/welcome ──────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: Event) => {
      // Desbloqueia áudio no clique da sugestão (iOS exige gesto do usuário)
      try { unlockAudio(); } catch (_) {}
      sendMessage((e as CustomEvent<string>).detail);
    };
    window.addEventListener('suggestion-click', handler);
    return () => window.removeEventListener('suggestion-click', handler);
  }, [sendMessage, unlockAudio]);

  // ── Desbloqueia áudio no primeiro envio de texto também ───────────────────────
  const handleSendWithUnlock = useCallback(
    (text: string) => {
      try { unlockAudio(); } catch (_) {}
      sendMessage(text);
    },
    [sendMessage, unlockAudio]
  );

  const isEmpty = messages.length === 0;

  return (
    <div className="fixed inset-0 flex flex-col md:flex-row overflow-hidden bg-[#f6fbfa] dark:bg-[#020b18] transition-colors duration-300">

      {/* ── Modal de voz ─────────────────────────────────────────────────────── */}
      <VoiceModal isListening={isListening} interimText={interimText} onStop={stopListening} />

      {/* ── Sidebar ──────────────────────────────────────────────────────────── */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onNewSession={startNewSession}
        toggleTheme={toggleTheme}
        darkMode={darkMode}
      />

      {/* ── Overlay mobile ───────────────────────────────────────────────────── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

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

        {/* ── Header pill ─────────────────────────────────────────────────────── */}
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
            {/* Hamburger mobile */}
            <button
              className="md:hidden text-white p-1 rounded-xl hover:bg-white/10 transition-all flex items-center justify-center shrink-0 cursor-pointer"
              onClick={() => setSidebarOpen(prev => !prev)}
              aria-label="Abrir/Fechar menu"
            >
              <span className="material-symbols-outlined text-[24px]">{sidebarOpen ? 'close' : 'menu'}</span>
            </button>

            {/* Logo — tamanho maior com margens negativas para não crescer a barra */}
            <div className="flex items-center justify-center w-16 h-16 sm:w-[76px] sm:h-[76px] md:w-[110px] md:h-[110px] shrink-0 -my-3 sm:-my-4 md:-my-6 overflow-visible rounded-2xl">
              <img src="/logo.png" alt="Logo Tutor" className="w-full h-full object-contain drop-shadow-lg" />
            </div>

            {/* Título — tamanho ajustado para caber por inteiro no celular sem corte */}
            <h1 className="text-sm min-[360px]:text-base sm:text-xl md:text-3xl font-bold tracking-wide text-white dark:text-blue-50 whitespace-nowrap overflow-visible">
              Tutor de Enfermagem
            </h1>
          </div>

          {/* Ações - Desktop only */}
          <div className="hidden md:flex items-center gap-1 shrink-0">
            <button
              onClick={startNewSession}
              className="text-white p-1 md:p-2 rounded-xl md:rounded-2xl border border-transparent hover:bg-white/10 hover:border-white/20 bg-white/5 shadow-sm transition-all flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 md:w-12 md:h-12 cursor-pointer"
              title="Nova Conversa"
            >
              <span className="material-symbols-outlined text-[16px] sm:text-[18px] md:text-[24px]">cleaning_services</span>
            </button>
            <button
              onClick={toggleTheme}
              className="text-white p-1 md:p-2 rounded-xl md:rounded-2xl border border-transparent hover:bg-white/10 hover:border-white/20 bg-white/5 shadow-sm transition-all flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 md:w-12 md:h-12 cursor-pointer"
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
              <WelcomeHero />
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

        {/* ── Footer com input + controles de voz ─────────────────────────────── */}
        <footer
          className="px-2 pt-2 pb-4 md:p-6 w-full max-w-3xl mx-auto z-10 mt-auto flex flex-col gap-2 shrink-0"
          style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
        >
          <MessageInput
            onSend={handleSendWithUnlock}
            isLoading={isLoading}
            disabled={isBackendOnline === false}
            isListening={isListening}
            isSpeaking={isSpeaking}
            isMuted={isMuted}
            onMicClick={toggleListening}
            onMuteClick={toggleMute}
            onStopSpeaking={stopSpeaking}
          />
        </footer>
      </main>
    </div>
  );
}

// ── Tela de boas-vindas ────────────────────────────────────────────────────────
function WelcomeHero() {
  return (
    <div className="flex flex-col items-center justify-start text-center px-4 md:px-10 mt-2 md:mt-6 relative z-10 w-full">
      <span className="material-symbols-outlined text-[36px] md:text-[56px] text-[#1573C2] dark:text-white mb-2 md:mb-3 drop-shadow-md">
        medical_information
      </span>
      <h2 className="text-[12px] md:text-base lg:text-lg font-bold text-[#1573C2] dark:text-white dark:opacity-95 max-w-xl leading-tight">
        Bem-vindo ao Tutor de Enfermagem.<br />
        Escreva uma pergunta ou escolha um tópico para começarmos.
      </h2>
    </div>
  );
}
