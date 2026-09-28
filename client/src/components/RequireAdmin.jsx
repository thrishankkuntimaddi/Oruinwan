import { useContext } from "react";
import { Navigate } from "react-router-dom";
import { AuthContext } from "../contexts/AuthContext";
import LoadingScreen from "../shared/components/ui/LoadingScreen";
import { isAdminUser } from "./company-dash/dashNav";

export default function RequireAdmin({ children }) {
    const { user, loading } = useContext(AuthContext);

    
    if (loading) {
        return <LoadingScreen />;
    }

    
    if (!user) {
        return <Navigate to="/login" replace />;
    }

    
    const isAdmin = isAdminUser(user);

    
    if (!isAdmin) {
        return <Navigate to="/workspaces" replace />;
    }

    
    return children;
}
