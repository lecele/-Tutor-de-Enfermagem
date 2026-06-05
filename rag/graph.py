"""
rag/graph.py — CRAG (Corrective RAG) com Memória de Sessão Persistente.

Fluxo exato implementado:
═══════════════════════════════════════════════════════════════════════════════

  ENTRADA: question (nova pergunta) + chat_history (restaurado pelo checkpoint)
       │
       ▼
  ┌────────────┐
  │  retrieve  │  Gera embedding da `question` → busca Supabase pgvector
  └─────┬──────┘
        │ documents (top-K chunks por similaridade)
        ▼
  ┌──────────────────┐
  │ grade_documents  │  ← CORE DO CRAG: Gemini avalia CADA chunk individualmente
  │                  │    Relevante → mantém no estado
  │                  │    Irrelevante → descarta
  └─────┬────────────┘
        │
        ▼ decide_after_grading (edge condicional)
        │
   ┌────┴──────────────────────────────────┐
   │                                       │
   ▼ (tem docs relevantes)                 ▼ (nenhum doc relevante)
  ┌──────────┐                     ┌───────────────────┐
  │ generate │                     │ fallback_response │
  │          │ resposta baseada    │                   │ resposta padrão
  │          │ em contexto +       │                   │ hardcoded — sem LLM,
  │          │ cita fonte (nome    │                   │ sem web search,
  │          │ do arquivo)         │                   │ sem alucinação
  └────┬─────┘                     └────────┬──────────┘
       │                                    │
       └────────────────┬───────────────────┘
                        │ → chat_history atualizado (operador.add)
                       END
                        │
                  [AsyncPostgresSaver persiste todo o estado por thread_id]

═══════════════════════════════════════════════════════════════════════════════
STATE KEYS: question | chat_history | documents | generation
═══════════════════════════════════════════════════════════════════════════════
"""

from __future__ import annotations

import asyncio
import operator
from functools import lru_cache
from typing import Annotated, Literal

import structlog
from langchain_core.documents import Document
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain_google_genai import ChatGoogleGenerativeAI
from services.embeddings_service import Gemini2Embeddings
from langgraph.checkpoint.base import BaseCheckpointSaver
from langgraph.graph import END, START, StateGraph
from pydantic import BaseModel, Field
from tenacity import retry, stop_after_attempt, wait_exponential
from typing_extensions import TypedDict

from config import get_settings
from db.supabase_client import get_supabase_client

logger = structlog.get_logger(__name__)


# ==============================================================================
# 1. STATE DO GRAFO
#    Contrato estrito: question | chat_history | documents | generation
# ==============================================================================

class GraphState(TypedDict):
    """
    Estado compartilhado entre todos os nós do grafo CRAG.

    Persistência via AsyncPostgresSaver (checkpoint por thread_id = session_id):
    - `question`:     Substituído a cada invocação com a nova pergunta.
    - `chat_history`: ACUMULADO entre turnos via `operator.add`. Cada turno
                      adiciona [{"role":"user",...}, {"role":"assistant",...}].
    - `documents`:    Substituído a cada invocação com os novos chunks.
    - `generation`:   Substituído a cada invocação com a nova resposta.
    """

    question: str
    """Pergunta atual do estudante de enfermagem."""

    chat_history: Annotated[list[dict], operator.add]
    """
    Histórico de mensagens da sessão.
    Formato: [{"role": "user"|"assistant", "content": "..."}]
    O reducer `operator.add` ACUMULA os turnos entre invocações (nunca sobrescreve).
    """

    documents: list[Document]
    """Chunks recuperados do Supabase no turno atual."""

    generation: str
    """Resposta final gerada (com contexto) ou mensagem de fallback."""


# ==============================================================================
# 2. CONSTANTES E UTILITÁRIOS DE CORTESIA
# ==============================================================================

import re
import unicodedata

