// app/api/chat/route.ts — Tutor de Enfermagem
// Otimizado para alta performance (sem CRAG grader lento) mas mantendo 
// a qualidade original das respostas (sem truncar contexto, prompt completo).

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const runtime = 'nodejs';
export const maxDuration = 60;

// ── Respostas fixas (zero tokens de LLM para navegação rápida) ───────────────

const GREETING_RESPONSE =
  'Olá! Sou o seu **Tutor de Enfermagem Perioperatória**.\n\n' +
  'Escolha uma das opções abaixo para começarmos:\n\n' +
  '1. **Resumo de Conteúdo**\n' +
  '2. **Simulado de Prova**\n' +
  '3. **Informações do Curso**\n' +
  '4. **Encerrar Sessão**\n\n' +
  '**Você pode clicar diretamente na opção desejada**, digitar o nome da opção ou simplesmente digitar o número correspondente no chat!';

const FAREWELL_RESPONSE =
  'Sessão encerrada. Bons estudos! Estarei aqui quando precisar.';

const FALLBACK_RESPONSE =
  'Desculpe, o material de estudo disponível não contém informações suficientes ' +
  'para responder a sua pergunta com precisão acadêmica.\n\n' +
  'Recomendo consultar:\n' +
  '- Seu professor orientador ou tutor da disciplina\n' +
  '- Biblioteca virtual da instituição\n' +
  '- Bases de dados científicas: **LILACS**, **BVS**, **PubMed**\n' +
  '- Publicações do **COFEN** (cofen.gov.br) e **Ministério da Saúde** (saude.gov.br)';

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

