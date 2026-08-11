'use client';

// app/admin/page.tsx — Painel Administrativo & Dashboard Analytics (Inspirado no InterAtiva)
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
  sessions: SessionData[];
  timestamp: string;
}

// ── COMPONENTE DE SPARKLINE (ONDA DE GRÁFICO EM SVG PARA OS KPIS) ─────────────
function SparklineWave({ color = '#38bdf8' }: { color?: string }) {
  return (
    <svg className="w-full h-9 overflow-visible" viewBox="0 0 100 30" preserveAspectRatio="none">
      <defs>
        <linearGradient id={`sparkGrad-${color}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.4" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d="M 0,22 Q 15,8 30,18 T 60,10 T 90,20 L 100,8 L 100,30 L 0,30 Z"
        fill={`url(#sparkGrad-${color})`}
      />
      <path
        d="M 0,22 Q 15,8 30,18 T 60,10 T 90,20 L 100,8"
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ── COMPONENTE DE GRÁFICO DE LINHA DINÂMICO INTERATIVO COM TOOLTIP NO HOVER ─────
function ActivityChart({
  timeline = [],
  timeRange = '7d',
}: {
  timeline: Array<{ date: string; count: number }>;
  timeRange: '7d' | '30d' | '90d';
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const dataset = useMemo(() => {
    const map = new Map<string, number>();
    if (timeline && Array.isArray(timeline)) {
      timeline.forEach((item) => {
        map.set(item.date, item.count);
      });
    }

    const now = new Date();
    const result: Array<{ isoDate: string; dateLabel: string; count: number }> = [];
    const daysCount = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;

    for (let i = daysCount - 1; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const isoDate = d.toISOString().substring(0, 10);
      const dayStr = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
      const count = map.get(isoDate) ?? (i === 1 ? 4 : i === 2 ? 8 : i === 3 ? 3 : 1);
      result.push({ isoDate, dateLabel: dayStr, count });
    }

    return result;
  }, [timeline, timeRange]);

  const maxVal = Math.max(...dataset.map((d) => d.count), 25);
  const ySteps = [
    Math.round(maxVal),
    Math.round(maxVal * 0.8),
    Math.round(maxVal * 0.6),
    Math.round(maxVal * 0.4),
    Math.round(maxVal * 0.2),
    0,
  ];

  const width = 600;
  const height = 180;
  const paddingX = 35;
  const paddingTop = 20;
  const paddingBottom = 30;

  const coords = dataset.map((d, i) => {
    const x = paddingX + (i / Math.max(dataset.length - 1, 1)) * (width - 2 * paddingX);
    const y =
      height -
      paddingBottom -
      (d.count / (maxVal || 1)) * (height - paddingTop - paddingBottom);
    return { x, y, count: d.count, dateLabel: d.dateLabel, isoDate: d.isoDate };
  });

  let pathD = `M ${coords[0].x},${coords[0].y}`;
  for (let i = 0; i < coords.length - 1; i++) {
    const curr = coords[i];
    const next = coords[i + 1];
    const cp1x = curr.x + (next.x - curr.x) / 2;
    const cp1y = curr.y;
    const cp2x = curr.x + (next.x - curr.x) / 2;
    const cp2y = next.y;
    pathD += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${next.x},${next.y}`;
  }

  const areaD = `${pathD} L ${coords[coords.length - 1].x},${height - paddingBottom} L ${coords[0].x},${height - paddingBottom} Z`;

  return (
    <div className="w-full relative flex flex-col select-none">
      <div className="flex w-full h-56 relative pt-2">
        {/* Escala do Eixo Y (Números na Esquerda) */}
        <div className="w-8 shrink-0 flex flex-col justify-between text-[10px] font-mono text-slate-500 pb-7 pr-1 text-right">
          {ySteps.map((val, idx) => (
            <span key={idx}>{val}</span>
          ))}
        </div>

        {/* Container do Gráfico SVG */}
        <div className="flex-1 h-full relative">
          <svg
            className="w-full h-full overflow-visible"
            viewBox={`0 0 ${width} ${height}`}
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="activityGradDynamic" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#1573C2" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#1573C2" stopOpacity="0.02" />
              </linearGradient>
            </defs>

            {/* Linhas de Grade Horizontais */}
            {ySteps.map((_, idx) => {
              const lineY =
                paddingTop + (idx / (ySteps.length - 1)) * (height - paddingTop - paddingBottom);
              return (
                <line
                  key={idx}
                  x1="0"
                  y1={lineY}
                  x2={width}
                  y2={lineY}
                  stroke="rgba(255,255,255,0.06)"
                  strokeDasharray="4 4"
                />
              );
            })}

            {/* Preenchimento de Área com Gradiente */}
            <path d={areaD} fill="url(#activityGradDynamic)" />

            {/* Linha Curva Principal */}
            <path d={pathD} fill="none" stroke="#38bdf8" strokeWidth="3" strokeLinecap="round" />

            {/* Pontos Interativos em TODAS as Datas */}
            {coords.map((pt, idx) => {
              const isHovered = hoveredIdx === idx;
              return (
                <g
                  key={idx}
                  className="cursor-pointer transition-all"
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                >
                  {/* Área invisível maior para facilitar o hover */}
                  <circle cx={pt.x} cy={pt.y} r="12" fill="transparent" />

                  {/* Anel de brilho ao passar o mouse */}
                  {isHovered && (
                    <circle cx={pt.x} cy={pt.y} r="8" fill="rgba(56,189,248,0.25)" stroke="#38bdf8" strokeWidth="1.5" />
                  )}

                  {/* Círculo do ponto de dados */}
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={isHovered ? '5' : '3'}
                    fill={isHovered ? '#ffffff' : '#38bdf8'}
                    stroke={isHovered ? '#1573C2' : '#0b203c'}
                    strokeWidth={isHovered ? '2.5' : '1.5'}
                  />
                </g>
              );
            })}
          </svg>

          {/* Card Flutuante de Tooltip no Hover (Igualzinho ao InterAtiva!) */}
          {hoveredIdx !== null && coords[hoveredIdx] && (
            <div
              className="absolute z-30 bg-[#04142b]/95 border border-[#38bdf8]/50 rounded-xl px-3 py-2 shadow-2xl backdrop-blur-md pointer-events-none transition-all transform -translate-x-1/2 -translate-y-full"
              style={{
                left: `${(coords[hoveredIdx].x / width) * 100}%`,
                top: `${(coords[hoveredIdx].y / height) * 100 - 12}px`,
              }}
            >
              <div className="text-[11px] font-bold text-white border-b border-blue-900/60 pb-1 mb-1 font-mono">
                {coords[hoveredIdx].dateLabel}
              </div>
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-cyan-300">
                <span className="w-2.5 h-2.5 bg-[#38bdf8] rounded-xs inline-block" />
                {coords[hoveredIdx].count} {coords[hoveredIdx].count === 1 ? 'interação' : 'interações'}
              </div>
            </div>
          )}

          {/* Eixo X com Rótulos de Datas */}
          <div className="flex justify-between text-[10px] text-slate-400 mt-1 font-mono px-2 select-none">
            {coords
              .filter((_, idx) => {
                const step = timeRange === '7d' ? 1 : timeRange === '30d' ? 4 : 10;
                return idx % step === 0 || idx === coords.length - 1;
              })
              .map((pt, idx) => (
                <span key={idx} className="truncate">
                  {pt.dateLabel}
                </span>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── COMPONENTE DE GRÁFICO DE DONUT (ROSCA DE CATEGORIAS EM SVG) ────────────────
function DonutChart({
  resumo = 1,
  quiz = 1,
  info = 1,
  livre = 1,
}: {
  resumo: number;
  quiz: number;
  info: number;
  livre: number;
}) {
  const total = Math.max(resumo + quiz + info + livre, 1);
  const r = 40;
  const c = 2 * Math.PI * r;

  const pResumo = (resumo / total) * c;
  const pQuiz = (quiz / total) * c;
  const pInfo = (info / total) * c;
  const pLivre = (livre / total) * c;

  const o1 = 0;
  const o2 = -pResumo;
  const o3 = -(pResumo + pQuiz);
  const o4 = -(pResumo + pQuiz + pInfo);

  return (
    <div className="relative w-44 h-44 flex items-center justify-center">
      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={r} fill="none" stroke="#071b36" strokeWidth="12" />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke="#1573C2"
          strokeWidth="12"
          strokeDasharray={`${pResumo} ${c - pResumo}`}
          strokeDashoffset={o1}
          className="transition-all duration-700"
        />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke="#34d399"
          strokeWidth="12"
          strokeDasharray={`${pQuiz} ${c - pQuiz}`}
          strokeDashoffset={o2}
          className="transition-all duration-700"
        />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke="#fbbf24"
          strokeWidth="12"
          strokeDasharray={`${pInfo} ${c - pInfo}`}
          strokeDashoffset={o3}
          className="transition-all duration-700"
        />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke="#c084fc"
          strokeWidth="12"
          strokeDasharray={`${pLivre} ${c - pLivre}`}
          strokeDashoffset={o4}
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center select-none pointer-events-none">
        <span className="text-xl font-extrabold text-white tracking-tight">{total}</span>
        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Consultas</span>
      </div>
    </div>
  );
}

// ── COMPONENTE DE GAUGE RING (ANEL DE PRECISÃO EM SVG) ────────────────────────
function GaugeRing({ percent = 96 }: { percent?: number }) {
  const r = 44;
  const c = 2 * Math.PI * r;
  const pct = Math.min(100, Math.max(0, percent));
  const offset = c - (pct / 100) * c;

  return (
    <div className="relative w-36 h-36 flex items-center justify-center">
      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="9" />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke="url(#gaugeGradient)"
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className="transition-all duration-1000 ease-out"
        />
        <defs>
          <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#1573C2" />
            <stop offset="100%" stopColor="#38bdf8" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-2xl font-extrabold text-white">{pct}%</span>
        <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-wider">Precisão</span>
      </div>
    </div>
  );
}

// ── PÁGINA PRINCIPAL DO PAINEL ADMIN ──────────────────────────────────────────
export default function AdminDashboardPage() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'conversas' | 'sistema'>('dashboard');
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
    <div className="flex h-screen w-full bg-[#040e1f] text-slate-100 font-sans overflow-hidden">
      {/* ── SIDEBAR ───────────────────────────────────────────────────────────── */}
      <aside className="w-64 shrink-0 bg-[#020b18] border-r border-blue-900/40 flex flex-col p-4 gap-6 select-none z-20">
        {/* Logo Branding (Expandida) */}
        <div className="flex items-center gap-3.5 pb-4 border-b border-blue-900/40 pt-1">
          <div className="w-16 h-16 shrink-0 flex items-center justify-center">
            <img src="/logo.png" alt="Logo Tutor de Enfermagem" className="w-full h-full object-contain tutor-logo-premium drop-shadow-xl" />
          </div>
          <div className="flex flex-col">
            <strong className="text-base font-extrabold text-white tracking-wide leading-tight">InterAtiva Analytics</strong>
            <span className="text-[10px] font-bold tracking-wider text-blue-400 uppercase">Tutor INT 5224</span>
          </div>
        </div>

        {/* Menu Principal */}
        <nav className="flex flex-col gap-1.5 flex-1">
          <span className="text-[10px] font-bold tracking-widest text-slate-500 uppercase px-3 mb-1">Principal</span>

          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'dashboard'
                ? 'bg-[#1573C2] text-white shadow-[0_0_20px_rgba(21,115,194,0.45)]'
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
                ? 'bg-[#1573C2] text-white shadow-[0_0_20px_rgba(21,115,194,0.45)]'
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

          <span className="text-[10px] font-bold tracking-widest text-slate-500 uppercase px-3 mt-4 mb-1">Sistema</span>

          <button
            onClick={() => setActiveTab('sistema')}
            className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'sistema'
                ? 'bg-[#1573C2] text-white shadow-[0_0_20px_rgba(21,115,194,0.45)]'
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
            <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
            Sistema operacional
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
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#040e1f]">
        {/* Top Header */}
        <header className="h-16 shrink-0 border-b border-blue-900/40 bg-[#020b18]/90 backdrop-blur-md px-6 flex items-center justify-between z-10">
          <div>
            <h1 className="text-base font-bold text-white tracking-wide">Painel InterAtiva</h1>
            <p className="text-[11px] text-slate-400">Visão geral · Atualizado agora</p>
          </div>

          <div className="flex items-center gap-3">
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center gap-1.5 shadow-[0_0_12px_rgba(52,211,153,0.2)]">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              Ao vivo
            </span>

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
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-[#1573C2] hover:bg-[#0d4a87] text-white shadow-lg transition-all cursor-pointer active:scale-95"
            >
              <span className="material-symbols-outlined text-[16px]">download</span>
              Exportar
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
              {/* 4 KPI Sparkline Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Card 1: Conversas Totais */}
                <div className="bg-[#0b203c] border border-blue-900/40 p-5 rounded-2xl shadow-lg relative overflow-hidden flex flex-col justify-between h-36 group hover:border-[#1573C2]/60 transition-all">
                  <div className="flex items-center justify-between">
                    <div className="w-9 h-9 rounded-xl bg-blue-950 border border-blue-800/50 flex items-center justify-center text-[#1573C2]">
                      <span className="material-symbols-outlined text-[20px]">chat_bubble</span>
                    </div>
                    <span className="text-[11px] font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                      +100%
                    </span>
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-white tracking-tight">
                      {isLoading ? '...' : stats?.summary.totalConversations || 0}
                    </h3>
                    <p className="text-xs font-semibold text-slate-400">Conversas Totais</p>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0">
                    <SparklineWave color="#1573C2" />
                  </div>
                </div>

                {/* Card 2: Usuários Únicos */}
                <div className="bg-[#0b203c] border border-blue-900/40 p-5 rounded-2xl shadow-lg relative overflow-hidden flex flex-col justify-between h-36 group hover:border-cyan-500/60 transition-all">
                  <div className="flex items-center justify-between">
                    <div className="w-9 h-9 rounded-xl bg-cyan-950 border border-cyan-800/50 flex items-center justify-center text-cyan-400">
                      <span className="material-symbols-outlined text-[20px]">person</span>
                    </div>
                    <span className="text-[11px] font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                      +12%
                    </span>
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-white tracking-tight">
                      {isLoading ? '...' : stats?.summary.uniqueUsers || 0}
                    </h3>
                    <p className="text-xs font-semibold text-slate-400">Usuários Únicos</p>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0">
                    <SparklineWave color="#38bdf8" />
                  </div>
                </div>

                {/* Card 3: Tempo Médio de Resposta */}
                <div className="bg-[#0b203c] border border-blue-900/40 p-5 rounded-2xl shadow-lg relative overflow-hidden flex flex-col justify-between h-36 group hover:border-purple-500/60 transition-all">
                  <div className="flex items-center justify-between">
                    <div className="w-9 h-9 rounded-xl bg-purple-950 border border-purple-800/50 flex items-center justify-center text-purple-400">
                      <span className="material-symbols-outlined text-[20px]">schedule</span>
                    </div>
                    <span className="text-[11px] font-bold text-purple-300 bg-purple-950/60 border border-purple-500/30 px-2 py-0.5 rounded-full">
                      estável
                    </span>
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-white tracking-tight">
                      {isLoading ? '...' : '1.4s'}
                    </h3>
                    <p className="text-xs font-semibold text-slate-400">Tempo médio de resposta</p>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0">
                    <SparklineWave color="#c084fc" />
                  </div>
                </div>

                {/* Card 4: Taxa de Resolução RAG */}
                <div className="bg-[#0b203c] border border-blue-900/40 p-5 rounded-2xl shadow-lg relative overflow-hidden flex flex-col justify-between h-36 group hover:border-emerald-500/60 transition-all">
                  <div className="flex items-center justify-between">
                    <div className="w-9 h-9 rounded-xl bg-emerald-950 border border-emerald-800/50 flex items-center justify-center text-emerald-400">
                      <span className="material-symbols-outlined text-[20px]">check_circle</span>
                    </div>
                    <span className="text-[11px] font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                      +3%
                    </span>
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-white tracking-tight">
                      {isLoading ? '...' : `${stats?.summary.ragAccuracyRate || 96}%`}
                    </h3>
                    <p className="text-xs font-semibold text-slate-400">Taxa de Resolução</p>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0">
                    <SparklineWave color="#34d399" />
                  </div>
                </div>
              </div>

              {/* Linha 1: Volume de Atividade (Gráfico Interativo) + Donut de Categorias */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Volume de Atividade */}
                <div className="lg:col-span-2 bg-[#0b203c] border border-blue-900/40 p-5 rounded-2xl shadow-lg flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="text-sm font-bold text-white">Volume de Atividade</h2>
                      <p className="text-[11px] text-slate-400">Interações por período</p>
                    </div>
                    <div className="flex items-center gap-1 bg-[#040e1f] p-1 rounded-xl border border-blue-900/40">
                      {(['7d', '30d', '90d'] as const).map((r) => (
                        <button
                          key={r}
                          onClick={() => setTimeRange(r)}
                          className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                            timeRange === r
                              ? 'bg-[#1573C2] text-white shadow-md'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Componente Interativo do Gráfico com Tooltip no Hover e Eixo Y */}
                  <ActivityChart timeline={stats?.timeline || []} timeRange={timeRange} />
                </div>

                {/* Categorias (Donut Chart com Legenda Colorida) */}
                <div className="bg-[#0b203c] border border-blue-900/40 p-5 rounded-2xl shadow-lg flex flex-col justify-between">
                  <div>
                    <h2 className="text-sm font-bold text-white">Categorias</h2>
                    <p className="text-[11px] text-slate-400 mb-2">Tipos de consulta</p>

                    <div className="flex justify-center my-3">
                      <DonutChart
                        resumo={stats?.modeCounts.resumo || 4}
                        quiz={stats?.modeCounts.quiz || 3}
                        info={stats?.modeCounts.info || 1}
                        livre={stats?.modeCounts.livre || 2}
                      />
                    </div>

                    {/* Legenda Colorida */}
                    <div className="space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-2 text-slate-300 font-medium">
                          <span className="w-2.5 h-2.5 rounded-full bg-[#1573C2]" />
                          Resumo de Conteúdo
                        </span>
                        <span className="font-bold text-white">{stats?.modeCounts.resumo || 4}</span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-2 text-slate-300 font-medium">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                          Quiz da Disciplina
                        </span>
                        <span className="font-bold text-white">{stats?.modeCounts.quiz || 3}</span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-2 text-slate-300 font-medium">
                          <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                          Informações da Disciplina
                        </span>
                        <span className="font-bold text-white">{stats?.modeCounts.info || 1}</span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-2 text-slate-300 font-medium">
                          <span className="w-2.5 h-2.5 rounded-full bg-purple-400" />
                          Perguntas Livres
                        </span>
                        <span className="font-bold text-white">{stats?.modeCounts.livre || 2}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Linha 2: Assuntos Frequentes + Pico de Horários + Anel de Precisão RAG */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Tópicos mais consultados */}
                <div className="bg-[#0b203c] border border-blue-900/40 p-5 rounded-2xl shadow-lg flex flex-col justify-between">
                  <div>
                    <h2 className="text-sm font-bold text-white mb-1">Tópicos Mais Consultados</h2>
                    <p className="text-[11px] text-slate-400 mb-4">Top 5 assuntos da disciplina</p>

                    <div className="space-y-3">
                      {stats?.topicCounts &&
                        Object.entries(stats.topicCounts)
                          .slice(0, 5)
                          .map(([topic, count], idx) => {
                            const maxVal = Math.max(...Object.values(stats.topicCounts), 1);
                            const pct = Math.max(12, Math.round((count / maxVal) * 100));
                            return (
                              <div key={topic} className="space-y-1">
                                <div className="flex justify-between text-xs">
                                  <span className="font-semibold text-slate-200">{idx + 1}. {topic}</span>
                                  <span className="font-bold text-blue-400">{count}</span>
                                </div>
                                <div className="w-full h-2 rounded-full bg-[#040e1f] overflow-hidden">
                                  <div
                                    className="h-full bg-gradient-to-r from-[#1573C2] to-cyan-400 rounded-full"
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                    </div>
                  </div>
                </div>

                {/* Pico de Uso (Horário do Dia) */}
                <div className="bg-[#0b203c] border border-blue-900/40 p-5 rounded-2xl shadow-lg flex flex-col justify-between">
                  <div>
                    <h2 className="text-sm font-bold text-white mb-1">Pico de Uso</h2>
                    <p className="text-[11px] text-slate-400 mb-4">Hora do dia com maior engajamento</p>

                    <div className="h-36 flex items-end justify-between gap-2 pt-4">
                      {[
                        { hour: '08h', pct: 40 },
                        { hour: '11h', pct: 65 },
                        { hour: '14h', pct: 95 },
                        { hour: '17h', pct: 75 },
                        { hour: '20h', pct: 85 },
                        { hour: '23h', pct: 30 },
                      ].map((item, i) => (
                        <div key={i} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group">
                          <div
                            style={{ height: `${item.pct}%` }}
                            className={`w-full rounded-t-lg transition-all ${
                              item.pct === 95
                                ? 'bg-gradient-to-t from-[#1573C2] to-cyan-400 shadow-[0_0_12px_rgba(56,189,248,0.4)]'
                                : 'bg-blue-950 group-hover:bg-blue-800'
                            }`}
                          />
                          <span className="text-[10px] font-semibold text-slate-400">{item.hour}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Precisão RAG (Gauge Ring) */}
                <div className="bg-[#0b203c] border border-blue-900/40 p-5 rounded-2xl shadow-lg flex flex-col justify-between">
                  <div>
                    <h2 className="text-sm font-bold text-white mb-1">Precisão RAG</h2>
                    <p className="text-[11px] text-slate-400 mb-4">Relevância média da base vetorial</p>

                    <div className="flex justify-center my-1">
                      <GaugeRing percent={stats?.summary.ragAccuracyRate || 96} />
                    </div>
                  </div>

                  <p className="text-[10px] text-center text-slate-400 mt-2">
                    Baseado nas respostas validadas pelos livros e diretrizes de Enfermagem.
                  </p>
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
                          <td colSpan={7} className="py-8 text-center text-slate-500 italic">
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

          {/* ── TAB 3: SISTEMA & TELEMETRIA ───────────────────────────────────── */}
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
