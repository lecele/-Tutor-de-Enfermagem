'use client';

// components/chat/MessageBubble.tsx — Balões com suporte a opções de menu clicáveis

import { useMemo, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Message } from '@/types/chat';
import { SourceBadges } from './SourceBadges';

interface MessageBubbleProps {
  message: Message;
  index: number;
}

// ── Dispatch de seleção de opção ─────────────────────────────────────────────
function dispatchOptionClick(text: string) {
  window.dispatchEvent(new CustomEvent('suggestion-click', { detail: text }));
}

// ── Extrai texto puro de nós React (para capturar o texto dos li) ────────────
function extractText(node: ReactNode): string {
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(extractText).join('');
  if (node && typeof node === 'object' && 'props' in node) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return extractText((node as any).props?.children);
  }
  return '';
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
      <div className={`flex max-w-[82%] flex-col ${isUser ? 'items-end' : 'items-start'}`}>
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
  // Detecta se a mensagem contém opções interativas para o usuário escolher
  const isOptionMessage = useMemo(() => {
    const lower = content.toLowerCase();
    return (
      (lower.includes('resumo de conteúdo') && lower.includes('simulado de prova')) ||
      lower.includes('perguntar sobre:') ||
      lower.includes('pergunte sobre:') ||
      lower.includes('escolha uma das') ||
      lower.includes('sugestões de estudo:') ||
      lower.includes('sugestões de temas:') ||
      lower.includes('deseja aprofundar') ||
      lower.includes('deseja continuar') ||
      lower.includes('voltar ao menu principal') ||
      lower.includes('informações da disciplina') ||
      lower.includes('informações do curso')
    );
  }, [content]);

  // Componentes customizados do ReactMarkdown
  const markdownComponents = useMemo(() => ({
    // Renderiza itens de lista como botões quando são opções
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    li: ({ children, ...props }: any) => {
      if (!isOptionMessage) return <li {...props}>{children}</li>;

      const label = extractText(children).trim();
      if (!label) return <li {...props}>{children}</li>;

      // Itens informativos como "Ou qualquer outra dúvida..." não viram botões
      if (label.toLowerCase().startsWith('ou ')) {
        return (
          <li className="list-none !pl-2 !ml-0 text-slate-400 dark:text-slate-500 text-xs italic mt-2">
            {children}
          </li>
        );
      }

      return (
        <li className="list-none !pl-0 !ml-0">
          <button
            type="button"
            onClick={() => dispatchOptionClick(label)}
            className="
              group flex items-center gap-3 w-full text-left
              rounded-xl px-4 py-2.5 my-1
              border border-[#1573C2]/25 dark:border-blue-400/20
              bg-blue-50/60 dark:bg-blue-950/20
              hover:bg-blue-100/90 dark:hover:bg-blue-900/30
              hover:border-[#1573C2]/45 dark:hover:border-blue-400/40
              focus:outline-none focus:ring-2 focus:ring-[#1573C2]/15
              transition-all duration-150 cursor-pointer
              shadow-sm hover:shadow-md active:scale-[0.98]
            "
          >
            <span className="
              material-symbols-outlined text-[16px]
              text-[#1573C2] dark:text-blue-400
              shrink-0
            " style={{ fontVariationSettings: "'FILL' 1" }}>
              touch_app
            </span>
            <span className="
              text-[13.5px] font-semibold
              text-[#1573C2] dark:text-blue-400
            ">
              {children}
            </span>
            <span className="
              material-symbols-outlined text-[14px] ml-auto
              text-[#1573C2]/40 dark:text-blue-400/40
              group-hover:translate-x-0.5 transition-transform
            ">
              chevron_right
            </span>
          </button>
        </li>
      );
    },
    // Renderiza links como texto simples — referências ABNT não devem ser clicáveis
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    a: ({ children }: any) => (
      <span className="text-slate-700 dark:text-slate-200">{children}</span>
    ),
    // Remove bullets da ol/ul quando são opções
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ol: ({ children, ...props }: any) => {
      if (!isOptionMessage) return <ol {...props}>{children}</ol>;
      return <ol className="!list-none !pl-0 !ml-0 flex flex-col gap-0.5 mt-1">{children}</ol>;
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ul: ({ children, ...props }: any) => {
      if (!isOptionMessage) return <ul {...props}>{children}</ul>;
      return <ul className="!list-none !pl-0 !ml-0 flex flex-col gap-0.5 mt-1">{children}</ul>;
    },
  }), [isOptionMessage]);

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
        prose-a:text-slate-700 dark:prose-a:text-slate-200 prose-a:no-underline prose-a:font-normal prose-a:cursor-text
        prose-blockquote:border-l-[#1573C2] prose-blockquote:bg-blue-50 dark:prose-blockquote:bg-blue-950/20 prose-blockquote:px-4 prose-blockquote:py-1 prose-blockquote:rounded-r-lg
      ">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
          {content}
        </ReactMarkdown>
      </div>

      {sourcesFound !== undefined && hasContext !== undefined && (
        <SourceBadges sourcesFound={sourcesFound} hasContext={hasContext} />
      )}
    </div>
  );
}
