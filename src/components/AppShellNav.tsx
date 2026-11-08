/** Main navigation chrome (desktop sidebar list + mobile bottom bar). */
import { NAV } from './AppShell.helpers';
import { getVisibleTabs, type UserRole } from '@/lib/accessControl';
import type { Tab } from '@/types';

type AppNavProps = {
  role: UserRole;
  tab: Tab;
  changeTab: (tab: Tab) => void;
  syncing: boolean;
  hasOpenChallenge: boolean;
};

export function AppSidebarNav({ role, tab, changeTab, syncing, hasOpenChallenge }: AppNavProps) {
  return (
    <nav aria-label="Navigasi utama" className="flex-1 px-3 py-3 space-y-1 overflow-y-auto scrollbar-hide">
      {NAV.filter((entry) => getVisibleTabs(role).includes(entry.id)).map(({ id, label, icon: Icon }) => {
        const active = tab === id;
        return (
          <button type="button"
            key={id}
            onClick={() => changeTab(id)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 relative group ${
              active ? 'bg-orange-50 text-[#FF6A00]' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
            }`}
          >
            <div className="transition-all duration-200">
              <Icon size={18} strokeWidth={active ? 2.5 : 2} />
            </div>
            <span className="font-bold text-[13px] transition-all">{label}</span>
            {active && (
              <div className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-[#FF6A00]" />
            )}
            {id === 'pos' && syncing && (
              <span className="ml-auto w-2 h-2 bg-emerald-500 rounded-full animate-ping" />
            )}
            {id === 'challenges' && hasOpenChallenge && (
              <span className="ml-auto h-2 w-2 rounded-full bg-[#FF6A00] shadow-[0_0_0_3px_rgba(255,106,0,0.12)]" />
            )}
          </button>
        );
      })}
    </nav>
  );
}

export function AppBottomNav({ role, tab, changeTab, syncing, hasOpenChallenge }: AppNavProps) {
  return (
    <nav aria-label="Navigasi utama" className="kaffe-bottom-nav lg:hidden flex items-stretch justify-start overflow-x-auto no-scrollbar bg-white/95 backdrop-blur-xl border-t border-orange-100/80 z-40 px-1 shadow-[0_-12px_32px_rgba(255,106,0,0.10)]"
      style={{ height: 'calc(64px + env(safe-area-inset-bottom,0px))', paddingBottom: 'env(safe-area-inset-bottom,0px)' }}>
      {NAV.filter((entry) => getVisibleTabs(role).includes(entry.id)).map(({ id, label, icon: Icon }) => {
        const active = tab === id;
        return (
          <button type="button"
            key={id}
            onClick={() => changeTab(id)}
            className={`flex h-full w-[74px] flex-none flex-col items-center justify-center transition-all relative min-w-0 active:scale-[0.96] ${
              active ? 'text-[#FF6A00]' : 'text-slate-400 hover:text-slate-600'
            }`}
            aria-label={`Buka tab ${label}`}
          >
            <div className="flex flex-col items-center gap-1 transition-all duration-200">
              <div className="relative">
                <Icon size={20} strokeWidth={active ? 2.5 : 2} />
                {id === 'pos' && syncing && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-500 rounded-full animate-ping border border-white shadow-sm" />
                )}
                {id === 'challenges' && hasOpenChallenge && (
                  <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full border border-white bg-[#FF6A00] shadow-sm" />
                )}
              </div>
              <span className="max-w-full truncate px-1 text-[10px] font-semibold">
                {label}
              </span>
            </div>
            {active && (
              <div className="absolute top-0 left-1/2 h-1 w-8 -translate-x-1/2 rounded-b-lg bg-[#FF6A00]" />
            )}
          </button>
        );
      })}
    </nav>
  );
}
