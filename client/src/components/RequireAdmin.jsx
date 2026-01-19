// client/src/components/RequireAdmin.jsx
import { useContext } from "react";
import { Navigate } from "react-router-dom";
import { AuthContext } from "../contexts/AuthContext";
import LoadingScreen from "../shared/components/ui/LoadingScreen";

/**
 * RequireAdmin Component
 * Protects routes that should only be accessible to admin/owner users
 * 
 * Usage:
 *   <RequireAdmin>
 *     <CompanyAdmin />
 *   </RequireAdmin>
 */
export default function RequireAdmin({ children }) {
    const { user, loading } = useContext(AuthContext);

    // Still loading user data
    if (loading) {
        return <LoadingScreen />;
    }

    // No user logged in
    if (!user) {
        return <Navigate to="/login" replace />;
    }

    // Check if user is admin or owner
    const isAdmin = user.companyRole === 'admin' || user.companyRole === 'owner';

    // Not an admin - redirect to main app
    if (!isAdmin) {
        return <Navigate to="/app" replace />;
    }

    // User is admin or owner - allow access
    return children;
}