# Resposta padrão para quando NENHUM chunk relevante é encontrado.
# NÃO usa LLM — é hardcoded para garantir precisão acadêmica.
FALLBACK_RESPONSE = (
    "Desculpe, o material de estudo disponível não contém informações suficientes "
    "para responder a sua pergunta com precisão acadêmica.\n\n"
    "Recomendo consultar:\n"
    "- Seu professor orientador ou tutor da disciplina\n"
    "- Biblioteca virtual da instituição\n"
    "- Bases de dados científicas: **LILACS**, **BVS**, **PubMed**\n"
    "- Publicações do **COFEN** (cofen.gov.br) e **Ministério da Saúde** (saude.gov.br)"
)

GREETING_WELCOME_RESPONSE = (
    "Olá! Sou o seu **Tutor de Enfermagem** da plataforma **Agentes na Saúde** (Perioperatória - UFSC). 🩺\n\n"
    "**MENU PRINCIPAL**\n\n"
    "Escolha uma das opções:\n"
    "1. **Resumo de Conteúdo**\n"
    "2. **Simulado de Prova**\n"
    "3. **Informações do Curso**\n"
    "4. **Encerrar Sessão**\n\n"
    "Digite o número ou o nome da opção desejada para começarmos!"
)


def _is_greeting_or_courtesy(question: str) -> bool:
    """
    Verifica se a pergunta do estudante é estritamente uma saudação ou cortesia isolada,
    sem nenhuma intenção ou termo de busca técnico de enfermagem.
    """
    if not question:
        return False
        
    # Remove acentos e converte para minúsculo
    normalized = unicodedata.normalize("NFD", question).encode("ascii", "ignore").decode("utf-8")
    normalized = normalized.lower().strip()
    # Substitui pontuações comuns por espaços
    normalized = re.sub(r"[^\w\s]", " ", normalized)
    # Divide em palavras
    words = [w.strip() for w in normalized.split() if w.strip()]
    
    if not words:
        return False
        
    # Conjunto de palavras permitidas em saudações e cortesias puras
    greeting_words = {
        "oi", "ola", "opa", "bom", "dia", "boa", "tarde", "noite", 
        "tudo", "bem", "como", "vai", "você", "voce", "voces", "vocês",
        "e", "ai", "hello", "hi", "salve", "tutor", "bot", "ia", "sistema",
        "quem", "o", "que", "faz", "pode", "fazer", "nome", "seu", "funciona",
        "ajuda", "me", "pode", "ajudar", "estudar", "com", "ola!", "oi!",
        "gentileza", "obrigado", "obrigada", "valeu", "grato", "grata"
    }
    
    # Se todas as palavras da mensagem estiverem no conjunto de palavras de saudação/cortesia,
    # então é estritamente uma saudação/cortesia.
    # Se houver pelo menos uma palavra fora desse conjunto (como "sutura", "choque", "pressao"),
    # não é considerada apenas saudação e deve seguir o fluxo acadêmico do RAG.
    for word in words:
        if word not in greeting_words:
            return False
            
    return True


# ==============================================================================
# 3. MODELOS DE IA (Singleton via lru_cache)
# ==============================================================================

@lru_cache(maxsize=1)
def _get_llm() -> ChatGoogleGenerativeAI:
    """
    Retorna o LLM Gemini Flash (Singleton).
    temperature=0.2 → respostas consistentes e academicamente precisas.
    """
    settings = get_settings()
    return ChatGoogleGenerativeAI(
        model="gemini-2.5-flash",
        temperature=0.2,
        google_api_key=settings.google_api_key,
        convert_system_message_to_human=False,
    )


@lru_cache(maxsize=1)
def _get_embeddings() -> Gemini2Embeddings:
    """Retorna o modelo de embeddings gemini-embedding-2 configurado com 768 dimensões."""
    settings = get_settings()
    return Gemini2Embeddings(
        model="models/gemini-embedding-2",
        output_dimensionality=768,
        google_api_key=settings.google_api_key,
    )


# ==============================================================================
# 4. SCHEMA PYDANTIC — Saída estruturada do avaliador CRAG
# ==============================================================================

