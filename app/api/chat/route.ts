// app/api/chat/route.ts
// CRAG (Corrective RAG) implementado em TypeScript para rodar na Vercel
// Substitui completamente o backend FastAPI Python

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const runtime = 'nodejs';
export const maxDuration = 120; // 2 min para processar RAG completo

// ── Constantes ────────────────────────────────────────────────────────────────

const FALLBACK_RESPONSE =
  'Desculpe, o material de estudo disponível não contém informações suficientes ' +
  'para responder a sua pergunta com precisão acadêmica.\n\n' +
  'Recomendo consultar:\n' +
  '- Seu professor orientador ou tutor da disciplina\n' +
  '- Biblioteca virtual da instituição\n' +
  '- Bases de dados científicas: **LILACS**, **BVS**, **PubMed**\n' +
  '- Publicações do **COFEN** (cofen.gov.br) e **Ministério da Saúde** (saude.gov.br)';

const GREETING_RESPONSE =
  'Olá! Sou o seu **Tutor de Enfermagem Perioperatória**. 🩺\n\n' +
  'Estou aqui para apoiar você nos seus estudos de Enfermagem Perioperatória de forma personalizada.\n\n' +
  '### MENU PRINCIPAL\n' +
  'Escolha uma das opções abaixo para começarmos:\n\n' +
  '1. **Resumo de Conteúdo**\n' +
  '2. **Simulado de Prova**\n' +
  '3. **Informações do Curso**\n' +
  '4. **Encerrar Sessão**\n\n' +
  'Digite o número ou o nome da opção desejada!';

const GREETING_WORDS = new Set([
  'oi', 'olá', 'ola', 'opa', 'bom', 'dia', 'boa', 'tarde', 'noite',
  'tudo', 'bem', 'como', 'vai', 'você', 'voce', 'e', 'aí', 'ai',
  'hello', 'hi', 'salve', 'tutor', 'bot', 'ia', 'sistema',
  'quem', 'o', 'que', 'faz', 'pode', 'fazer', 'nome', 'seu',
  'ajuda', 'me', 'estudar', 'com', 'obrigado', 'obrigada', 'valeu',
  'menu', 'inicio', 'início', 'voltar', 'começar', 'comecar'
]);

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

// ── Helpers ───────────────────────────────────────────────────────────────────

function isGreeting(text: string): boolean {
  const normalized = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .trim();
  const words = normalized.split(/\s+/).filter(Boolean);
  if (!words.length) return false;
  
  // Se for apenas uma palavra e estiver na lista de saudações, ou se for um comando de voltar/menu
  return words.some((w) => GREETING_WORDS.has(w)) && words.length <= 3;
}

function formatContext(docs: Document[]): string {
  if (!docs.length) return 'Nenhum material disponível.';
  return docs
    .map((d, i) =>
      `[${i + 1}] **Arquivo:** ${d.source} (similaridade: ${d.similarity.toFixed(2)})\n${d.content}`
    )
    .join('\n\n---\n\n');
}

function formatHistory(history: Array<{ role: string; content: string }>, maxTurns = 8): string {
  if (!history.length) return '';
  const recent = history.slice(-(maxTurns * 2));
  return recent
    .map((h) => `**${h.role === 'user' ? 'Estudante' : 'Tutor'}:** ${h.content}`)
    .join('\n');
}

// ── Inicializa clientes (lazy, uma vez por cold start) ────────────────────────

let _supabase: ReturnType<typeof createClient> | null = null;
let _genai: GoogleGenerativeAI | null = null;

function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_KEY!
    );
  }
  return _supabase;
}

function getGenAI() {
  if (!_genai) {
    _genai = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);
  }
  return _genai;
}

// ── STEP 1: Gera embedding da pergunta ───────────────────────────────────────

async function embedQuery(text: string): Promise<number[]> {
  const genai = getGenAI();
  const model = genai.getGenerativeModel({ model: 'gemini-embedding-2' });
  const result = await model.embedContent({
    content: { role: 'user', parts: [{ text }] },
    outputDimensionality: 768,
  } as any);
  return result.embedding.values;
}

// ── STEP 2: Busca documentos no Supabase ─────────────────────────────────────

async function retrieveDocs(embedding: number[]): Promise<Document[]> {
  const supabase = getSupabase();
  const { data, error } = await (supabase.rpc as any)('match_documents', {
    query_embedding: embedding,
    match_threshold: parseFloat(process.env.RAG_MATCH_THRESHOLD || '0.45'),
    match_count: parseInt(process.env.RAG_MATCH_COUNT || '5'),
  });

  if (error) {
    console.error('[retrieve] Supabase RPC error:', error);
    return [];
  }

  return (data || []).map((row: Record<string, unknown>) => ({
    content: row.content as string,
    source: (row.source as string) || 'desconhecido',
    similarity: (row.similarity as number) || 0,
  }));
}

// ── STEP 3: Avalia relevância de cada chunk (CRAG grader) ────────────────────

