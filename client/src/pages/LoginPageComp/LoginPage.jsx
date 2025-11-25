import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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
      navigate("/", { replace: true });
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
    <div className="min-h-screen flex items-center justify-center bg-white px-4 sm:px-6 lg:px-8">
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
