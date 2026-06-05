'use client';

// components/chat/MessageBubble.tsx — Balões de conversa com identidade visual premium

import { motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Bot, User } from 'lucide-react';
import { Message } from '@/types/chat';
import { SourceBadges } from './SourceBadges';

interface MessageBubbleProps {
  message: Message;
  /** Índice da mensagem (para animação escalonada) */
  index: number;
}

export function MessageBubble({ message, index }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <motion.div
      className={`flex items-end gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        duration: 0.35,
        delay: Math.min(index * 0.05, 0.2),
        ease: [0.16, 1, 0.3, 1],
      }}
    >
      {/* Avatar */}
      <div className="flex-shrink-0">
        {isUser ? <UserAvatar /> : <AgentAvatar />}
      </div>

      {/* Conteúdo */}
      <div className={`flex max-w-[75%] flex-col ${isUser ? 'items-end' : 'items-start'}`}>
        {/* Label de papel */}
        <span className={`mb-1 text-[10px] font-semibold uppercase tracking-wider ${
          isUser ? 'text-sky-500' : 'text-slate-400'
        }`}>
          {isUser ? 'Você' : 'Tutor IA'}
        </span>

        {/* Balão */}
        {isUser ? (
          <UserBubble content={message.content} />
        ) : (
          <AgentBubble
            content={message.content}
            sourcesFound={message.sources_found}
            hasContext={message.has_context}
          />
        )}

        {/* Timestamp */}
        <span className="mt-1 text-[10px] text-slate-400">
          {message.timestamp.toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      </div>
    </motion.div>
  );
}

// ── Avatares ────────────────────────────────────────────────────────────────

function AgentAvatar() {
  return (
    <div className="relative">
      {/* Glow */}
      <div className="absolute inset-0 rounded-full bg-sky-500/20 blur-md scale-125 animate-pulse" />
      <div className="relative flex h-8 w-8 items-center justify-center rounded-full border border-sky-500/35 bg-[#050c14] shadow-[0_0_15px_rgba(14,165,233,0.4)]">
        <Bot className="h-4 w-4 text-sky-400" />
      </div>
    </div>
  );
}

function UserAvatar() {
  return (
    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0c1622] border border-[#0ea5e9]/30 ring-2 ring-sky-500/10 shadow-[0_0_10px_rgba(14,165,233,0.1)]">
      <User className="h-4 w-4 text-sky-400" />
    </div>
  );
}

// ── Balões ───────────────────────────────────────────────────────────────────

function UserBubble({ content }: { content: string }) {
  return (
    <div className="rounded-2xl rounded-br-none bg-sky-500 px-4.5 py-3 text-[13px] leading-relaxed text-white shadow-[0_4px_20px_rgba(14,165,233,0.25)]">
      <p className="whitespace-pre-wrap break-words">{content}</p>
    </div>
  );
}

function AgentBubble({
  content,
  sourcesFound,
  hasContext,
}: {
  content: string;
  sourcesFound?: number;
  hasContext?: boolean;
}) {
  return (
    <div className="rounded-2xl rounded-bl-none border border-slate-200 bg-slate-50 px-5 py-4 shadow-sm">
      {/* Markdown renderizado */}
      <div className="prose prose-sm max-w-none text-slate-700
        prose-headings:font-display prose-headings:font-bold prose-headings:text-slate-800
        prose-strong:text-sky-600 prose-strong:font-bold
        prose-code:rounded prose-code:bg-slate-100 prose-code:border prose-code:border-slate-200 prose-code:px-1.5 prose-code:py-0.5 prose-code:text-sky-700 prose-code:font-mono prose-code:text-[11px]
        prose-li:text-slate-600 prose-p:leading-relaxed prose-p:text-[13.5px] prose-p:text-slate-600
        prose-a:text-sky-500 hover:prose-a:text-sky-600 prose-a:font-semibold prose-a:underline hover:prose-a:no-underline
        prose-blockquote:border-l-sky-400 prose-blockquote:bg-sky-50 prose-blockquote:px-4 prose-blockquote:py-1 prose-blockquote:rounded-r-lg prose-blockquote:text-slate-600">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {content}
        </ReactMarkdown>
      </div>

      {/* Badges de fontes (apenas para respostas com metadados) */}
      {sourcesFound !== undefined && hasContext !== undefined && (
        <SourceBadges
          sourcesFound={sourcesFound}
          hasContext={hasContext}
        />
      )}
    </div>
  );
}

