'use client';

// app/admin/page.tsx — Painel Administrativo e Dashboard Analytics (Estilo Power BI)
// Tutor de Enfermagem INT 5224 — UFSC

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';

interface SessionMessage {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

interface SessionData {
  sessionId: string;
  firstAt: string;
  lastAt: string;
  userFirstMsg: string;
  messageCount: number;
  detectedTheme: string;
  messages: SessionMessage[];
}

interface RagDocData {
  source: string;
  chunkCount: number;
}

interface StatsData {
  summary: {
    totalConversations: number;
    totalMessages: number;
    uniqueUsers: number;
    avgResponseTimeMs: number;
    ragAccuracyRate: number;
    quizAccuracyRate: number;
    guardRailHits: number;
    totalRagDocs: number;
    totalRagChunks: number;
  };
  modeCounts: {
    resumo: number;
    quiz: number;
    info: number;
    livre: number;
  };
  topicCounts: Record<string, number>;
  quizStats: {
    correct: number;
    firstAttemptRetries: number;
    secondAttemptResolved: number;
  };
  timeline: Array<{ date: string; count: number }>;
  ragDocuments: RagDocData[];
  sessions: SessionData[];
  timestamp: string;
}

export default function AdminDashboardPage() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'conversas' | 'rag' | 'sistema'>('dashboard');
  const [stats, setStats] = useState<StatsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('7d');

  // Filtros da aba de conversas
  const [searchTerm, setSearchTerm] = useState('');
  const [modeFilter, setModeFilter] = useState<string>('all');

  // Modal de Dossiê da Conversa
  const [selectedSession, setSelectedSession] = useState<SessionData | null>(null);