class DocumentRelevanceGrade(BaseModel):
    """
    Schema de saída estruturada para o nó grade_documents.

    O Gemini Flash preenche este modelo ao avaliar cada chunk individualmente.
    O uso de `with_structured_output` elimina a necessidade de parsing manual.
    """

    score: Literal["relevant", "irrelevant"] = Field(
        description=(
            "Avaliação binária de relevância:\n"
            "'relevant'   → o chunk contém informação DIRETAMENTE útil para responder "
            "a pergunta de enfermagem (conceitos, procedimentos, dados clínicos, etc.)\n"
            "'irrelevant' → o chunk não aborda o tema da pergunta de forma útil."
        )
    )
    justification: str = Field(
        description=(
            "Justificativa técnica em 1-2 frases. "
            "Deve mencionar especificamente POR QUE o chunk é ou não relevante."
        )
    )


# ==============================================================================
# 5. UTILITÁRIOS
# ==============================================================================

def _format_chat_history(chat_history: list[dict], max_turns: int = 6) -> str:
    """
    Formata os últimos N turnos do histórico como texto para injeção no prompt.

    Args:
        chat_history: Lista de dicts {"role": "user"|"assistant", "content": "..."}.
        max_turns:    Número máximo de turnos (par user+assistant) a incluir.

    Returns:
        String formatada ou string vazia se não houver histórico.
    """
    if not chat_history:
        return ""

    # Pega os últimos max_turns * 2 registros (par user+assistant por turno)
    recent = chat_history[-(max_turns * 2):]

    lines = []
    for entry in recent:
        role_label = "Estudante" if entry.get("role") == "user" else "Tutor"
        lines.append(f"**{role_label}:** {entry.get('content', '')}")
        
    return "\n".join(lines)

def _format_context_with_sources(documents: list[Document]) -> str:
    """
    Formata os documentos relevantes como contexto numerado com nome do arquivo.

    Cada chunk é exibido com:
    - Número de referência [1], [2], ...
    - Nome do arquivo de origem (para citação na resposta)
    - Conteúdo do chunk

    Args:
        documents: Lista de Documents relevantes (já filtrados pelo grade_documents).

    Returns:
        String formatada para injeção no System Prompt de geração.
    """
    if not documents:
        return "Nenhum material disponível."

    parts = []
    for i, doc in enumerate(documents, start=1):
        source = doc.metadata.get("source", "Fonte desconhecida")
        similarity = doc.metadata.get("similarity", 0.0)
        parts.append(
            f"[{i}] **Arquivo:** {source} (similaridade: {similarity:.2f})\n"
            f"{doc.page_content}"
        )

    return "\n\n---\n\n".join(parts)


# ==============================================================================
# 6. NÓS DO GRAFO
# ==============================================================================

@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=10),
    reraise=True,
)
async def retrieve(state: GraphState) -> dict:
    """
    Nó 1 — RETRIEVE: Busca semântica no Supabase pgvector (assíncrono).

    Gera o embedding da `question` e executa a função RPC `match_documents`
    no Supabase, retornando os top-K chunks por similaridade de cosseno.
    """
    question = state["question"]
    settings = get_settings()

    if not question.strip():
        logger.warning("retrieve_empty_question")
        return {"documents": []}



    logger.info("crag_retrieve_start", question=question[:100])

    # Gera embedding da pergunta em uma thread pool
    embeddings = _get_embeddings()
    question_embedding = await asyncio.to_thread(embeddings.embed_query, question)

    # Busca por similaridade no Supabase via RPC
    client = get_supabase_client()
    
    def _execute_rpc():
        return client.rpc(
            "match_documents",
            {
                "query_embedding": question_embedding,
                "match_threshold": settings.rag_match_threshold,
                "match_count": settings.rag_match_count,
            },
        ).execute()

    result = await asyncio.to_thread(_execute_rpc)
    raw_docs = result.data or []
    documents = [
        Document(
            page_content=row["content"],
            metadata={
                "id": row.get("id", ""),
                "source": row.get("source", "desconhecido"),
                "similarity": row.get("similarity", 0.0),
            },
        )
        for row in raw_docs
    ]

    logger.info("crag_retrieve_done", docs_retrieved=len(documents))
    return {"documents": documents}


