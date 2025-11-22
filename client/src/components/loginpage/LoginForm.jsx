// client/src/components/loginpage/LoginForm.jsx

import { useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../../contexts/AuthContext";
import { GoogleLogin } from "@react-oauth/google";
import axios from "axios";
import { saveAccessToken } from "../../utils/tokenUtils";

const LoginForm = ({ onSwitch }) => {
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);

  const { login, setUser } = useContext(AuthContext); // <-- FIXED
  const navigate = useNavigate();

  const isPasswordValid =
    formData.password.length >= 8 && formData.password.length <= 16;

  const isFormValid = formData.email !== "" && isPasswordValid;

  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isFormValid) return;

    try {
      await login(formData);
      alert("Login successful!");
      navigate("/");
    } catch (err) {
      alert(err.message || "Login failed");
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold">Welcome to Chttrix</h2>
        <p className="mt-2 text-sm text-gray-600">
          Sign in to start collaborating on your next big idea.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Email */}
        <input
          name="email"
          type="email"
          placeholder="Enter your email"
          required
          value={formData.email}
          onChange={handleChange}
          className="block w-full px-4 py-2 border rounded-md"
        />

        {/* Password */}
        <div className="relative">
          <input
            name="password"
            type={showPassword ? "text" : "password"}
            placeholder="Enter your password"
            required
            value={formData.password}
            onChange={handleChange}
            className="block w-full px-4 py-2 border rounded-md"
          />

          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-2 text-xl"
          >
            {showPassword ? "🙈" : "👁️"}
          </button>
        </div>

        <p className="text-right text-sm">
          <a href="/forgot-password" className="text-blue-600 hover:underline">
            Forgot password?
          </a>
        </p>

        {/* Login Button */}
        <button
          type="submit"
          disabled={!isFormValid}
          className={`w-full py-2 px-4 rounded-md text-white font-medium ${
            isFormValid
              ? "bg-blue-600 hover:bg-blue-700"
              : "bg-gray-400 cursor-not-allowed"
          }`}
        >
          Login
        </button>

        {/* Google Login */}
        <div className="mt-4 flex justify-center">
          <GoogleLogin
            onSuccess={async (credentialResponse) => {
              try {
                const res = await axios.post(
                  `${process.env.BACKEND_URL}/api/auth/google-login`,
                  { credential: credentialResponse.credential },
                  { withCredentials: true }
                );

                saveAccessToken(res.data.accessToken);

                // Directly set user in context
                setUser(res.data.user);

                navigate("/");
              } catch (err) {
                console.error("Google login failed:", err);
                alert("Google login failed");
              }
            }}
            onError={() => alert("Google login failed")}
          />
        </div>
      </form>

      <p className="text-center text-sm">
        Don’t have an account?{" "}
        <button onClick={onSwitch} className="text-blue-600 hover:underline">
          Sign Up
        </button>
      </p>
    </div>
  );
};

export default LoginForm;
