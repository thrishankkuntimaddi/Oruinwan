import React, { useState } from "react";
import LoginForm from "../components/loginpage/LoginForm";
import SignupForm from "../components/loginpage/SignupForm";

const LoginPage = () => {
  const [isSignup, setIsSignup] = useState(false);

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