async def grade_documents(state: GraphState) -> dict:
    """
    Nó 2 — GRADE DOCUMENTS: Core do CRAG — Avaliação concorrente e estrita de relevância.

    Usa o Gemini com saída estruturada (Pydantic) de forma paralela para avaliar
    cada chunk individualmente. Chunks irrelevantes são descartados.
    """
    question = state["question"]
    documents = state["documents"]

    logger.info("crag_grade_start", question=question[:80], total_docs=len(documents))

    if not documents:
        logger.warning("crag_grade_no_docs_to_evaluate")
        return {"documents": []}

    llm = _get_llm()
    grader = llm.with_structured_output(DocumentRelevanceGrade)

    grader_prompt = ChatPromptTemplate.from_messages([
        SystemMessage(content=(
            "Você é um avaliador especialista em enfermagem clínica e acadêmica. "
            "Sua tarefa é avaliar se um trecho (chunk) de material didático é RELEVANTE "
            "para responder a pergunta de um estudante de enfermagem.\n\n"
            "## Critérios de RELEVÂNCIA (deve atender TODOS):\n"
            "1. O trecho aborda DIRETAMENTE o tema central da pergunta.\n"
            "2. Contém conceitos, procedimentos, dados clínicos ou científicos "
            "que auxiliariam na formulação da resposta.\n"
            "3. A informação é específica — não apenas tangencial ao tema.\n\n"
            "## Critérios de IRRELEVÂNCIA (qualquer um é suficiente):\n"
            "- O trecho fala de um tema diferente da pergunta.\n"
            "- O trecho é genérico demais para ser útil na resposta.\n"
            "- A conexão com a pergunta é forçada ou superficial.\n\n"
            "Seja RIGOROSO. Em caso de dúvida, classifique como 'irrelevant'."
        )),
        HumanMessage(content=(
            "**Pergunta do estudante de enfermagem:**\n{question}\n\n"
            "**Trecho do material de estudo:**\n{document}\n\n"
            "Avalie a relevância deste trecho para responder a pergunta acima."
        )),
    ])

    async def evaluate_single_doc(i: int, doc: Document):
        source = doc.metadata.get("source", "?")
        similarity = doc.metadata.get("similarity", 0.0)

        try:
            grade: DocumentRelevanceGrade = await grader.ainvoke(
                grader_prompt.format_messages(
                    question=question,
                    document=doc.page_content[:2000],  # Limita tamanho por token budget
                )
            )

            log_entry = (
                f"[Chunk {i + 1}/{len(documents)}] "
                f"Fonte: '{source}' | Sim: {similarity:.2f} | "
                f"→ {grade.score.upper()} | {grade.justification}"
            )

            if grade.score == "relevant":
                logger.debug("crag_grade_relevant", chunk=i + 1, source=source)
                return doc, log_entry
            else:
                logger.debug("crag_grade_irrelevant", chunk=i + 1, source=source)
                return None, log_entry

        except Exception as exc:
            logger.error("crag_grade_error", chunk=i + 1, error=str(exc))
            log_entry = f"[Chunk {i + 1}] ERRO na avaliação → incluído por segurança."
            return doc, log_entry

    # Dispara as avaliações de todos os chunks de forma simultânea/paralela
    tasks = [evaluate_single_doc(i, doc) for i, doc in enumerate(documents)]
    results = await asyncio.gather(*tasks)

    relevant_docs = []
    grade_log = []
    for doc, log_entry in results:
        grade_log.append(log_entry)
        if doc is not None:
            relevant_docs.append(doc)

    logger.info(
        "crag_grade_done",
        relevant=len(relevant_docs),
        irrelevant=len(documents) - len(relevant_docs),
        total=len(documents),
    )

    # Loga o resumo completo da avaliação para auditoria acadêmica
    for entry in grade_log:
        logger.info("crag_grade_log", entry=entry)

    return {"documents": relevant_docs}


