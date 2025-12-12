import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft, CheckCircle } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import LoginForm from "../../components/loginpage/LoginForm";
import SignupForm from "../../components/loginpage/SignupForm";

const LoginPage = () => {
  const [isSignup, setIsSignup] = useState(false);
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Get message and email from navigation state (from registration)
  const registrationMessage = location.state?.message;
  const prefilledEmail = location.state?.email;

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
        {/* Registration Success Message */}
        {registrationMessage && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3 animate-fade-in">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-green-800">{registrationMessage}</p>
              {prefilledEmail && (
                <p className="text-xs text-green-600 mt-1">Email: {prefilledEmail}</p>
              )}
            </div>
          </div>
        )}

        {isSignup ? (
          <SignupForm onSwitch={() => setIsSignup(false)} />
        ) : (
          <LoginForm
            onSwitch={() => setIsSignup(true)}
            initialEmail={prefilledEmail}
          />
        )}
      </div>
    </div>
  );
};

export default LoginPage;
