"""
migrate_new_project.py — Conecta direto via PostgreSQL e cria as tabelas.
"""
import psycopg2
import sys

DB_URL = "postgresql://postgres:Interativa2023*@db.bpfrigeycfnflycgbmfs.supabase.co:5432/postgres"

MIGRATION_SQL = """
-- 1. Extensao pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Tabela de documentos RAG
CREATE TABLE IF NOT EXISTS public.documents (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content     TEXT NOT NULL,
    embedding   vector(768),
    source      TEXT,
    metadata    JSONB DEFAULT '{}',
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS documents_embedding_idx
    ON public.documents USING hnsw (embedding vector_cosine_ops);

CREATE UNIQUE INDEX IF NOT EXISTS documents_content_hash_idx
    ON public.documents ((metadata->>'content_hash'))
    WHERE metadata->>'content_hash' IS NOT NULL;

-- 3. Funcao de busca semantica (match_documents)
CREATE OR REPLACE FUNCTION public.match_documents(
    query_embedding vector(768),
    match_threshold float DEFAULT 0.75,
    match_count     int   DEFAULT 5
)
RETURNS TABLE (id UUID, content TEXT, source TEXT, metadata JSONB, similarity float)
LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    SELECT d.id, d.content, d.source, d.metadata,
           1 - (d.embedding <=> query_embedding) AS similarity
    FROM public.documents d
    WHERE 1 - (d.embedding <=> query_embedding) > match_threshold
    ORDER BY d.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- 4. Historico de sessoes
CREATE TABLE IF NOT EXISTS public.chat_sessions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id  TEXT NOT NULL UNIQUE,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW(),
    metadata    JSONB DEFAULT '{}'
);

-- 5. Historico de mensagens
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id  TEXT NOT NULL REFERENCES public.chat_sessions(session_id) ON DELETE CASCADE,
    role        TEXT NOT NULL CHECK (role IN ('human', 'ai', 'system')),
    content     TEXT NOT NULL,
    metadata    JSONB DEFAULT '{}',
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS chat_messages_session_idx
    ON public.chat_messages(session_id, created_at);

-- 6. RLS + Policies permissivas para o backend (anon key)
ALTER TABLE public.documents      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_sessions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages   ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS allow_all_anon ON public.documents;
CREATE POLICY allow_all_anon ON public.documents FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS allow_all_anon ON public.chat_sessions;
CREATE POLICY allow_all_anon ON public.chat_sessions FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS allow_all_anon ON public.chat_messages;
CREATE POLICY allow_all_anon ON public.chat_messages FOR ALL TO anon USING (true) WITH CHECK (true);
"""

VERIFY_SQL = """
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('documents', 'chat_sessions', 'chat_messages')
ORDER BY table_name;
"""

def main():
    print("Conectando ao novo banco Supabase...")
    print(f"Host: db.bpfrigeycfnflycgbmfs.supabase.co")

    try:
        conn = psycopg2.connect(DB_URL, connect_timeout=15)
        conn.autocommit = True
        cur = conn.cursor()
        print("[OK] Conexao estabelecida!\n")

        print("Executando migracao...")
        cur.execute(MIGRATION_SQL)
        print("[OK] Migracao executada!\n")

        print("Verificando tabelas criadas:")
        cur.execute(VERIFY_SQL)
        rows = cur.fetchall()
        for row in rows:
            print(f"  + {row[0]}")

        if len(rows) == 3:
            print("\n[SUCESSO] Todas as 3 tabelas foram criadas com sucesso!")
        else:
            print(f"\n[AVISO] Apenas {len(rows)} tabelas encontradas.")

        cur.close()
        conn.close()

    except psycopg2.OperationalError as e:
        print(f"[ERRO DE CONEXAO] {e}")
        sys.exit(1)
    except Exception as e:
        print(f"[ERRO] {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
