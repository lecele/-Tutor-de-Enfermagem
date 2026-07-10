// app/api/chat/route.ts — CRAG-lite com controle de tokens
// Otimizações: prompt compacto, histórico curto, chunks truncados,
// roteamento por intenção (menu/conteúdo), maxOutputTokens controlado.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const runtime = 'nodejs';
export const maxDuration = 60;

// ── Respostas fixas (zero tokens de LLM) ─────────────────────────────────────

const GREETING_RESPONSE =
  'Olá! Sou o **Tutor de Enfermagem Perioperatória** da UFSC. 🩺\n\n' +
  '### MENU PRINCIPAL\n' +
  'Escolha uma das opções abaixo para começarmos:\n\n' +
  '1. **Resumo de Conteúdo**\n' +
  '2. **Simulado de Prova**\n' +
  '3. **Informações do Curso**\n' +
  '4. **Encerrar Sessão**\n\n' +
  'Digite o número ou o nome da opção desejada!';

const FAREWELL_RESPONSE =
  'Sessão encerrada. Bons estudos! Estarei aqui quando precisar. 👋';

const FALLBACK_RESPONSE =
  'O material de estudo disponível não contém informações suficientes para responder com precisão acadêmica.\n\n' +
  'Recomendo consultar:\n' +
  '- Seu professor ou tutor da disciplina\n' +
  '- Biblioteca virtual da UFSC\n' +
  '- **LILACS**, **BVS**, **PubMed**\n' +
  '- **COFEN** (cofen.gov.br) e **Ministério da Saúde** (saude.gov.br)';

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface ChatRequest {
  session_id: string;
  message: string;
}

interface Document {
  content: string;
  source: string;
  similarity: number;
}

// ── Roteamento por intenção (sem LLM) ────────────────────────────────────────
// Detecta mensagens que não precisam de RAG — economiza embedding + Supabase.

const GREETING_TOKENS = new Set([
  'oi', 'ola', 'olá', 'opa', 'bom', 'boa', 'hello', 'hi', 'salve',
  'tudo', 'bem', 'dia', 'tarde', 'noite', 'como', 'vai', 'menu',
  'inicio', 'início', 'comecar', 'começar', 'voltar', 'tutor', 'bot',
  'quem', 'faz', 'pode', 'fazer', 'obrigado', 'obrigada', 'valeu',
]);

const FAREWELL_TOKENS = new Set([
  '4', 'encerrar', 'sair', 'tchau', 'bye', 'adeus', 'finalizar', 'encerrar sessão',
]);

function detectIntent(text: string): 'greeting' | 'farewell' | 'content' {
  const norm = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .trim();
  const words = norm.split(/\s+/).filter(Boolean);

  if (words.length === 0) return 'greeting';

  // Adeus / encerrar sessão
  if (words.length <= 3 && words.some((w) => FAREWELL_TOKENS.has(w))) return 'farewell';

  // Saudação / menu / navegação
  if (words.length <= 4 && words.some((w) => GREETING_TOKENS.has(w))) return 'greeting';

  // Opções do menu por número ou texto
  if (/^[123]$/.test(norm) || /^(resumo|simulado|informa|curso)/.test(norm)) return 'greeting';

  return 'content';
}

// ── Helpers de formatação (compactos para economizar tokens) ─────────────────

// Trunca cada chunk a 900 chars e exibe no máximo 3 chunks
function formatContext(docs: Document[]): string {
  if (!docs.length) return 'Nenhum material disponível.';
  return docs
    .slice(0, 3)
    .map((d, i) =>
      `[${i + 1}] ${d.source} (sim:${d.similarity.toFixed(2)})\n${d.content.slice(0, 900)}`
    )
    .join('\n\n---\n\n');
}

// Últimas 3 trocas (6 mensagens) — suficiente para contexto conversacional
function formatHistory(history: Array<{ role: string; content: string }>): string {
  if (!history.length) return '';
  return history
    .slice(-6)
    .map((h) => `${h.role === 'user' ? 'Estudante' : 'Tutor'}: ${h.content.slice(0, 400)}`)
    .join('\n');
}

// ── Clientes lazy (um por cold start) ────────────────────────────────────────

let _supabase: ReturnType<typeof createClient> | null = null;
let _genai: GoogleGenerativeAI | null = null;

function getSupabase() {
  if (!_supabase) _supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_KEY!);
  return _supabase;
}
function getGenAI() {
  if (!_genai) _genai = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);
  return _genai;
}

// ── Embedding ─────────────────────────────────────────────────────────────────

async function embedQuery(text: string): Promise<number[]> {
  const model = getGenAI().getGenerativeModel({ model: 'gemini-embedding-2' });
  const result = await model.embedContent({
    content: { role: 'user', parts: [{ text }] },
    outputDimensionality: 768,
  } as any);
  return result.embedding.values;
}

// ── Retrieval ─────────────────────────────────────────────────────────────────

async function retrieveDocs(embedding: number[], threshold = 0.50, count = 3): Promise<Document[]> {
  const supabase = getSupabase();
  const { data, error } = await (supabase.rpc as any)('match_documents', {
    query_embedding: embedding,
    match_threshold: parseFloat(process.env.RAG_MATCH_THRESHOLD || String(threshold)),
    match_count: parseInt(process.env.RAG_MATCH_COUNT || String(count)),
  });
  if (error) { console.error('[retrieve]', error); return []; }
  return (data || []).map((r: Record<string, unknown>) => ({
    content: r.content as string,
    source: (r.source as string) || 'desconhecido',
    similarity: (r.similarity as number) || 0,
  }));
}

