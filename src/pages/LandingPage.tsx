import { useState, useEffect, type MouseEvent as ReactMouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Store,
  Zap,
  ArrowRight,
  Menu,
  X,
  ArrowUp,
  Coffee,
  Lock,
  HelpCircle,
  Shield,
  Cloud,
  Trophy,
  Brain,
  CheckCircle2,
  Smartphone,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useModalBehavior } from '@/hooks/useModalBehavior';
import PricingPage from '@/components/subscription/PricingPage';
import type { BillingCycle, SubscriptionPlanId } from '@/lib/subscriptionPlans';
import {
  LOGO_ICON,
  NAV_LINKS,
  BENEFITS,
  ARCHITECTURE_SYNC_ITEMS,
  SUPPORT_CONTACT,
  FEATURES,
  SAFE_CONTENT,
  getFeatureDetail,
  type SafeContentKey,
  type MarketingFeature,
} from './landing/content';
import { DashboardPreview, LandingDeviceShowcase } from './landing/DevicePreviews';
import { LandingFooter } from './landing/LandingFooter';
import { LandingSocialProof } from './landing/LandingSocialProof';
import { IS_PAYMENT_DISABLED } from '@/lib/paymentMode';

export default function LandingPage() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [showDownloadWarning, setShowDownloadWarning] = useState(false);
  const [selectedFeature, setSelectedFeature] = useState<MarketingFeature | null>(null);
  const [isFeatureDetailOpen, setIsFeatureDetailOpen] = useState(false);
  const [selectedSafeItem, setSelectedSafeItem] = useState<SafeContentKey | null>(null);
  const [isSafeDetailOpen, setIsSafeDetailOpen] = useState(false);
  const [pricingCycle, setPricingCycle] = useState<Exclude<BillingCycle, 'free'>>('yearly');

  useEffect(() => {
    if (window.location.pathname === '/' || window.location.pathname === '') {
      window.history.replaceState({}, '', '/welcome');
    }

    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          setIsScrolled(window.scrollY > 20);
          setShowScrollTop(window.scrollY > 500);
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [mobileMenuOpen]);

  const scrollToTarget = (id: string) => {
    const targetId = id.replace('#', '');
    const element = document.getElementById(targetId);
    if (element) {
      element.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
      setMobileMenuOpen(false);
    }
  };

  const scrollToSection = (e: ReactMouseEvent<HTMLElement>, id: string) => {
    e.preventDefault();
    scrollToTarget(id);
  };

  const handleDownload = (e: ReactMouseEvent<HTMLElement>) => {
    e.preventDefault();
    if (!isAuthenticated) {
      setShowDownloadWarning(true);
    } else {
      const link = document.createElement('a');
      link.href = '/downloads/kaffepos-latest.apk';
      link.download = 'kaffepos-v2.apk';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleFeatureClick = (feature: MarketingFeature) => {
    setSelectedFeature(feature);
    setIsFeatureDetailOpen(true);
  };

  const closeDownloadWarning = () => setShowDownloadWarning(false);
  const closeFeatureDetail = () => setIsFeatureDetailOpen(false);
  const closeSafeDetail = () => setIsSafeDetailOpen(false);
  const downloadModal = useModalBehavior<HTMLDivElement>({
    open: showDownloadWarning,
    onClose: closeDownloadWarning,
  });
  const featureModal = useModalBehavior<HTMLDivElement>({
    open: isFeatureDetailOpen,
    onClose: closeFeatureDetail,
  });
  const safeModal = useModalBehavior<HTMLDivElement>({
    open: isSafeDetailOpen,
    onClose: closeSafeDetail,
  });

  const handlePricingSelect = (plan: SubscriptionPlanId, cycle: BillingCycle) => {
    if (plan === 'secangkir') {
      navigate('/register');
      return;
    }
    if (!isAuthenticated) {
      navigate(`/login?redirect=${encodeURIComponent(`/plan-confirmation?plan=${plan}&billingCycle=${cycle}`)}`);
      return;
    }
    navigate(`/plan-confirmation?plan=${plan}&billingCycle=${cycle}`);
  };

  const BRAND_ACCENT = '#FF6A00';

  return (
    <div id="top" className="kaffe-app-bg min-h-[100dvh] overflow-x-hidden font-sans text-slate-900 selection:bg-[#FF6A00]/20">
      {/* WCAG Skip Link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-xl focus:bg-white focus:px-6 focus:py-3 focus:font-extrabold focus:text-slate-900"
      >
        Langsung ke konten utama
      </a>

      {/* Persistent Micro-Grid Background Layer */}
      <div className="pointer-events-none fixed inset-0 z-0" aria-hidden="true">
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(15,23,42,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(15,23,42,0.5) 1px, transparent 1px)',
            backgroundSize: '44px 44px',
          }}
        />
      </div>

      {/* Navbar */}
      <header
        className={`fixed left-0 right-0 top-0 z-50 transition-[background-color,border-color,padding,box-shadow] duration-300 ${
          isScrolled
            ? 'border-b border-slate-200/80 bg-white/95 py-3 shadow-sm backdrop-blur-xl'
            : 'border-b border-slate-100 bg-white/90 py-4 backdrop-blur-xl'
        }`}
      >
        <nav
          className="mx-auto flex max-w-[1400px] items-center justify-between px-6 md:px-12"
          aria-label="Navigasi Utama"
        >
          <button
            type="button"
            className="group flex cursor-pointer items-center gap-3 rounded-2xl text-left outline-none transition-transform duration-300 focus-visible:ring-4 focus-visible:ring-[#FF6A00]/50"
            onClick={() => scrollToTarget('#top')}
          >
            <div className="flex items-center gap-3 transition-transform duration-300 group-hover:scale-[1.03]">
              <img
                src={LOGO_ICON}
                alt=""
                className="h-10 w-10 object-contain md:h-11 md:w-11"
                loading="eager"
              />
              <div>
                <span className="font-display text-2xl font-extrabold tracking-tight text-slate-900 md:text-[26px]">
                  Kaffe<span className="text-[#FF6A00]">POS</span>
                </span>
                <span className="ml-2 hidden rounded-md bg-orange-50 px-1.5 py-0.5 font-mono text-[10px] font-bold text-[#FF6A00] ring-1 ring-orange-200/60 sm:inline-block">
                  v2.0
                </span>
              </div>
            </div>
          </button>

          {/* Desktop Navigation */}
          <ul className="hidden list-none items-center gap-8 lg:flex">
            {NAV_LINKS.filter((link) => !IS_PAYMENT_DISABLED || link.href !== '#pricing').map((link) => (
              <li key={link.name}>
                <a
                  href={link.href}
                  onClick={(e) => scrollToSection(e, link.href)}
                  className={`group relative px-1 py-2 text-[14px] font-bold outline-none transition-colors focus-visible:text-[#FF6A00] ${
                    isScrolled ? 'text-slate-600 hover:text-slate-900' : 'text-slate-700 hover:text-slate-900'
                  }`}
                >
                  {link.name}
                  <span className=" absolute -bottom-0.5 left-0 h-0.5 w-full origin-left scale-x-0 rounded-full bg-[#FF6A00] transition-transform duration-200 group-hover:scale-x-100" />
                </a>
              </li>
            ))}
          </ul>

          <div className="hidden items-center gap-3.5 md:flex">
            {isAuthenticated ? (
              <button
                type="button"
                onClick={() => navigate('/')}
                className="group flex items-center gap-2.5 rounded-full bg-slate-900 py-2.5 pl-5 pr-2.5 text-[13px] font-bold text-white shadow-sm transition-colors hover:bg-slate-800"
              >
                <span>Buka Dashboard</span>
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15 transition-transform duration-200 group-hover:translate-x-0.5">
                  <ArrowRight size={14} />
                </span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  className="rounded-xl px-4 py-2.5 text-[14px] font-bold text-slate-700 transition-colors hover:bg-slate-100/80 hover:text-slate-900"
                >
                  Masuk
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/register')}
                  className="group flex items-center gap-2.5 rounded-full bg-[#FF6A00] py-2 pl-5 pr-2 text-[13px] font-extrabold text-white shadow-[0_12px_26px_rgba(255,106,0,0.22)] transition-[transform,box-shadow] duration-200 hover:bg-[#FF8A1C] active:scale-[0.98]"
                >
                  <span>Coba Gratis</span>
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 transition-transform duration-200 group-hover:translate-x-0.5">
                    <ArrowRight size={14} />
                  </span>
                </button>
              </>
            )}
          </div>

          <button
            type="button"
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-900 shadow-sm lg:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? 'Tutup menu' : 'Buka menu'}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </nav>

        {/* Mobile Menu Overlay */}
        <div
          className={`fixed inset-0 z-[100] transition-opacity duration-300 lg:hidden ${
            mobileMenuOpen ? 'visible opacity-100' : 'invisible opacity-0'
          }`}
          aria-hidden={!mobileMenuOpen}
        >
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />

          <div
            className={`absolute inset-x-0 top-0 flex flex-col border-b border-slate-200 bg-white transition-transform duration-300 ease-out ${
              mobileMenuOpen ? 'translate-y-0' : '-translate-y-full'
            }`}
          >
            <div className="flex items-center justify-between p-6">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 overflow-hidden rounded-lg border border-slate-100 bg-white p-1.5 shadow-soft">
                  <img src={LOGO_ICON} alt="KaffePOS" className="h-full w-full object-contain" />
                </div>
                <span className="font-display text-lg font-extrabold tracking-tight text-slate-900">
                  Kaffe<span className="text-[#FF6A00]">POS</span>
                </span>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="flex h-10 w-10 items-center justify-center text-slate-400 transition-colors hover:text-slate-900"
                aria-label="Tutup menu"
              >
                <X size={22} />
              </button>
            </div>

            <div className="px-6 pb-8">
              <div className="flex flex-col gap-4 border-t border-slate-100 py-5">
                {NAV_LINKS.filter((link) => !IS_PAYMENT_DISABLED || link.href !== '#pricing').map((link) => (
                  <a
                    key={link.name}
                    href={link.href}
                    onClick={(e) => scrollToSection(e, link.href)}
                    className="text-base font-bold text-slate-700 transition-colors hover:text-[#FF6A00]"
                  >
                    {link.name}
                  </a>
                ))}
              </div>

              <div className="flex flex-col gap-3 border-t border-slate-100 pt-5">
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    navigate('/login');
                  }}
                  className="w-full rounded-xl border border-slate-200 py-3.5 font-bold text-slate-700 transition-colors hover:bg-slate-50"
                >
                  Masuk Akun
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    navigate('/register');
                  }}
                  className="w-full rounded-xl bg-[#FF6A00] py-3.5 font-extrabold text-white shadow-lg shadow-[#FF6A00]/20"
                >
                  Mulai Trial 14 Hari Gratis
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main id="main-content" className="relative z-10 overflow-x-hidden pt-20">
        {/* Hero Section */}
        <section className="relative overflow-hidden px-5 pb-16 pt-12 sm:px-6 md:pb-22 md:pt-20">
          <div className="mx-auto grid min-w-0 max-w-7xl items-center gap-12 lg:grid-cols-[0.94fr_1.22fr]">
            <div className="relative z-10 min-w-0 text-left">
              <div className="mb-5 inline-flex flex-wrap items-center gap-2 rounded-full border border-orange-200/80 bg-white/90 px-3.5 py-1.5 shadow-sm">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse-soft" />
                <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-slate-700">
                  InsForge Cloud &bull; Mayar API v2 &bull; Offline-First
                </span>
              </div>

              <h1 className="max-w-[340px] break-words font-display text-[34px] font-extrabold leading-[1.12] tracking-tight text-slate-900 sm:max-w-[620px] sm:text-[50px] md:text-[60px]">
                Sistem Kasir Cafe yang Rapi, Cepat, dan <span className="text-[#FF6A00]">Siap Tumbuh</span>
              </h1>
              <p className="mt-5 max-w-[340px] break-words text-base font-medium leading-7 text-slate-600 sm:max-w-[560px] md:text-[17px] md:leading-8">
                Kelola transaksi kasir, gramasi resep HPP, layar dapur (KDS), Kopi Passport loyalty, performa barista, dan printer thermal dalam satu platform cloud yang tetap berjalan saat internet putus. Mulai <span className="font-mono font-bold text-slate-900">Rp49.000/bulan</span>, gratis trial <span className="font-mono font-bold text-slate-900">14 hari</span>.
              </p>

              {/* Island CTA Buttons */}
              <div className="mt-8 flex max-w-[340px] flex-col gap-3 sm:max-w-none sm:flex-row sm:flex-wrap sm:items-center">
                <button
                  type="button"
                  onClick={() => navigate('/register')}
                  className="group inline-flex h-12 w-full items-center justify-between gap-3 rounded-full bg-[#FF6A00] pl-6 pr-2 text-sm font-extrabold text-white shadow-[0_14px_30px_rgba(255,106,0,0.24)] transition-transform duration-200 hover:bg-[#FF8A1C] active:scale-[0.98] sm:w-auto"
                >
                  <span>Mulai Trial Gratis</span>
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 transition-transform duration-200 group-hover:translate-x-0.5">
                    <ArrowRight size={15} />
                  </span>
                </button>
                <a
                  href="#features"
                  onClick={(e) => scrollToSection(e, '#features')}
                  className="inline-flex h-12 w-full items-center justify-center rounded-full border border-slate-200 bg-white px-6 text-sm font-extrabold text-slate-800 shadow-sm transition-colors hover:border-orange-200 hover:bg-orange-50/50 hover:text-[#FF6A00] sm:w-auto"
                >
                  Lihat Fitur
                </a>
                <button
                  type="button"
                  onClick={() => navigate('/login?demo=1')}
                  className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full border border-orange-200 bg-orange-50/50 px-5 text-sm font-extrabold text-[#FF6A00] shadow-sm transition-colors hover:bg-orange-100/60 sm:w-auto"
                >
                  <span>☕ Coba Demo Live</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownload}
                  className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full border border-orange-200/80 bg-orange-50/60 px-5 text-xs font-extrabold text-[#FF6A00] transition-colors hover:bg-orange-100/70 sm:w-auto"
                >
                  <Smartphone size={15} />
                  <span>APK Android Kasir</span>
                </button>
              </div>

              <div className="mt-10 grid max-w-[580px] gap-4 border-t border-slate-200/70 pt-7 sm:grid-cols-3">
                {[
                  { title: 'Offline First', metric: '0 Data Loss', desc: 'Tetap jualan saat Wi-Fi putus', icon: Cloud },
                  { title: 'Resep & KDS', metric: '< 1.2% Selisih', desc: 'Potong gramasi stok otomatis', icon: Trophy },
                  { title: 'AI Insights', metric: 'Real-time HPP', desc: 'Analisis jam ramai & margin', icon: Brain },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.title} className="flex items-start gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-[#FF6A00] ring-1 ring-orange-200/60">
                        <Icon size={18} />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h3 className="text-xs font-extrabold text-slate-900">{item.title}</h3>
                          <span className="font-mono text-[10px] font-bold text-[#FF6A00]">{item.metric}</span>
                        </div>
                        <p className="mt-0.5 text-xs leading-5 text-slate-500">{item.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <LandingDeviceShowcase />
          </div>
        </section>

        {/* Segment Bar */}
        <section className="border-y border-slate-100 bg-white px-5 py-8 sm:px-6">
          <div className="mx-auto max-w-7xl">
            <p className="text-center font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
              Dirancang khusus untuk ekosistem bisnis kopi &amp; F&amp;B di Indonesia
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-x-10 gap-y-4 text-sm font-extrabold text-slate-600 md:gap-x-14">
              <div className="flex items-center gap-2">
                <Coffee size={17} className="text-[#FF6A00]" /> Specialty Coffee Shop
              </div>
              <div className="flex items-center gap-2">
                <Zap size={17} className="text-[#FF6A00]" /> Kedai Kopi &amp; Roastery
              </div>
              <div className="flex items-center gap-2">
                <Store size={17} className="text-[#FF6A00]" /> Espresso Bar &amp; Booth
              </div>
              <div className="flex items-center gap-2">
                <Coffee size={17} className="text-[#FF6A00]" /> Slow Bar &amp; Manual Brew
              </div>
              <div className="flex items-center gap-2">
                <Store size={17} className="text-[#FF6A00]" /> Jaringan Cafe Multi-Cabang
              </div>
            </div>
          </div>
        </section>

        {/* Unit Economics & Benefits (Double-Bezel Cards) */}
        <section className="px-5 py-14 sm:px-6 md:py-18">
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-5 md:grid-cols-3">
              {BENEFITS.map((benefit) => {
                const Icon = benefit.icon;
                return (
                  <div key={benefit.title} className="kaffe-double-bezel">
                    <div className="kaffe-double-bezel-inner flex h-full flex-col justify-between p-6">
                      <div>
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-50 text-[#FF6A00] ring-1 ring-orange-200/60">
                            <Icon size={21} />
                          </div>
                          <span className="rounded-full bg-slate-100 px-3 py-1 font-mono text-[10px] font-bold text-slate-700">
                            {benefit.tag}
                          </span>
                        </div>
                        <h2 className="mt-5 font-display text-xl font-extrabold tracking-tight text-slate-900">
                          {benefit.title}
                        </h2>
                        <p className="mt-2.5 text-sm font-medium leading-7 text-slate-600">{benefit.desc}</p>
                      </div>
                      <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-3.5">
                        <span className="text-[11px] font-bold text-slate-400">Benchmark Operasional</span>
                        <span className="font-mono text-xs font-extrabold tabular-nums text-[#FF6A00]">
                          {benefit.metric}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Asymmetric Bento 2.0 Features Grid */}
        <section id="features" className="px-5 py-8 sm:px-6 md:py-12">
          <div className="kaffe-soft-section mx-auto max-w-7xl rounded-[32px] px-5 py-10 md:px-10 md:py-14">
            <div className="mx-auto max-w-3xl text-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-orange-200/80 bg-white px-3.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#FF6A00]">
                <Sparkles size={12} />
                <span>Modular Cafe OS</span>
              </div>
              <h2 className="mt-3 font-display text-2xl font-extrabold tracking-tight text-slate-900 md:text-4xl">
                Satu POS untuk Mengelola Operasional Cafe Lebih Rapi
              </h2>
              <p className="mx-auto mt-3.5 max-w-2xl text-sm font-medium leading-7 text-slate-600 md:text-base">
                KaffePOS menggabungkan kasir offline-first, pemotongan resep HPP otomatis, Kitchen Display (KDS), Kopi Passport loyalty, evaluasi barista, dan printer thermal dalam satu alur kerja yang sinkron.
              </p>
            </div>

            <div className="mt-10 grid grid-cols-1 gap-5 lg:grid-cols-12">
              {FEATURES.map((feature) => {
                const Icon = feature.icon;
                const isWide = feature.bentoSpan === 'lg:col-span-12';
                return (
                  <button
                    key={feature.title}
                    type="button"
                    onClick={() => handleFeatureClick(feature)}
                    className={`kaffe-double-bezel group text-left transition-transform duration-200 hover:-translate-y-0.5 ${feature.bentoSpan}`}
                  >
                    <div
                      className={`kaffe-double-bezel-inner flex h-full flex-col justify-between p-6 sm:p-7 ${
                        isWide ? 'lg:flex-row lg:items-center lg:gap-8' : ''
                      }`}
                    >
                      <div className={isWide ? 'lg:max-w-xl' : ''}>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-3">
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-[#FF6A00] ring-1 ring-orange-200/70 transition-colors group-hover:bg-[#FF6A00] group-hover:text-white">
                              <Icon size={22} />
                            </div>
                            <span className="rounded-full border border-orange-200/70 bg-orange-50/70 px-3 py-1 font-mono text-[10px] font-bold text-[#FF6A00]">
                              {feature.tag}
                            </span>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] font-bold text-slate-400">{feature.metricLabel}</p>
                            <p className="font-mono text-xs font-extrabold tabular-nums text-slate-900">
                              {feature.metricValue}
                            </p>
                          </div>
                        </div>

                        <h3 className="mt-5 font-display text-xl font-extrabold tracking-tight text-slate-900 group-hover:text-[#FF6A00]">
                          {feature.title}
                        </h3>
                        <p className="mt-2.5 text-sm font-medium leading-7 text-slate-600">{feature.desc}</p>
                      </div>

                      <div className={`mt-5 border-t border-slate-100 pt-4 ${isWide ? 'lg:mt-0 lg:min-w-[340px] lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0' : ''}`}>
                        <ul className="space-y-2">
                          {feature.bullets.map((bullet) => (
                            <li key={bullet} className="flex items-center gap-2 text-xs font-bold text-slate-700">
                              <CheckCircle2 size={14} className="shrink-0 text-[#FF6A00]" />
                              <span>{bullet}</span>
                            </li>
                          ))}
                        </ul>
                        <div className="mt-4 inline-flex items-center gap-1.5 text-xs font-extrabold text-[#FF6A00]">
                          <span>Lihat spesifikasi teknis</span>
                          <ArrowRight size={13} className="transition-transform duration-200 group-hover:translate-x-1" />
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* Cloud & Payment Architecture Sync Section */}
        <section id="architecture" className="px-5 py-14 sm:px-6 md:py-20">
          <div className="mx-auto max-w-7xl">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div className="max-w-2xl">
                <p className="font-mono text-xs font-extrabold uppercase tracking-[0.2em] text-[#FF6A00]">
                  Infrastruktur Kelas Produksi
                </p>
                <h2 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-slate-900 md:text-4xl">
                  Sinkronisasi Cloud Tanpa Kompromi dengan InsForge &amp; Mayar v2
                </h2>
              </div>
              <p className="max-w-md text-sm font-medium leading-7 text-slate-600">
                Setiap transaksi, mutasi gramasi bahan baku, dan perpanjangan lisensi outlet diproses di atas arsitektur cloud PostgreSQL terisolasi.
              </p>
            </div>

            <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {ARCHITECTURE_SYNC_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.title} className="kaffe-double-bezel">
                    <div className="kaffe-double-bezel-inner flex h-full flex-col justify-between p-6">
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-[10px] font-extrabold uppercase tracking-wider text-[#FF6A00]">
                            {item.badge}
                          </span>
                          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-50 text-[#FF6A00]">
                            <Icon size={18} />
                          </div>
                        </div>
                        <h3 className="mt-4 font-display text-lg font-extrabold text-slate-900">{item.title}</h3>
                        <p className="mt-2 text-xs font-medium leading-6 text-slate-600">{item.desc}</p>
                      </div>

                      <div className="mt-5 border-t border-slate-100 pt-3.5">
                        <p className="font-mono text-xl font-extrabold tabular-nums text-slate-900">{item.metric}</p>
                        <p className="mt-0.5 text-[11px] font-semibold text-slate-500">{item.metricSub}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* AI Insights & Executive Dashboard Section */}
        <section id="about" className="px-5 py-12 sm:px-6 md:py-18">
          <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[0.72fr_1.28fr]">
            <div>
              <p className="font-mono text-xs font-extrabold uppercase tracking-[0.2em] text-[#FF6A00]">
                AI Insights &amp; Dashboard
              </p>
              <h2 className="mt-3.5 font-display text-3xl font-extrabold leading-tight tracking-tight text-slate-900 md:text-4xl">
                Ubah Transaksi Harian Jadi Keputusan Bisnis
              </h2>
              <p className="mt-4 text-sm font-medium leading-7 text-slate-600 md:text-base">
                Dashboard KaffePOS membantu owner memantau omzet real-time, menu dengan margin tertinggi, distribusi jam sibuk, peringatan stok kritis, dan performa barista tanpa rekap spreadsheet manual.
              </p>
              <div className="mt-6 space-y-3.5">
                {[
                  'Rekapitulasi revenue harian, mingguan, dan bulanan secara real-time',
                  'Deteksi otomatis jam ramai (peak hour) dan menu paling menguntungkan',
                  'Rekonsiliasi pembayaran tunai, QRIS Mayar, dan Virtual Account',
                  'Ekspor laporan PDF dan cadangan data JSON sekali klik untuk owner',
                ].map((item) => (
                  <div key={item} className="flex items-start gap-3 text-sm font-semibold text-slate-700">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[#FF6A00] bg-orange-50 text-[11px] font-bold text-[#FF6A00]">
                      ✓
                    </span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
            <DashboardPreview />
          </div>
        </section>

        {/* Pricing Section */}
        {!IS_PAYMENT_DISABLED && (
          <section id="pricing" className="px-5 pb-16 pt-6 sm:px-6 md:pb-22">
            <div className="mx-auto max-w-7xl">
              <div className="mb-8 text-center">
                <p className="font-mono text-xs font-extrabold uppercase tracking-[0.2em] text-[#FF6A00]">
                  Paket Berlangganan &amp; Aktivasi Instan Mayar
                </p>
                <h2 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-slate-900 md:text-4xl">
                  Mulai dari Outlet Kecil, Siap untuk Berkembang
                </h2>
                <p className="mx-auto mt-3.5 max-w-2xl text-sm font-medium leading-7 text-slate-600">
                  Mulai dengan trial 14 hari fitur Signature lengkap. Setelah itu pilih paket sesuai skala kedai Anda—pembayaran praktis melalui QRIS, Virtual Account, atau E-Wallet dengan aktivasi lisensi otomatis.
                </p>
              </div>
              <PricingPage
                selectedCycle={pricingCycle}
                onCycleChange={setPricingCycle}
                onSelectPlan={handlePricingSelect}
                ctaLabel={(plan) => {
                  if (plan === 'secangkir') {
                    return 'Mulai Sekarang';
                  }
                  return isAuthenticated ? 'Lanjut ke Checkout' : 'Login untuk Checkout';
                }}
              />
              <div className="kaffe-cta-band mt-6 flex flex-col gap-5 rounded-[28px] p-6 md:flex-row md:items-center md:justify-between md:p-8">
                <div className="flex min-w-0 items-start gap-5">
                  <div className="kaffe-cta-logo-card hidden h-20 w-20 shrink-0 items-center justify-center rounded-[22px] border border-white bg-white shadow-[0_16px_40px_rgba(31,41,51,0.12)] sm:flex">
                    <img src={LOGO_ICON} alt="" className="h-11 w-11" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-display text-2xl font-extrabold tracking-tight text-white md:text-3xl">
                      Coba fitur lengkap lebih dulu, lanjutkan saat sudah cocok.
                    </h3>
                    <p className="mt-2.5 max-w-2xl text-sm font-medium leading-7 text-white/90">
                      Masa percobaan 14 hari membantu Anda menguji alur kasir, pemotongan resep gudang, Kopi Passport, laporan PDF, dan printer thermal langsung di meja bar.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/register')}
                  className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-white px-7 text-sm font-extrabold text-[#FF6A00] shadow-[0_14px_30px_rgba(31,41,51,0.16)] transition-colors hover:bg-orange-50"
                >
                  <span>Mulai Trial Gratis</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          </section>
        )}

        {/* Contact & Onboarding Support */}
        <section id="contact" className="border-t border-slate-100 bg-white px-5 py-14 sm:px-6 md:py-18">
          <div className="mx-auto max-w-7xl">
            <div className="mb-8 max-w-3xl">
              <p className="font-mono text-xs font-extrabold uppercase tracking-[0.2em] text-[#FF6A00]">
                Kontak &amp; Onboarding
              </p>
              <h2 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-slate-900 md:text-4xl">
                Butuh Bantuan Memulai?
              </h2>
              <p className="mt-3.5 text-sm font-medium leading-7 text-slate-600">
                Tim teknis KaffePOS siap mendampingi setup menu dan resep HPP awal, konfigurasi printer thermal Bluetooth/USB, hingga aktivasi pembayaran.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {SUPPORT_CONTACT.map((item) => (
                <div key={item.label} className="kaffe-double-bezel">
                  <div className="kaffe-double-bezel-inner h-full p-5">
                    <p className="font-mono text-[11px] font-extrabold uppercase tracking-wider text-[#FF6A00]">
                      {item.label}
                    </p>
                    {item.href ? (
                      <a
                        href={item.href}
                        target={item.href.startsWith('http') ? '_blank' : undefined}
                        rel={item.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                        className="mt-2.5 block break-words text-sm font-extrabold text-slate-900 transition-colors hover:text-[#FF6A00]"
                      >
                        {item.value}
                      </a>
                    ) : (
                      <p className="mt-2.5 text-sm font-bold leading-6 text-slate-800">{item.value}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <LandingSocialProof />
      </main>

      {/* Download APK Modal */}
      {showDownloadWarning && (
        <div className="kaffe-modal-overlay fixed inset-0 z-[100] flex justify-center">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-md animate-in fade-in duration-200"
            onClick={closeDownloadWarning}
            aria-label="Tutup peringatan unduhan"
          />
          <div
            ref={downloadModal.panelRef}
            className="kaffe-modal-panel kaffe-modal-scroll relative w-full border border-slate-200 bg-white p-6 shadow-premium animate-in zoom-in duration-200 sm:p-8 md:p-10 [--kaffe-modal-max-width:520px]"
            aria-labelledby="download-warning-title"
            {...downloadModal.dialogProps}
          >
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-[#FF6A00]/20 bg-orange-50">
              <Lock size={32} style={{ color: BRAND_ACCENT }} />
            </div>
            <h3
              id="download-warning-title"
              className="kaffe-safe-text mb-3 text-center font-display text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl"
            >
              Unduh APK Kasir Khusus Outlet Terdaftar
            </h3>
            <p className="kaffe-safe-text mb-7 text-center text-sm font-medium leading-7 text-slate-600 sm:text-base">
              Untuk menjaga keamanan sinkronisasi InsForge Cloud dan lisensi perangkat, installer APK Android tersedia langsung di dalam Dashboard setelah Anda membuat akun outlet gratis.
            </p>
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={() => navigate('/register')}
                className="w-full rounded-2xl bg-[#FF6A00] py-4 text-sm font-extrabold text-white shadow-premium transition-colors hover:bg-[#FF8A1C]"
              >
                Buat Akun Outlet Gratis (14 Hari)
              </button>
              <button
                type="button"
                onClick={closeDownloadWarning}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3.5 text-xs font-extrabold uppercase tracking-wider text-slate-600 transition-colors hover:bg-slate-100"
              >
                Tutup Jendela
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Feature Intelligence Detail Modal */}
      {isFeatureDetailOpen && selectedFeature && (
        <div className="kaffe-modal-overlay fixed inset-0 z-[110] flex justify-center">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-200"
            onClick={closeFeatureDetail}
            aria-label="Tutup detail fitur"
          />

          <div
            ref={featureModal.panelRef}
            className="kaffe-modal-panel kaffe-modal-scroll relative flex w-full flex-col border border-slate-200 bg-white shadow-premium animate-in zoom-in duration-200 md:flex-row [--kaffe-modal-max-width:900px]"
            aria-labelledby="feature-detail-title"
            {...featureModal.dialogProps}
          >
            {/* Left Side: Metric & Hardware Visual */}
            <div className="relative flex flex-col items-center justify-center overflow-hidden border-b border-slate-100 bg-slate-50/80 p-6 sm:p-8 md:w-5/12 md:border-b-0 md:border-r md:p-10">
              {(() => {
                const detail = getFeatureDetail(selectedFeature.title);
                const DetailIcon = detail?.icon || HelpCircle;
                return (
                  <div className="relative z-10 text-center">
                    <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-2xl border border-orange-200/70 bg-white text-[#FF6A00] shadow-sm sm:h-24 sm:w-24">
                      <DetailIcon size={42} strokeWidth={1.75} />
                    </div>
                    <div className="kaffe-safe-text mb-2 font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">
                      {detail.stats.metric}
                    </div>
                    <div className="kaffe-safe-text font-mono text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
                      {detail.stats.value}
                    </div>
                    <div className="mx-auto mt-5 h-1 w-12 rounded-full bg-[#FF6A00]" />
                  </div>
                );
              })()}
            </div>

            {/* Right Side: Specification Content */}
            <div className=" bg-white p-6 sm:p-8 md:w-7/12 md:p-10">
              <button
                type="button"
                onClick={closeFeatureDetail}
                className="absolute right-4 top-4 text-slate-400 transition-colors hover:text-slate-900 sm:right-6 sm:top-6"
                aria-label="Tutup detail fitur"
              >
                <X size={22} />
              </button>

              <span className="inline-block rounded-full bg-orange-50 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-[#FF6A00]">
                {selectedFeature.tag}
              </span>

              <h3
                id="feature-detail-title"
                className="kaffe-safe-text mb-4 mt-3 pr-8 font-display text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl"
              >
                {selectedFeature.title}
              </h3>

              <p className="kaffe-safe-text mb-7 text-sm font-medium leading-7 text-slate-600 sm:text-base">
                {getFeatureDetail(selectedFeature.title).details}
              </p>

              <div className="space-y-3">
                <h4 className="kaffe-safe-text font-mono text-[11px] font-extrabold uppercase tracking-[0.2em] text-[#FF6A00]">
                  Kapabilitas Utama
                </h4>
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {getFeatureDetail(selectedFeature.title).highlights.map((h: string) => (
                    <div
                      key={h}
                      className="flex items-center gap-2.5 rounded-xl border border-slate-100 bg-slate-50/70 px-3.5 py-2.5"
                    >
                      <CheckCircle2 size={15} className="shrink-0 text-[#FF6A00]" />
                      <span className="kaffe-safe-text text-xs font-bold text-slate-800">{h}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => {
                    closeFeatureDetail();
                    navigate('/register');
                  }}
                  className="flex-1 rounded-xl bg-[#FF6A00] px-5 py-3.5 text-xs font-extrabold text-white transition-colors hover:bg-[#FF8A1C]"
                >
                  Uji Fitur Ini Gratis 14 Hari
                </button>
                <button
                  type="button"
                  onClick={closeFeatureDetail}
                  className="rounded-xl border border-slate-200 bg-white px-5 py-3.5 text-xs font-extrabold text-slate-600 transition-colors hover:bg-slate-50"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Safe Detail Overlay - Legal, Security & Audit */}
      {isSafeDetailOpen && selectedSafeItem && (
        <div className="kaffe-modal-overlay fixed inset-0 z-[110] flex justify-center">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-200"
            onClick={closeSafeDetail}
            aria-label="Tutup dokumen keamanan"
          />

          <div
            ref={safeModal.panelRef}
            className="kaffe-modal-panel relative flex w-full flex-col border border-slate-200 bg-white shadow-premium animate-in zoom-in duration-200 [--kaffe-modal-max-width:800px]"
            aria-labelledby="safe-detail-title"
            {...safeModal.dialogProps}
          >
            <div className="relative border-b border-slate-100 bg-slate-50/80 p-6 sm:p-8">
              <button
                type="button"
                onClick={closeSafeDetail}
                className="absolute right-4 top-4 text-slate-400 transition-colors hover:text-slate-900 sm:right-6 sm:top-6"
                aria-label="Tutup dokumen keamanan"
              >
                <X size={22} />
              </button>

              <div className="mb-4 flex items-start gap-4 pr-10">
                {(() => {
                  const item = SAFE_CONTENT[selectedSafeItem];
                  const ItemIcon = item?.icon || Shield;
                  return (
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-orange-200/70 bg-white text-[#FF6A00] shadow-sm">
                      <ItemIcon size={24} />
                    </div>
                  );
                })()}
                <div className="min-w-0">
                  <p className="kaffe-safe-text font-mono text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#FF6A00]">
                    Tata Kelola &amp; Keamanan Platform
                  </p>
                  <h3
                    id="safe-detail-title"
                    className="kaffe-safe-text mt-1 font-display text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl"
                  >
                    {selectedSafeItem}
                  </h3>
                </div>
              </div>

              <p className="kaffe-safe-text max-w-2xl text-sm font-medium leading-7 text-slate-600">
                {SAFE_CONTENT[selectedSafeItem]?.description}
              </p>
            </div>

            <div className="kaffe-modal-scroll flex-1 bg-white p-6 sm:p-8">
              <div className="space-y-6">
                {SAFE_CONTENT[selectedSafeItem]?.points.map((p) => (
                  <div key={p.title} className="rounded-2xl border border-slate-100 bg-slate-50/50 p-5">
                    <h4 className="kaffe-safe-text font-display text-base font-extrabold text-slate-900">
                      {p.title}
                    </h4>
                    <p className="kaffe-safe-text mt-2 text-sm font-medium leading-7 text-slate-600">
                      {p.detail}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-8 flex flex-col items-center justify-between gap-4 border-t border-slate-100 pt-6 sm:flex-row">
                <div className="kaffe-safe-text font-mono text-xs font-bold text-slate-400">
                  InsForge Cloud RLS &bull; Mayar API v2 Verified &bull; 2026
                </div>
                <button
                  type="button"
                  onClick={closeSafeDetail}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-6 py-3 text-xs font-extrabold uppercase tracking-wider text-slate-700 transition-colors hover:bg-slate-100 sm:w-auto"
                >
                  Tutup Dokumen
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <LandingFooter
        scrollToSection={scrollToSection}
        setSelectedSafeItem={setSelectedSafeItem}
        setIsSafeDetailOpen={setIsSafeDetailOpen}
      />

      {/* Back to Top */}
      {showScrollTop && (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-6 right-6 z-[60] flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FF6A00] text-white shadow-premium ring-4 ring-[#FF6A00]/15 transition-transform duration-200 hover:scale-105 active:scale-95"
          aria-label="Kembali ke atas"
        >
          <ArrowUp size={20} strokeWidth={2.5} />
        </button>
      )}
    </div>
  );
}