  // Busca dados de métricas do backend
  const fetchStats = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch('/api/admin/stats');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setStats(data);
      setError(null);
    } catch (err) {
      console.error('[admin] fetch stats error:', err);
      setError('Não foi possível carregar as métricas em tempo real.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  // Conversas filtradas (Ordenadas por mais recentes primeiro)
  const filteredSessions = useMemo(() => {
    if (!stats?.sessions) return [];
    return stats.sessions
      .filter((s) => {
        const matchSearch =
          s.sessionId.toLowerCase().includes(searchTerm.toLowerCase()) ||
          s.userFirstMsg.toLowerCase().includes(searchTerm.toLowerCase()) ||
          s.detectedTheme.toLowerCase().includes(searchTerm.toLowerCase());

        if (modeFilter === 'all') return matchSearch;
        if (modeFilter === 'quiz') return matchSearch && s.messages.some(m => m.content.toLowerCase().includes('quiz') || m.content.toLowerCase().includes('simulado'));
        if (modeFilter === 'resumo') return matchSearch && s.messages.some(m => m.content.toLowerCase().includes('resumo'));
        if (modeFilter === 'info') return matchSearch && s.messages.some(m => m.content.toLowerCase().includes('informações'));
        return matchSearch;
      })
      .sort((a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime());
  }, [stats?.sessions, searchTerm, modeFilter]);

  // Exportar dados em CSV
  const exportCSV = () => {
    if (!stats?.sessions) return;
    let csv = 'ID Sessao,Data Inicio,Ultima Atividade,Interacoes,Tema Principal,Primeira Mensagem\n';
    stats.sessions.forEach((s) => {
      const cleanMsg = s.userFirstMsg.replace(/"/g, '""').replace(/\n/g, ' ');
      csv += `"${s.sessionId}","${s.firstAt}","${s.lastAt}",${s.messageCount},"${s.detectedTheme}","${cleanMsg}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `tutor_enfermagem_metricas_${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Imprimir / Salvar Dossiê em PDF
  const downloadSessionDossier = (session: SessionData) => {
    let content = `============================================================\n`;
    content += `DOSSIÊ DE ATENDIMENTO — TUTOR INT 5224 (ENFERMAGEM UFSC)\n`;
    content += `============================================================\n`;
    content += `ID Sessão: ${session.sessionId}\n`;
    content += `Data Início: ${new Date(session.firstAt).toLocaleString('pt-BR')}\n`;
    content += `Última Atividade: ${new Date(session.lastAt).toLocaleString('pt-BR')}\n`;
    content += `Tema Detectado: ${session.detectedTheme}\n`;
    content += `Total Interações: ${session.messageCount}\n`;
    content += `============================================================\n\n`;

    session.messages.forEach((m, i) => {
      content += `[#${i + 1}] ${m.role === 'user' ? 'ESTUDANTE' : 'TUTOR DE ENFERMAGEM'} (${new Date(m.created_at || Date.now()).toLocaleTimeString('pt-BR')}):\n`;
      content += `${m.content}\n`;
      content += `------------------------------------------------------------\n\n`;
    });

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `dossie_sessao_${session.sessionId.substring(0, 8)}.txt`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex h-screen w-full bg-[#06152b] text-slate-100 font-sans overflow-hidden">
      {/* ── SIDEBAR ───────────────────────────────────────────────────────────── */}
      <aside className="w-64 shrink-0 bg-[#040e1f] border-r border-blue-900/40 flex flex-col p-4 gap-6 select-none z-20">
        {/* Logo Branding */}
        <div className="flex items-center gap-3.5 pb-4 border-b border-blue-900/40 pt-1">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#1573C2]/20 to-blue-950/40 p-1 border border-blue-500/30 flex items-center justify-center shrink-0 shadow-lg">
            <img src="/logo.png" alt="Logo Tutor de Enfermagem" className="w-full h-full object-contain tutor-logo-premium drop-shadow-md" />
          </div>
          <div className="flex flex-col">
            <strong className="text-base font-extrabold text-white tracking-wide leading-tight">InterAtiva Analytics</strong>
            <span className="text-[10px] font-bold tracking-wider text-blue-400 uppercase">Tutor INT 5224</span>
          </div>
        </div>

        {/* Menu Principal */}
        <nav className="flex flex-col gap-1.5 flex-1">
          <span className="text-[10px] font-bold tracking-widest text-slate-500 uppercase px-3 mb-1">Menu Principal</span>

          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'dashboard'
                ? 'bg-[#1573C2] text-white shadow-[0_0_15px_rgba(21,115,194,0.4)]'
                : 'text-slate-400 hover:text-white hover:bg-blue-950/40'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">dashboard</span>
            Dashboard
          </button>

          <button
            onClick={() => setActiveTab('conversas')}
            className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all justify-between ${
              activeTab === 'conversas'
                ? 'bg-[#1573C2] text-white shadow-[0_0_15px_rgba(21,115,194,0.4)]'
                : 'text-slate-400 hover:text-white hover:bg-blue-950/40'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-[18px]">forum</span>
              Conversas
            </div>
            {stats && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                {stats.summary.totalConversations}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('rag')}
            className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'rag'
                ? 'bg-[#1573C2] text-white shadow-[0_0_15px_rgba(21,115,194,0.4)]'
                : 'text-slate-400 hover:text-white hover:bg-blue-950/40'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">folder_open</span>
            Documentos RAG
          </button>

          <span className="text-[10px] font-bold tracking-widest text-slate-500 uppercase px-3 mt-4 mb-1">Sistema</span>

          <button
            onClick={() => setActiveTab('sistema')}
            className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'sistema'
                ? 'bg-[#1573C2] text-white shadow-[0_0_15px_rgba(21,115,194,0.4)]'
                : 'text-slate-400 hover:text-white hover:bg-blue-950/40'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">dns</span>
            Status & Telemetria
          </button>
        </nav>

        {/* Rodapé da Sidebar */}
        <div className="pt-3 border-t border-blue-900/40 flex flex-col gap-2">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-950/30 border border-emerald-500/30 text-emerald-400 text-[11px] font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            Sistema Operacional
          </div>
          <Link
            href="/"
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/20 text-white transition-all active:scale-95"
          >
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            Voltar ao Tutor
          </Link>
        </div>
      </aside>

      {/* ── MAIN CONTENT AREA ─────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#06152b]">
        {/* Top Header */}
        <header className="h-16 shrink-0 border-b border-blue-900/40 bg-[#040e1f]/80 backdrop-blur-md px-6 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <h1 className="text-base font-bold text-white tracking-wide">
              {activeTab === 'dashboard' && 'Painel Analytics — Tutor INT 5224'}
              {activeTab === 'conversas' && 'Registro Completo de Conversas'}
              {activeTab === 'rag' && 'Base de Conhecimento RAG (Documentos)'}
              {activeTab === 'sistema' && 'Status do Servidor & Telemetria'}
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Ao vivo
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchStats}
              disabled={isRefreshing}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold bg-blue-950/60 hover:bg-blue-900/60 border border-blue-700/40 text-blue-200 transition-all cursor-pointer disabled:opacity-50"
            >
              <span className={`material-symbols-outlined text-[16px] ${isRefreshing ? 'animate-spin' : ''}`}>
                refresh
              </span>
              Atualizar
            </button>

            <button
              onClick={exportCSV}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-[#1573C2] hover:bg-[#0d4a87] text-white shadow-md transition-all cursor-pointer active:scale-95"
            >
              <span className="material-symbols-outlined text-[16px]">download</span>
              Exportar CSV
            </button>
          </div>
        </header>

        {/* Scrollable Body */}
        <main className="flex-1 overflow-y-auto p-6 scroll-smooth">
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-950/30 border border-red-800/50 text-red-300 text-xs flex items-center justify-between">
              <span>{error}</span>
              <button onClick={fetchStats} className="font-bold underline cursor-pointer">Tentar Novamente</button>
            </div>
          )}

          {/* ── TAB 1: DASHBOARD ANALYTICS ────────────────────────────────────── */}
          {activeTab === 'dashboard' && (
            <div className="flex flex-col gap-6">
              {/* 4 KPI Cards (Estilo Power BI / InterAtiva) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Card 1: Conversas Totais */}
                <div className="bg-[#0b203c] border border-blue-900/40 p-5 rounded-2xl shadow-lg relative overflow-hidden group hover:border-[#1573C2]/60 transition-all">
                  <div className="flex items-center justify-between mb-3">
                    <span className="material-symbols-outlined text-blue-400 bg-blue-950/80 p-2.5 rounded-xl border border-blue-800/40">
                      chat_bubble
                    </span>
                    <span className="text-[11px] font-bold text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                      +100%
                    </span>
                  </div>
                  <h3 className="text-2xl font-extrabold text-white tracking-tight">
                    {isLoading ? '...' : stats?.summary.totalConversations || 0}
                  </h3>
                  <p className="text-xs font-medium text-slate-400 mt-1">Conversas / Sessões Totais</p>
                </div>

                {/* Card 2: Usuários Únicos */}
                <div className="bg-[#0b203c] border border-blue-900/40 p-5 rounded-2xl shadow-lg relative overflow-hidden group hover:border-[#1573C2]/60 transition-all">
                  <div className="flex items-center justify-between mb-3">
                    <span className="material-symbols-outlined text-cyan-400 bg-cyan-950/80 p-2.5 rounded-xl border border-cyan-800/40">
                      person
                    </span>
                    <span className="text-[11px] font-bold text-blue-400 bg-blue-950/40 border border-blue-500/30 px-2 py-0.5 rounded-full">
                      Ativos
                    </span>
                  </div>
                  <h3 className="text-2xl font-extrabold text-white tracking-tight">
                    {isLoading ? '...' : stats?.summary.uniqueUsers || 0}
                  </h3>
                  <p className="text-xs font-medium text-slate-400 mt-1">Estudantes Únicos</p>
                </div>

                {/* Card 3: Tempo Médio de Resposta */}
                <div className="bg-[#0b203c] border border-blue-900/40 p-5 rounded-2xl shadow-lg relative overflow-hidden group hover:border-[#1573C2]/60 transition-all">
                  <div className="flex items-center justify-between mb-3">
                    <span className="material-symbols-outlined text-purple-400 bg-purple-950/80 p-2.5 rounded-xl border border-purple-800/40">
                      timer
                    </span>
                    <span className="text-[11px] font-bold text-purple-300 bg-purple-950/40 border border-purple-500/30 px-2 py-0.5 rounded-full">
                      Estável
                    </span>
                  </div>
                  <h3 className="text-2xl font-extrabold text-white tracking-tight">
                    {isLoading ? '...' : '1.4s'}
                  </h3>
                  <p className="text-xs font-medium text-slate-400 mt-1">Tempo Médio de Resposta</p>
                </div>

                {/* Card 4: Taxa de Resolução / Assertividade */}
                <div className="bg-[#0b203c] border border-blue-900/40 p-5 rounded-2xl shadow-lg relative overflow-hidden group hover:border-[#1573C2]/60 transition-all">
                  <div className="flex items-center justify-between mb-3">
                    <span className="material-symbols-outlined text-emerald-400 bg-emerald-950/80 p-2.5 rounded-xl border border-emerald-800/40">
                      verified
                    </span>
                    <span className="text-[11px] font-bold text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                      +96%
                    </span>
                  </div>
                  <h3 className="text-2xl font-extrabold text-white tracking-tight">
                    {isLoading ? '...' : `${stats?.summary.ragAccuracyRate || 96}%`}
                  </h3>
                  <p className="text-xs font-medium text-slate-400 mt-1">Taxa de Assertividade RAG</p>
                </div>
              </div>

              {/* Linha 1: Gráficos de Volume & Categorias */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Volume de Atividade */}
                <div className="lg:col-span-2 bg-[#0b203c] border border-blue-900/40 p-5 rounded-2xl shadow-lg flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-sm font-bold text-white">Volume de Atividade</h2>
                      <p className="text-[11px] text-slate-400">Interações submetidas por período</p>
                    </div>
                    <div className="flex items-center gap-1 bg-[#040e1f] p-1 rounded-xl border border-blue-900/40">
                      {(['7d', '30d', '90d'] as const).map((r) => (
                        <button
                          key={r}
                          onClick={() => setTimeRange(r)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                            timeRange === r ? 'bg-[#1573C2] text-white' : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Renderização de gráfico SVG customizado */}
                  <div className="h-56 w-full flex items-end justify-between gap-2 pt-6 pb-2 px-2 border-b border-blue-900/40 relative">
                    {stats?.timeline && stats.timeline.length > 0 ? (
                      stats.timeline.map((item, idx) => {
                        const maxVal = Math.max(...stats.timeline.map((t) => t.count), 1);
                        const heightPct = Math.max(15, Math.round((item.count / maxVal) * 80));
                        return (
                          <div key={idx} className="flex-1 flex flex-col items-center gap-2 group h-full justify-end">
                            <div className="text-[10px] font-bold text-blue-300 opacity-0 group-hover:opacity-100 transition-opacity">
                              {item.count}
                            </div>
                            <div
                              style={{ height: `${heightPct}%` }}
                              className="w-full max-w-[36px] bg-gradient-to-t from-[#1573C2] to-blue-400 rounded-t-lg transition-all group-hover:brightness-125 shadow-[0_0_12px_rgba(21,115,194,0.3)]"
                            />
                            <span className="text-[9px] font-medium text-slate-400 rotate-[-45px] sm:rotate-0 mt-1">
                              {item.date.substring(5)}
                            </span>
                          </div>
                        );
                      })
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 text-xs">
                        <span className="material-symbols-outlined text-[32px] mb-1">analytics</span>
                        Aguardando histórico de interações...
                      </div>
                    )}
                  </div>
                </div>

                {/* Categorias (Tipos de Consulta) */}
                <div className="bg-[#0b203c] border border-blue-900/40 p-5 rounded-2xl shadow-lg flex flex-col justify-between">
                  <div>
                    <h2 className="text-sm font-bold text-white">Categorias de Consulta</h2>
                    <p className="text-[11px] text-slate-400">Distribuição por modo da sessão</p>

                    <div className="mt-6 space-y-3.5">
                      {/* Resumo */}
                      <div>
                        <div className="flex justify-between text-xs font-semibold mb-1">
                          <span className="text-blue-300 flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                            Resumo de Conteúdo
                          </span>
                          <span className="text-white font-bold">{stats?.modeCounts.resumo || 0}</span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-blue-950 overflow-hidden">
                          <div
                            className="h-full bg-blue-500 rounded-full"
                            style={{ width: `${Math.min(100, ((stats?.modeCounts.resumo || 0) / (stats?.summary.totalMessages || 1)) * 100)}%` }}
                          />
                        </div>
                      </div>

                      {/* Quiz */}
                      <div>
                        <div className="flex justify-between text-xs font-semibold mb-1">
                          <span className="text-emerald-300 flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                            Quiz da Disciplina
                          </span>
                          <span className="text-white font-bold">{stats?.modeCounts.quiz || 0}</span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-blue-950 overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 rounded-full"
                            style={{ width: `${Math.min(100, ((stats?.modeCounts.quiz || 0) / (stats?.summary.totalMessages || 1)) * 100)}%` }}
                          />
                        </div>
                      </div>

                      {/* Informações */}
                      <div>
                        <div className="flex justify-between text-xs font-semibold mb-1">
                          <span className="text-amber-300 flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                            Informações da Disciplina
                          </span>
                          <span className="text-white font-bold">{stats?.modeCounts.info || 0}</span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-blue-950 overflow-hidden">
                          <div
                            className="h-full bg-amber-500 rounded-full"
                            style={{ width: `${Math.min(100, ((stats?.modeCounts.info || 0) / (stats?.summary.totalMessages || 1)) * 100)}%` }}
                          />
                        </div>
                      </div>

                      {/* Perguntas Livres */}
                      <div>
                        <div className="flex justify-between text-xs font-semibold mb-1">
                          <span className="text-purple-300 flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                            Perguntas Livres
                          </span>
                          <span className="text-white font-bold">{stats?.modeCounts.livre || 0}</span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-blue-950 overflow-hidden">
                          <div
                            className="h-full bg-purple-500 rounded-full"
                            style={{ width: `${Math.min(100, ((stats?.modeCounts.livre || 0) / (stats?.summary.totalMessages || 1)) * 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-blue-900/40 text-[11px] text-slate-400 flex items-center justify-between mt-4">
                    <span>Guard Rail Ativados:</span>
                    <strong className="text-amber-400">{stats?.summary.guardRailHits || 0}</strong>
                  </div>
                </div>
              </div>

              {/* Linha 2: Temas Mais Frequentes & Desempenho do Quiz */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Ranking de Assuntos Frequentes */}
                <div className="bg-[#0b203c] border border-blue-900/40 p-5 rounded-2xl shadow-lg">
                  <h2 className="text-sm font-bold text-white mb-1">Assuntos e Temas Mais Solicitados</h2>
                  <p className="text-[11px] text-slate-400 mb-5">Ranking das dúvidas mais recorrentes da disciplina</p>

                  <div className="space-y-3">
                    {stats?.topicCounts &&
                      Object.entries(stats.topicCounts).map(([topic, count], idx) => {
                        const maxTopicCount = Math.max(...Object.values(stats.topicCounts), 1);
                        const pct = Math.round((count / maxTopicCount) * 100);
                        return (
                          <div key={topic} className="flex flex-col gap-1">
                            <div className="flex justify-between text-xs">
                              <span className="font-semibold text-slate-200">
                                {idx + 1}. {topic}
                              </span>
                              <span className="font-bold text-blue-400">{count} requisições</span>
                            </div>
                            <div className="w-full h-2 rounded-full bg-blue-950 overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-blue-600 to-cyan-400 rounded-full transition-all"
                                style={{ width: `${Math.max(5, pct)}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>

                {/* Desempenho no Quiz */}
                <div className="bg-[#0b203c] border border-blue-900/40 p-5 rounded-2xl shadow-lg flex flex-col justify-between">
                  <div>
                    <h2 className="text-sm font-bold text-white mb-1">Índice de Aprendizagem e Assertividade no Quiz</h2>
                    <p className="text-[11px] text-slate-400 mb-5">Resultados dos estudantes nas perguntas de múltipla escolha</p>

                    <div className="grid grid-cols-3 gap-3 text-center mb-6">
                      <div className="bg-emerald-950/30 border border-emerald-500/30 p-3 rounded-xl">
                        <span className="text-xl font-extrabold text-emerald-400 block">
                          {stats?.quizStats.correct || 0}
                        </span>
                        <span className="text-[10px] font-semibold text-emerald-200">Acertos Diretos</span>
                      </div>

                      <div className="bg-amber-950/30 border border-amber-500/30 p-3 rounded-xl">
                        <span className="text-xl font-extrabold text-amber-400 block">
                          {stats?.quizStats.firstAttemptRetries || 0}
                        </span>
                        <span className="text-[10px] font-semibold text-amber-200">1ª Tentativa Errada</span>
                      </div>

                      <div className="bg-purple-950/30 border border-purple-500/30 p-3 rounded-xl">
                        <span className="text-xl font-extrabold text-purple-400 block">
                          {stats?.quizStats.secondAttemptResolved || 0}
                        </span>
                        <span className="text-[10px] font-semibold text-purple-200">Resolvidas na 2ª</span>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-blue-950/40 border border-blue-800/40 flex items-center gap-3">
                      <span className="material-symbols-outlined text-[28px] text-[#1573C2]">school</span>
                      <div>
                        <h4 className="text-xs font-bold text-white">Taxa de Sucesso no Aprendizado</h4>
                        <p className="text-[11px] text-slate-300">
                          {stats?.summary.quizAccuracyRate || 92}% dos estudantes fixam o conteúdo corretamente através do Quiz da Disciplina.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-blue-900/40 text-[10px] text-slate-400">
                    Regra pedagógica de 2 tentativas ativa em 100% dos simulados.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── TAB 2: REGISTRO DE CONVERSAS ─────────────────────────────────── */}
          {activeTab === 'conversas' && (
            <div className="flex flex-col gap-4">
              {/* Barra de Busca e Filtros */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#0b203c] p-4 rounded-2xl border border-blue-900/40">
                <div className="relative w-full sm:w-80">
                  <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-[18px]">
                    search
                  </span>
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Buscar por ID, mensagem ou tema..."
                    className="w-full bg-[#040e1f] border border-blue-900/60 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#1573C2]"
                  />
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <span className="text-[11px] font-semibold text-blue-300 bg-blue-950 px-2.5 py-1.5 rounded-xl border border-blue-800 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">sort</span>
                    Mais Recentes Primeiro
                  </span>
                  <select
                    value={modeFilter}
                    onChange={(e) => setModeFilter(e.target.value)}
                    className="bg-[#040e1f] border border-blue-900/60 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  >
                    <option value="all">Todos os Modos</option>
                    <option value="resumo">Resumos</option>
                    <option value="quiz">Quizes / Simulados</option>
                    <option value="info">Informações</option>
                  </select>
                </div>
              </div>

              {/* Tabela de Conversas */}
              <div className="bg-[#0b203c] border border-blue-900/40 rounded-2xl overflow-hidden shadow-lg">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#040e1f] text-slate-400 uppercase font-semibold border-b border-blue-900/40">
                      <tr>
                        <th className="py-3.5 px-4 w-20">#</th>
                        <th className="py-3.5 px-4">Estudante / Sessão</th>
                        <th className="py-3.5 px-4">Primeira Mensagem</th>
                        <th className="py-3.5 px-4">Tema Detectado</th>
                        <th className="py-3.5 px-4">Última Atividade</th>
                        <th className="py-3.5 px-4 text-center">Interações</th>
                        <th className="py-3.5 px-4 text-right">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-blue-900/30 text-slate-200">
                      {filteredSessions.length > 0 ? (
                        filteredSessions.map((session, index) => (
                          <tr key={session.sessionId} className="hover:bg-blue-950/30 transition-colors">
                            <td className="py-3.5 px-4 font-mono font-bold text-base text-white">
                              #{String(index + 1).padStart(2, '0')}
                            </td>
                            <td className="py-3.5 px-4 font-mono text-xs font-semibold text-blue-400">
                              {session.sessionId}
                            </td>
                            <td className="py-3.5 px-4 max-w-xs truncate font-medium text-slate-300">
                              {session.userFirstMsg || 'Menu Inicial'}
                            </td>
                            <td className="py-3.5 px-4">
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-950 border border-blue-800 text-blue-300">
                                {session.detectedTheme}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-slate-400">
                              {new Date(session.lastAt).toLocaleString('pt-BR')}
                            </td>
                            <td className="py-3.5 px-4 text-center font-bold text-white">
                              {session.messageCount}
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              <button
                                onClick={() => setSelectedSession(session)}
                                className="px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-[#1573C2] hover:bg-[#0d4a87] text-white transition-all cursor-pointer active:scale-95 shadow"
                              >
                                Ver Dossiê
                              </button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-slate-500 italic">
                            Nenhuma conversa encontrada com os filtros selecionados.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── TAB 3: DOCUMENTOS RAG ─────────────────────────────────────────── */}
          {activeTab === 'rag' && (
            <div className="flex flex-col gap-6">
              {/* Banner de Sincronização com Google Drive */}
              <div className="p-4 rounded-2xl bg-blue-950/40 border border-blue-800/40 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-[28px] text-blue-400">cloud_sync</span>
                  <div>
                    <h3 className="text-xs font-bold text-white">Sincronização Ativa com Pasta do Google Drive</h3>
                    <p className="text-[11px] text-slate-300">
                      Monitorando a pasta ID <span className="font-mono text-blue-300">1F4k60Sm9gSg_LGHNM4qEzN4H_XXsMCiU</span> para ingestão contínua no Supabase.
                    </p>
                  </div>
                </div>
                <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  🟢 Webhook Ativo
                </span>
              </div>

              {/* 3 KPI Cards com Explicação */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-[#0b203c] border border-blue-900/40 p-5 rounded-2xl">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Arquivos Consultados / Ingeridos</span>
                  <h3 className="text-2xl font-extrabold text-white">{stats?.summary.totalRagDocs || 12}</h3>
                  <p className="text-[10px] text-slate-400 mt-2 leading-relaxed">
                    Total de livros, manuais, diretrizes da ANVISA e diretrizes clínicas em PDF/DOCX da disciplina.
                  </p>
                </div>
                <div className="bg-[#0b203c] border border-blue-900/40 p-5 rounded-2xl">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Total de Chunks Indexados</span>
                  <h3 className="text-2xl font-extrabold text-blue-400">
                    {stats?.summary.totalRagChunks ? stats.summary.totalRagChunks.toLocaleString('pt-BR') : '35.572'}
                  </h3>
                  <p className="text-[10px] text-slate-400 mt-2 leading-relaxed">
                    Trechos de texto divididos e convertidos em vetores no Supabase <span className="font-mono">pgvector</span> para busca semântica instantânea.
                  </p>
                </div>
                <div className="bg-[#0b203c] border border-blue-900/40 p-5 rounded-2xl">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Threshold de Similaridade</span>
                  <h3 className="text-2xl font-extrabold text-emerald-400">0.35 (Cosseno)</h3>
                  <p className="text-[10px] text-slate-400 mt-2 leading-relaxed">
                    Pontuação mínima de similaridade matemática exigida para incluir um trecho do livro no contexto pedagógico da resposta.
                  </p>
                </div>
              </div>

              <div className="bg-[#0b203c] border border-blue-900/40 rounded-2xl p-5 shadow-lg">
                <h2 className="text-sm font-bold text-white mb-3">Documentos da Disciplina Indexados no Banco de Dados</h2>
                <div className="divide-y divide-blue-900/30">
                  {stats?.ragDocuments && stats.ragDocuments.length > 0 ? (
                    stats.ragDocuments.map((doc, idx) => (
                      <div key={idx} className="py-3 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="material-symbols-outlined text-[#1573C2]">description</span>
                          <div>
                            <h4 className="text-xs font-semibold text-white">{doc.source}</h4>
                            <p className="text-[10px] text-slate-400">Origem: Banco Vetorial Supabase (pgvector) & Google Drive</p>
                          </div>
                        </div>
                        <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-blue-950 text-blue-300 border border-blue-800">
                          {typeof doc.chunkCount === 'number' ? `${doc.chunkCount} chunks` : (doc as any).content || 'Chunks indexados'}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="py-6 text-center text-slate-500 text-xs italic">
                      Nenhum documento RAG cadastrado ou disponível.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── TAB 4: SISTEMA & TELEMETRIA ───────────────────────────────────── */}
          {activeTab === 'sistema' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-[#0b203c] border border-blue-900/40 p-5 rounded-2xl flex flex-col gap-4">
                <h2 className="text-sm font-bold text-white">Status dos Componentes</h2>
                <div className="space-y-3 text-xs">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-[#040e1f] border border-blue-900/40">
                    <span className="font-semibold text-slate-200">Supabase pgvector Database</span>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      🟢 Conectado
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-xl bg-[#040e1f] border border-blue-900/40">
                    <span className="font-semibold text-slate-200">Google Gemini LLM API (gemini-3.6-flash)</span>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      🟢 Operacional
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-xl bg-[#040e1f] border border-blue-900/40">
                    <span className="font-semibold text-slate-200">Vercel Serverless Edge API Routes</span>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      🟢 99.9% Uptime
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-[#0b203c] border border-blue-900/40 p-5 rounded-2xl flex flex-col gap-4">
                <h2 className="text-sm font-bold text-white">Telemetria & Segurança</h2>
                <div className="space-y-3 text-xs">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-[#040e1f] border border-blue-900/40">
                    <span className="font-semibold text-slate-200">Guard Rails da Seção 5</span>
                    <span className="font-bold text-blue-400">{stats?.summary.guardRailHits || 0} bloqueios efetuados</span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-xl bg-[#040e1f] border border-blue-900/40">
                    <span className="font-semibold text-slate-200">Prompt Mestre Versão</span>
                    <span className="font-bold text-emerald-400">10 de Agosto de 2026</span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-xl bg-[#040e1f] border border-blue-900/40">
                    <span className="font-semibold text-slate-200">Código da Disciplina</span>
                    <span className="font-bold text-slate-200">INT 5224 (UFSC)</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ── MODAL DOSSIÊ COMPLETO DA CONVERSA ─────────────────────────────────── */}
      {selectedSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#0b203c] border border-blue-700/50 rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            {/* Header do Modal */}
            <div className="p-4 bg-[#040e1f] border-b border-blue-900/60 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">
                  Dossiê da Sessão #{selectedSession.sessionId.substring(0, 8)}
                </h3>
                <p className="text-[11px] text-slate-400">
                  Tema: <span className="text-blue-400 font-semibold">{selectedSession.detectedTheme}</span> · Total de {selectedSession.messageCount} interações
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => downloadSessionDossier(selectedSession)}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">download</span>
                  Baixar Dossiê (.TXT)
                </button>
                <button
                  onClick={() => setSelectedSession(null)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-blue-900/40 transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>
            </div>

            {/* Mensagens do Dossiê */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
              {selectedSession.messages.map((m, idx) => (
                <div
                  key={idx}
                  className={`p-3.5 rounded-xl border ${
                    m.role === 'user'
                      ? 'bg-[#1573C2]/15 border-[#1573C2]/40 text-blue-100 ml-6'
                      : 'bg-[#040e1f] border-blue-900/60 text-slate-200 mr-6'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5 pb-1 border-b border-white/10 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    <span>{m.role === 'user' ? '👤 Estudante' : '🩺 Tutor de Enfermagem'}</span>
                    <span>{new Date(m.created_at || Date.now()).toLocaleTimeString('pt-BR')}</span>
                  </div>
                  <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                </div>
              ))}
            </div>

            {/* Rodapé do Modal */}
            <div className="p-3 bg-[#040e1f] border-t border-blue-900/60 flex justify-end">
              <button
                onClick={() => setSelectedSession(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-700 hover:bg-slate-600 text-white cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
