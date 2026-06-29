'use client';

// components/chat/MessageBubble.tsx — Balões no estilo InterAtiva, azul

import { motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Message } from '@/types/chat';
import { SourceBadges } from './SourceBadges';

interface MessageBubbleProps {
  message: Message;
  index: number;
}

export function MessageBubble({ message, index }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <motion.div
      className={`flex items-end gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.04, 0.2), ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Avatar */}
      <div className="flex-shrink-0">
        {isUser ? <UserAvatar /> : <AgentAvatar />}
      </div>

      {/* Conteúdo */}
      <div className={`flex max-w-[78%] flex-col ${isUser ? 'items-end' : 'items-start'}`}>
        <span className={`mb-1 text-[10px] font-semibold uppercase tracking-wider ${
          isUser ? 'text-[#1573C2] dark:text-blue-400' : 'text-slate-400 dark:text-slate-500'
        }`}>
          {isUser ? 'Você' : 'Tutor IA'}
        </span>

        {isUser ? <UserBubble content={message.content} /> : (
          <AgentBubble
            content={message.content}
            sourcesFound={message.sources_found}
            hasContext={message.has_context}
          />
        )}

        <span className="mt-1 text-[10px] text-slate-400">
          {message.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </motion.div>
  );
}

// ── Avatares ─────────────────────────────────────────────────────────────────

function AgentAvatar() {
  return (
    <div className="relative flex-shrink-0">
      <div className="absolute inset-0 rounded-full bg-[#1573C2]/20 blur-md scale-125 animate-pulse" />
      <div className="relative flex h-9 w-9 items-center justify-center rounded-full border border-[#1573C2]/35 bg-white dark:bg-[#05111f] shadow-[0_0_15px_rgba(21,115,194,0.35)]">
        <span className="material-symbols-outlined text-[18px] text-[#1573C2] dark:text-blue-400">
          medical_services
        </span>
      </div>
    </div>
  );
}

function UserAvatar() {
  return (
    <div className="flex-shrink-0 flex h-9 w-9 items-center justify-center rounded-full bg-white dark:bg-[#0c1e35] border border-[#1573C2]/30 shadow-sm">
      <span className="material-symbols-outlined text-[18px] text-[#1573C2] dark:text-blue-400">
        person
      </span>
    </div>
  );
}

// ── Balões ───────────────────────────────────────────────────────────────────

function UserBubble({ content }: { content: string }) {
  return (
    <div className="rounded-2xl rounded-br-none bg-[#1573C2] px-4 py-3 text-[13.5px] leading-relaxed text-white shadow-[0_4px_20px_rgba(21,115,194,0.25)]">
      <p className="whitespace-pre-wrap break-words">{content}</p>
    </div>
  );
}

function AgentBubble({ content, sourcesFound, hasContext }: {
  content: string;
  sourcesFound?: number;
  hasContext?: boolean;
}) {
  return (
    <div className="rounded-2xl rounded-bl-none border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0d1e35] px-5 py-4 shadow-sm">
      <div className="
        prose prose-sm max-w-none
        text-slate-700 dark:text-slate-200
        prose-headings:font-bold prose-headings:text-slate-800 dark:prose-headings:text-white
        prose-strong:text-[#1573C2] dark:prose-strong:text-blue-400 prose-strong:font-bold
        prose-code:rounded prose-code:bg-slate-100 dark:prose-code:bg-slate-800 prose-code:px-1.5 prose-code:py-0.5 prose-code:text-[#1573C2] dark:prose-code:text-blue-300 prose-code:text-[11px]
        prose-li:text-slate-600 dark:prose-li:text-slate-300
        prose-p:leading-relaxed prose-p:text-[13.5px]
        prose-a:text-[#1573C2] prose-a:font-semibold prose-a:underline
        prose-blockquote:border-l-[#1573C2] prose-blockquote:bg-blue-50 dark:prose-blockquote:bg-blue-950/20 prose-blockquote:px-4 prose-blockquote:py-1 prose-blockquote:rounded-r-lg
      ">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
      </div>

      {sourcesFound !== undefined && hasContext !== undefined && (
        <SourceBadges sourcesFound={sourcesFound} hasContext={hasContext} />
      )}
    </div>
  );
}
