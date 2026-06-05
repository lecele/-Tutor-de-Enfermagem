'use client';

// app/page.tsx — Página principal do Tutor de Enfermagem

import { useEffect, useState } from 'react';
import { Sidebar } from '@/components/sidebar/Sidebar';
import { ChatContainer } from '@/components/chat/ChatContainer';
import { useChat } from '@/hooks/useChat';

export default function HomePage() {
  const {
    messages,
    isLoading,
    error,
    session,
    isBackendOnline,
    messagesEndRef,
    sendMessage,
    startNewSession,
    clearError,
  } = useChat();

  // Escuta sugestões clicadas na WelcomeScreen
  useEffect(() => {
    const handler = (e: Event) => {
      const custom = e as CustomEvent<string>;
      sendMessage(custom.detail);
    };
    window.addEventListener('suggestion-click', handler);
    return () => window.removeEventListener('suggestion-click', handler);
  }, [sendMessage]);

  return (
    <main className="relative flex h-screen w-screen overflow-hidden bg-[#02080f] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#07131e] via-[#050c14] to-[#02080f]">
      {/* Blobs decorativos de fundo */}
      <BackgroundBlobs />

      {/* Layout principal (Split-pane flush) */}
      <div className="relative z-10 flex h-full w-full overflow-hidden">
        {/* Sidebar */}
        <Sidebar onNewSession={startNewSession} />

        {/* Chat */}
        <ChatContainer
          messages={messages}
          isLoading={isLoading}
          error={error}
          messagesEndRef={messagesEndRef}
          onSend={sendMessage}
          onClearError={clearError}
          isBackendOnline={isBackendOnline}
        />
      </div>
    </main>
  );
}

// ── Blobs animados de fundo (Glows celestes e teal do design system) ─────────

function BackgroundBlobs() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Grid de pontilhados sutil do design system original de Agentes na Saúde */}
      <div className="absolute inset-0 opacity-[0.035]" style={{
        backgroundImage: 'radial-gradient(circle, rgba(14,165,233,0.8) 1px, transparent 1px)',
        backgroundSize: '36px 36px',
        transform: 'translateZ(0)'
      }}></div>

      {/* Blob principal — canto superior direito */}
      <div
        className="absolute -right-32 -top-32 h-[500px] w-[500px] rounded-full bg-sky-500/8 blur-[120px]"
        style={{ animation: 'float 14s ease-in-out infinite' }}
      />
      {/* Blob secundário — canto inferior esquerdo */}
      <div
        className="absolute -bottom-40 -left-40 h-[450px] w-[450px] rounded-full bg-sky-400/6 blur-[100px]"
        style={{ animation: 'float 18s ease-in-out infinite reverse' }}
      />
      {/* Blob terciário — centro */}
      <div
        className="absolute left-1/4 top-1/4 h-80 w-80 rounded-full bg-sky-400/4 blur-[90px]"
        style={{ animation: 'float 22s ease-in-out infinite 4s' }}
      />
    </div>
  );
}
