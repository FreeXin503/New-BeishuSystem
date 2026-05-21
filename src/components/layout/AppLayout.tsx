import { ReactNode, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useUserStore } from '../../stores/useUserStore';

interface AppLayoutProps {
  children: ReactNode;
  title?: string;
  showBack?: boolean;
  onBack?: () => void;
}

const NAV_ITEMS = [
  { path: '/', label: '控制大厅', icon: '📊' },
  { path: '/content', label: '语料资源库', icon: '📂' },
  { path: '/learning', label: '演练工作台', icon: '🎯' },
  { path: '/review', label: '集中复习大厅', icon: '🔄' },
  { path: '/wrong-answers', label: '智能错题本', icon: '❌' },
  { path: '/statistics', label: '量化时空轴', icon: '📈' },
  { path: '/settings', label: '系统设置', icon: '⚙️' },
];

export default function AppLayout({ children }: AppLayoutProps) {
  const location = useLocation();
  const { user } = useUserStore();
  const [outboxCount, setOutboxCount] = useState(0);
  const [isMock, setIsMock] = useState(false);

  useEffect(() => {
    setIsMock(import.meta.env.VITE_USE_MOCK === 'true');
    loadOutboxCount();
    const interval = setInterval(loadOutboxCount, 3000); // Poll outbox every 3s
    return () => clearInterval(interval);
  }, []);

  async function loadOutboxCount() {
    try {
      const { getUnsyncedOutboxTransactions } = await import('../../services/storage/indexedDB');
      if (getUnsyncedOutboxTransactions) {
        const unsynced = await getUnsyncedOutboxTransactions();
        setOutboxCount(unsynced.length);
      }
    } catch {
      setOutboxCount(0);
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-workspace-bg">
      {/* Sidebar Layout */}
      <aside className="w-72 bg-white border-r border-workspace-border flex flex-col z-50 shadow-[4px_0_24px_rgba(0,0,0,0.01)] shrink-0">
        <div className="p-8 pb-8">
          <div className="flex items-center gap-3.5">
            <div className="h-10 w-10 rounded-2xl bg-brand-primary flex items-center justify-center shadow-lg shadow-indigo-600/30 text-white font-bold text-xl tracking-tighter transition-transform hover:rotate-6 duration-300">
              R
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-brand-dark">
                Recitation<span className="text-brand-primary">Hub</span>
              </h1>
              <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest leading-none">
                v2.0 Enterprise
              </p>
            </div>
          </div>
        </div>

        {/* Sidebar Nav */}
        <nav className="flex-1 px-4 space-y-1 overflow-y-auto no-scrollbar">
          <p className="px-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">
            Workspace
          </p>

          {NAV_ITEMS.map((item) => {
            const isActive =
              item.path === '/'
                ? location.pathname === '/'
                : location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);

            return (
              <Link
                key={item.path}
                to={item.path}
                className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-2xl text-sm font-semibold transition-all duration-300 group hover:scale-[1.02] active:scale-[0.98] ${
                  isActive
                    ? 'sidebar-active text-white'
                    : 'text-workspace-subtext hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <span className="text-lg group-hover:scale-110 transition-transform">
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Bottom Banner inside Sidebar */}
        <div className="p-6">
          <div className="bg-gradient-to-br from-indigo-950 to-brand-dark rounded-master p-5 text-white shadow-xl shadow-indigo-950/20 relative overflow-hidden">
            <div className="absolute -right-6 -bottom-6 h-20 w-20 bg-brand-primary/20 rounded-full blur-xl"></div>
            <p className="text-xs font-medium text-indigo-300 mb-1">当前海马体固化速率</p>
            <h4 className="text-2xl font-bold tracking-tight mb-3">
              1.8x <span className="text-xs font-normal opacity-50">SM2驱动</span>
            </h4>
            <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
              <div className="bg-feedback-success h-full w-[72%]"></div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Container */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header Layout */}
        <header className="h-20 bg-white border-b border-workspace-border px-8 flex items-center justify-between z-40 shadow-[0_2px_12px_rgba(0,0,0,0.005)] shrink-0">
          <div className="w-96 relative group">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
            <input
              type="text"
              placeholder="全局学术词典与离线语料全景检索..."
              className="w-full h-11 pl-11 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:border-brand-primary focus:bg-white transition-all duration-300"
              disabled
            />
          </div>

          <div className="flex items-center gap-6">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all ${
              outboxCount > 0 
                ? 'bg-rose-50 text-feedback-error border-rose-100/50' 
                : 'bg-emerald-50 text-feedback-success border-emerald-100/50'
            }`}>
              <span className={`h-2 w-2 rounded-full ${outboxCount > 0 ? 'bg-feedback-error animate-ping' : 'bg-feedback-success animate-pulse'}`}></span>
              Client Outbox: {outboxCount} 积压{outboxCount === 0 && '（已幂等同步）'}
            </div>
            <div className={`text-xs font-black tracking-widest uppercase px-2.5 py-1 rounded-md ${
              isMock 
                ? 'bg-indigo-50 text-brand-primary border border-indigo-100' 
                : 'bg-slate-100 text-slate-500'
            }`}>
              Sandbox: {isMock ? 'Active' : 'Offline Sync'}
            </div>
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-full bg-gradient-to-tr from-indigo-200 to-purple-300 border border-slate-200 cursor-pointer shadow-inner flex items-center justify-center text-xs font-bold text-slate-700">
                {user?.email?.charAt(0).toUpperCase() || 'G'}
              </div>
            </div>
          </div>
        </header>

        {/* Content Viewport */}
        <div className="flex-1 overflow-y-auto no-scrollbar page-fade-in">
          {children}
        </div>
      </div>
    </div>
  );
}
