// client/src/components/loginpage/LoginForm.jsx

import { useState, useContext } from "react";
import { useNavigate, Link } from "react-router-dom";
import { AuthContext } from "../../contexts/AuthContext";
import { GoogleLogin } from "@react-oauth/google";
import axios from "axios";
import { saveAccessToken } from "../../utils/tokenUtils";

// Icons (using text/emoji for now, replace with real icons if available)
const GitHubIcon = () => <span>🐙</span>;
const LinkedInIcon = () => <span>💼</span>;

const LoginForm = ({ onSwitch }) => {
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const { login, setUser } = useContext(AuthContext);
  const navigate = useNavigate();

  const isFormValid = formData.email && formData.password.length >= 8;

  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isFormValid) return;

    try {
      await login(formData);
      // Navigate to workspace selection instead of direct home
      navigate("/workspaces");
    } catch (err) {
      alert(err.message || "Login failed");
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      const res = await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}/api/auth/google-login`,
        { credential: credentialResponse.credential },
        { withCredentials: true }
      );
      saveAccessToken(res.data.accessToken);
      setUser(res.data.user);
      navigate("/workspaces");
    } catch (err) {
      console.error("Google login failed:", err);
      alert("Google login failed");
    }
  };

  return (
    <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Welcome Back</h1>
        <p className="text-gray-500 mt-2">Enter your details to access your workspace.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Email */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input
            name="email"
            type="email"
            placeholder="name@company.com"
            required
            value={formData.email}
            onChange={handleChange}
            className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
          />
        </div>

        {/* Password */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="block text-sm font-medium text-gray-700">Password</label>
          </div>
          <div className="relative">
            <input
              name="password"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              required
              value={formData.password}
              onChange={handleChange}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
            >
              {showPassword ? "🙈" : "👁️"}
            </button>
          </div>
          <div className="flex justify-end mt-1">
            <Link to="/forgot-password" className="text-sm text-blue-600 hover:text-blue-700 font-medium">
              Forgot password?
            </Link>
          </div>
        </div>

        {/* Login Button */}
        <button
          type="submit"
          disabled={!isFormValid}
          className={`w-full py-3 rounded-lg text-white font-semibold text-lg shadow-md transition-all transform hover:-translate-y-0.5 ${isFormValid
              ? "bg-blue-600 hover:bg-blue-700 hover:shadow-lg"
              : "bg-gray-300 cursor-not-allowed"
            }`}
        >
          Log In
        </button>
      </form>

      {/* Divider */}
      <div className="relative my-8">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-200"></div>
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-4 bg-white text-gray-500">or login with</span>
        </div>
      </div>

      {/* OAuth Buttons */}
      <div className="grid grid-cols-3 gap-3">
        <div className="flex justify-center">
          {/* Google Button Wrapper to fit design */}
          <div className="overflow-hidden rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors flex justify-center items-center w-full h-12">
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => alert("Login Failed")}
              type="icon"
              shape="square"
            />
          </div>
        </div>

        <button className="flex items-center justify-center h-12 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-2xl">
          <GitHubIcon />
        </button>

        <button className="flex items-center justify-center h-12 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-2xl text-blue-700">
          <LinkedInIcon />
        </button>
      </div>

      {/* Footer */}
      <p className="text-center mt-8 text-gray-600">
        Don’t have an account?{" "}
        <button onClick={onSwitch} className="text-blue-600 font-semibold hover:underline">
          Sign up
        </button>
      </p>
    </div>
  );
};

export default LoginForm;
