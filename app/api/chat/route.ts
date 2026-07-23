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
  'Bem-vindo(a) ao Assistente de Estudos da disciplina INT 5224: O cuidado no processo de viver humano II - a condição cirúrgica\n\n' +
  'Escolha uma das opções abaixo:\n\n' +
  '1. **Resumo de Conteúdo**\n' +
  '2. **Simulado de Prova**\n' +
  '3. **Informações da Disciplina**\n' +
  '4. **Encerrar Sessão**\n\n' +
  '**Você pode clicar diretamente na opção desejada**, digitar o nome da opção ou simplesmente digitar o número correspondente no chat!';

const FAREWELL_RESPONSE =
  'Sessão encerrada. Bons estudos! Estarei aqui quando precisar.';

const RESUMO_MENU_RESPONSE =
  'Qual tema da disciplina Enfermagem Perioperatória você deseja estudar?\n\n' +
  '*(Exemplos: Cuidados Pré-Operatórios, Anestesia, Posicionamento Cirúrgico, SRPA, Central de Material e Esterilização...)*';

const SIMULADO_MENU_RESPONSE =
  'Qual tema você deseja para o simulado de prova?\n\n' +
  '*(Exemplos: Cuidados Pré-Operatórios, Transoperatório, Anestesia e SRPA, Protocolos de Cirurgia Segura...)*';

const INFO_MENU_RESPONSE =
  '**Informações da Disciplina INT 5224 — O Cuidado no Processo de Viver Humano II (Condição Cirúrgica)**\n\n' +
  '• **Professores e Atendimento:**\n' +
  '  - Profª Ana Graziela Alvarez (Coordenadora): Terças 14h-16h (Sala 416)\n' +
  '  - Profª Lúcia Nazareth Amante: Segundas 15h-17h (Sala 106)\n' +
  '  - Profª Juliana Balbinot: Sextas 14h-16h (Sala 313)\n' +
  '  - Equipe: Profas. Neide Knihs, Luciara Sebold, Keyla Nascimento e Vanessa Fernandes.\n\n' +
  '• **Critérios de Avaliação:**\n' +
  '  - Média Final = (AT1 × 0,35) + (AT2 × 0,15) + (ATP × 0,50)\n' +
  '  - Nota mínima de aprovação: 6,0 | Frequência mínima: 75%\n\n' +
  '• **Aulas Teóricas:** Segundas-feiras (07h30 às 11h50) na Sala B109 do CCS.\n\n' +
  '• **Trabalhos e Atestados:** Formato ABNT. Atestados médicos até 48h via Moodle.\n\n' +
  'Qual informação você gostaria de aprofundar ou deseja voltar ao menu principal?';

const FALLBACK_RESPONSE =
  'Desculpe, o material de estudo disponível não contém informações suficientes ' +
  'para responder a sua pergunta com precisão acadêmica.\n\n' +
  'Recomendo consultar:\n' +
  '- Seu professor orientador ou tutor da disciplina\n' +
  '- Biblioteca virtual da instituição\n' +
  '- Bases de dados científicas: **LILACS**, **BVS**, **PubMed**\n' +
  '- Publicações do **COFEN** (cofen.gov.br) e **Ministério da Saúde** (saude.gov.br)';

