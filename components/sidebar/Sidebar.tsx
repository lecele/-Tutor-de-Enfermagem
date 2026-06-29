'use client';

// components/sidebar/Sidebar.tsx — Sidebar estilo InterAtiva, azul médico

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onNewSession: () => void;
}

const TOPICS = [
  { label: 'Preparo Pré-operatório',       query: 'Quais os cuidados de enfermagem no preparo pré-operatório?' },
  { label: 'Posicionamento Cirúrgico',     query: 'Explique os principais posicionamentos cirúrgicos e riscos.' },
  { label: 'Centro Cirúrgico (CC)',        query: 'Como funciona a estrutura e rotina do centro cirúrgico?' },
  { label: 'Recuperação Anestésica (SRPA)', query: 'Quais os cuidados de enfermagem na sala de recuperação anestésica?' },
  { label: 'Cuidados Pós-operatórios',     query: 'Quais as principais complicações no pós-operatório e como prevenir?' },
  { label: 'Assepsia e Antissepsia',       query: 'Explique os princípios de assepsia e antissepsia no CC.' },
  { label: 'Infecção Hospitalar',          query: 'Quais os protocolos de prevenção de infecção hospitalar?' },
  { label: 'Estomias',                     query: 'Quais os cuidados de enfermagem com pacientes estomizados?' },
  { label: 'Nutrição Perioperatória',      query: 'Quais as recomendações de nutrição no perioperatório?' },
  { label: 'Cirurgia Segura',              query: 'O que é o protocolo de cirurgia segura da OMS?' },
];

export function Sidebar({ isOpen, onClose, onNewSession }: SidebarProps) {
  const fire = (query: string) => {
    window.dispatchEvent(new CustomEvent('suggestion-click', { detail: query }));
    onClose();
  };

  return (
    <aside
      className={`
        fixed md:static top-0 left-0
        w-[85vw] max-w-[320px] md:w-[19rem]
        m-0 md:my-6 md:ml-6 md:mr-1
        h-full md:h-[calc(100vh-3rem)]
        rounded-none md:rounded-[2rem]
        bg-[#eaf3fc] dark:bg-[#06101e]/95
        backdrop-blur-xl
        border-r-2 md:border-2 border-[#1573C2] dark:border-r dark:md:border dark:border-blue-500/30
        z-50
        transform transition-all duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-[110%]'} md:translate-x-0
        flex flex-col
        shadow-[0_15px_30px_rgba(0,0,0,0.15)] dark:shadow-[0_15px_30px_rgba(0,0,0,0.5)]
        overflow-hidden
      `}
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      {/* Botão fechar (mobile) */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 md:hidden text-white hover:text-white transition-colors z-50 bg-[#1060a5] dark:bg-[#0a2040] p-1.5 rounded-full border border-white/20 shadow-sm shrink-0"
      >
        <span className="material-symbols-outlined text-[18px]">close</span>
      </button>

      {/* Header - Centralizado */}
      <div className="w-full flex items-center justify-center gap-2 px-6 pt-12 pb-2 md:pt-8 md:pb-1 shrink-0">
        <span className="material-symbols-outlined text-[16px] text-[#1573C2] dark:text-blue-300 opacity-90">school</span>
        <h2 className="text-[#1573C2] dark:text-blue-100 text-[11px] font-bold tracking-[0.15em] uppercase opacity-100 drop-shadow-sm">
          Tópicos de Estudo
        </h2>
      </div>

      {/* Lista de tópicos */}
      <div
        className="w-full h-full flex-1 overflow-y-auto flex flex-col justify-evenly px-4 py-2 pb-8 md:px-5 md:pb-8 gap-3"
        style={{ paddingBottom: 'max(2rem, env(safe-area-inset-bottom))' }}
      >
        {TOPICS.map((topic) => (
          <button
            key={topic.label}
            onClick={() => fire(topic.query)}
            className="
              w-full text-center text-[13px] font-semibold
              text-white
              bg-[#1573C2]
              hover:bg-[#0d4a87]
              border border-blue-400/30
              rounded-full px-4 py-2.5
              shadow-sm transition-all duration-200
              hover:shadow-md hover:-translate-y-[0.5px]
              active:scale-[0.98]
              cursor-pointer
            "
          >
            {topic.label}
          </button>
        ))}
      </div>
    </aside>
  );
}