async function gradeDocs(question: string, docs: Document[]): Promise<Document[]> {
  if (!docs.length) return [];

  const genai = getGenAI();
  const model = genai.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: { temperature: 0.1 },
  });

  const gradePromises = docs.map(async (doc, i) => {
    const prompt = `Você é um avaliador especialista em enfermagem clínica.
Avalie se o trecho abaixo é RELEVANTE para responder a pergunta do estudante.

Responda APENAS com "RELEVANT" ou "IRRELEVANT".

**Pergunta:** ${question}

**Trecho [${i + 1}] (fonte: ${doc.source}):**
${doc.content.slice(0, 1500)}

Avaliação:`;

    try {
      const result = await model.generateContent(prompt);
      const verdict = result.response.text().trim().toUpperCase();
      return verdict.includes('RELEVANT') ? doc : null;
    } catch {
      return doc; 
    }
  });

  const results = await Promise.all(gradePromises);
  return results.filter((d): d is Document => d !== null);
}

// ── STEP 4: Gera resposta com contexto ───────────────────────────────────────

async function generateResponse(
  question: string,
  docs: Document[],
  history: Array<{ role: string; content: string }>
): Promise<string> {
  const genai = getGenAI();
  const model = genai.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: { temperature: 0.2 },
  });

  const context = formatContext(docs);
  const historyText = formatHistory(history);
  const historySection = historyText
    ? `\n\n## Histórico da Conversa:\n${historyText}`
    : '';

  const systemPrompt = `Você é o **Tutor de Enfermagem**, um Assistente de Inteligência Artificial Generativa Educacional especializado em Enfermagem Perioperatória.
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
- Para qualquer pergunta técnica ou teórica (Tópico A), consulte os **Materiais de Estudo Disponíveis** abaixo.
- Se o material de estudo retornado estiver vazio ou for insuficiente para responder à pergunta com precisão acadêmica, você DEVE usar EXATAMENTE a mensagem padrão de fallback (e nada mais):
  "Desculpe, o material de estudo disponível não contém informações suficientes para responder a sua pergunta com precisão acadêmica.

  Recomendo consultar:
  - Seu professor orientador ou tutor da disciplina
  - Biblioteca virtual da instituição
  - Bases de dados científicas: **LILACS**, **BVS**, **PubMed**
  - Publicações do **COFEN** (cofen.gov.br) e **Ministério da Saúde** (saude.gov.br)"
- **ATENÇÃO:** Nunca use a resposta de fallback para mensagens de navegação do menu, saudações, escolhas de opções ou interações de conversa geral (Tópico B).

## Materiais de Estudo Disponíveis:
${context}${historySection}`;

  const result = await model.generateContent([
    { text: systemPrompt },
    { text: `Mensagem atual do estudante: ${question}` },
  ]);

  return result.response.text();
}

// ── STEP 5: Salva/recupera histórico no Supabase ─────────────────────────────

async function getSessionHistory(
  sessionId: string
): Promise<Array<{ role: string; content: string }>> {
  try {
    const supabase = getSupabase();
    const { data } = await (supabase.from('chat_messages') as any)
      .select('role, content')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })
      .limit(12); // últimas 6 trocas
    return data || [];
  } catch {
    return [];
  }
}

async function saveMessages(
  sessionId: string,
  userMsg: string,
  assistantMsg: string
) {
  try {
    const supabase = getSupabase();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('chat_messages') as any).insert([
      { session_id: sessionId, role: 'user', content: userMsg },
      { session_id: sessionId, role: 'assistant', content: assistantMsg },
    ]);
  } catch (e) {
    console.warn('[saveMessages] Erro ao salvar histórico:', e);
  }
}

// ── HANDLER PRINCIPAL ─────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const startTime = Date.now();

  try {
    const body: ChatRequest = await req.json();
    const { session_id, message } = body;

    if (!message?.trim()) {
      return NextResponse.json({ error: 'Mensagem vazia' }, { status: 400 });
    }

    const question = message.trim();

    // 0. Saudação pura → resposta direta sem RAG
    if (isGreeting(question)) {
      await saveMessages(session_id, question, GREETING_RESPONSE);
      return NextResponse.json({
        answer: GREETING_RESPONSE,
        sources_found: 0,
        has_context: false,
        chat_history_length: 2,
        processing_time_ms: Date.now() - startTime,
      });
    }

    // 1. Recuperar histórico da sessão
    const history = await getSessionHistory(session_id);

    // 2. Gerar embedding da pergunta
    let embedding: number[];
    try {
      embedding = await embedQuery(question);
    } catch (e) {
      console.error('[embed] Erro:', e);
      // Fallback sem RAG se embedding falhar
      await saveMessages(session_id, question, FALLBACK_RESPONSE);
      return NextResponse.json({
        answer: FALLBACK_RESPONSE,
        sources_found: 0,
        has_context: false,
        chat_history_length: history.length + 2,
        processing_time_ms: Date.now() - startTime,
      });
    }

    // 3. Recuperar documentos
    const rawDocs = await retrieveDocs(embedding);

    // 4. Avaliar relevância (CRAG)
    const relevantDocs = rawDocs.length > 0 ? await gradeDocs(question, rawDocs) : [];

    // 5. Gerar resposta (sempre passa pelo LLM para tratar conversas/ajuda de forma inteligente)
    const answer = await generateResponse(question, relevantDocs, history);

    // 6. Salvar no histórico
    await saveMessages(session_id, question, answer);

    return NextResponse.json({
      answer,
      sources_found: relevantDocs.length,
      has_context: relevantDocs.length > 0,
      chat_history_length: history.length + 2,
      processing_time_ms: Date.now() - startTime,
    });

  } catch (err) {
    console.error('[chat] Erro inesperado:', err);
    return NextResponse.json(
      { error: 'Erro interno do servidor.' },
      { status: 500 }
    );
  }
}
