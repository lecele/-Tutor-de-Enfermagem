# Tutor de Enfermagem 🩺

O **Tutor de Enfermagem** é um assistente virtual de inteligência artificial generativa educacional especializado em **Enfermagem Perioperatória**. Ele foi desenvolvido para apoiar estudantes de graduação em enfermagem, promovendo a aprendizagem personalizada, o pensamento crítico e a autonomia intelectual através de um sistema de RAG (Retrieval-Augmented Generation) robusto e interativo.

O projeto faz parte do ecossistema de soluções voltadas à saúde da plataforma **Agentes na Saúde**.

* **Produção (Vercel):** [https://tutor-de-enfermagem.vercel.app](https://tutor-de-enfermagem.vercel.app)

---

## 🚀 Arquitetura e Tecnologias

O sistema é composto por uma arquitetura moderna e de alta performance:

1. **Frontend (Next.js 15 + React 19 + TailwindCSS 4):**
   - Rápido, responsivo e adaptado para múltiplos dispositivos (celulares iOS, Android e desktop).
   - Interface inspirada no design premium do projeto **InterAtiva**, personalizada na identidade visual **Azul Médico**.
   - Menu lateral flutuante de tópicos com borda azul destacada em modo claro, header tipo pill, entrada de chat em formato pill e suporte nativo a **Dark Mode** com persistência.

2. **Backend Serverless (Next.js API Route / App Router):**
   - Processamento de chat integrado em `app/api/chat/route.ts` eliminando a necessidade de servidores adicionais.
   - Timeout estendido de 120s na Vercel para execução completa do fluxo RAG.

3. **Banco de Vetores (Supabase + pgvector):**
   - Tabela `documents` para armazenamento dos materiais acadêmicos indexados em formato vetorial.
   - Busca de similaridade por Cosseno usando a extensão `vector` com indexação HNSW de alta performance.
   - Tabela `chat_messages` para histórico persistente de conversas.

4. **Modelos de IA (Google Gemini):**
   - **Embedding:** `gemini-embedding-2` (dimensões de saída: 768) para máxima precisão na busca semântica de materiais de estudo.
   - **Geração:** `gemini-2.5-flash` para respostas rápidas, fluidas e cumprimento estrito do **Prompt Mestre** de personalidade pedagógica.

---

## 📚 Processamento de Documentos e Ingestão (Otimizado)

O Tutor conta com um pipeline de processamento de documentos localizado no script `ingest_docling.py`:

* **Roteamento Inteligente de Documentos:**
  - **PDFs:** São processados diretamente usando o leitor leve em Python puro `pypdf`. Isso garante **100% de estabilidade** e evita o erro de estouro de memória C++ (`std::bad_alloc`) ao processar livros extensos da disciplina (como os manuais de *Cuidados Críticos* e o *Brunner & Suddarth*).
  - **Outros formatos (.docx, .pptx):** São processados usando o framework `Docling`, aproveitando a extração inteligente de estrutura em Markdown.
* **Volume do RAG (Enfermagem Perioperatória):**
  - **35.572 trechos (chunks)** de conhecimento acadêmico indexados com sucesso no banco de dados do Supabase.
* **Deduplicação Inteligente:**
  - Gera hash de conteúdo para cada bloco. Chunks idênticos já existentes no banco de dados são pulados automaticamente, otimizando o tempo de processamento e o consumo da API de embeddings.

---

## 🛠️ Como Executar o Projeto

### Pré-requisitos
- Node.js (v18+)
- Python (v3.10+) com `pip`

### 1. Configuração de Variáveis de Ambiente
Crie um arquivo `.env` na raiz do projeto com base no modelo abaixo:

```env
# --- Google AI (Gemini) ---
GOOGLE_API_KEY=sua_chave_do_gemini
GOOGLE_SERVICE_ACCOUNT_FILE=./credentials/service_account.json

# --- Supabase ---
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_KEY=sua_anon_key_ou_service_role
SUPABASE_DB_URL=postgresql://postgres:sua_senha@db.seu-projeto.supabase.co:5432/postgres

# --- Ingestão ---
RAG_MATCH_THRESHOLD=0.45
RAG_MATCH_COUNT=5
RAG_TABLE_NAME=documents
INGESTION_BATCH_SIZE=20
```

### 2. Executando o Ingestor de Documentos
Coloque seus arquivos `.pdf`, `.docx` ou `.pptx` dentro da pasta `nova_base/enfermagem_perioperatoria` e execute:

```bash
# Instale as dependências python do projeto
pip install -r requirements.txt

# Execute a ingestão
python ingest_docling.py --pasta "nova_base/enfermagem_perioperatoria"
```

### 3. Rodando o Servidor de Desenvolvimento
Instale as dependências do Node e inicie o projeto localmente:

```bash
npm install
npm run dev
```
Abra [http://localhost:3000](http://localhost:3000) no seu navegador.

### 4. Executando a Suíte de Testes
Para homologar a precisão das respostas do RAG, o método socrático e o comportamento de fallback, execute a suíte de testes automatizada local:

```bash
python scratch_test_rag.py
```

---

## ⚙️ Prompt Mestre de Personalidade

O comportamento do Tutor é regido estritamente pelas regras pedagógicas do curso, integradas na rota da API. Ele suporta:
- **Menu Principal Interativo:** Com opções de *Resumo de Conteúdo*, *Simulado de Prova*, *Informações do Curso* e *Encerrar Sessão*.
- **Método Socrático:** O Tutor estimula o raciocínio clínico do aluno fazendo perguntas direcionadas (uma por vez) e evitando entregar respostas prontas de imediato.
- **Grader de Relevância (CRAG):** Toda resposta técnica de enfermagem passa por um avaliador secundário automático para garantir que a informação vem estritamente da base de conhecimentos aprovada. Caso contrário, a resposta padrão de fallback é exibida.nte da base de conhecimentos aprovada. Caso contrário, a resposta padrão de fallback é exibida.
