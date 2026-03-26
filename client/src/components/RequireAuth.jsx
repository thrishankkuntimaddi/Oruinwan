import { useContext } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { AuthContext } from "../contexts/AuthContext";
import LoadingScreen from "../shared/components/ui/LoadingScreen";

export default function RequireAuth({ children }) {
  const { user, loading } = useContext(AuthContext);
  const location = useLocation();

  if (loading) return <LoadingScreen />;

  if (!user) return <Navigate to="/login" replace />;

  // STRICT ACCESS CONTROL:
  // Chttrix Super Admins are RESTRICTED to /chttrix-admin only.
  // They should not access user workspaces or dashboards.
  if (user.roles?.includes('chttrix_admin')) {
    return <Navigate to="/chttrix-admin" replace />;
  }

  // ── BULK-IMPORT FIRST-LOGIN GATE ─────────────────────────────────────────
  // If the user has a temporary (system-generated) password and has not yet
  // initialized their own, block access to every protected route and force
  // them through the mandatory password-setup page.
  // The path check prevents an infinite redirect loop on /setup-password itself.
  if (
    user.isTemporaryPassword === true &&
    user.passwordInitialized === false &&
    location.pathname !== "/setup-password"
  ) {
    return <Navigate to="/setup-password" replace />;
  }
  // ─────────────────────────────────────────────────────────────────────────

  return children;
}

