import { useContext } from "react";
import { Navigate } from "react-router-dom";
import { AuthContext } from "../contexts/AuthContext";
import LoadingScreen from "../shared/components/ui/LoadingScreen";
import logger from '../utils/logger';

export default function RequireChttrixAdmin({ children }) {
    const { user, loading } = useContext(AuthContext);

    
    if (loading) {
        return <LoadingScreen />;
    }

    
    if (!user) {
        return <Navigate to="/login" replace />;
    }

    
    const isChttrixAdmin = user.roles && user.roles.includes('chttrix_admin');

    
    if (!isChttrixAdmin) {
        logger.warn("🚫 Access denied: User does not have chttrix_admin role");
        return <Navigate to="/workspaces" replace />;
    }

    

    return children;
}
