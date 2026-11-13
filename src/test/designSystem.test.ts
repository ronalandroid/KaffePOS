import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readProjectFile(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

describe('white and orange professional design system', () => {
  it('ships the reference orange gradient tokens and global button styling', () => {
    const css = readProjectFile('src/index.css');

    expect(css).toContain('--brand-gradient: linear-gradient');
    expect(css).toContain('--brand-surface-gradient: linear-gradient');
    expect(css).toContain('#FF6A00');
    expect(css).toContain('#FF8A1C');
    expect(css).toContain('--brand-neutral-900: #1F2933');
    expect(css).toContain('.kaffe-app-bg');
    expect(css).toContain('.kaffe-soft-section');
    expect(css).toContain('.kaffe-cta-band');
    expect(css).toContain('.kaffe-metric-card');
    expect(css).toContain('.kaffe-table-surface');
    expect(css).toContain('background-image: var(--brand-gradient)');
  });

  it('uses clean white gradient surfaces for web and app shells', () => {
    const landing = readProjectFile('src/pages/LandingPage.tsx');
    const appShell = readProjectFile('src/components/AppShell.tsx');
    const auth = readProjectFile('src/components/auth/AuthPage.tsx');
    const dashboard = readProjectFile('src/components/dashboard/Dashboard.tsx');
    const css = readProjectFile('src/index.css');

    expect(landing).toContain('kaffe-soft-section');
    expect(landing).toContain('kaffe-cta-band');
    expect(landing).toContain('kaffe-cta-logo-card');
    expect(landing).toContain('border border-white bg-white');
    // The footer surface now lives in its own extracted component.
    const landingFooter = readProjectFile('src/pages/landing/LandingFooter.tsx');
    expect(landingFooter).toContain('kaffe-footer');
    expect(landingFooter).not.toContain('footer className="relative z-10 bg-[#FF6A00]');
    expect(appShell).toContain('kaffe-app-bg');
    expect(appShell).toContain('kaffe-sidebar');
    expect(auth).toContain('kaffe-app-bg');
    // Preview-card content was extracted to its own module alongside AuthPage.
    const authContent = readProjectFile('src/components/auth/authContent.ts');
    expect(authContent).toContain('authPreviewCards');
    // Preview data + panels were extracted next to AuthPage; the design-system
    // contract now lives in those modules.
    const authPanels = readProjectFile('src/components/auth/AuthPreviewPanels.tsx');
    expect(authContent).toContain('icon: MonitorSmartphone');
    expect(authContent).toContain('supportIcon: BarChart3');
    expect(authContent).toContain('icon: Store');
    expect(authContent).toContain('icon: ShieldCheck');
    expect(authContent).toContain('supportIcon: RefreshCw');
    expect(authPanels).toContain('kaffe-preview-icon-panel');
    expect(authPanels).toContain('kaffe-mobile-preview-icon');
    expect(authPanels).toContain('kaffe-mobile-preview-badge');
    expect(auth).not.toContain('APP_PREVIEW');
    expect(authPanels).not.toContain('APP_PREVIEW');
    expect(auth).not.toContain('BRAND_PREVIEW');
    expect(auth).not.toContain('LICENSE_PREVIEW');
    expect(authPanels).toContain('kaffe-auth-preview');
    expect(authPanels).toContain('kaffe-float-soft');
    expect(css).toContain('.kaffe-auth-preview');
    expect(css).toContain('.kaffe-preview-icon-panel');
    expect(css).toContain('.kaffe-mobile-preview-icon');
    expect(css).toContain('.kaffe-mobile-preview-strip');
    expect(css).toContain('@keyframes kaffeFloat');
    expect(css).toContain('@keyframes kaffeGlowSweep');
    expect(dashboard).toContain('kaffe-app-bg');
    expect(dashboard).toContain('kaffe-metric-card');
  });

  it('keeps product management aligned with the desktop web reference', () => {
    const menu = readProjectFile('src/components/menu/MenuTab.tsx');

    expect(menu).toContain('kaffe-table-surface');
    expect(menu).toContain('kaffe-product-grid');
    expect(menu).toContain('kaffe-filter-chip');
    expect(menu).toContain('Tambah Produk');
  });

  it('keeps the marketing hero shrinkable on narrow mobile screens', () => {
    const landing = readProjectFile('src/pages/LandingPage.tsx');

    expect(landing).toContain('grid min-w-0');
    expect(landing).toContain('relative z-10 min-w-0 text-left');
    expect(landing).toContain('break-words');
    expect(landing).toContain('max-w-[340px]');
  });

  it('guards app surfaces against common mobile overflow bugs', () => {
    const css = readProjectFile('src/index.css');
    const appShell = readProjectFile('src/components/AppShell.tsx');
    const dashboard = readProjectFile('src/components/dashboard/Dashboard.tsx');
    // The POS catalog grid markup lives in PosProductGrid after POSTab was split.
    const posGrid = readProjectFile('src/components/pos/PosProductGrid.tsx');
    const warehouse = readProjectFile('src/components/warehouse/WarehouseTab.tsx');

    expect(css).toContain('.kaffe-responsive-surface');
    expect(css).toContain('.kaffe-card-grid');
    expect(css).toContain('.kaffe-scroll-tabs');
    expect(css).toContain('.kaffe-bottom-nav');
    expect(css).toContain('100dvh');
    expect(css).toContain('scrollbar-gutter: stable');
    expect(css).toContain('overflow-wrap: break-word');
    expect(css).not.toContain('overflow-wrap: anywhere');
    expect(css).toContain('max-height: min(92dvh');
    expect(css).toContain('safe-area-inset-bottom');
    expect(appShell).toContain('kaffe-responsive-surface');
    // The bottom nav moved into the extracted AppShellNav component.
    const appShellNav = readProjectFile('src/components/AppShellNav.tsx');
    expect(appShellNav).toContain('kaffe-bottom-nav');
    expect(dashboard).toContain('kaffe-card-grid');
    expect(dashboard).toContain('kaffe-scroll-tabs');
    expect(posGrid).toContain('kaffe-card-grid');
    expect(posGrid).toContain('kaffe-scroll-tabs');
    expect(warehouse).toContain('kaffe-card-grid');
    expect(warehouse).toContain('kaffe-scroll-tabs');
  });

  it('keeps modal, status, and OTP surfaces compact on small screens', () => {
    const css = readProjectFile('src/index.css');
    const landing = readProjectFile('src/pages/LandingPage.tsx');
    const appShell = readProjectFile('src/components/AppShell.tsx');
    const auth = readProjectFile('src/components/auth/AuthPage.tsx');

    expect(css).toContain('.kaffe-modal-overlay');
    expect(css).toContain('.kaffe-modal-panel');
    expect(css).toContain('.kaffe-modal-scroll');
    expect(css).toContain('.kaffe-safe-text');
    expect(css).toContain('max-height: calc(100dvh');
    expect(css).toContain('scroll-snap-type: x proximity');
    expect(css).toContain('.kaffe-status-banner');
    expect(css).toContain('.kaffe-otp-grid');
    expect(css).toContain('.kaffe-otp-cell');
    expect(landing).toContain('kaffe-modal-panel');
    expect(landing).toContain('kaffe-modal-scroll');
    expect(landing).toContain('[--kaffe-modal-max-width:900px]');
    expect(landing).not.toContain('rounded-[60px]');
    expect(landing).not.toContain('rounded-[50px]');
    expect(landing).not.toContain('text-7xl');
    expect(appShell).toContain('kaffe-status-banner');
    expect(auth).toContain('kaffe-otp-grid');
    expect(auth).toContain('kaffe-otp-cell');
  });

  it('applies competitor-inspired POS polish across operational screens', () => {
    const css = readProjectFile('src/index.css');
    // POSTab was split: the catalog grid lives in PosProductGrid, the checkout
    // sidebar in PosCartPanel.
    const posGrid = readProjectFile('src/components/pos/PosProductGrid.tsx');
    const posCart = readProjectFile('src/components/pos/PosCartPanel.tsx');
    const posPayment = readProjectFile('src/components/pos/PosPaymentModal.tsx');
    const posReceipt = readProjectFile('src/components/pos/PosReceiptModal.tsx');
    const menu = readProjectFile('src/components/menu/MenuTab.tsx');
    const history = readProjectFile('src/components/history/HistoryTab.tsx');
    const report = readProjectFile('src/components/report/ReportTab.tsx');
    const kitchen = readProjectFile('src/components/kitchen/KitchenTab.tsx');
    const settings = readProjectFile('src/components/settings/SettingsTab.tsx');

    expect(css).toContain('.kaffe-command-bar');
    expect(css).toContain('.kaffe-action-card');
    expect(css).toContain('.kaffe-empty-state');
    expect(css).toContain('.kaffe-checkout-panel');
    expect(css).toContain('.kaffe-sticky-action');
    expect(css).toContain('.kaffe-filter-chip[data-active="true"]');
    expect(css).toContain('outline: 3px solid var(--a11y-focus)');
    expect(posGrid).toContain('kaffe-quick-grid');
    expect(posGrid).not.toContain('loading="lazy"');
    expect(posGrid).toContain('triggerCardFlash');
    expect(posCart).toContain('kaffe-checkout-panel');
    expect(posCart).toContain('focus:border-[#FF6A00]/60');
    expect(posPayment).toContain('focus:ring-[#FF6A00]/40');
    expect(posReceipt).toContain('setAnimating(false)');
    expect(posGrid).toContain('kaffe-sticky-action');
    [menu, history, report, kitchen, settings].forEach((screen) => {
      expect(screen).toContain('kaffe-responsive-surface');
      expect(screen).toContain('kaffe-scroll-tabs');
    });
  });

  it('keeps subscription billing in the clean white and orange system', () => {
    const css = readProjectFile('src/index.css');
    const subscription = readProjectFile('src/components/settings/SubscriptionSection.tsx');
    const checkout = readProjectFile('src/components/settings/SubscriptionCheckoutFlow.tsx');

    expect(css).toContain('.kaffe-gradient-cta');
    expect(css).toContain('.kaffe-subscription-card');
    expect(css).toContain('.kaffe-subscription-detail-panel');
    expect(css).toContain('.kaffe-checkout-highlight');
    expect(subscription).toContain('kaffe-subscription-card');
    expect(subscription).toContain('kaffe-subscription-detail-panel');
    expect(subscription).toContain('kaffe-gradient-cta');
    expect(checkout).toContain('kaffe-gradient-cta');
    expect(checkout).toContain('kaffe-checkout-highlight');
    expect(subscription).not.toContain('bg-slate-900');
    expect(subscription).not.toContain('border-slate-900');
    expect(subscription).not.toContain('bg-blue-50');
    expect(checkout).not.toContain('bg-slate-900');
    expect(checkout).not.toContain('border-slate-900');
    expect(checkout).not.toContain('bg-emerald-600');
  });
});
