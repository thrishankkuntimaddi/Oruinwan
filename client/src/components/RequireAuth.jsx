import { useContext } from "react";
import { Navigate } from "react-router-dom";
import { AuthContext } from "../contexts/AuthContext";
import LoadingScreen from "../shared/components/ui/LoadingScreen";

export default function RequireAuth({ children }) {
  const { user, loading } = useContext(AuthContext);

  if (loading) return <LoadingScreen />;

  if (!user) return <Navigate to="/login" replace />;

  // STRICT ACCESS CONTROL:
  // Chttrix Super Admins are RESTRICTED to /chttrix-admin only.
  // They should not access user workspaces or dashboards.
  if (user.roles?.includes('chttrix_admin')) {
    return <Navigate to="/chttrix-admin" replace />;
  }

  return children;
}