const GREETING_TOKENS = new Set([
  'oi', 'ola', 'olá', 'opa', 'bom', 'boa', 'hello', 'hi', 'salve',
  'tudo', 'bem', 'como', 'vai', 'menu', 'inicio', 'início',
  'comecar', 'começar', 'voltar', 'tutor', 'bot', 'quem', 'faz',
  'pode', 'fazer', 'obrigado', 'obrigada', 'valeu',
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

  // Saudação / menu / navegação inicial (não intercepta opções do menu)
  if (words.length <= 4 && words.some((w) => GREETING_TOKENS.has(w))) return 'greeting';

  return 'content';
}

// ── Helpers de formatação RAG (Restaurado qualidade máxima) ───────────────────

// Não trunca os chunks e formata com clareza
function formatContext(docs: Document[]): string {
  if (!docs.length) return 'Nenhum material disponível.';
  return docs
    .map((d, i) =>
      `[${i + 1}] **Arquivo:** ${d.source} (similaridade: ${d.similarity.toFixed(2)})\n${d.content}`
    )
    .join('\n\n---\n\n');
}

// Histórico de 12 mensagens (6 trocas) para o LLM manter o contexto perfeitamente
function formatHistory(history: Array<{ role: string; content: string }>): string {
  if (!history.length) return '';
  return history
    .map((h) => `**${h.role === 'user' ? 'Estudante' : 'Tutor'}:** ${h.content}`)
    .join('\n');
}

// ── Clientes lazy ────────────────────────────────────────────────────────────

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

// ── Retrieval (Dinâmico: match_count=5 com threshold configurável) 

async function retrieveDocs(embedding: number[], threshold = 0.45): Promise<Document[]> {
  const supabase = getSupabase();
  const { data, error } = await (supabase.rpc as any)('match_documents', {
    query_embedding: embedding,
    match_threshold: threshold,
    match_count: parseInt(process.env.RAG_MATCH_COUNT || '5'),
  });
  if (error) { console.error('[retrieve]', error); return []; }
  return (data || []).map((r: Record<string, unknown>) => ({
    content: r.content as string,
    source: (r.source as string) || 'desconhecido',
    similarity: (r.similarity as number) || 0,
  }));
}

// ── System Prompt Completo (Restaurado Prompt Mestre) ────────────────────────

function buildSystemPrompt(context: string, historyText: string): string {
  return `Você é o **Tutor de Enfermagem**, um Assistente de Inteligência Artificial Generativa Educacional especializado em Enfermagem Perioperatória.
Seu propósito é apoiar estudantes de graduação em enfermagem da Universidade Federal de Santa Catarina (UFSC), promovendo a aprendizagem personalizada, o pensamento crítico e a autonomia intelectual. Você não substitui o raciocínio do estudante e NUNCA fornece respostas prontas para avaliações, trabalhos ou provas.

Siga rigorosamente as seguintes diretrizes extraídas do PROMPT MESTRE do curso:

### 1. PRINCÍPIOS ÉTICOS OBRIGATÓRIOS:
- **UNESCO:** Centralidade humana; equidade, inclusão e acessibilidade; transparência; privacidade; segurança e bem-estar; promoção do pensamento crítico; uso pedagógico responsável; evitar dependência excessiva e garantir integridade acadêmica.
- **MEC:** Atuar como apoio, não substituto; evitar plágio e respostas prontas para avaliações.

### 2. ESTILO DE COMUNICAÇÃO:
- Linguagem acadêmica, técnica e adequada à área da saúde, com clareza e rigor conceitual.
- Tom motivador, respeitoso e estimulador.
- Indique fontes confiáveis usando citações dos materiais fornecidos [1], [2], etc.
- Use analogias, metáforas, exemplos reais e hipotéticos para enriquecer as explicações.

### 3. COMPORTAMENTO E FLUXOS DE MENU:
Sempre que o estudante interagir, guie a conversa de acordo com o fluxo abaixo:

- **MENU PRINCIPAL:**
  Se o aluno iniciar a sessão, pedir o menu ou se o contexto indicar retorno, apresente exatamente:
  "### MENU PRINCIPAL
  Escolha uma das opções:
  1. **Resumo de Conteúdo**
  2. **Simulado de Prova**
  3. **Informações do Curso**
  4. **Encerrar Sessão**
  Digite o número ou o nome da opção desejada!"

- **Opção 1: Resumo de Conteúdo**
  1. Solicitação de Tema: Pergunte: "Qual tema da Enfermagem Perioperatória você deseja estudar?"
  2. Refinamento: Se o tema for amplo, ajude a especificar.
  3. Estrutura do Resumo: O resumo deve conter obrigatoriamente:
     - Explicação detalhada (usando os Materiais de Estudo Disponíveis)
     - Exemplos clínicos contextualizados
     - Relação com práticas de enfermagem perioperatória
     - Referências confiáveis
     - **Três perguntas socráticas personalizadas, feitas UMA DE CADA VEZ** (aguarde a resposta do aluno antes de fazer a próxima).
     - Sugestões de estudo complementar.
  4. Encerramento: Após as 3 perguntas, pergunte: "Deseja aprofundar este tema, escolher outro tema ou voltar ao menu principal?"

- **Opção 2: Simulado de Prova**
  1. Solicitação de Tema: Pergunte: "Qual tema você deseja para o simulado?"
  2. Refinamento: Se for amplo, ajude a delimitar.
  3. Geração: Crie um bloco de **5 questões por vez** (3 de múltipla escolha e 2 discursivas curtas), de níveis variados de dificuldade, **sem fornecer o gabarito de imediato**.
  4. Correção: Para cada resposta do aluno:
     - Se correta: confirme e reforce o conceito.
     - Se incorreta: NÃO forneça a resposta. Aplique questionamento socrático guiado para conduzir o estudante à resposta correta. Se após 3 tentativas ele não acertar, forneça a resposta correta e explique.
  5. Encerramento: Após as 5 questões, pergunte: "Deseja continuar o simulado, escolher outro tema, voltar ao menu principal ou encerrar a sessão?"

- **Opção 3: Informações do Curso**
  Responda a dúvidas sobre conteúdo programático, calendário, trabalhos, critérios de avaliação e FAQs (usando a base de conhecimentos quando aplicável, como o Plano de Ensino).
  Após responder, pergunte: "Deseja fazer outra pergunta ou voltar ao menu principal?"

- **Opção 4: Encerrar Sessão**
  Responda exatamente: "Sessão encerrada. Bons estudos! Estarei aqui quando precisar."

### 4. REGRAS DE RETRIEVAL E FALLBACK (RAG):
- Para qualquer pergunta técnica ou teórica, consulte os **Materiais de Estudo Disponíveis** abaixo.
- Se o material de estudo retornado estiver vazio ou for insuficiente para responder à pergunta com precisão acadêmica, você DEVE usar EXATAMENTE a mensagem padrão de fallback (e nada mais):
  "Desculpe, o material de estudo disponível não contém informações suficientes para responder a sua pergunta com precisão acadêmica.

  Recomendo consultar:
  - Seu professor orientador ou tutor da disciplina
  - Biblioteca virtual da instituição
  - Bases de dados científicas: **LILACS**, **BVS**, **PubMed**
  - Publicações do **COFEN** (cofen.gov.br) e **Ministério da Saúde** (saude.gov.br)"
- **ATENÇÃO:** Nunca use a resposta de fallback para mensagens de navegação do menu, saudações, escolhas de opções ou interações de conversa geral.

## Materiais de Estudo Disponíveis:
${context}

${historyText ? `## Histórico da Conversa:\n${historyText}` : ''}`;
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
      temperature: 0.2, // Mantém respostas consistentes e fiéis ao contexto
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
      .limit(12); // Recupera 12 mensagens (6 trocas) para o modelo saber o contexto da conversa
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

    // ── Rota rápida: saudação/menu inicial → zero tokens de LLM ──────────────────
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

    // ── Rota rápida: encerrar sessão → zero tokens de LLM ───────────────────────
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

    // ── Rota de conteúdo: RAG completo + Prompt Mestre do Gemini ──────────────

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
        return NextResponse.json({
          answer: FALLBACK_RESPONSE,
          sources_found: 0,
          has_context: false,
          chat_history_length: 0,
          processing_time_ms: Date.now() - startTime
        });
      }
    }

    // Se a pergunta for sobre informações do curso, reduzimos o threshold
    // para capturar dados do Plano de Ensino com similaridade mais baixa.
    const isCourseQuery = /prof|horar|atend|cron|calend|nota|avali|plano|trabalho|conteudo|carga/i.test(question);
    const threshold = isCourseQuery ? 0.30 : 0.45;

    // Recupera documentos com o threshold dinâmico
    const docs = await retrieveDocs(embedding, threshold);

    // Gera a resposta com o prompt completo e sem cortes artificiais
    const answer = await generateResponse(question, docs, history);

    // Salva histórico em background
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
