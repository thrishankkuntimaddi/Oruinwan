import { useEffect, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { saveAccessToken } from "../../utils/tokenUtils";
import logger from '../../utils/logger';

// Server redirects to `/oauth-success#access=<token>` (fragment: never sent to
// servers, logged, or leaked via Referer). Legacy `?access=` is still accepted
// during the transition.
function readOAuthParams() {
  if (typeof window === 'undefined') return { access: null, requiresPasswordSetup: false };
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const query = new URLSearchParams(window.location.search);
  const access = hash.get('access') || query.get('access');
  const requiresPasswordSetup =
    (hash.get('requiresPasswordSetup') || query.get('requiresPasswordSetup')) === 'true';
  return { access, requiresPasswordSetup };
}

function scrubTokenFromUrl() {
  try {
    window.history.replaceState(window.history.state, '', window.location.pathname);
  } catch {
    // ignore (non-browser environment)
  }
}

export default function OAuthSuccess() {
  const { loadUser } = useAuth();
  const navigate = useNavigate();
  // Read once on mount, then remove the token from the address bar/history.
  const [{ access, requiresPasswordSetup }] = useState(readOAuthParams);
  const [isProcessing, setIsProcessing] = useState(false);
  const [loadAttempts, setLoadAttempts] = useState(0);

  useEffect(() => {
    scrubTokenFromUrl();
    if (!access) {
      logger.warn('OAuth success page reached without an access token');
      navigate("/login", { replace: true });
    }
  }, [access, navigate]);

  useEffect(() => {
    if (!access || isProcessing) return;

    const handleOAuth = async () => {
      setIsProcessing(true);

      try {
        saveAccessToken(access);
        await loadUser();
        await new Promise(resolve => setTimeout(resolve, 500));

        navigate(requiresPasswordSetup ? "/set-password" : "/workspaces", { replace: true });
      } catch (error) {
        logger.error("❌ OAuth error:", error);

        if (loadAttempts < 1) {
          setLoadAttempts(prev => prev + 1);
          setIsProcessing(false);
          return;
        }

        navigate("/login", { replace: true });
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
