// app/api/chat/route.ts — Tutor de Enfermagem INT 5224
// Prompt Mestre conforme Prompt 21Jul2026.pdf (todas as 15 seções implementadas)

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const runtime = 'nodejs';
export const maxDuration = 60;

// ── Respostas fixas (zero tokens de LLM para navegação rápida) ───────────────

const GREETING_RESPONSE =
  'Olá! Que bom ter você aqui no Assistente de Estudos da INT 5224 – O cuidado no processo de viver humano II: a condição cirúrgica\n\n' +
  'Este espaço foi pensado para facilitar sua jornada de aprendizagem sobre o cuidado no processo de viver humano em condição cirúrgica. Aqui você revisa conteúdos, pratica com simulados e acessa informações essenciais da disciplina.\n\n' +
  'Como usar: Fale comigo como se estivesse conversando com um tutor. Peça explicações, tire dúvidas ou escolha uma das opções abaixo.\n\n' +
  'Opções:\n\n' +
  '- Resumo de Conteúdo\n' +
  '- Simulado de Prova\n' +
  '- Informações da Disciplina\n' +
  '- Encerrar Sessão';

const MENU_RETURN_RESPONSE =
  'Você voltou ao menu principal.\n\n' +
  'Escolha uma opção ou envie uma pergunta livre relacionada à disciplina:\n\n' +
  '- Resumo de Conteúdo\n' +
  '- Simulado de Prova\n' +
  '- Informações da Disciplina\n' +
  '- Encerrar Sessão';

const FAREWELL_RESPONSE =
  'Sessão encerrada. Bons estudos! Estarei aqui sempre quando precisar.';

const RESUMO_MENU_RESPONSE =
  'Qual tema da disciplina O cuidado no processo de viver humano II - a condição cirúrgica você deseja estudar?\n\n' +
  '*(Exemplos: Controle de infecção no perioperatório, Feridas, Nomenclatura Cirúrgica, Suturas, Dor pós-operatória, Cuidados pré-operatórios, Avaliação Nutricional, entre outros)*';

const SIMULADO_MENU_RESPONSE =
  'Qual tema você deseja para o simulado? Após a declaração do tema, farei três perguntas de múltipla escolha onde apenas uma resposta é a correta.\n\n' +
  '*(Exemplos: Hemostasia, Cirurgia Bariátrica, Estomas, Capacitação Hospitalar, Teleconsulta, Cuidados pós-operatórios, entre outros)*';

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
  'Deseja fazer outra pergunta, voltar ao menu principal ou encerrar a sessão?';

const REFUSAL_RESPONSE =
  'Não posso responder a essa solicitação porque está fora do escopo da disciplina ou das diretrizes éticas do assistente. Posso ajudar com temas relacionados à disciplina O cuidado no processo de viver humano II - a condição cirúrgica. Deseja voltar ao menu principal ou repetir a pergunta?';

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

type Intent = 'greeting' | 'menu_return' | 'farewell' | 'menu_resumo' | 'menu_simulado' | 'menu_info' | 'content';

function detectIntent(text: string): Intent {
  const norm = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .trim();

  if (!norm) return 'greeting';

  // Retorno explícito ao menu
  if (/^(menu|voltar|inicio|home|opcoes|opcao|voltar pro comeco|quero o menu)$/.test(norm)) {
    return 'menu_return';
  }

  // Correspondência exata das escolhas do menu
  if (/^(1|opcao 1|resumo de conteudo|1 resumo de conteudo|resumo)$/.test(norm)) {
    return 'menu_resumo';
  }
  if (/^(2|opcao 2|simulado de prova|simulado|2 simulado de prova)$/.test(norm)) {
    return 'menu_simulado';
  }
  if (/^(3|opcao 3|informacoes da disciplina|informacao da disciplina|3 informacoes da disciplina|informacoes|informacao)$/.test(norm)) {
    return 'menu_info';
  }
  if (/^(4|opcao 4|encerrar sessao|encerrar|sair|tchau|bye|adeus|finalizar)$/.test(norm)) {
    return 'farewell';
  }

  const words = norm.split(/\s+/).filter(Boolean);

  // Saudação / navegação inicial
  if (
    words.length <= 3 &&
    words.some((w) => ['oi', 'ola', 'opa', 'bom', 'boa', 'hello', 'hi', 'salve', 'comecar', 'tutor', 'bot'].includes(w))
  ) {
    return 'greeting';
  }

  return 'content';
}

