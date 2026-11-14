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

/** Sidebar sections: daily operations first, then business management, then team and growth. */
const NAV_SECTIONS: Array<{ label: string; tabs: Tab[] }> = [
  { label: 'Operasional', tabs: ['dashboard', 'pos', 'kitchen', 'history'] },
  { label: 'Bisnis', tabs: ['menu', 'warehouse', 'report', 'loyalty'] },
  { label: 'Tim', tabs: ['performance', 'challenges'] },
  { label: 'Akun', tabs: ['referrals', 'affiliate', 'settings'] },
];

/** Bottom bar order: the cashier's most frequent destinations come first. */
const BOTTOM_ORDER: Tab[] = ['dashboard', 'pos', 'history', 'kitchen', 'menu', 'warehouse', 'report', 'loyalty', 'performance', 'challenges', 'referrals', 'affiliate', 'settings'];

function NavDot({ show, tone }: { show: boolean; tone: 'sync' | 'alert' }) {
  if (!show) return null;
  return (
    <span
      aria-hidden="true"
      className={`h-2 w-2 shrink-0 rounded-full ${tone === 'sync' ? 'bg-emerald-500 animate-pulse' : 'bg-[#FF6A00]'}`}
    />
  );
}

export function AppSidebarNav({ role, tab, changeTab, syncing, hasOpenChallenge }: AppNavProps) {
  const visible = new Set(getVisibleTabs(role));
  const byId = new Map(NAV.map((entry) => [entry.id as Tab, entry]));

  return (
    <nav aria-label="Navigasi utama" className="flex-1 overflow-y-auto scrollbar-hide px-2.5 pb-3 xl:px-3">
      {NAV_SECTIONS.map((section) => {
        const entries = section.tabs.filter((id) => visible.has(id)).map((id) => byId.get(id)!).filter(Boolean);
        if (entries.length === 0) return null;
        return (
          <div key={section.label} className="mt-2 border-t border-[var(--brand-hairline)] pt-2 first:mt-0 first:border-t-0 first:pt-1 xl:mt-0 xl:border-t-0 xl:pt-4 xl:first:pt-1">
            <p className="hidden px-3 pb-1.5 text-[10px] font-extrabold uppercase tracking-[0.12em] text-slate-500 xl:block">{section.label}</p>
            <div className="space-y-0.5">
              {entries.map(({ id, label, icon: Icon }) => {
                const active = tab === id;
                return (
                  <button
                    type="button"
                    key={id}
                    onClick={() => changeTab(id)}
                    aria-current={active ? 'page' : undefined}
                    aria-label={label}
                    title={label}
                    className={`relative flex w-full items-center justify-center gap-3 rounded-xl px-3 text-left transition-colors xl:justify-start ${
                      active
                        ? 'bg-[var(--brand-orange-soft)] text-[var(--brand-orange-text)]'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <Icon size={18} strokeWidth={active ? 2.4 : 2} className="shrink-0" />
                    <span className={`hidden flex-1 truncate text-[13.5px] xl:inline ${active ? 'font-bold' : 'font-semibold'}`}>{label}</span>
                    <span className="absolute right-2 top-2 xl:static">
                      <NavDot show={id === 'pos' && syncing} tone="sync" />
                      <NavDot show={id === 'challenges' && hasOpenChallenge} tone="alert" />
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </nav>
  );
}

export function AppBottomNav({ role, tab, changeTab, syncing, hasOpenChallenge }: AppNavProps) {
  const visible = new Set(getVisibleTabs(role));
  const byId = new Map(NAV.map((entry) => [entry.id as Tab, entry]));
  const entries = BOTTOM_ORDER.filter((id) => visible.has(id)).map((id) => byId.get(id)!).filter(Boolean);

  return (
    <nav
      aria-label="Navigasi utama"
      className="kaffe-bottom-nav lg:hidden z-40 flex items-stretch justify-start overflow-x-auto no-scrollbar border-t border-[var(--brand-panel-border)] bg-white px-1"
      style={{ height: 'calc(64px + env(safe-area-inset-bottom,0px))', paddingBottom: 'env(safe-area-inset-bottom,0px)' }}
    >
      {entries.map(({ id, label, icon: Icon }) => {
        const active = tab === id;
        return (
          <button
            type="button"
            key={id}
            onClick={() => changeTab(id)}
            aria-current={active ? 'page' : undefined}
            aria-label={`Buka tab ${label}`}
            className={`relative flex h-full w-[72px] min-w-0 flex-none flex-col items-center justify-center gap-1 ${
              active ? 'text-[var(--brand-orange-text)]' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <span
              className={`relative flex h-7 w-12 items-center justify-center rounded-full transition-colors ${
                active ? 'bg-[var(--brand-orange-soft)]' : ''
              }`}
            >
              <Icon size={20} strokeWidth={active ? 2.4 : 2} />
              {id === 'pos' && syncing && (
                <span className="absolute right-2 top-0.5 h-2 w-2 rounded-full border border-white bg-emerald-500" />
              )}
              {id === 'challenges' && hasOpenChallenge && (
                <span className="absolute right-2 top-0.5 h-2 w-2 rounded-full border border-white bg-[#FF6A00]" />
              )}
            </span>
            <span className={`max-w-full truncate px-1 text-[10.5px] ${active ? 'font-bold' : 'font-semibold'}`}>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
