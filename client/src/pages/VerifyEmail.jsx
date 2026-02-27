// client/src/pages/VerifyEmail.jsx
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, XCircle, Loader2, Mail, Sun, Moon, ArrowRight, RefreshCw } from 'lucide-react';
import { useTheme } from "../contexts/ThemeContext";

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const email = searchParams.get('email') || '';
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');
  const navigate = useNavigate();
  const hasRun = useRef(false);
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    if (!token || !email) {
      setStatus('error');
      setMessage('Missing token or email in the URL.');
      return;
    }

    async function verify() {
      setStatus('sending');
      try {
        const res = await fetch(
          `${import.meta.env.VITE_BACKEND_URL}/api/auth/verify-email?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`,
          { credentials: 'include' }
        );

        const data = await res.json();
        if (!res.ok) {
          setStatus('error');
          setMessage(data.message || 'Verification failed');
          return;
        }

        setStatus('success');
        setMessage(data.message || 'Email verified successfully');
        setTimeout(() => navigate('/login'), 3000);

      } catch (err) {
        setStatus('error');
        setMessage(err.message || 'Network error');
      }
    }

    verify();
  }, [token, email, navigate]);

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 dark:bg-[#030712] transition-colors duration-500 relative overflow-hidden">
      {/* Background Effects */}
      <div className={`absolute inset-0 transition-opacity duration-500 ${theme === 'dark' ? 'opacity-100' : 'opacity-0'}`}>
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-purple-600/20 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/2"></div>
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[120px] translate-y-1/2 -translate-x-1/2"></div>
      </div>

      <div className={`absolute inset-0 transition-opacity duration-500 ${theme === 'dark' ? 'opacity-0' : 'opacity-100'}`}>
        <div className="absolute -top-[10%] -left-[10%] w-[60%] h-[60%] rounded-full bg-gradient-to-br from-blue-100/60 via-purple-100/30 to-transparent blur-[80px]"></div>
        <div className="absolute top-[20%] -right-[10%] w-[50%] h-[50%] rounded-full bg-gradient-to-bl from-indigo-100/60 via-pink-100/30 to-transparent blur-[80px]"></div>
      </div>

      {/* Toggle Theme (Top Right) */}
      <div className="absolute top-6 right-6 z-50">
        <button
          onClick={toggleTheme}
          className="p-3 rounded-xl bg-white/50 dark:bg-slate-800/50 backdrop-blur-md border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-white/80 dark:hover:bg-slate-700/80 transition-all shadow-sm"
        >
          {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
        </button>
      </div>

      <div className="w-full max-w-md relative z-10 px-6">
        {/* Glass Card */}
        <div className="backdrop-blur-xl bg-white/70 dark:bg-[#0B0F19]/60 border border-white/50 dark:border-white/10 shadow-2xl rounded-3xl p-10 text-center transition-all duration-300">

          {/* Header Icon */}
          <div className="flex justify-center mb-8">
            <div className={`p-5 rounded-2xl shadow-lg transition-all duration-500 ${status === 'success' ? 'bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400 rotate-0' :
              status === 'error' ? 'bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 rotate-12' :
                'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 animate-pulse'
              }`}>
              {status === 'success' ? <CheckCircle size={48} strokeWidth={2.5} /> :
                status === 'error' ? <XCircle size={48} strokeWidth={2.5} /> :
                  status === 'sending' ? <Loader2 size={48} className="animate-spin" strokeWidth={2.5} /> :
                    <Mail size={48} strokeWidth={2.5} />
              }
            </div>
          </div>

          <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-4 tracking-tight">
            {status === 'success' ? 'Verified!' :
              status === 'error' ? 'Verification Failed' :
                'Verifying...'}
          </h2>

          <p className="text-slate-500 dark:text-slate-400 mb-8 text-lg leading-relaxed">
            {status === 'idle' && 'Preparing to verify your email address...'}
            {status === 'sending' && 'Please wait while we secure your account...'}
            {status === 'success' && message}
            {status === 'error' && message}
          </p>

          {status === 'success' && (
            <div className="space-y-6 animate-fade-in-up">
              <div className="relative w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div className="absolute top-0 left-0 h-full bg-green-500 rounded-full animate-[progress_3s_ease-in-out_forwards] w-full origin-left"></div>
              </div>

              <p className="text-sm font-medium text-slate-400 dark:text-slate-500">Redirecting to login automatically...</p>

              <button
                onClick={() => navigate('/login')}
                className="w-full py-4 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold hover:opacity-90 transition-all flex items-center justify-center gap-2 shadow-lg"
              >
                Go to Login Now <ArrowRight size={18} />
              </button>
            </div>
          )}

          {status === 'error' && (
            <div className="space-y-4 animate-fade-in-up">
              <button
                onClick={() => window.location.reload()}
                className="w-full py-4 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/25"
              >
                <RefreshCw size={18} /> Try Again
              </button>
              <button
                onClick={() => navigate('/login')}
                className="w-full py-4 rounded-xl border-2 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
              >
                Back to Login
              </button>
            </div>
          )}
        </div>
        <div className={`mt-8 text-center text-xs font-medium transition-colors duration-500 ${theme === 'dark' ? 'text-white/20' : 'text-slate-300'}`}>
          Secure Verification System
        </div>
      </div>
    </div>
  );
}

