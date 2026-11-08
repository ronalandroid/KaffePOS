/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  Coffee,
  ExternalLink,
  Eye,
  EyeOff,
  Lock,
  RefreshCw,
  ShieldCheck,
  Store,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { AuthMode, getAuthModeFromLocation, getAuthPathForMode } from '@/utils/authFlow';
import { getPasswordResetParams } from '@/utils/authFlow';
import { normalizeUserFacingError } from '@/lib/errorMessages';
import { LOGO_ICON, brandHighlights } from './authContent';
import { AuthPreviewStage, AuthMobilePreviewStrip } from './AuthPreviewPanels';
export default function AuthPage() {
  const { signIn, signUp, resetPassword, updatePassword, resendVerification, verifyEmailCode, isAuthenticated } = useAuth();
  const location = useLocation();
  const { pathname, search } = location;
  const navigate = useNavigate();
  const isNative = Capacitor.isNativePlatform();

  const redirectUrl = useMemo(() => {
    const params = new URLSearchParams(search);
    return params.get('redirect') || '/';
  }, [search]);

  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [uname, setUname] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [registered, setRegistered] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [formErrors, setFormErrors] = useState<{ email?: string; pass?: string; uname?: string }>({});
  const [resendCooldown, setResendCooldown] = useState(0);
  const emailRef = useRef<HTMLInputElement>(null);
  const resetParams = useMemo(() => {
    if (mode !== 'reset' || typeof window === 'undefined') {
      return { email: null, token: null };
    }

    return getPasswordResetParams(new URL(window.location.href));
  }, [mode]);
  const invalidResetLink = mode === 'reset' && (!resetParams.email || !resetParams.token);

  useEffect(() => {
    const resolvedMode = getAuthModeFromLocation(pathname, search);
    const params = new URLSearchParams(search);
    const verified = params.get('verified') === '1';
    const registeredEmail = localStorage.getItem('kaffepos_registered_email');

    setMode(resolvedMode);

    if (verified) {
      setRegistered(false);
      setErr('');
      setOk('Email berhasil diverifikasi. Sekarang kamu bisa masuk ke KaffePOS.');
      localStorage.removeItem('kaffepos_registered_email');
      return;
    }

    if (resolvedMode === 'register' && registeredEmail) {
      setEmail(registeredEmail);
      setRegistered(true);
      return;
    }

    if (resolvedMode !== 'register') {
      setRegistered(false);
    }

    const demoParam = params.get('demo');
    if (demoParam && resolvedMode === 'login') {
      if (demoParam === 'cashier' || demoParam === 'kasir') {
        setEmail('kasir@kaffepos.my.id');
        setPass('DemoPassword123');
      } else {
        setEmail('demo@kaffepos.my.id');
        setPass('DemoPassword123');
      }
    }
  }, [pathname, search]);

  useEffect(() => {
    if (!registered && mode !== 'reset') {
      const timer = setTimeout(() => emailRef.current?.focus(), 100);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [mode, registered]);

  useEffect(() => {
    if (isAuthenticated) {
      localStorage.removeItem('kaffepos_registered_email');
      sessionStorage.removeItem('kaffepos_registered_email');
      if (mode !== 'reset') {
        navigate(redirectUrl, { replace: true });
      }
    }
  }, [isAuthenticated, mode, navigate, redirectUrl]);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    if (resendCooldown > 0) {
      timer = setInterval(() => setResendCooldown((current) => current - 1), 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [resendCooldown]);

  useEffect(() => {
    if (mode === 'register' || mode === 'reset') {
      const errors: { email?: string; pass?: string; uname?: string } = {};
      if (mode === 'register' && email && !/\S+@\S+\.\S+/.test(email.trim())) {
        errors.email = 'Format email tidak valid';
      }
      if (mode === 'register' && uname && uname.trim().length < 3) {
        errors.uname = 'Nama toko minimal 3 karakter';
      }
      if (pass && (pass.length < 10 || !/[A-Z]/.test(pass) || !/[a-z]/.test(pass) || !/\d/.test(pass))) {
        errors.pass = 'Password min 10 huruf, kombinasi besar, kecil & angka';
      }
      setFormErrors(errors);
      return;
    }

    setFormErrors({});
  }, [email, pass, uname, mode]);

  const switchMode = useCallback((nextMode: AuthMode) => {
    setErr('');
    setOk('');
    setPass('');
    setConfirmPass('');
    setShow(false);
    setVerificationCode('');
    setResendCooldown(0);
    setFormErrors({});
    setRegistered(false);

    if (nextMode !== 'register') {
      localStorage.removeItem('kaffepos_registered_email');
    }

    navigate(getAuthPathForMode(nextMode), { replace: true });
  }, [navigate]);

  const handleResendVerification = useCallback(async () => {
    if (resendCooldown > 0 || !email.trim()) return;

    setResending(true);
    setErr('');
    setOk('');
    try {
      const result = await resendVerification(email.trim());
      if (result.error) {
        setErr(result.error || 'Gagal mengirim ulang email verifikasi.');
        return;
      }

      setOk('Kode verifikasi baru sudah dikirim lewat email.');
      setResendCooldown(60);
    } catch (error) {
      setErr(normalizeUserFacingError(error, 'Gagal mengirim ulang email verifikasi.'));
    } finally {
      setResending(false);
    }
  }, [email, resendCooldown, resendVerification]);

  const handleVerificationCheck = useCallback(async () => {
    if (verificationCode.replace(/\D/g, '').length !== 6) {
      setErr('Masukkan kode verifikasi 6 digit dari email terlebih dahulu.');
      return;
    }

    setErr('');
    setOk('');
    setConfirming(true);

    try {
      const result = await verifyEmailCode(email.trim(), verificationCode);
      if (result.error) {
        setErr(result.error);
        return;
      }

      setOk('Akun berhasil diverifikasi. Menyiapkan dashboard...');
      const loginResult = await signIn(email.trim(), pass);
      if (loginResult.error) {
        setRegistered(false);
        setVerificationCode('');
        switchMode('login');
        setOk('Akun berhasil diverifikasi. Silakan login untuk melanjutkan.');
        return;
      }
      navigate(redirectUrl, { replace: true });
    } catch (e: any) {
      setErr(normalizeUserFacingError(e, 'Verifikasi belum bisa diproses. Coba lagi.'));
    } finally {
      setConfirming(false);
    }
  }, [email, navigate, pass, signIn, verificationCode, verifyEmailCode, switchMode, redirectUrl]);

  const handleCancelVerification = useCallback(() => {
    setRegistered(false);
    setVerificationCode('');
    setErr('');
    setOk('');
    setPass('');
    setConfirmPass('');
    setResendCooldown(0);
    localStorage.removeItem('kaffepos_registered_email');
    sessionStorage.removeItem('kaffepos_registered_email');
  }, []);

  const submit = async () => {
    if (busy) return;
    setErr('');
    setOk('');

    if (mode === 'forgot' && !email) {
      setErr('Alamat email wajib diisi.');
      return;
    }
    if (mode === 'reset' && invalidResetLink) {
      setErr('Tautan reset password tidak valid atau sudah kedaluwarsa. Minta tautan baru untuk melanjutkan.');
      return;
    }
    if (mode === 'reset' && (!pass || !confirmPass)) {
      setErr('Password baru dan konfirmasi wajib diisi.');
      return;
    }
    if ((mode === 'login' || mode === 'register') && (!email || !pass)) {
      setErr('Email dan password wajib diisi.');
      return;
    }

    setBusy(true);

    try {
      if (mode === 'login') {
        const result = await signIn(email, pass);
        if (result.error) {
          if (result.error === 'email_not_confirmed') {
            setErr('email_not_confirmed');
          } else {
            setErr(result.error);
          }
        } else {
          navigate(redirectUrl, { replace: true });
        }
      } else if (mode === 'register') {
        if (!uname) {
          setErr('Nama toko wajib diisi.');
          setBusy(false);
          return;
        }

        const result = await signUp(email, pass, uname);

        if (result.error) {
          setErr(result.error);
        } else {
          setRegistered(true);
          setOk(result.message || 'Akun berhasil dibuat. Cek email untuk kode verifikasi.');
          localStorage.setItem('kaffepos_registered_email', email);
        }
      } else if (mode === 'forgot') {
        const result = await resetPassword(email);
        if (result.error) {
          setErr(result.error);
        } else {
          setOk(`Tautan reset password berhasil dikirim ke ${email}`);
          setEmail('');
        }
      } else if (mode === 'reset') {
        if (pass !== confirmPass) {
          setErr('Password baru dan konfirmasi tidak cocok.');
          setBusy(false);
          return;
        }
        const result = await updatePassword(pass);
        if (result.error) {
          setErr(result.error);
        } else {
          setOk('Password berhasil diperbarui. Silakan kembali ke form masuk.');
          setPass('');
          setConfirmPass('');
          setTimeout(() => switchMode('login'), 3000);
        }
      }
    } catch (e: any) {
      setErr(normalizeUserFacingError(e, 'Terjadi kesalahan tidak terduga. Coba lagi.'));
    } finally {
      setBusy(false);
    }
  };

  const handleInstantDemoLogin = useCallback(async (demoRole: 'owner' | 'cashier') => {
    const demoEmail = demoRole === 'owner' ? 'demo@kaffepos.my.id' : 'kasir@kaffepos.my.id';
    const demoPassword = 'DemoPassword123';
    setEmail(demoEmail);
    setPass(demoPassword);
    setErr('');
    setOk(`Menyiapkan sesi Demo ${demoRole === 'owner' ? 'Owner' : 'Kasir'}...`);
    setBusy(true);
    try {
      const res = await signIn(demoEmail, demoPassword);
      if (res.error) {
        setErr(res.error);
        setOk('');
      } else {
        navigate(redirectUrl, { replace: true });
      }
    } catch (e: any) {
      setErr(normalizeUserFacingError(e, 'Login demo gagal.'));
      setOk('');
    } finally {
      setBusy(false);
    }
  }, [navigate, redirectUrl, signIn]);

  const openInbox = async () => {
    const domain = email.split('@')[1];
    if (domain) {
      const targetUrl = domain.includes('gmail')
        ? 'https://mail.google.com/mail/u/0/#search/KaffePOS'
        : domain.includes('yahoo')
          ? 'https://mail.yahoo.com'
          : domain.includes('outlook') || domain.includes('hotmail')
            ? 'https://outlook.live.com'
            : `https://${domain}`;

      if (Capacitor.isNativePlatform()) {
        await Browser.open({ url: targetUrl });
        return;
      }
      window.open(targetUrl, '_blank', 'noopener,noreferrer');
    }
  };


  const duplicateRegistrationErr = err.includes('sudah terdaftar');
  const isInvalid = mode === 'register' && Object.keys(formErrors).length > 0;

  const authTitle = mode === 'login'
    ? 'Masuk'
    : mode === 'register'
      ? 'Buat Akun Gratis'
      : mode === 'forgot'
        ? 'Lupa Password'
        : 'Update Password';

  const authDescription = mode === 'login'
    ? 'Lanjutkan operasional kafe Anda dengan akses backoffice yang mudah dan aman.'
    : mode === 'register'
      ? 'Bergabunglah dengan ratusan pengusaha kafe lainnya dalam ekosistem KaffePOS.'
      : mode === 'forgot'
        ? 'Tautan reset sandi akan segera dikirim ke alamat email terdaftar Anda.'
        : invalidResetLink
          ? 'Tautan reset sudah tidak bisa dipakai. Minta tautan baru untuk melanjutkan dengan aman.'
          : `Atur password baru untuk ${resetParams.email}.`;

  return (
    <div data-testid="reference-auth-shell" className="kaffe-app-bg min-h-[100dvh] text-slate-700 selection:bg-[#FF6A00]/20 font-sans relative">
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.05] hidden lg:block"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,106,0,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,106,0,0.1) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />
      
      <div className="mx-auto min-h-[100dvh] w-full max-w-[1280px] lg:grid lg:grid-cols-2 relative z-10">
        
        {/* Left Side - Reference mobile-first brand panel */}
        <section className="relative hidden lg:flex flex-col justify-center px-10 xl:px-16 py-8 animate-in" style={{ animationDuration: '0.6s' }}>
          
          <div className="max-w-xl">
            <div
              className="flex items-center gap-3 mb-6 group cursor-pointer"
              onClick={() => navigate(isNative ? '/login' : '/welcome')}
            >
              <div className="flex items-center gap-3 group-hover:scale-105 transition-transform duration-300">
                <img
                  src={LOGO_ICON}
                  alt=""
                  className="h-11 w-11 object-contain"
                  loading="eager"
                />
                <span className="text-3xl font-extrabold tracking-tight text-slate-900">
                  Kaffe<span className="text-[#FF6A00]">POS</span>
                </span>
              </div>
            </div>

            <h1 className="text-[40px] font-extrabold leading-[1.14] text-slate-900 mb-4">
              Aplikasi Kasir Modern Untuk <span className="text-[#FF6A00]">Bisnis Anda</span>
            </h1>
            <p className="text-[16px] text-slate-500 leading-7 font-medium mb-5 max-w-[520px]">
              Kelola penjualan, stok, pelanggan, dan laporan bisnis dengan mudah dalam satu aplikasi.
            </p>

            <div className="mb-4 flex flex-wrap gap-2">
              {brandHighlights.map((item, idx) => {
                const Icon = item.icon;
                return (
                  <div key={idx} className="inline-flex items-center gap-2 rounded-full border border-orange-100 bg-white/90 px-3 py-2 text-[11px] font-extrabold text-slate-900 shadow-sm">
                    <Icon size={15} className="text-[#FF6A00]" strokeWidth={2.5} aria-hidden="true" />
                    <span>{item.title}</span>
                    <span className="sr-only">{item.copy}</span>
                  </div>
                );
              })}
            </div>

            <AuthPreviewStage />

          </div>

        </section>

        {/* Right Side - Auth Forms */}
        <section className="relative flex min-h-[100dvh] items-center justify-center py-8 px-4 sm:px-6 lg:items-start lg:px-8 lg:pt-14">
          <div className="w-full min-w-0 max-w-[calc(100vw_-_2rem)] sm:max-w-[460px] lg:max-w-[420px] animate-in" style={{ animationDuration: '0.5s' }}>
             
            {/* Mobile Title */}
            <div className="mb-10 text-center lg:hidden animate-in slide-up">
              <div
                data-testid="reference-auth-mobile-brand"
                className="mb-5 flex items-center justify-center"
              >
                <img
                  src={LOGO_ICON}
                  alt=""
                  className="h-11 w-11 object-contain"
                  loading="eager"
                />
                <span className="ml-2 text-2xl font-extrabold tracking-tight text-slate-900">
                  Kaffe<span className="text-[#FF6A00]">POS</span>
                </span>
              </div>
              <p className="text-[13px] text-slate-400 px-4">Bergabung ke dalam ekosistem KaffePOS</p>
            </div>

            <AuthMobilePreviewStrip />

            <div className="kaffe-panel min-w-0 rounded-[24px] p-6 sm:p-7 relative transition-[border-color,box-shadow] duration-300 hover:border-[#FF6A00]/20">
              <div className="text-center mb-8">
                <div className="flex justify-center mb-6">
                  <div className="w-16 h-16 bg-[#FFF4EA] rounded-lg flex items-center justify-center p-3 shadow-sm border border-orange-50">
                    <img src={LOGO_ICON} alt="KaffePOS" className="w-full h-full object-contain" />
                  </div>
                </div>
                <h2 className="text-2xl font-extrabold text-slate-900 mb-3">
                  {registered ? 'Verifikasi' : (mode === 'login' ? 'Selamat datang kembali!' : authTitle)}
                </h2>
                <p className="text-[13px] text-slate-500 font-medium leading-6">
                  {registered
                    ? `Kode OTP dikirim ke ${email}`
                    : (mode === 'login' ? 'Silakan masuk untuk melanjutkan' : authDescription)}
                </p>
              </div>

              {!registered && mode !== 'forgot' && mode !== 'reset' && (
                <div className="mb-6 flex overflow-hidden rounded-[20px] bg-slate-50 p-1.5 border border-slate-100">
                  {(['login', 'register'] as AuthMode[]).map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => switchMode(value)}
                    className={`flex-1 rounded-[14px] py-3 text-[14px] font-bold transition-colors ${
                        mode === value
                          ? 'bg-white text-slate-900 shadow-soft border border-slate-100'
                          : 'text-slate-400 hover:text-slate-600'
                      }`}
                    >
                      {value === 'login' ? 'Login' : 'Daftar'}
                    </button>
                  ))}
                </div>
              )}

              {!registered && mode === 'forgot' && (
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  aria-label="Kembali ke halaman login"
                  className="mb-8 flex items-center gap-2 text-[12px] font-black text-[#FF6A00] transition hover:gap-3 outline-none"
                >
                  <ArrowLeft size={16} aria-hidden="true" />
                  KEMBALI KE LOGIN
                </button>
              )}

              {!registered && mode === 'reset' && invalidResetLink && (
                <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3">
                  <p className="text-[13px] leading-relaxed text-amber-900">
                    Link reset ini sudah tidak berlaku. Minta tautan baru agar proses ganti password tetap aman.
                  </p>
                  <button
                    type="button"
                    onClick={() => switchMode('forgot')}
                    className="mt-3 inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-white px-3 py-2 text-[12px] font-bold text-amber-900 transition hover:bg-amber-100 outline-none"
                  >
                    Minta tautan baru
                  </button>
                </div>
              )}

              {(err || ok) && (
                <div className="mb-6">
                  {err && (
                    <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 shake" role="alert" aria-live="assertive">
                      <AlertCircle size={16} className="mt-0.5 shrink-0 text-red-700" aria-hidden="true" />
                      <div className="flex-1 space-y-2">
                        <p className="text-[13px] leading-relaxed text-red-800">
                          {err === 'email_not_confirmed'
                            ? 'Email belum terkonfirmasi. Silakan periksa inbox OTP.'
                            : err}
                        </p>
                        {(err === 'email_not_confirmed' || duplicateRegistrationErr) && (
                          <div className="flex gap-2">
                            <button
                              type="button"
                              disabled={resending || resendCooldown > 0}
                              onClick={handleResendVerification}
                              className="rounded border border-red-300 bg-white px-2 py-1 text-[11px] font-bold text-red-800 hover:bg-red-100 disabled:opacity-50 outline-none"
                            >
                              {resending ? '...' : (resendCooldown > 0 ? `Tunggu ${resendCooldown}s` : 'Kirim Ulang OTP')}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  {ok && (
                    <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-3 animate-in slide-up" role="status" aria-live="polite">
                      <CheckCircle size={16} className="mt-0.5 shrink-0 text-emerald-700" aria-hidden="true" />
                      <p className="text-[13px] leading-relaxed text-emerald-800">{ok}</p>
                    </div>
                  )}
                </div>
              )}

              {registered ? (
                <div className="space-y-6 animate-in slide-up">
                  <button
                    type="button"
                    onClick={handleCancelVerification}
                    aria-label="Kembali ke form daftar"
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-orange-100 bg-orange-50 px-4 text-[12px] font-bold text-[#9A3412] transition-colors hover:border-[#FF6A00]/40 hover:bg-orange-100"
                  >
                    <ArrowLeft size={16} aria-hidden="true" />
                    Kembali
                  </button>

                  <div className="space-y-3 pb-2 pt-2">
                    <div className="kaffe-otp-grid relative flex justify-center gap-2.5 sm:gap-3 mx-auto w-full max-w-[340px]">
                      {[0, 1, 2, 3, 4, 5].map((idx) => {
                        const val = verificationCode[idx] || '';
                        const isActive = verificationCode.length === idx || (verificationCode.length === 6 && idx === 5);
                        return (
                          <div
                            key={idx}
                            className={`kaffe-otp-cell flex h-12 w-12 sm:h-14 sm:w-12 items-center justify-center rounded-xl border text-[24px] font-black transition-[border-color,box-shadow] duration-200 ${
                              isActive
                                ? 'border-[#FF6A00] bg-white ring-4 ring-[#FF6A00]/10 text-slate-900'
                                : val
                                  ? 'border-slate-200 bg-slate-50 text-slate-900 shadow-inner'
                                  : 'border-slate-100 bg-slate-50/50 text-slate-300'
                            }`}
                          >
                            {val || (isActive ? <span className="h-6 w-[2.5px] animate-pulse bg-[#FF6A00] rounded-full" /> : '')}
                          </div>
                        );
                      })}
                      <input
                        id="auth-otp"
                        type="text"
                        inputMode="numeric"
                        aria-label="Kode verifikasi OTP 6 digit"
                        autoComplete="one-time-code"
                        maxLength={6}
                        value={verificationCode}
                        onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                        autoFocus
                        className="absolute inset-0 w-full h-full opacity-0 cursor-text z-20"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={confirming || verificationCode.length !== 6}
                    onClick={handleVerificationCheck}
                    className="w-full flex items-center justify-center gap-3 rounded-2xl py-4 mt-6 text-[15px] font-extrabold text-white transition-colors shadow-premium disabled:opacity-50 disabled:pointer-events-none bg-[#FF6A00] hover:bg-[#FF8A1C]"
                  >
                    {confirming ? <RefreshCw size={20} className="animate-spin" aria-hidden="true" /> : 'Verifikasi Akun'}
                  </button>

                  <div className="flex items-center justify-between gap-4 pt-6 border-t border-slate-100 mt-6">
                    <button
                      type="button"
                      onClick={openInbox}
                      aria-label="Buka inbox email di tab baru"
                      className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-slate-50 border border-slate-200 px-3 py-3 text-[12px] font-bold text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                    >
                      Buka Inbox <ExternalLink size={14} aria-hidden="true" className="opacity-70" />
                    </button>
                    <button
                      type="button"
                      disabled={resending || resendCooldown > 0}
                      onClick={handleResendVerification}
                      className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-slate-50 border border-slate-200 px-3 py-3 text-[12px] font-bold text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors disabled:opacity-50"
                    >
                      <RefreshCw size={14} className={`${resending ? 'animate-spin' : ''} opacity-70`} aria-hidden="true" />
                      {resendCooldown > 0 ? `Tunggu ${resendCooldown}s` : 'Kirim Ulang'}
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="space-y-4 animate-in slide-up">
                  {mode === 'register' && (
                    <div className="space-y-2">
                      <label htmlFor="auth-uname" className="text-[11px] font-black text-slate-400 pl-1 uppercase tracking-widest">Nama Bisnis</label>
                      <div className="relative group">
                        <Store size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-[#FF6A00] transition-colors" aria-hidden="true" />
                        <input
                          id="auth-uname"
                          ref={mode === 'register' ? emailRef : undefined}
                          type="text"
                          value={uname}
                          onChange={(e) => setUname(e.target.value)}
                          aria-invalid={!!formErrors.uname}
                          aria-describedby={formErrors.uname ? 'auth-uname-error' : undefined}
                          className={`w-full h-14 rounded-2xl bg-slate-50/50 border pl-12 pr-4 text-[16px] font-bold text-slate-900 placeholder-slate-300 outline-none transition-all focus:bg-white focus:ring-4 focus:ring-[#FF6A00]/40 ${
                            formErrors.uname ? 'border-red-700' : 'border-slate-100 focus:border-[#FF6A00]/20'
                          }`}
                          placeholder="Kopi Senja"
                        />
                      </div>
                      {formErrors.uname && (
                        <p id="auth-uname-error" role="alert" className="pl-1 text-[12px] font-semibold text-red-800">
                          {formErrors.uname}
                        </p>
                      )}
                    </div>
                  )}

                  {(mode === 'login' || mode === 'register' || mode === 'forgot') && (
                    <div className="space-y-2">
                      <label htmlFor="auth-email" className="text-[11px] font-black text-slate-400 pl-1 uppercase tracking-widest">Email atau No. HP</label>
                      <div className="relative group">
                        <input
                          id="auth-email"
                          ref={mode === 'login' || mode === 'forgot' ? emailRef : undefined}
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          aria-invalid={!!formErrors.email}
                          aria-describedby={formErrors.email ? 'auth-email-error' : undefined}
                          className={`w-full h-14 rounded-2xl bg-slate-50/50 border px-5 text-[16px] font-bold text-slate-900 placeholder-slate-300 outline-none transition-all focus:bg-white focus:ring-4 focus:ring-[#FF6A00]/40 ${
                            formErrors.email ? 'border-red-700' : 'border-slate-100 focus:border-[#FF6A00]/20'
                          }`}
                          placeholder="toko@email.com"
                        />
                      </div>
                      {formErrors.email && (
                        <p id="auth-email-error" role="alert" className="pl-1 text-[12px] font-semibold text-red-800">
                          {formErrors.email}
                        </p>
                      )}
                    </div>
                  )}

                  {(mode === 'login' || mode === 'register' || mode === 'reset') && (
                    <div className="space-y-2 pt-1">
                      <div className="flex items-center justify-between pl-1">
                        <label htmlFor="auth-pass" className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Password</label>
                        {mode === 'login' && (
                          <button
                            type="button"
                            onClick={() => switchMode('forgot')}
                            className="text-[12px] font-bold text-slate-400 hover:text-[#FF6A00] transition-colors outline-none"
                          >
                            Lupa password?
                          </button>
                        )}
                      </div>
                      <div className="relative group">
                        <input
                          id="auth-pass"
                          ref={mode === 'reset' ? emailRef : undefined}
                          type={show ? 'text' : 'password'}
                          value={pass}
                          onChange={(e) => setPass(e.target.value)}
                          aria-invalid={!!formErrors.pass}
                          aria-describedby={formErrors.pass ? 'auth-pass-error' : undefined}
                          className={`w-full h-14 rounded-2xl bg-slate-50/50 border px-5 pr-12 text-[16px] font-bold text-slate-900 placeholder-slate-300 outline-none transition-[background-color,border-color,box-shadow] focus:bg-white focus:ring-4 focus:ring-[#FF6A00]/40 ${
                            formErrors.pass ? 'border-red-700' : 'border-slate-100 focus:border-[#FF6A00]/20'
                          }`}
                          placeholder="••••••••••"
                        />
                        <button
                          type="button"
                          onClick={() => setShow(!show)}
                          aria-label={show ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 w-10 h-10 flex items-center justify-center hover:text-[#FF6A00] transition-colors outline-none rounded-md"
                        >
                          {show ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                        </button>
                      </div>
                      {formErrors.pass && (
                        <p id="auth-pass-error" role="alert" className="pl-1 text-[12px] font-semibold text-red-800">
                          {formErrors.pass}
                        </p>
                      )}
                    </div>
                  )}

                  {mode === 'reset' && (
                    <div className="space-y-2 pt-1">
                      <label htmlFor="auth-confirm" className="text-[11px] font-black text-slate-400 pl-1 uppercase tracking-widest">Konfirmasi Sandi Baru</label>
                      <div className="relative group">
                        <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-[#FF6A00] transition-colors" aria-hidden="true" />
                        <input
                          id="auth-confirm"
                          type={show ? 'text' : 'password'}
                          value={confirmPass}
                          onChange={(e) => setConfirmPass(e.target.value)}
                          className="w-full h-14 rounded-2xl bg-slate-50/50 border border-slate-100 pl-12 pr-4 text-[16px] font-bold text-slate-900 placeholder-slate-300 outline-none transition-[background-color,border-color,box-shadow] focus:bg-white focus:ring-4 focus:ring-[#FF6A00]/40 focus:border-[#FF6A00]/20"
                          placeholder="••••••••••"
                        />
                      </div>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={busy || isInvalid || invalidResetLink}
                    className="w-full mt-6 flex items-center justify-center gap-3 rounded-2xl h-13 text-[15px] font-extrabold text-white transition-colors shadow-[0_12px_24px_rgba(255,106,0,0.22)] hover:bg-[#FF8A1C] active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none bg-[#FF6A00] tracking-tight"
                  >
                    {busy ? (
                      <>
                        <RefreshCw size={20} className="animate-spin" aria-hidden="true" />
                        <span>{mode === 'login' ? 'Memproses...' : mode === 'register' ? 'Mendaftarkan...' : mode === 'forgot' ? 'Mengirim...' : 'Menyimpan...'}</span>
                      </>
                    ) : (
                      <span>{mode === 'login' ? 'Masuk' : mode === 'register' ? 'Daftar Gratis' : mode === 'forgot' ? 'Reset Password' : 'Update Password'}</span>
                    )}
                  </button>

                  {mode === 'login' && !registered && (
                    <div className="mt-5 pt-4 border-t border-slate-100">
                      <div className="flex items-center justify-between mb-2.5">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                          Akun Demo Siap Pakai
                        </span>
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60 flex items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          Database Live
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            void handleInstantDemoLogin('owner');
                          }}
                          className="group relative flex flex-col items-start p-2.5 rounded-xl border border-orange-200/70 bg-orange-50/50 hover:bg-orange-100/60 hover:border-[#FF6A00]/60 transition-colors text-left disabled:opacity-50"
                        >
                          <div className="flex items-center justify-between w-full mb-0.5">
                            <div className="flex items-center gap-1.5">
                              <ShieldCheck size={14} className="text-[#FF6A00]" />
                              <span className="text-xs font-extrabold text-slate-900 group-hover:text-[#FF6A00] transition-colors">
                                Demo Owner
                              </span>
                            </div>
                            <ArrowRight size={11} className="text-[#FF6A00] opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                          <span className="text-[10px] font-medium text-slate-500">
                            Fitur Lengkap (Signature Pro)
                          </span>
                        </button>

                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            void handleInstantDemoLogin('cashier');
                          }}
                          className="group relative flex flex-col items-start p-2.5 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-slate-100 hover:border-slate-300 transition-colors text-left disabled:opacity-50"
                        >
                          <div className="flex items-center justify-between w-full mb-0.5">
                            <div className="flex items-center gap-1.5">
                              <Coffee size={14} className="text-slate-700 group-hover:text-[#FF6A00] transition-colors" />
                              <span className="text-xs font-extrabold text-slate-900 group-hover:text-[#FF6A00] transition-colors">
                                Demo Kasir
                              </span>
                            </div>
                            <ArrowRight size={11} className="text-slate-700 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                          <span className="text-[10px] font-medium text-slate-500">
                            Mode Bar & Kasir POS
                          </span>
                        </button>
                      </div>
                    </div>
                  )}

                </form>
              )}

              {/* Branding Footer */}
              {!registered && (
                <div className="mt-8 pt-6 border-t border-slate-100 text-center">
                  <p className="text-[14px] text-slate-500 font-medium">
                    {mode === 'login' ? (
                      <>
                        Belum punya akun?{' '}
                        <button
                          type="button"
                          onClick={() => switchMode('register')}
                          className="text-[#FF6A00] font-black hover:underline"
                        >
                          Daftar sekarang
                        </button>
                      </>
                    ) : (
                      <>
                        Sudah punya akun?{' '}
                        <button
                          type="button"
                          onClick={() => switchMode('login')}
                          className="text-[#FF6A00] font-black hover:underline"
                        >
                          Masuk sekarang
                        </button>
                      </>
                    )}
                  </p>
                </div>
              )}

            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