// ── System Prompt compacto ────────────────────────────────────────────────────
// Reduzido de ~1.800 para ~700 tokens mantendo todas as regras comportamentais.

function buildSystemPrompt(context: string, historyText: string): string {
  return `Você é o Tutor de Enfermagem Perioperatória da UFSC — IA educacional que apoia estudantes de graduação. Você NÃO fornece respostas prontas para avaliações ou provas.

REGRAS:
- Linguagem acadêmica, técnica, clara, motivadora.
- Cite os materiais fornecidos como [1], [2].
- NUNCA substitua o raciocínio do estudante.

MENU PRINCIPAL (apresente quando o aluno iniciar, pedir menu ou voltar):
1. Resumo de Conteúdo → pergunte o tema, forneça resumo com exemplos clínicos + 3 perguntas socráticas UMA POR VEZ.
2. Simulado de Prova → 5 questões (3 múltipla escolha + 2 discursivas), sem gabarito imediato. Se errar: socrático guiado; após 3 tentativas: forneça a resposta.
3. Informações do Curso → tire dúvidas sobre calendário, plano de ensino, critérios de avaliação.
4. Encerrar Sessão → responda exatamente: "Sessão encerrada. Bons estudos!"

FALLBACK: Se os Materiais de Estudo estiverem vazios ou insuficientes para uma pergunta técnica, use a mensagem de fallback padrão. NÃO use fallback para saudações, menu ou navegação.

## Materiais de Estudo:
${context}${historyText ? `\n\n## Conversa recente:\n${historyText}` : ''}`;
}

// ── Geração de resposta ───────────────────────────────────────────────────────

async function generateResponse(
  question: string,
  docs: Document[],
  history: Array<{ role: string; content: string }>
): Promise<string> {
  const model = getGenAI().getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 1024, // cap: evita respostas longas desnecessárias
    },
  });

  const systemPrompt = buildSystemPrompt(formatContext(docs), formatHistory(history));

  const result = await model.generateContent([
    { text: systemPrompt },
    { text: `Estudante: ${question}` },
  ]);

  return result.response.text();
}

// ── Histórico ─────────────────────────────────────────────────────────────────

async function getSessionHistory(sessionId: string): Promise<Array<{ role: string; content: string }>> {
  try {
    const { data } = await (getSupabase().from('chat_messages') as any)
      .select('role, content')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })
      .limit(6); // 3 trocas — suficiente, economiza tokens
    return data || [];
  } catch { return []; }
}

async function saveMessages(sessionId: string, userMsg: string, assistantMsg: string) {
  try {
    await (getSupabase().from('chat_messages') as any).insert([
      { session_id: sessionId, role: 'user', content: userMsg },
      { session_id: sessionId, role: 'assistant', content: assistantMsg },
    ]);
  } catch (e) { console.warn('[save]', e); }
}

// ── HANDLER ───────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const startTime = Date.now();

  try {
    const body: ChatRequest = await req.json();
    const { session_id, message } = body;

    if (!message?.trim()) {
      return NextResponse.json({ error: 'Mensagem vazia' }, { status: 400 });
    }

    const question = message.trim();
    const intent = detectIntent(question);

    // ── Rota rápida: saudação/menu → zero tokens de LLM ──────────────────────
    if (intent === 'greeting') {
      saveMessages(session_id, question, GREETING_RESPONSE); // fire-and-forget
      return NextResponse.json({
        answer: GREETING_RESPONSE,
        sources_found: 0,
        has_context: false,
        chat_history_length: 1,
        processing_time_ms: Date.now() - startTime,
      });
    }

    // ── Rota rápida: encerrar sessão → zero tokens ────────────────────────────
    if (intent === 'farewell') {
      saveMessages(session_id, question, FAREWELL_RESPONSE);
      return NextResponse.json({
        answer: FAREWELL_RESPONSE,
        sources_found: 0,
        has_context: false,
        chat_history_length: 1,
        processing_time_ms: Date.now() - startTime,
      });
    }

    // ── Rota de conteúdo: RAG + LLM ──────────────────────────────────────────

    // Embedding + histórico em paralelo
    let history: Array<{ role: string; content: string }> = [];
    let embedding!: number[];

    try {
      [history, embedding] = await Promise.all([
        getSessionHistory(session_id),
        embedQuery(question),
      ]);
    } catch (e) {
      console.error('[init]', e);
      try { embedding = await embedQuery(question); } catch {
        saveMessages(session_id, question, FALLBACK_RESPONSE);
        return NextResponse.json({ answer: FALLBACK_RESPONSE, sources_found: 0, has_context: false, chat_history_length: 0, processing_time_ms: Date.now() - startTime });
      }
    }

    // Retrieval (3 chunks, threshold 0.50)
    const docs = await retrieveDocs(embedding, 0.50, 3);

    // Gerar resposta
    const answer = await generateResponse(question, docs, history);

    // Salvar em background (não bloqueia resposta)
    saveMessages(session_id, question, answer);

    return NextResponse.json({
      answer,
      sources_found: docs.length,
      has_context: docs.length > 0,
      chat_history_length: history.length + 2,
      processing_time_ms: Date.now() - startTime,
    });

  } catch (err) {
    console.error('[chat]', err);
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 });
  }
}