async def generate(state: GraphState) -> dict:
    """
    Nó 3a — GENERATE: Resposta fundamentada com contexto documental (assíncrono).

    Ativado quando `grade_documents` encontrou chunks relevantes.
    """
    question = state["question"]
    documents = state["documents"]
    chat_history = state.get("chat_history", [])

    logger.info("crag_generate_start", question=question[:80], context_docs=len(documents))

    # Formata contexto e histórico
    context = _format_context_with_sources(documents)
    history_text = _format_chat_history(chat_history)

    history_section = (
        f"\n\n## Histórico da Conversa:\n{history_text}"
        if history_text
        else ""
    )

    generation_prompt = ChatPromptTemplate.from_messages([
        SystemMessage(content=(
            "Você é o **Tutor IA de Enfermagem**, um Assistente de Inteligência Artificial Generativa Educacional especializado em Enfermagem Perioperatória.\n"
            "Seu propósito é apoiar estudantes, promovendo a aprendizagem personalizada, o pensamento crítico e a autonomia intelectual. Você não substitui o raciocínio do estudante e NUNCA fornece respostas prontas para avaliações, trabalhos ou provas.\n\n"
            "## Princípios Éticos e Pedagógicos Obrigatórios:\n"
            "- **Atuação pedagógica:** Atue como apoio, não substituto. Estimule o pensamento crítico e o raciocínio clínico.\n"
            "- **Regras Pedagógicas Gerais:** Nunca entregue respostas prontas de imediato. Use o método socrático: faça perguntas direcionadas para guiar o estudante a raciocinar e descobrir a resposta correta por si mesmo.\n"
            "- **Adaptação:** Adapte suas explicações ao nível do estudante (Iniciante: exemplos simples e analogias; Intermediário: aprofundamento conceitual; Avançado: cenários clínicos complexos).\n"
            "- **Conteúdos Proibidos:** NÃO forneça diagnósticos, prescrições ou condutas clínicas. NÃO engaje em temas políticos, religiosos, sexuais ou ilegais.\n\n"
            "## Estilo de Comunicação:\n"
            "- Linguagem acadêmica, técnica e adequada à área da saúde, com clareza e rigor conceitual.\n"
            "- Tom motivador, respeitoso e estimulador.\n"
            "- Indique fontes confiáveis dos materiais fornecidos usando as citações numéricas [1], [2], etc.\n\n"
            "## Diretrizes de Funcionamento:\n"
            "1. Quando o estudante fizer uma pergunta, analise os materiais de estudo fornecidos abaixo para responder.\n"
            "2. Formule a resposta de forma estruturada, com explicações claras e exemplos quando aplicável.\n"
            "3. Termine sua resposta fazendo uma pergunta socrática personalizada para incentivar o estudante a refletir sobre o tema abordado ou aprofundar o assunto.\n"
            "4. Se as informações nos materiais fornecidos forem insuficientes para responder, diga isso de forma transparente e oriente-o a buscar em fontes tradicionais (como bases LILACS, BVS, PubMed ou COFEN).\n\n"
            f"## Materiais de Estudo Disponíveis:\n{context}\n"
            f"{history_section}"
        )),
        HumanMessage(content="{question}"),
    ])

    llm = _get_llm()
    chain = generation_prompt | llm | StrOutputParser()
    response = await chain.ainvoke({"question": question})

    logger.info("crag_generate_done", response_chars=len(response))

    return {
        "generation": response,
        # operator.add: ADICIONA este turno ao histórico acumulado no checkpoint
        "chat_history": [
            {"role": "user",      "content": question},
            {"role": "assistant", "content": response},
        ],
    }
