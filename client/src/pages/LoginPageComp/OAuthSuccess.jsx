import { useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useNavigate, useSearchParams } from "react-router-dom";
import { saveAccessToken } from "../../utils/tokenUtils";

export default function OAuthSuccess() {
  const { loadUser } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const access = params.get("access");

  useEffect(() => {
    if (!access) return;

    // store access token
    saveAccessToken(access);

    loadUser();
    navigate("/");
  }, [access, loadUser, navigate]);

  return <div className="text-center mt-20">Logging you in...</div>;
}