// ── Helpers de formatação RAG ─────────────────────────────────────────────────

function formatContext(docs: Document[]): string {
  if (!docs.length) return 'Nenhum material disponível.';
  return docs
    .map((d, i) =>
      `[${i + 1}] Arquivo: ${d.source} (similaridade: ${d.similarity.toFixed(2)})\n${d.content}`
    )
    .join('\n\n---\n\n');
}

function formatHistory(history: Array<{ role: string; content: string }>): string {
  if (!history.length) return '';
  return history
    .map((h) => `${h.role === 'user' ? 'Estudante' : 'Tutor'}: ${h.content}`)
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

// ── Retrieval ─────────────────────────────────────────────────────────────────

async function retrieveDocs(embedding: number[], threshold = 0.35): Promise<Document[]> {
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

// ── System Prompt Mestre (Prompt 21Jul2026.pdf — COMPLETO, 15 seções) ─────────

function buildSystemPrompt(context: string, historyText: string): string {
  return `Prompt Mestre — INT 5224 – O cuidado no processo de viver humano II: a condição cirúrgica (UFSC)

1 Identidade do Assistente
Você é um Assistente de Inteligência Artificial Generativa Educacional da disciplina de código INT 5224 e nome "O cuidado no processo de viver humano II - a condição cirúrgica" da Universidade Federal de Santa Catarina (UFSC).
Seu propósito é apoiar estudantes de graduação em enfermagem, promovendo aprendizagem personalizada, pensamento crítico e autonomia intelectual. Você não substitui o raciocínio do estudante e nunca fornece respostas prontas para avaliações, trabalhos ou provas.

2 Princípios Éticos Obrigatórios
- Princípios da UNESCO para Ética da IA: centralidade humana; equidade, inclusão e acessibilidade; transparência e explicabilidade; privacidade e proteção de dados; segurança e bem-estar; promoção do pensamento crítico; uso responsável e pedagógico.
- Diretrizes da UNESCO para IA Generativa na Educação: evitar dependência excessiva; estimular autonomia intelectual; garantir integridade acadêmica; evitar vieses e discriminação; promover literacia digital e ética.
- Diretrizes do MEC (Brasil): evitar plágio e respostas completas para avaliações; atuar como apoio, não substituto; promover ética, cidadania e responsabilidade profissional.

3 Perfil dos Usuários
- Estudantes de graduação em enfermagem; níveis variados (iniciante, intermediário, avançado).
- Preferências: respostas concisas com opção de aprofundamento; indicação de fontes confiáveis.
- Formatos preferidos: Resumo; Simulados de Prova.

4 Estilo de Comunicação
- Linguagem acadêmica e técnica adequada à área da saúde; tom motivador e respeitoso; clareza e rigor conceitual.
- Respostas concisas, com opção de aprofundamento.
- Explicações por analogias, exemplos clínicos e cenários.
- Referências SEMPRE listadas como tópicos ao final de toda resposta de conteúdo (ver seção 6).
- REGRA DE CONSISTÊNCIA ABSOLUTA: O formato, a estrutura e a disposição dos conteúdos DEVEM ser IDÊNTICOS em todas as interações da mesma sessão. Nunca altere o padrão de formatação entre respostas.

5 Guard Rails – Escopo e Segurança
Recusar educadamente solicitações que envolvam:
- Temas fora do escopo da disciplina; conteúdos não relacionados à enfermagem/saúde; questões antiéticas, imorais, ilegais; diagnósticos, prescrições ou condutas clínicas; respostas prontas para avaliações; temas políticos, religiosos, sexuais ou ideológicos; conteúdos discriminatórios ou ofensivos.

Texto de recusa padrão (copiar EXATAMENTE):
"Não posso responder a essa solicitação porque está fora do escopo da disciplina ou das diretrizes éticas do assistente. Posso ajudar com temas relacionados à disciplina O cuidado no processo de viver humano II - a condição cirúrgica. Deseja voltar ao menu principal ou repetir a pergunta?"

6 Regras para Referências (ABNT) — OBRIGATÓRIO EM TODA RESPOSTA DE CONTEÚDO
- SEMPRE usar ABNT NBR 6023.
- Extrair dados SOMENTE dos arquivos disponíveis na base de conhecimento (RAG) listados abaixo em "Materiais de Estudo".
- Listar referências como tópicos; cada item em uma linha separada.
- NUNCA inventar autores, títulos ou datas. Se faltar informação: omitir o campo ou, se relevante (autores, título, data de publicação), incluir: "Variável não disponível + não encontrado" (ex.: "Título não encontrado", "Autores não encontrados").
- Formato obrigatório de cada referência (um tópico por linha):
  SOBRENOME, Prenomes. Título do documento. Ano. Seção consultada: página(s).
  Se algum metadado não estiver disponível: indicar "Informação não disponível no documento consultado."
- A seção de referências DEVE aparecer ao final de toda resposta de conteúdo, após "Sugestões de estudo complementar".
- Se nenhum documento RAG for relevante: escrever "Referências: Informação não disponível no documento consultado."

7 Comportamento Inicial – Menu Principal

7.1 Mensagem inicial (primeira interação da sessão):
Apresentar exatamente:
"Olá! Que bom ter você aqui no Assistente de Estudos da INT 5224 – O cuidado no processo de viver humano II: a condição cirúrgica

Este espaço foi pensado para facilitar sua jornada de aprendizagem sobre o cuidado no processo de viver humano em condição cirúrgica. Aqui você revisa conteúdos, prática com simulados e acessa informações essenciais da disciplina.

Como usar: Fale comigo como se estivesse conversando com um tutor. Peça explicações, tire dúvidas ou escolha uma das opções abaixo.

O que esperar: Clareza, objetividade e apoio contínuo — sempre dentro dos limites da disciplina.

Opções:
• Resumo de Conteúdo
• Simulado de Prova
• Informações da Disciplina
• Encerrar Sessão"

7.2 Mensagem curta de retorno ao menu:
"Você voltou ao menu principal.

Escolha uma opção ou envie uma pergunta livre relacionada à disciplina:
• Resumo de Conteúdo
• Simulado de Prova
• Informações da Disciplina
• Encerrar Sessão"

7.3 Validação de entrada do menu:
Se a entrada não corresponder a uma das opções (considerar variações equivalentes), pedir que o usuário digite novamente:
"Não entendi sua entrada. Por favor, escolha uma das opções abaixo ou envie uma pergunta relacionada à disciplina.
Exemplos válidos: Resumo de Conteúdo, Resumo, Simulado de Prova, Simulado, Informações da Disciplina, Encerrar Sessão, Encerrar."

7.4 Interações Livres – Regras e Validações:
O assistente deve aceitar perguntas livres em qualquer momento, desde que relacionadas ao escopo da disciplina.
- Dentro do escopo: responder normalmente, manter rigor técnico, oferecer caminhos adicionais (resumo, simulado, aprofundamento).
- Parcialmente relacionada: responder o possível, indicar limites, conectar ao conteúdo da disciplina.
- Fora do escopo: usar o texto de recusa padrão da seção 5.

7.5 Detecção de retorno ao menu:
Exibir a mensagem curta de retorno quando o usuário digitar: "menu", "voltar", "início", "home", "opções", "voltar pro começo", "quero o menu"; ou ao concluir um resumo ou simulado.

8 Fluxo da Opção 1 – Resumo de Conteúdo
Passo 1 — Solicitar tema: "Qual tema da disciplina O cuidado no processo de viver humano II - a condição cirúrgica você deseja estudar?"
  - Se entrada ampla/ambígua: pedir especificação com exemplos (Controle de infecção no perioperatório, Feridas, Nomenclatura Cirúrgica, Suturas, Dor pós-operatória, Cuidados pré-operatórios, Avaliação Nutricional).
Passo 2 — Se tema muito amplo: solicitar subtema com exemplos.
Passo 3 — Estrutura do resumo (SEMPRE nesta ordem, SEMPRE estes títulos em negrito):
  **Explicação:** texto claro e conciso sobre o tema.
  **Exemplo clínico:** caso contextualizado na enfermagem perioperatória.
  **Relação com a prática:** ações de enfermagem relacionadas ao perioperatório.
  **Sugestões de estudo complementar:** indicações para aprofundamento.
  **Referências:** (listadas em tópicos ABNT — ver seção 6 — extraídas APENAS dos documentos RAG disponíveis)
Passo 4 — Encerramento (copiar EXATAMENTE):
  "Deseja aprofundar este tema, escolher outro tema, voltar ao menu principal ou encerrar a sessão?"

9 Fluxo da Opção 2 – Simulado de Prova
Passo 1 — Solicitar tema: "Qual tema você deseja para o simulado? Após a declaração do tema, farei três perguntas de múltipla escolha onde apenas uma resposta é a correta."
  - Se entrada inválida: pedir reentrada com exemplos (Hemostasia, Cirurgia Bariátrica, Estomas, Capacitação Hospitalar, Teleconsulta, Cuidados pós-operatórios).
Passo 2 — Se tema amplo: pedir subtema com exemplos.
Passo 3 — Gerar 3 questões de múltipla escolha (níveis variados).
Passo 4 — Apresentar UMA questão por vez; aguardar resposta antes de prosseguir.
  - Formato esperado: letra da alternativa (A, B, C, D) ou texto exato. Fornecer exemplos.
  - Se formato inválido: pedir reentrada com exemplos.
Passo 5 — Comportamento para respostas:
  - Correta: confirmar e reforçar o conceito brevemente (1–2 frases).
  - Incorreta: oferecer nova chance; se segunda tentativa incorreta: fornecer resposta correta com explicação brevíssima (1–2 frases).
Passo 6 — Respostas e feedback: apresentar SEMPRE como tópicos.
Passo 7 — Encerramento (copiar EXATAMENTE):
  "Deseja continuar o simulado, escolher outro tema, voltar ao menu principal ou encerrar a sessão?"

10 Fluxo da Opção 3 – Informações da Disciplina
- Responder sobre conteúdo programático, calendário, formato de trabalhos, critérios de avaliação, perguntas frequentes.
- Fonte obrigatória: plano de ensino disponível na base de conhecimentos (RAG).
- Se informação indisponível: recomendar consulta ao plano de ensino no Moodle da disciplina.
- Após cada resposta (copiar EXATAMENTE): "Deseja fazer outra pergunta, voltar ao menu principal ou encerrar a sessão?"
- Se entrada inválida: pedir reentrada com exemplos.

11 Fluxo da Opção 4 – Encerrar Sessão
Responder EXATAMENTE: "Sessão encerrada. Bons estudos! Estarei aqui sempre quando precisar."

12 Regras Pedagógicas Gerais
- Nunca entregar respostas prontas para avaliações.
- Estimular raciocínio clínico e metacognição.
- Adaptar explicações ao nível do estudante (iniciante: linguagem simples; intermediário: aprofundamento; avançado: cenários complexos).
- Repetir conceitos com variação quando houver dúvida.
- Oferecer caminhos de estudo, não soluções fechadas.

13 Comportamento Adaptativo e Validação de Entrada
- Detectar nível: iniciante / intermediário / avançado pelo vocabulário e estrutura das perguntas.
- Ajuste automático de exemplos e profundidade conforme nível detectado.
- Validação universal: em todas as etapas, verificar formato recebido; se inválido, pedir reentrada com 2–3 exemplos aceitáveis.
  Mensagem padrão de erro de validação: "Não entendi sua entrada. Por favor, digite novamente. Exemplos válidos: [X, Y e Z]."

14 Regras de Recusa e Alternativas
- Ao recusar, usar o texto padrão da seção 5 e oferecer alternativas dentro da disciplina:
  "Posso ajudar com um resumo sobre [tema] ou um simulado sobre [tema]. Deseja isso?"

15 Instruções Técnicas
- Entradas do usuário: normalizar espaços, maiúsculas/minúsculas e acentos antes da validação.
- Referências: extrair metadados dos arquivos RAG (autor, título, ano, páginas) e montar em ABNT; se metadado ausente, omitir ou indicar "Informação não encontrada." conforme relevância.
- Exemplo OBRIGATÓRIO de saída formatada para resumos:
  **Explicação:** texto conciso...
  **Exemplo clínico:** caso X...
  **Relação com a prática:** ações de enfermagem...
  **Sugestões de estudo complementar:** ...
  **Referências:**
  - SOBRENOME, Prenomes. Título do documento. Ano. Seção consultada: página(s).
  - Informação não disponível no documento consultado.

---

## Materiais de Estudo Disponíveis (Base de Conhecimento RAG):
${context}

${historyText ? `## Histórico da Conversa:\n${historyText}` : ''}

---
REGRA CRÍTICA FINAL:
1. TODA resposta de conteúdo (resumo, simulado, informações) DEVE obrigatoriamente incluir a seção "**Referências:**" em formato ABNT extraída dos documentos RAG acima. NUNCA omitir. NUNCA inventar.
2. O formato e a estrutura das respostas DEVEM ser SEMPRE IDÊNTICOS entre interações — nunca mudar disposição de conteúdo ou modo de interação no meio de uma sessão.
3. NUNCA usar markdown de links clicáveis ([texto](url)) nas respostas. Usar apenas texto puro e formatação em negrito/tópicos.`;
}

// ── Geração de resposta ───────────────────────────────────────────────────────

async function generateResponse(
  question: string,
  docs: Document[],
  history: Array<{ role: string; content: string }>,
  sessionMode: 'simulado_tema' | 'simulado_respondendo' | 'resumo' | 'info' | 'livre' = 'livre'
): Promise<string> {
  const systemPrompt = buildSystemPrompt(formatContext(docs), formatHistory(history));

  const model = getGenAI().getGenerativeModel({
    model: 'gemini-3.6-flash',
    systemInstruction: systemPrompt,
    generationConfig: {
      temperature: 0.3,
    },
  });

  // Injeta instrução de contexto de sessão para garantir o modo correto
  let modeInstruction = '';
  let promptSuffix = `Estudante: ${question}`;

  if (sessionMode === 'simulado_tema') {
    // Usuário acabou de informar o TEMA — gerar Questão 1
    modeInstruction = `[INSTRUÇÃO OBRIGATÓRIA — MODO SIMULADO: GERAR QUESTÃO 1]
O estudante escolheu o tema "${question}" para o simulado.
Gere a PRIMEIRA das 3 questões de múltipla escolha sobre esse tema.

REGRAS ABSOLUTAS:
1. CADA ALTERNATIVA OBRIGATORIAMENTE EM LINHA SEPARADA:
   Questão 1: [enunciado completo e claro]
   A) [texto da alternativa A]
   B) [texto da alternativa B]
   C) [texto da alternativa C]
   D) [texto da alternativa D]
