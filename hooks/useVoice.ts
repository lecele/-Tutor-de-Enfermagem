'use client';

// hooks/useVoice.ts — Hook de voz para STT (microfone → texto) e TTS (texto → fala)
// Portado e adaptado do MedCron (useVoice.js) para TypeScript com Next.js

import { useState, useCallback, useRef, useEffect } from 'react';

// ── Tipos da Web Speech API (não estão nos tipos padrão do TS strict) ─────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySpeechRecognition = any;

// ── Desbloqueio de áudio (iOS/Safari) ────────────────────────────────────────
// Safari exige que qualquer interação com áudio seja iniciada em resposta
// a um gesto do usuário. Esta função cria uma utterance silenciosa para
// "desbloquear" o motor de áudio no primeiro toque da tela.
function unlockAudioEngine() {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  const u = new SpeechSynthesisUtterance('\u200B'); // Zero-width space
  u.volume = 0;
  u.rate = 10;
  window.speechSynthesis.speak(u);
}

// ── Limpeza de Markdown para leitura em voz ───────────────────────────────────
function cleanTextForSpeech(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, '') // remove blocos de código
    .replace(/`[^`]*`/g, '')         // remove código inline
    .replace(/[*_~#>]/g, '')         // remove marcações markdown
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // transforma links em texto
    .replace(/\b\d{4,}\b/g, (m) => m.split('').join(' ')) // separa números longos
    .replace(/\n{2,}/g, '. ')        // transforma parágrafos em pausas
    .trim();
}

// ── Hook principal ────────────────────────────────────────────────────────────
export function useVoice(onTranscript: (text: string) => void) {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<AnySpeechRecognition>(null);

  // Garante lista de vozes carregada (necessário em alguns navegadores)
  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.getVoices();
    window.speechSynthesis.onvoiceschanged = () => {
      window.speechSynthesis.getVoices();
    };
  }, []);

  // ── TTS: Ler texto em voz alta ──────────────────────────────────────────────
  const speak = useCallback((text: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    const cleaned = cleanTextForSpeech(text);
    if (!cleaned) return;

    // Cancela qualquer fala em andamento
    window.speechSynthesis.cancel();

    setTimeout(() => {
      const utterance = new SpeechSynthesisUtterance(cleaned);
      utterance.lang = 'pt-BR';
      utterance.rate = 1.05;
      utterance.pitch = 1.0;

      // Tenta usar voz pt-BR disponível no dispositivo
      const voices = window.speechSynthesis.getVoices();
      const ptBR = voices.find((v) => {
        const lang = v.lang.replace('_', '-').toLowerCase();
        return lang === 'pt-br';
      });
      if (ptBR) utterance.voice = ptBR;

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);

      window.speechSynthesis.speak(utterance);
    }, 80);
  }, []);

  // ── Parar fala em andamento ─────────────────────────────────────────────────
  const stopSpeaking = useCallback(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, []);

  // ── STT: Parar escuta ───────────────────────────────────────────────────────
  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (_) { /* ignora */ }
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, []);

  // ── STT: Iniciar escuta ─────────────────────────────────────────────────────
  const startListening = useCallback(() => {
    // Desbloqueio de áudio (crítico para iOS)
    try { unlockAudioEngine(); } catch (_) { /* ignora */ }

    if (typeof window === 'undefined') return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognitionAPI = (window as any).SpeechRecognition
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) {
      alert('Seu navegador não suporta reconhecimento de voz. Use Chrome ou Safari.');
      return;
    }

    // Aborta sessão anterior se houver
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch (_) { /* ignora */ }
    }

    const recognition = new SpeechRecognitionAPI();
    recognition.lang = 'pt-BR';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => setIsListening(true);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      const transcript: string = event.results[0][0].transcript;
      if (transcript?.trim()) {
        onTranscript(transcript.trim());
      }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onerror = (event: any) => {
      console.warn('[useVoice] Erro no reconhecimento:', event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [onTranscript]);

  // ── Toggle: Alterna entre ouvir e parar ────────────────────────────────────
  const toggleListening = useCallback(() => {
    try { unlockAudioEngine(); } catch (_) { /* ignora */ }
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  return {
    isListening,
    isSpeaking,
    toggleListening,
    stopListening,
    speak,
    stopSpeaking,
    unlockAudio: unlockAudioEngine,
  };
}
