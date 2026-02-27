
// client/src/pages/LoginPageComp/ResetPassword.jsx
import React, { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useToast } from "../../contexts/ToastContext";
import { useTheme } from "../../contexts/ThemeContext";
import { Eye, EyeOff, Check, Lock, Sun, Moon, ShieldCheck } from "lucide-react";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { theme, toggleTheme } = useTheme();

  const token = params.get("token");
  const email = params.get("email");

  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);

  // Password Rules Logic
  const passwordRules = {
    length: newPassword.length >= 8 && newPassword.length <= 16,
    upper: /[A-Z]/.test(newPassword),
    number: /[0-9]/.test(newPassword),
    special: /[^A-Za-z0-9]/.test(newPassword)
  };

  const calculateStrength = () => {
    let score = 0;
    if (passwordRules.length) score++;
    if (passwordRules.upper) score++;
    if (passwordRules.number) score++;
    if (passwordRules.special) score++;
    return score;
  };

  const strength = calculateStrength();
  const strengthColor = ["bg-slate-200 dark:bg-slate-700", "bg-red-500", "bg-yellow-500", "bg-blue-500", "bg-green-500"];
  const strengthText = ["Too Weak", "Weak", "Fair", "Good", "Strong"];
  const isPasswordStrong = strength === 4;

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (newPassword !== confirm) {
      showToast("Passwords do not match", "error");
      return;
    }
    if (!isPasswordStrong) {
      showToast("Password does not meet requirements", "error");
      return;
    }

    try {
      const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, email, password: newPassword }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Reset failed");
      }

      showToast("Password reset successful! Please login.", "success");
      navigate("/login");
    } catch (err) {
      showToast(err.message, "error");
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

          <div className="text-center mb-8">
            <div className="w-16 h-16 mx-auto bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center mb-6 shadow-lg rotate-3">
              <ShieldCheck size={32} />
            </div>
            <h1 className="text-3xl font-black text-slate-900 dark:text-white mb-2">Reset Password</h1>
            <p className="text-slate-500 dark:text-slate-400 font-medium">Create a strong password to secure your account.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* New Password */}
            <div className="space-y-2">
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 ml-1">New Password</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                  <Lock size={20} />
                </div>
                <input
                  type={showPwd ? "text" : "password"}
                  placeholder="Create new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full pl-12 pr-12 py-4 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-[#030712]/50 text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all font-medium"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                >
                  {showPwd ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>

              {/* Password Strength Meter */}
              {newPassword && (
                <div className="pt-2 px-1 transition-all duration-300 ease-in-out">
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-slate-500 dark:text-slate-400 font-medium">Password Strength</span>
                    <span className={`font-bold ${strength === 4 ? 'text-green-500' : 'text-slate-400'}`}>
                      {strengthText[strength]}
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${strengthColor[strength]} transition-all duration-500 ease-out`}
                      style={{ width: `${(strength / 4) * 100}%` }}
                    ></div>
                  </div>

                  {/* Rules Checklist */}
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <div className={`flex items-center gap-1.5 transition-colors ${passwordRules.length ? "text-green-500 font-bold" : ""}`}>
                      <span className="text-[10px]">{passwordRules.length ? "●" : "○"}</span> 8-16 chars
                    </div>
                    <div className={`flex items-center gap-1.5 transition-colors ${passwordRules.upper ? "text-green-500 font-bold" : ""}`}>
                      <span className="text-[10px]">{passwordRules.upper ? "●" : "○"}</span> Uppercase
                    </div>
                    <div className={`flex items-center gap-1.5 transition-colors ${passwordRules.number ? "text-green-500 font-bold" : ""}`}>
                      <span className="text-[10px]">{passwordRules.number ? "●" : "○"}</span> Number
                    </div>
                    <div className={`flex items-center gap-1.5 transition-colors ${passwordRules.special ? "text-green-500 font-bold" : ""}`}>
                      <span className="text-[10px]">{passwordRules.special ? "●" : "○"}</span> Special char
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div className="space-y-2">
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 ml-1">Confirm Password</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                  <Lock size={20} />
                </div>
                <input
                  type={showConfirmPwd ? "text" : "password"}
                  placeholder="Confirm new password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className={`w-full pl-12 pr-12 py-4 rounded-xl border bg-slate-50/50 dark:bg-[#030712]/50 text-slate-900 dark:text-white placeholder:text-slate-400 outline-none transition-all font-medium ${confirm && newPassword !== confirm
                    ? "border-red-500 focus:ring-2 focus:ring-red-500/20"
                    : "border-slate-200 dark:border-white/10 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                    }`}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPwd(!showConfirmPwd)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                >
                  {showConfirmPwd ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              {confirm && newPassword === confirm && (
                <div className="flex items-center gap-1.5 ml-1 mt-1 text-green-500 text-xs font-bold animate-fade-in-up">
                  <Check size={14} strokeWidth={3} />
                  <span>Passwords match</span>
                </div>
              )}
              {confirm && newPassword !== confirm && (
                <p className="text-red-500 text-xs font-bold ml-1 mt-1 animate-fade-in-up">Passwords do not match</p>
              )}
            </div>

            <button
              type="submit"
              disabled={!isPasswordStrong || newPassword !== confirm}
              className={`w-full py-4 rounded-xl text-white font-bold text-lg shadow-lg transform transition-all mt-4 ${isPasswordStrong && newPassword === confirm
                ? "bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:-translate-y-0.5"
                : "bg-slate-300 dark:bg-slate-800 text-slate-500 dark:text-slate-500 cursor-not-allowed shadow-none"
                }`}
            >
              Reset Password
            </button>
          </form>
        </div>

        <div className={`mt-8 text-center text-xs font-medium transition-colors duration-500 ${theme === 'dark' ? 'text-white/20' : 'text-slate-300'}`}>
          Secure Password Reset
        </div>

      </div>
    </div>
  );
}