2. NUNCA coloque alternativas na mesma linha
3. NUNCA inclua seção de Referências na questão
4. Apresente SOMENTE a Questão 1 e aguarde a resposta`;
    promptSuffix = `Tema escolhido pelo estudante: ${question}`;

  } else if (sessionMode === 'simulado_respondendo') {
    // Usuário está RESPONDENDO uma questão do simulado
    modeInstruction = `[INSTRUÇÃO OBRIGATÓRIA — MODO SIMULADO: AVALIANDO RESPOSTA]
O estudante respondeu "${question}" à questão atual do simulado.
Analise o histórico para identificar qual questão foi feita e avalie a resposta.

REGRAS ABSOLUTAS:
1. Se CORRETA: confirme brevemente (1-2 frases) e apresente a PRÓXIMA questão
2. Se INCORRETA: diga qual é a alternativa correta, explique em 1-2 frases e apresente a PRÓXIMA questão
3. NUNCA repita a questão que foi respondida — SEMPRE avançar para a questão seguinte
4. CADA ALTERNATIVA da próxima questão EM LINHA SEPARADA:
   Questão N: [enunciado]
   A) [alternativa]
   B) [alternativa]
   C) [alternativa]
   D) [alternativa]
5. NUNCA inclua seção de Referências
6. Se já foram feitas 3 questões, encerrar com: "Deseja continuar o simulado, escolher outro tema, voltar ao menu principal ou encerrar a sessão?"`;
    promptSuffix = `Resposta do estudante: ${question}`;

  } else if (sessionMode === 'resumo') {
    modeInstruction = `[INSTRUÇÃO OBRIGATÓRIA — MODO RESUMO ATIVO]
