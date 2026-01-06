import React, { useState, useEffect } from "react";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { ArrowLeft, CheckCircle, Sparkles, Command, Shield, Moon, Sun } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import LoginForm from "../../components/loginpage/LoginForm";
import SignupForm from "../../components/loginpage/SignupForm";
import { useTheme } from "../../contexts/ThemeContext";

const LoginPage = () => {
  const [searchParams] = useSearchParams();
  const mode = searchParams.get("mode");
  const [isSignup, setIsSignup] = useState(mode === "signup");

  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, toggleTheme } = useTheme(); // Ensure theme consistency

  // Get message and email from navigation state (from registration)
  const registrationMessage = location.state?.message;
  const prefilledEmail = location.state?.email;

  useEffect(() => {
    if (mode === "signup") {
      setIsSignup(true);
    } else {
      setIsSignup(false);
    }
  }, [mode]);

  // Redirect to home if already logged in
  useEffect(() => {
    if (!loading && user) {
      navigate("/workspaces", { replace: true });
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-[#030712] text-slate-500">
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-12 h-12 bg-gray-200 dark:bg-gray-800 rounded-full mb-4"></div>
          <p>Loading session...</p>
        </div>
      </div>
    );
  }

  if (user) return null;

  return (
    <div className="min-h-screen w-full flex bg-white dark:bg-[#030712] selection:bg-indigo-500 selection:text-white">

      {/* LEFT SIDE - BRAND PRESENTATION (Desktop Only) */}
      <div className={`hidden lg:flex lg:w-1/2 relative overflow-hidden flex-col justify-between p-16 transition-colors duration-500 ${theme === 'dark' ? 'bg-[#0B0F19]' : 'bg-slate-50'}`}>

        {/* --- Background Effects (Theme Dependent) --- */}

        {/* Dark Mode Background */}
        <div className={`absolute inset-0 transition-opacity duration-500 ${theme === 'dark' ? 'opacity-100' : 'opacity-0'}`}>
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-purple-600/30 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/2"></div>
          <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-indigo-600/20 rounded-full blur-[120px] translate-y-1/2 -translate-x-1/2"></div>
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150"></div>
        </div>

        {/* Light Mode Background (Orbs) */}
        <div className={`absolute inset-0 transition-opacity duration-500 ${theme === 'dark' ? 'opacity-0' : 'opacity-100'}`}>
          <style>{`
                @keyframes float { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(0, -20px); } }
                @keyframes float-delayed { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(0, 20px); } }
                .animate-float { animation: float 10s ease-in-out infinite; }
                .animate-float-delayed { animation: float-delayed 12s ease-in-out infinite; }
            `}</style>
          <div className="absolute -top-[10%] -left-[10%] w-[60%] h-[60%] rounded-full bg-gradient-to-br from-blue-100/80 via-purple-100/50 to-transparent blur-[80px] animate-float"></div>
          <div className="absolute top-[20%] -right-[10%] w-[50%] h-[50%] rounded-full bg-gradient-to-bl from-indigo-100/80 via-pink-100/50 to-transparent blur-[80px] animate-float-delayed"></div>
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-50 brightness-100 contrast-150 mix-blend-soft-light"></div>
        </div>

        {/* --- Content --- */}
        <div className="relative z-10">
          <div onClick={() => navigate('/')} className="cursor-pointer flex items-center gap-3 mb-12 group w-fit">
            <img src="/chttrix-logo.jpg" alt="Logo" className="w-10 h-10 rounded-xl shadow-md group-hover:scale-110 transition-transform duration-300" />
            <span className={`text-2xl font-bold tracking-tight transition-colors duration-500 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Chttrix</span>
          </div>

          <h1 className={`text-6xl font-black leading-tight mb-8 transition-colors duration-500 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
            Work where <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-purple-600 dark:from-indigo-400 dark:to-purple-400">future happens.</span>
          </h1>
          <p className={`text-xl max-w-lg leading-relaxed font-medium transition-colors duration-500 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
            The operating system for high-performance teams.
            Seamlessly switch between structured channels, video huddles, and AI-powered workflows.
          </p>
        </div>

        {/* --- Features Grid (Theme Adoptive Cards) --- */}
        <div className="relative z-10 grid grid-cols-2 gap-6 mt-12">
          {/* Card 1 */}
          <div className={`p-6 rounded-2xl border backdrop-blur-sm transition-all duration-500 ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-white/40 border-white/50 shadow-lg shadow-indigo-100'}`}>
            <Sparkles className="text-purple-500 dark:text-purple-400 mb-4" size={24} />
            <h3 className={`font-bold text-lg mb-2 transition-colors duration-500 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>AI Native</h3>
            <p className={`text-sm transition-colors duration-500 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>Built with intelligence at the core, not as an afterthought.</p>
          </div>

          {/* Card 2 */}
          <div className={`p-6 rounded-2xl border backdrop-blur-sm transition-all duration-500 ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-white/40 border-white/50 shadow-lg shadow-indigo-100'}`}>
            <Shield className="text-indigo-500 dark:text-indigo-400 mb-4" size={24} />
            <h3 className={`font-bold text-lg mb-2 transition-colors duration-500 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Enterprise Ready</h3>
            <p className={`text-sm transition-colors duration-500 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>Bank-grade security with granular role-based access control.</p>
          </div>
        </div>

        <div className={`relative z-10 text-xs mt-12 transition-colors duration-500 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
          © 2025 Chttrix Inc. All rights reserved.
        </div>
      </div>

      {/* RIGHT SIDE - AUTH FORMS */}
      <div className="w-full lg:w-1/2 flex flex-col items-center justify-center p-6 sm:p-8 relative">

        {/* Toggle Theme (Top Right) */}
        <div className="absolute top-6 right-6">
          <button
            onClick={toggleTheme}
            className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </div>

        {/* Mobile Header */}
        <div className="absolute top-6 left-6 lg:hidden">
          <button onClick={() => navigate('/')} className="flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-indigo-600 transition-colors">
            <ArrowLeft size={18} /> Back
          </button>
        </div>

        <div className="w-full max-w-md space-y-8">

          {/* Registration Success Message */}
          {registrationMessage && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4 flex items-start gap-4 animate-fade-in-up">
              <div className="p-2 bg-green-100 dark:bg-green-800 rounded-full shrink-0">
                <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-300" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-green-900 dark:text-green-100">Account Created</h3>
                <p className="text-sm text-green-700 dark:text-green-300 mt-1">{registrationMessage}</p>
                {prefilledEmail && (
                  <p className="text-xs text-green-600 dark:text-green-400 mt-2 font-mono bg-green-100 dark:bg-green-800/50 px-2 py-1 rounded w-fit">
                    {prefilledEmail}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Forms */}
          <div className="transition-all duration-500 ease-in-out">
            {isSignup ? (
              <SignupForm onSwitch={() => setIsSignup(false)} />
            ) : (
              <LoginForm
                onSwitch={() => setIsSignup(true)}
                initialEmail={prefilledEmail}
              />
            )}
          </div>

        </div>
      </div>
    </div>
  );
};

export default LoginPage;
