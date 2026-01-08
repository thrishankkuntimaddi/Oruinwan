// client/src/components/RequireOwner.jsx
import { useContext } from "react";
import { Navigate } from "react-router-dom";
import { AuthContext } from "../contexts/AuthContext";
import LoadingScreen from "./ui/LoadingScreen";

/**
 * RequireOwner Component
 * Protects routes that should ONLY be accessible to company owners
 * 
 * Usage:
 *   <RequireOwner>
 *     <OwnerDashboard />
 *   </RequireOwner>
 */
export default function RequireOwner({ children }) {
    const { user, loading } = useContext(AuthContext);

    // Still loading user data
    if (loading) {
        return <LoadingScreen />;
    }

    // No user logged in
    if (!user) {
        return <Navigate to="/login" replace />;
    }

    // Check if user is owner
    const isOwner = user.companyRole === 'owner';

    // Not an owner - redirect to workspaces
    if (!isOwner) {
        console.warn("🚫 Access denied: User is not a company owner");
        return <Navigate to="/workspaces" replace />;
    }

    // User is owner - allow access
    console.log("✅ Owner access granted");
    return children;
}
