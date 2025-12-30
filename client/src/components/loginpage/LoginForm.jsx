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

      // Determine redirect based on company status
      const hasCompany = response?.user?.companyId;
      const isAdmin = response?.isAdmin ||
        response?.user?.companyRole === 'owner' ||
        response?.user?.companyRole === 'admin';

      const company = response?.company || {};
      const isSetupComplete = company.isSetupComplete;

      if (hasCompany) {
        if (isAdmin && !isSetupComplete) {
          // Redirect to setup flow
          if (!company.setupStep || company.setupStep === 0) {
            navigate("/company/confirm");
          } else {
            navigate("/company/setup");
          }
        } else {
          navigate("/workspaces");
        }
      } else if (isAdmin) {
        navigate("/admin/company"); // Edge case for admin without company structure (unlikely in new flow)
      } else {
        navigate("/workspaces");
      }

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
    <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-5 border border-gray-100">
      <div className="text-center mb-5">
        <h1 className="text-xl font-bold text-gray-900 tracking-tight">Welcome to Chttrix</h1>
        <p className="text-gray-500 mt-1.5 text-xs">Enter your details to access your workspace.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Email */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
          <input
            name="email"
            type="email"
            placeholder="Enter your email"
            required
            value={formData.email}
            onChange={handleChange}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm text-gray-900 bg-white"
          />
        </div>

        {/* Password */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="block text-xs font-medium text-gray-700">Password</label>
          </div>
          <div className="relative">
            <input
              name="password"
              type={showPassword ? "text" : "password"}
              placeholder="Enter your password"
              required
              value={formData.password}
              onChange={handleChange}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm text-gray-900 bg-white"
            />


            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-2 text-gray-400 hover:text-gray-600"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <div className="flex justify-end mt-1">
            <Link to="/forgot-password" className="text-xs text-blue-600 hover:text-blue-700 font-medium">
              Forgot password?
            </Link>
          </div>
        </div>

        {/* Login Button */}
        <button
          type="submit"
          disabled={!isFormValid}
          className={`w-full py-2 rounded-lg text-white font-semibold text-sm shadow-md transition-all transform hover:-translate-y-0.5 ${isFormValid
            ? "bg-blue-600 hover:bg-blue-700 hover:shadow-lg"
            : "bg-gray-300 cursor-not-allowed"
            }`}
        >
          Log In
        </button>
      </form>

      {/* Divider */}
      <div className="relative my-5">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-200"></div>
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="px-4 bg-white text-gray-500 text-xs">or login with</span>
        </div>
      </div>

      {/* OAuth Buttons */}
      <div className="grid grid-cols-3 gap-2">
        <div className="flex justify-center">
          {/* Google Button Wrapper to fit design */}
          <button
            type="button"
            onClick={() => googleLogin()}
            className="flex items-center justify-center w-full h-9 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <GoogleIcon />
          </button>
        </div>

        <button className="flex items-center justify-center h-9 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-lg">
          <GitHubIcon />
        </button>

        <button className="flex items-center justify-center h-9 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-lg text-blue-700">
          <LinkedInIcon />
        </button>
      </div>

      {/* Footer */}
      <p className="text-center mt-5 text-xs text-gray-600">
        Don’t have an account?{" "}
        <button onClick={onSwitch} className="text-blue-600 font-semibold hover:underline">
          Sign up
        </button>
      </p>
    </div>
  );
};

export default LoginForm;
