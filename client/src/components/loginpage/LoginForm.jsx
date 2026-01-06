// client/src/components/loginpage/LoginForm.jsx

import { useState, useContext } from "react";
import { useNavigate, Link } from "react-router-dom";
import { AuthContext } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { useGoogleLogin } from "@react-oauth/google";
import axios from "axios";
import { Eye, EyeOff, Github, Linkedin } from "lucide-react";



const GoogleIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
);

const GitHubIcon = () => <Github size={20} />;
const LinkedInIcon = () => <Linkedin size={20} />;

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
    console.log("🔵 LOGIN SUBMIT:", formData);
    if (!isFormValid) return;

    try {
      const response = await login(formData);
      console.log("✅ Login response:", response);

      showToast("Login successful!", "success");

      // Wait a moment for AuthContext to update
      await new Promise(resolve => setTimeout(resolve, 100));

      // Check if there's a pending invite to redirect to
      const pendingInvite = localStorage.getItem('pendingInvite');
      if (pendingInvite) {
        navigate(`/join-workspace?token=${pendingInvite}`);
        return;
      }

      // 0. Priority Backend Instruction
      if (response.redirectTo) {
        console.log("🔀 Redirecting based on backend instruction:", response.redirectTo);
        navigate(response.redirectTo);
        return;
      }

      // 1. Check for Pending Verification
      console.log("🔍 Checking companyStatus:", response?.user?.companyStatus);
      if (response?.user?.companyStatus === 'pending' || response?.user?.companyStatus === 'pending_verification') {
        console.log("✅ Redirecting to pending verification page");
        navigate("/pending-verification");
        return;
      }

      // Determine redirect based on company status
      const hasCompany = response?.user?.companyId;
      const isAdmin = response?.isAdmin ||
        response?.user?.companyRole === 'owner' ||
        response?.user?.companyRole === 'admin';

      // Fallback Logic
      // User requested to always start at /workspaces (Personal Environment)
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
        console.log("✅ Google token saved to localStorage");

        // Then update context
        setUser(res.data.user);

        showToast("Google login successful!", "success");
        navigate("/workspaces");
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

      {/* OAuth Buttons */}
      <div className="grid grid-cols-3 gap-3">
        <button
          type="button"
          onClick={() => googleLogin()}
          className="flex items-center justify-center h-12 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
        >
          <GoogleIcon />
        </button>

        <button className="flex items-center justify-center h-12 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all text-slate-900 dark:text-white">
          <GitHubIcon />
        </button>

        <button className="flex items-center justify-center h-12 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all text-[#0077b5]">
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
