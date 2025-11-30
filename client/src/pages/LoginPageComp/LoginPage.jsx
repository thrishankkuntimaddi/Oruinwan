import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import LoginForm from "../../components/loginpage/LoginForm";
import SignupForm from "../../components/loginpage/SignupForm";

const LoginPage = () => {
  const [isSignup, setIsSignup] = useState(false);
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  // Redirect to home if already logged in
  useEffect(() => {
    if (!loading && user) {
      console.log("✅ User already logged in, redirecting to home");
      navigate("/workspaces", { replace: true });
    }
  }, [user, loading, navigate]);

  // Show loading while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600">Loading...</p>
      </div>
    );
  }

  // Don't render login form if user is authenticated (will redirect)
  if (user) return null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-4 sm:px-6 lg:px-8 relative">
      <button
        onClick={() => navigate("/")}
        className="absolute top-6 left-6 flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-full shadow-sm hover:text-gray-900 hover:border-gray-300 hover:shadow-md transition-all duration-200 group"
      >
        <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
        Back to Home
      </button>
      <div className="max-w-md w-full space-y-8">
        {isSignup ? (
          <SignupForm onSwitch={() => setIsSignup(false)} />
        ) : (
          <LoginForm onSwitch={() => setIsSignup(true)} />
        )}
      </div>
    </div>
  );
};

export default LoginPage;
