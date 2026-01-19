// client/src/components/RequireChttrixAdmin.jsx
import { useContext } from "react";
import { Navigate } from "react-router-dom";
import { AuthContext } from "../contexts/AuthContext";
import LoadingScreen from "../shared/components/ui/LoadingScreen";

/**
 * RequireChttrixAdmin Component
 * Protects routes that should only be accessible to Chttrix super administrators
 * 
 * This component checks if the logged-in user has the 'chttrix_admin' role.
 * Only users with this role can access the Chttrix admin dashboard for verifying companies.
 * 
 * Usage:
 *   <RequireChttrixAdmin>
 *     <ChttrixAdminDashboard />
 *   </RequireChttrixAdmin>
 */
export default function RequireChttrixAdmin({ children }) {
    const { user, loading } = useContext(AuthContext);

    // Still loading user data
    if (loading) {
        return <LoadingScreen />;
    }

    // No user logged in - redirect to login
    if (!user) {
        return <Navigate to="/login" replace />;
    }

    // Check if user has chttrix_admin role
    const isChttrixAdmin = user.roles && user.roles.includes('chttrix_admin');

    // Not a Chttrix admin - redirect to workspaces
    if (!isChttrixAdmin) {
        console.warn("🚫 Access denied: User does not have chttrix_admin role");
        return <Navigate to="/workspaces" replace />;
    }

    // User is Chttrix admin - allow access

    return children;
}
