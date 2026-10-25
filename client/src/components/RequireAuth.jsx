import { useContext } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { AuthContext } from "../contexts/AuthContext";
import LoadingScreen from "../shared/components/ui/LoadingScreen";
import { rememberReturn } from "../utils/returnTo";

export default function RequireAuth({ children }) {
  const { user, loading } = useContext(AuthContext);
  const location = useLocation();

  if (loading) return <LoadingScreen />;

  if (!user) {
    // A shared link: come back to it after signing in.
    rememberReturn(`${location.pathname}${location.search}`);
    return <Navigate to="/login" replace />;
  }

  
  
  
  if (user.roles?.includes('oruinwan_admin')) {
    return <Navigate to="/platform-admin" replace />;
  }

  
  
  
  
  
  if (
    user.isTemporaryPassword === true &&
    user.passwordInitialized === false &&
    location.pathname !== "/setup-password"
  ) {
    return <Navigate to="/setup-password" replace />;
  }
  

  return children;
}