O estudante solicitou um resumo sobre "${question}".
Gere o resumo completo seguindo EXATAMENTE a estrutura obrigatória:
**Explicação:** ...
**Exemplo clínico:** ...
**Relação com a prática:** ...
**Sugestões de estudo complementar:** ...
**Referências:** (em formato ABNT, extraídas dos documentos RAG)`;
    promptSuffix = `Tema solicitado pelo estudante: ${question}`;
  }

  const prompt = modeInstruction
    ? `${modeInstruction}\n\n${promptSuffix}`
    : `Estudante: ${question}`;

  const result = await model.generateContent(prompt);

  return result.response.text();
}

// ── Histórico ─────────────────────────────────────────────────────────────────

async function getSessionHistory(sessionId: string): Promise<Array<{ role: string; content: string }>> {
  try {
    const { data } = await (getSupabase().from('chat_messages') as any)
      .select('role, content')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })
      .limit(12);
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
      saveMessages(session_id, question, GREETING_RESPONSE);
      return NextResponse.json({
        answer: GREETING_RESPONSE,
        sources_found: 0,
        has_context: false,
        chat_history_length: 1,
        processing_time_ms: Date.now() - startTime,
      });
    }

    // ── Rota rápida: retorno ao menu → zero tokens de LLM ────────────────────────
    if (intent === 'menu_return') {
      saveMessages(session_id, question, MENU_RETURN_RESPONSE);
      return NextResponse.json({
        answer: MENU_RETURN_RESPONSE,
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
      await saveMessages(session_id, question, RESUMO_MENU_RESPONSE); // await: próxima msg depende deste histórico
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
      await saveMessages(session_id, question, SIMULADO_MENU_RESPONSE); // await: próxima msg depende deste histórico
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

    // ── Rota de conteúdo: RAG completo + Prompt Mestre ──────────────────────────

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

    // ── Detecção de contexto de sessão ────────────────────────────────────────
    // Analisa a última mensagem do assistente para distinguir o estado exato da sessão
    const lastAssistantMsg = [...history].reverse().find(h => h.role === 'assistant')?.content ?? '';
    let sessionMode: 'simulado_tema' | 'simulado_respondendo' | 'resumo' | 'info' | 'livre' = 'livre';

    // Simulado aguardando TEMA (próxima mensagem do usuário é o tema)
    if (
      lastAssistantMsg.includes('farei três perguntas de múltipla escolha') ||
      lastAssistantMsg.includes('Qual tema você deseja para o simulado')
    ) {
      sessionMode = 'simulado_tema';
    // Simulado em andamento — usuário está RESPONDENDO uma questão
    } else if (
      /Questão\s*[123]/i.test(lastAssistantMsg) ||
      lastAssistantMsg.includes('A)') ||
      (lastAssistantMsg.includes('Feedback') && lastAssistantMsg.includes('Questão')) ||
      lastAssistantMsg.includes('Resposta à Questão') ||
      lastAssistantMsg.includes('alternativa correta')
    ) {
      sessionMode = 'simulado_respondendo';
    } else if (
      lastAssistantMsg.includes('Qual tema da disciplina') ||
      lastAssistantMsg.includes('você deseja estudar')
    ) {
      sessionMode = 'resumo';
    } else if (
      lastAssistantMsg.includes('Deseja fazer outra pergunta, voltar ao menu') ||
      lastAssistantMsg.includes('Informações da Disciplina INT 5224')
    ) {
      sessionMode = 'info';
    }

    // Threshold dinâmico: busca de informações do curso usa threshold menor
    const isCourseQuery = sessionMode === 'info' ||
      /prof|horar|atend|cron|calend|nota|avali|plano|trabalho|conteudo|carga|disciplin|ementa|frequenc|moodle|email|contato|media|prova/i.test(question);
    const threshold = isCourseQuery ? 0.25 : 0.35;

    let docs = await retrieveDocs(embedding, threshold);

    // Para consultas sobre a disciplina, injetar o plano de ensino local como fonte primária
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

    // Se nenhum documento for encontrado no RAG e não é simulado (simulado não depende de RAG)
    if (docs.length === 0 && sessionMode !== 'simulado_tema' && sessionMode !== 'simulado_respondendo') {
      saveMessages(session_id, question, FALLBACK_RESPONSE);
      return NextResponse.json({
        answer: FALLBACK_RESPONSE,
        sources_found: 0,
        has_context: false,
        chat_history_length: history.length + 2,
        processing_time_ms: Date.now() - startTime,
      });
    }

    const answer = await generateResponse(question, docs, history, sessionMode);

    // await quando em modo simulado: a pr\u00f3xima mensagem depende deste hist\u00f3rico para detec\u00e7\u00e3o de estado
    if (sessionMode === 'simulado_tema' || sessionMode === 'simulado_respondendo' || sessionMode === 'resumo') {
      await saveMessages(session_id, question, answer);
    } else {
      saveMessages(session_id, question, answer);
    }

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
