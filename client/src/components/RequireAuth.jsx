import { useContext } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { AuthContext } from "../contexts/AuthContext";
import LoadingScreen from "../shared/components/ui/LoadingScreen";

export default function RequireAuth({ children }) {
  const { user, loading } = useContext(AuthContext);
  const location = useLocation();

  if (loading) return <LoadingScreen />;

  if (!user) return <Navigate to="/login" replace />;

  
  
  
  if (user.roles?.includes('chttrix_admin')) {
    return <Navigate to="/chttrix-admin" replace />;
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
