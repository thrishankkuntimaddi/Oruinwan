// client/src/components/loginpage/LoginForm.jsx

import { useState, useContext } from "react";
import { useNavigate, Link } from "react-router-dom";
import { AuthContext } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { useGoogleLogin } from "@react-oauth/google";
import axios from "axios";
import { Eye, EyeOff } from "lucide-react";



const GoogleIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
);

const GitHubIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-1.455-3.795-1.455-.54-1.38-1.335-1.755-1.335-1.755-1.095-.75.09-.735.09-.735 1.215.09 1.845 1.245 1.845 1.245 1.08 1.86 2.805 1.32 3.495 1.005.105-.78.42-1.32.765-1.62-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405 1.02 0 2.04.135 3 .405 2.28-1.56 3.285-1.245 3.285-1.245.675 1.65.255 2.88.135 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.285 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
  </svg>
);

const LinkedInIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="#0077b5" xmlns="http://www.w3.org/2000/svg">
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
  </svg>
);



const LoginForm = ({ onSwitch, initialEmail = "" }) => {
  const [formData, setFormData] = useState({
    email: initialEmail,
    password: ""
  });
  const [showPassword, setShowPassword] = useState(false);
  const { login, setUser } = useContext(AuthContext);
  const { showToast } = useToast();
  const navigate = useNavigate();

  const isFormValid = formData.email && formData.password.length >= 8;

  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!isFormValid) return;

    try {
      const response = await login(formData.email, formData.password);


      showToast("Login successful!", "success");

      // Wait a moment for AuthContext to update
      await new Promise(resolve => setTimeout(resolve, 100));

      // ============================================================
      // ℹ️ Identity key initialization happens automatically in AuthContext.login()
      // NO identity init logic needed here - centralized in AuthContext
      // ============================================================

      // Check if there's a pending invite to redirect to
      const pendingInvite = localStorage.getItem('pendingInvite');
      if (pendingInvite) {
        navigate(`/join-workspace?token=${pendingInvite}`);
        return;
      }

      // 0. Priority Backend Instruction
      if (response.redirectTo) {

        navigate(response.redirectTo);
        return;
      }

      // 1. Check for Pending Verification

      if (response?.user?.companyStatus === 'pending' || response?.user?.companyStatus === 'pending_verification') {

        navigate("/pending-verification");
        return;
      }

      // 2. PRIORITY: Check for Platform Admin (chttrix_admin role)
      const isPlatformAdmin = response?.user?.roles?.includes('chttrix_admin');
      if (isPlatformAdmin) {

        navigate("/chttrix-admin");
        return;
      }

      // 3. Check company role and redirect accordingly
      const hasCompany = response?.user?.companyId;
      const companyRole = response?.user?.companyRole;

      if (hasCompany && companyRole) {
        // Company users - route to their dashboard based on role
        if (companyRole === 'owner') {

          navigate("/owner/dashboard");
          return;
        }
        if (companyRole === 'admin') {

          navigate("/admin/dashboard");
          return;
        }
        if (companyRole === 'manager') {

          navigate("/manager/dashboard");
          return;
        }
      }

      // 4. Fallback - Regular members and guests go to workspaces

      navigate("/workspaces");

    } catch (err) {
      console.error("🔴 Login Error:", err);
      showToast(err.message || "Login failed", "error");
    }
  };

  const googleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      try {
        const res = await axios.post(
          `${process.env.REACT_APP_BACKEND_URL}/api/auth/google-login`,
          { accessToken: tokenResponse.access_token },
          { withCredentials: true }
        );

        // Save to localStorage first
        localStorage.setItem("accessToken", res.data.accessToken);

        // Then update context
        setUser(res.data.user);


        showToast("Google login successful!", "success");

        // ============================================================
        // 🔐 PASSWORD SETUP CHECK (UX Flow - Decoupled from Phase 1)
        // ============================================================
        // NOTE: requiresPasswordSetup is UX-only
        // Identity keys are initialized via AuthContext.loadUser() on page mount
        // Password setup happens AFTER identity is established
        // ============================================================
        if (res.data.requiresPasswordSetup || res.data.isFirstLogin) {
          // Store flag in localStorage for the setup-password page
          localStorage.setItem("oauthPasswordSetupRequired", "true");
          localStorage.setItem("oauthProvider", "google");
          navigate("/set-password");
          return;
        }
        // ============================================================


        // ================================================================
        // NORMAL LOGIN FLOW - Password already set
        // ================================================================

        // Check if user is platform admin
        const isPlatformAdmin = res.data.user?.roles?.includes('chttrix_admin');
        if (isPlatformAdmin) {
          navigate("/chttrix-admin");
        } else if (res.data.user?.companyRole === 'owner') {
          navigate("/owner/dashboard");
        } else {
          navigate("/workspaces");
        }
      } catch (err) {
        console.error("Google login failed:", err);
        showToast("Google login failed", "error");
      }
    },
    onError: () => showToast("Login Failed", "error"),
  });

  return (
    <div className="w-full bg-transparent">
      <div className="mb-10">
        <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight mb-2">Welcome back</h2>
        <p className="text-slate-500 dark:text-slate-400">Enter your credentials to access your workspace.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Email */}
        <div className="space-y-1.5">
          <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">Email</label>
          <input
            name="email"
            type="email"
            placeholder="Enter your email"
            required
            value={formData.email}
            onChange={handleChange}
            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all duration-200"
          />
        </div>

        {/* Password */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center">
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">Password</label>
            <Link to="/forgot-password" className="text-sm font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 hover:underline">
              Forgot password?
            </Link>
          </div>
          <div className="relative group">
            <input
              name="password"
              type={showPassword ? "text" : "password"}
              placeholder="Enter your password"
              required
              value={formData.password}
              onChange={handleChange}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all duration-200"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-3.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
        </div>

        {/* Login Button */}
        <button
          type="submit"
          disabled={!isFormValid}
          className={`w-full py-3.5 rounded-xl text-white font-bold text-lg shadow-lg shadow-indigo-500/20 transition-all transform hover:-translate-y-1 hover:shadow-indigo-500/40 active:translate-y-0 ${isFormValid
            ? "bg-indigo-600 hover:bg-indigo-700"
            : "bg-slate-300 dark:bg-slate-700 cursor-not-allowed"
            }`}
        >
          Sign In
        </button>
      </form>

      {/* Divider */}
      <div className="relative my-8">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-slate-200 dark:border-slate-700"></div>
        </div>
        <div className="relative flex justify-center text-xs uppercase tracking-widest font-bold">
          <span className="px-4 bg-white dark:bg-[#030712] text-slate-400">Or continue with</span>
        </div>
      </div>

      {/* Social Login Buttons */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <button
          type="button"
          onClick={googleLogin}
          className="flex items-center justify-center gap-2 h-12 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
        >
          <GoogleIcon />
        </button>

        <button
          type="button"
          onClick={() => window.location.href = `${process.env.REACT_APP_BACKEND_URL}/api/auth/github`}
          className="flex items-center justify-center gap-2 h-12 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
        >
          <GitHubIcon />
        </button>

        <button
          type="button"
          onClick={() => window.location.href = `${process.env.REACT_APP_BACKEND_URL}/api/auth/linkedin`}
          className="flex items-center justify-center gap-2 h-12 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
        >
          <LinkedInIcon />
        </button>
      </div>

      {/* Footer */}
      <p className="text-center mt-8 text-sm text-slate-500 dark:text-slate-400">
        New to Chttrix?{" "}
        <button onClick={onSwitch} className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline">
          Create an account
        </button>
      </p>
    </div>
  );
};

export default LoginForm;
