// client/src/pages/LoginPageComp/ForgotPassword.jsx
import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import { Mail, ArrowLeft, Key, CheckCircle2, Sun, Moon } from "lucide-react";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

  // Redirect logged-in users
  useEffect(() => {
    if (user) {
      navigate("/", { replace: true });
    }
  }, [user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setSent(true);
    } catch (error) {
      console.error("Forgot Password Error:", error);
    }
  };

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
        <div className="backdrop-blur-xl bg-white/70 dark:bg-[#0B0F19]/60 border border-white/50 dark:border-white/10 shadow-2xl rounded-3xl p-8 md:p-10 transition-all duration-300">

          <div className="text-center mb-10">
            <div className={`w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-6 shadow-lg rotate-3 transition-colors duration-500 ${sent ? 'bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400' : 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400'}`}>
              {sent ? <CheckCircle2 size={32} /> : <Key size={32} />}
            </div>
            <h1 className="text-3xl font-black text-slate-900 dark:text-white mb-3">
              {sent ? "Check your inbox" : "Forgot Password?"}
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-lg leading-relaxed">
              {!sent ? "Enter your email details to receive a reset link." : `We sent a reset link to ${email}`}
            </p>
          </div>

          {!sent ? (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 ml-1">Email Address</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                    <Mail size={20} />
                  </div>
                  <input
                    type="email"
                    placeholder="name@company.com"
                    className="w-full pl-12 pr-4 py-4 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-[#030712]/50 text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all font-medium"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-4 rounded-xl text-white font-bold text-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 transform hover:-translate-y-0.5 transition-all"
              >
                Send Reset Link
              </button>

              <div className="text-center mt-6">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-white font-bold transition-colors"
                >
                  <ArrowLeft size={16} /> Back to Sign In
                </Link>
              </div>
            </form>
          ) : (
            <div className="space-y-6">

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-sm text-slate-600 dark:text-slate-300 text-center leading-relaxed">
                Didn't receive the email? Check your spam filter or try another email address.
              </div>

              <button
                onClick={() => setSent(false)}
                className="w-full py-4 rounded-xl border-2 border-slate-200 dark:border-white/10 text-slate-700 dark:text-white font-bold hover:bg-slate-50 dark:hover:bg-white/5 transition-all"
              >
                Try different email
              </button>

              <div className="text-center">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-white font-bold transition-colors"
                >
                  <ArrowLeft size={16} /> Back to Sign In
                </Link>
              </div>

            </div>
          )}
        </div>

        <div className={`mt-8 text-center text-xs font-medium transition-colors duration-500 ${theme === 'dark' ? 'text-white/20' : 'text-slate-300'}`}>
          Secure Authentication System
        </div>

      </div>
    </div>
  );
}