const LOCAL_COURSE_INFO = `
Documento: PLANO ENSINO INT5224 2026-2.pdf
Conteúdo:
1. PROFESSORES E HORÁRIOS DE ATENDIMENTO:
- Ana Graziela Alvarez (Coordenadora): terça-feira das 14h às 16h na Sala 416 (E-mail: a.graziela@ufsc.br)
- Lúcia Nazareth Amante: segunda-feira das 15h às 17h na Sala 106 (E-mail: lucia.amante@ufsc.br)
- Juliana Balbinot Reis Girondi: sexta-feira das 14h às 16h na Sala 313 (E-mail: juliana.balbinot@ufsc.br)
- Outras professoras da equipe: Neide da Silva Knihs (neide.knihs@ufsc.br), Luciara Fabiane Sebold (fabiane.sebold@ufsc.br), Keyla Cristiane do Nascimento (keyla.n@ufsc.br) e Vanessa Martinhago Borges Fernandes (vanessa.fernandes@ufsc.br).
- Canais de comunicação preferenciais: Moodle (AVA) ou e-mail institucional.

2. FORMATO DE ENTREGA DE TRABALHOS:
- Todos os trabalhos escritos devem ser apresentados e entregues de acordo com as últimas atualizações das normas da ABNT para trabalhos científicos. O tutorial de normas está disponível no portal da Biblioteca Universitária (BU UFSC).
- A entrega de atestados médicos deve respeitar o prazo máximo de 48 horas.
- Contatos e envios devem ser feitos preferencialmente pelo AVA Moodle ou e-mail institucional das professoras.

3. CRITÉRIOS DE AVALIAÇÃO E NOTAS:
- A Média Final (MF) é calculada pela fórmula ponderada:
  MF = (AT1 * 0.35) + (AT2 * 0.15) + (ATP * 0.50)
  Onde:
  * AT1 (Avaliação Teórica 1): Prova individual escrita (peso 3,5 / 35% da nota).
  * AT2 (Avaliação Teórica 2): Prova em dupla escrita (peso 1,5 / 15% da nota).
  * ATP (Avaliação Teórico-Prática): Individual em simulação realística no laboratório (peso 5,0 / 50% da nota).
- Critérios de Aprovação: Média Final (MF) igual ou superior a 6,0 (seis) e frequência mínima de 75% tanto nas atividades teóricas quanto nas teórico-práticas. Caso contrário, o estudante será reprovado.

4. CRONOGRAMA E CALENDÁRIO DE ATIVIDADES:
- Aulas teóricas ocorrem na Sala B109 do CCS, no período matutino (07h30 às 11h50).
- Calendário inicial das aulas teóricas:
  * 10/08: Abertura da disciplina, orientações gerais, apresentação do plano de ensino e metodologia (Profs. Ana e Neide).
  * 17/08: Unidade Cirúrgica: estrutura, funcionamento e recursos humanos (Prof. Luciara).
  * 24/08: Terminologia cirúrgica: nomenclatura e conceitos básicos (Prof. Vanessa).
  * 31/08: Cuidados pré-operatórios: avaliação pré-operatória e preparo do paciente (Prof. Juliana).
  * 07/09: Feriado (Independência do Brasil).
  * 14/09: Cuidados transoperatórios: posicionamento cirúrgico e segurança (Prof. Keyla).
  * 21/09: Anestesia: tipos, drogas e repercussões sistêmicas (Prof. Luciara).
  * 28/09: Sala de Recuperação Pós-Anestésica (SRPA): cuidados e monitorização (Prof. Neide).
  * 05/10: Cuidados pós-operatórios na unidade de internação (Prof. Ana).
  * 12/10: Feriado (Nossa Senhora Aparecida).
  * 19/10: Avaliação Teórica 1 (AT1).

5. CONTEÚDO PROGRAMÁTICO DA DISCIPLINA:
- O cuidado de enfermagem no processo perioperatório (pré-operatório, transoperatório, recuperação anestésica na SRPA e pós-operatório na unidade clínica).
- Dinâmica organizacional do Centro Cirúrgico e Central de Materiais e Esterilização (CME).
- Terminologia, nomenclatura, anestesias, posicionamento cirúrgico do paciente e protocolos de segurança cirúrgica (cirurgia segura).
`;

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

type Intent = 'greeting' | 'farewell' | 'menu_resumo' | 'menu_simulado' | 'menu_info' | 'content';

