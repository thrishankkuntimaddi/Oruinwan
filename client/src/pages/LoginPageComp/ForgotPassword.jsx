// client/src/pages/LoginPageComp/ForgotPassword.jsx
import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  // Redirect logged-in users
  useEffect(() => {
    if (user) {
      navigate("/", { replace: true });
    }
  }, [user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/auth/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setSent(true);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Forgot Password</h1>
          <p className="text-gray-500 mt-2 text-sm">
            {!sent ? "Enter your email to receive a reset link." : "Check your inbox for the reset link."}
          </p>
        </div>

        {!sent ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                placeholder="Enter your email"
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 rounded-lg text-white font-semibold text-base shadow-md transition-all transform hover:-translate-y-0.5 bg-blue-600 hover:bg-blue-700 hover:shadow-lg mt-2"
            >
              Send Reset Link
            </button>

            <div className="text-center mt-4">
              <Link
                to="/login"
                className="text-xs text-blue-600 hover:text-blue-700 font-medium hover:underline"
              >
                ← Back to Login
              </Link>
            </div>
          </form>
        ) : (
          <div className="text-center space-y-6">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <span className="text-3xl">✉️</span>
            </div>

            <div className="bg-green-50 border border-green-100 rounded-lg p-4">
              <p className="text-green-800 text-sm font-medium">
                If an account exists for <span className="font-bold">{email}</span>, you will receive a reset link shortly.
              </p>
            </div>

            <button
              onClick={() => navigate('/login')}
              className="w-full py-2.5 rounded-lg text-white font-semibold text-base shadow-md transition-all transform hover:-translate-y-0.5 bg-blue-600 hover:bg-blue-700 hover:shadow-lg"
            >
              Back to Login
            </button>

            <button
              onClick={() => setSent(false)}
              className="text-xs text-gray-500 hover:text-gray-700 underline"
            >
              Try a different email
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