async def fallback_response(state: GraphState) -> dict:
    """
    Nó 3b — FALLBACK: Resposta padrão quando nenhum chunk é relevante (assíncrono).

    DESIGN DECISION — Por que hardcoded e não LLM:
    - Evita alucinação: o LLM não inventa informações médicas/clínicas.
    - Precisão acadêmica: respostas de saúde requerem fonte verificável.
    - Consistência: todos os estudantes recebem a mesma orientação segura.
    - Performance: sem custo de token para o fallback.
    """
    question = state["question"]

    logger.info(
        "crag_fallback_triggered",
        question=question[:80],
        reason="Nenhum chunk relevante encontrado após avaliação CRAG.",
    )

    # Se a pergunta for uma saudação ou cortesia, responde com as boas-vindas acolhedoras do Tutor
    if _is_greeting_or_courtesy(question):
        response_text = GREETING_WELCOME_RESPONSE
        logger.info("crag_fallback_greeting_welcome", question=question[:80])
    else:
        response_text = FALLBACK_RESPONSE

    return {
        "generation": response_text,
        # Registra no histórico mesmo o fallback (para rastreabilidade)
        "chat_history": [
            {"role": "user",      "content": question},
            {"role": "assistant", "content": response_text},
        ],
    }


# ==============================================================================
# 7. EDGE CONDICIONAL — Roteamento pós-avaliação
# ==============================================================================

def decide_after_grading(
    state: GraphState,
) -> Literal["generate", "fallback_response"]:
    """
    Edge condicional: Define a rota após o nó `grade_documents`.

    Lógica:
    - Se `documents` não estiver vazio → chunks relevantes encontrados → "generate"
    - Se `documents` estiver vazio → todos os chunks foram descartados → "fallback_response"

    Esta é a decisão central do CRAG: a correção acontece aqui.
    """
    has_relevant = bool(state.get("documents"))

    route = "generate" if has_relevant else "fallback_response"
    logger.info("crag_routing_decision", route=route, relevant_docs=len(state.get("documents", [])))

    return route


# ==============================================================================
# 8. CONSTRUÇÃO DO GRAFO
# ==============================================================================

def build_crag_graph(checkpointer: BaseCheckpointSaver | None = None):
    """
    Constrói e compila o StateGraph CRAG com memória persistente opcional.

    Topologia:
        START
          │
          ▼
        retrieve          ← Nó 1: Busca pgvector no Supabase
          │
          ▼
        grade_documents   ← Nó 2: CORE CRAG — Avalia cada chunk com Gemini
          │
          ▼ decide_after_grading (edge condicional)
          │
     ┌────┴──────────────────────────┐
     │                               │
     ▼ (docs relevantes)             ▼ (sem docs relevantes)
   generate                    fallback_response
   (LLM + contexto + fontes)   (hardcoded — sem alucinação)
     │                               │
     └──────────────┬────────────────┘
                    │ chat_history acumulado (operator.add)
                   END → AsyncPostgresSaver persiste por thread_id

    Args:
        checkpointer: Saver de checkpoint (AsyncPostgresSaver ou MemorySaver).
                      Se None, o grafo roda sem persistência (apenas desenvolvimento).

    Returns:
        CompiledStateGraph pronto para uso com ainvoke().
    """
    workflow = StateGraph(GraphState)

    # ── Registra os nós ────────────────────────────────────────────────────────
    workflow.add_node("retrieve",          retrieve)
    workflow.add_node("grade_documents",   grade_documents)
    workflow.add_node("generate",          generate)
    workflow.add_node("fallback_response", fallback_response)

    # ── Define as arestas ──────────────────────────────────────────────────────
    workflow.add_edge(START, "retrieve")
    workflow.add_edge("retrieve", "grade_documents")

    # Edge condicional: grade_documents → generate OU fallback_response
    workflow.add_conditional_edges(
        source="grade_documents",
        path=decide_after_grading,
        path_map={
            "generate":          "generate",
            "fallback_response": "fallback_response",
        },
    )

    # Ambos os caminhos terminam no END
    workflow.add_edge("generate",          END)
    workflow.add_edge("fallback_response", END)

    # ── Compila com checkpointer ───────────────────────────────────────────────
    compiled = workflow.compile(checkpointer=checkpointer)

    checkpointer_name = type(checkpointer).__name__ if checkpointer else "None (sem persistência)"
    logger.info(
        "crag_graph_compiled",
        nodes=["retrieve", "grade_documents", "generate", "fallback_response"],
        checkpointer=checkpointer_name,
        state_keys=["question", "chat_history", "documents", "generation"],
    )

    return compiled