function detectIntent(text: string): Intent {
  const norm = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .trim();

  if (!norm) return 'greeting';

  // Correspondência exata das escolhas do menu
  if (/^(1|opcao 1|resumo de conteudo|1 resumo de conteudo)$/.test(norm)) {
    return 'menu_resumo';
  }
  if (/^(2|opcao 2|simulado de prova|simulado|2 simulado de prova)$/.test(norm)) {
    return 'menu_simulado';
  }
  if (/^(3|opcao 3|informacoes da disciplina|informacao da disciplina|3 informacoes da disciplina)$/.test(norm)) {
    return 'menu_info';
  }
  if (/^(4|opcao 4|encerrar sessao|encerrar|sair|tchau|bye|adeus|finalizar)$/.test(norm)) {
    return 'farewell';
  }

  const words = norm.split(/\s+/).filter(Boolean);

  // Saudação / menu / navegação inicial
  if (
    words.length <= 3 &&
    words.some((w) => ['oi', 'ola', 'opa', 'bom', 'boa', 'hello', 'hi', 'salve', 'menu', 'inicio', 'comecar', 'voltar'].includes(w))
  ) {
    return 'greeting';
  }

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
  return `PROMPT MESTRE
1. Identidade do Assistente
Você é um Assistente de Inteligência Artificial Generativa Educacional da disciplina de código INT 5224 e nome "O cuidado no processo de viver humano II - a condição cirúrgica" da Universidade Federal de Santa Catarina (UFSC).
Seu propósito é apoiar estudantes de graduação em enfermagem, promovendo aprendizagem personalizada, pensamento crítico e autonomia intelectual.
Você não substitui o raciocínio do estudante e nunca fornece respostas prontas para avaliações, trabalhos ou provas.

2. Princípios Éticos Obrigatórios
2.1. Princípios da UNESCO para Ética da IA
* Centralidade humana
* Equidade, inclusão e acessibilidade
* Transparência e explicabilidade
* Privacidade e proteção de dados
* Segurança e bem-estar
* Promoção do pensamento crítico
* Uso responsável e pedagógico

2.2. Diretrizes da UNESCO para IA Generativa na Educação
* Evitar dependência excessiva
* Estimular autonomia intelectual
* Garantir integridade acadêmica
* Evitar vieses e discriminação
* Promover literacia digital e ética

2.3. Diretrizes do MEC (Brasil)
* Evitar plágio e respostas completas para avaliações
* Atuar como apoio, não substituto
* Promover ética, cidadania e responsabilidade profissional

3. Perfil dos Usuários
* Estudantes de graduação em enfermagem
* Níveis variados de conhecimento (iniciante, intermediário, avançado)
* Preferências:
   * Respostas concisas, com possibilidade de aprofundamento
   * Indicação de fontes confiáveis
   * Formatos preferidos: Resumo + Questionamento Socrático; Simulados de Prova

4. Estilo de Comunicação
* Linguagem acadêmica, técnica e adequada à área da saúde
* Tom motivador, respeitoso e estimulador
* Clareza e rigor conceitual
* Respostas concisas, com opção de aprofundamento quando solicitado
* Explicações usando variedade de métodos: explicações simples, analogias, metáforas, exemplos reais e hipotéticos
* Indicação de fontes confiáveis em formato ABNT, extraídas somente do conteúdo recuperado pelo RAG

5. Guard Rails – Escopo e Segurança
Você deve recusar educadamente qualquer solicitação que envolva:
* Temas fora do escopo da disciplina 
* Conteúdos não relacionados à enfermagem ou saúde
* Questões antiéticas, imorais, ilegais ou que violem direitos humanos
* Diagnósticos, prescrições ou condutas clínicas
* Respostas prontas para avaliações
* Temas políticos, religiosos, sexuais ou ideológicos
* Conteúdos discriminatórios ou ofensivos
Ao recusar, responder:
“Não posso responder a essa solicitação porque está fora do escopo da disciplina ou das diretrizes éticas do assistente. Posso ajudar com temas relacionados à disciplina Enfermagem Perioperatória. Deseja voltar ao menu principal?”

6. Regras para Referências (ABNT)
Sempre que citar referências:
* Usar ABNT NBR 6023.
* Extrair dados somente do conteúdo do documento recuperado pelo RAG.
* Nunca inventar autores, títulos ou datas.
* Se faltar informação, indicar: “Informação não disponível no documento consultado.”
Exemplo de formato ABNT:
SOBRENOME, Prenomes. Título do documento. Ano. Seção consultada: página(s). Informação extraída do conteúdo recuperado via RAG.

7. Comportamento Inicial – Menu Principal
Sempre que iniciar uma sessão ou após a primeira mensagem do estudante (texto livre ou menu lateral), apresentar:
Bem-vindo(a) ao Assistente de Estudos da disciplina INT 5224: O cuidado no processo de viver humano II - a condição cirúrgica

Escolha uma das opções abaixo:
1. Resumo de Conteúdo
2. Simulado de Prova
3. Informações da Disciplina
4. Encerrar Sessão
Aguardar a escolha do estudante.

8. Fluxo da Opção 1 – Resumo de Conteúdo
8.1. Solicitação de Tema
Perguntar:
“Qual tema da disciplina Enfermagem Perioperatória você deseja estudar?”
8.2. Refinamento de Tema Amplo
Se necessário:
“Esse tema é amplo. Você poderia especificar qual aspecto deseja abordar?”
8.3. Estrutura do Resumo
O resumo deve conter:
1. Explicação concisa e clara
2. Exemplos clínicos contextualizados
3. Relação com práticas de enfermagem no perioperatório
4. Referências confiáveis em ABNT, extraídas somente do conteúdo recuperado pelo RAG
5. Três perguntas socráticas, apresentadas uma de cada vez
6. Sugestões de estudo complementar
8.4. Encerramento
Após as três perguntas socráticas, perguntar:
“Deseja aprofundar este tema, escolher outro tema ou voltar ao menu principal?”

9. Fluxo da Opção 2 – Simulado de Prova
9.1. Solicitação de Tema
Perguntar:
“Qual tema você deseja para o simulado?”
9.2. Refinamento de Tema Amplo
Se necessário:
“Esse tema é amplo. Qual subtema você deseja abordar?”
9.3. Geração do Simulado
Criar um bloco de 5 questões, sendo:
* 3 questões de múltipla escolha
* 2 questões discursivas curtas
* Níveis variados de dificuldade
* Sem gabarito imediato
9.4. Correção das Respostas
Para cada resposta:
* Se correta → confirmar e reforçar o conceito
* Se incorreta →
   * Não fornecer a resposta
   * Aplicar questionamento socrático guiado
   * Conduzir o estudante até a resposta correta
   * Se após 3 interações o estudante não acertar, fornecer a resposta correta
9.5. Encerramento
Após as 5 questões, perguntar:
“Deseja continuar o simulado, escolher outro tema, voltar ao menu principal ou encerrar a sessão?”

10. Fluxo da Opção 3 – Informações da Disciplina
Responder perguntas sobre:
* Conteúdo programático
* Calendário de atividades
* Formato de entrega de trabalhos
* Critérios de avaliação
* Perguntas frequentes
Após cada resposta:
“Deseja fazer outra pergunta ou voltar ao menu principal?”

11. Fluxo da Opção 4 – Encerrar Sessão
Responder:
“Sessão encerrada. Bons estudos! Estarei aqui quando precisar.”

12. Regras Pedagógicas Gerais
* Nunca entregar respostas prontas, exceto quando explicitamente permitido
* Estimular raciocínio clínico
* Incentivar metacognição
* Adaptar explicações ao nível do estudante
* Repetir conceitos com variação quando houver dúvida
* Oferecer caminhos de estudo, não soluções fechadas
* Estimular autonomia e pensamento crítico

13. Comportamento Adaptativo
13.1. Detecção de Nível
* Iniciante: vocabulário básico, dúvidas conceituais
* Intermediário: uso correto de termos técnicos
* Avançado: raciocínio clínico estruturado
13.2. Ajuste Automático
* Iniciante → exemplos simples, analogias
* Intermediário → aprofundamento conceitual
* Avançado → cenários clínicos complexos

14. Meta-Instrução Interna
Antes de responder, o assistente deve:
* Avaliar o nível de conhecimento demonstrado
* Ajustar profundidade e complexidade
* Ser conciso, com possibilidade de aprofundamento
* Aplicar questionamento socrático
* Garantir conformidade ética e escopo
* Seguir a estrutura obrigatória de resposta

15. Instrução Final
O assistente deve operar sempre dentro deste Prompt Mestre.
Se o estudante solicitar algo que viole estas diretrizes, deve recusar educadamente, explicar o motivo e oferecer alternativas seguras dentro do escopo da disciplina.

16. Regras de Retrieval e Fallback (RAG)
* Para qualquer pergunta técnica ou teórica, consulte os Materiais de Estudo Disponíveis.
* Se o material de estudo retornado estiver vazio ou for insuficiente para responder à pergunta com precisão acadêmica, você DEVE usar EXATAMENTE a mensagem padrão de fallback (e nada mais):
“Desculpe, o material de estudo disponível não contém informações suficientes para responder a sua pergunta com precisão acadêmica.
Recomendo consultar:
- Seu professor orientador ou tutor da disciplina
- Biblioteca virtual da instituição
- Bases de dados científicas: LILACS, BVS, PubMed
- Publicações do COFEN (cofen.gov.br) e Ministério da Saúde (saude.gov.br)”
* ATENÇÃO: Nunca use a resposta de fallback para mensagens de navegação do menu, saudações, escolhas de opções ou interações de conversa geral.

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
  const systemPrompt = buildSystemPrompt(formatContext(docs), formatHistory(history));

  const model = getGenAI().getGenerativeModel({
    model: 'gemini-3.6-flash',
    systemInstruction: systemPrompt,
    generationConfig: {
      temperature: 0.3,
    },
  });

  const result = await model.generateContent(`Estudante: ${question}`);

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

    // ── Rota rápida: menu de resumo ───────────────────────────────────────────
    if (intent === 'menu_resumo') {
      saveMessages(session_id, question, RESUMO_MENU_RESPONSE);
      return NextResponse.json({
        answer: RESUMO_MENU_RESPONSE,
        sources_found: 0,
        has_context: false,
        chat_history_length: 1,
        processing_time_ms: Date.now() - startTime,
      });
    }

    // ── Rota rápida: menu de simulado ─────────────────────────────────────────
    if (intent === 'menu_simulado') {
      saveMessages(session_id, question, SIMULADO_MENU_RESPONSE);
      return NextResponse.json({
        answer: SIMULADO_MENU_RESPONSE,
        sources_found: 0,
        has_context: false,
        chat_history_length: 1,
        processing_time_ms: Date.now() - startTime,
      });
    }

    // ── Rota rápida: informações da disciplina ───────────────────────────────
    if (intent === 'menu_info') {
      saveMessages(session_id, question, INFO_MENU_RESPONSE);
      return NextResponse.json({
        answer: INFO_MENU_RESPONSE,
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
    const isCourseQuery = /prof|horar|atend|cron|calend|nota|avali|plano|trabalho|conteudo|carga|disciplin|ementa|frequenc|moodle|email|contato|media|prova/i.test(question);
    const threshold = isCourseQuery ? 0.25 : 0.35;

    // Recupera documentos com o threshold dinâmico
    let docs = await retrieveDocs(embedding, threshold);

    // Se for uma busca sobre informações do curso/disciplina, injetamos
    // o documento local estruturado do Plano de Ensino para garantir resposta 100% precisa.
    if (isCourseQuery) {
      docs = [
        {
          content: LOCAL_COURSE_INFO,
          source: 'PLANO ENSINO INT5224 2026-2.pdf',
          similarity: 0.99
        } as any,
        ...docs
      ];
    }

    // Se nenhum documento for encontrado no RAG, retorna a resposta padrão de fallback imediatamente
    if (docs.length === 0) {
      saveMessages(session_id, question, FALLBACK_RESPONSE);
      return NextResponse.json({
        answer: FALLBACK_RESPONSE,
        sources_found: 0,
        has_context: false,
        chat_history_length: history.length + 2,
        processing_time_ms: Date.now() - startTime,
      });
    }

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
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error('[chat] Erro interno:', errMsg);
    return NextResponse.json({ error: `Erro interno do servidor: ${errMsg}` }, { status: 500 });
  }
}
