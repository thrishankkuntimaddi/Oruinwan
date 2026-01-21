import { useEffect, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useNavigate, useSearchParams } from "react-router-dom";
import { saveAccessToken } from "../../utils/tokenUtils";

export default function OAuthSuccess() {
  const { loadUser } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [isProcessing, setIsProcessing] = useState(false);
  const [loadAttempts, setLoadAttempts] = useState(0);

  const access = params.get("access");
  const requiresPasswordSetup = params.get("requiresPasswordSetup") === 'true';

  useEffect(() => {
    if (!access || isProcessing) return;

    const handleOAuth = async () => {
      setIsProcessing(true);

      try {
        // Store access token to localStorage
        saveAccessToken(access);


        // Load user data - this updates the AuthContext
        await loadUser();


        // Wait a bit for context to update
        await new Promise(resolve => setTimeout(resolve, 500));



        // Check if password setup is required
        if (requiresPasswordSetup) {
          navigate("/set-password");
        } else {
          // Redirect to workspaces page
          navigate("/workspaces");
        }
      } catch (error) {
        console.error("❌ OAuth error:", error);

        // Retry once if first attempt fails
        if (loadAttempts < 1) {

          setLoadAttempts(prev => prev + 1);
          setIsProcessing(false);
          return;
        }

        navigate("/login");
      }
    };

    handleOAuth();
  }, [access, loadUser, navigate, isProcessing, loadAttempts, requiresPasswordSetup]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600 font-medium">Logging you in...</p>
        {loadAttempts > 0 && (
          <p className="text-gray-500 text-sm mt-2">Verifying session...</p>
        )}
      </div>
    </div>
  );
}
