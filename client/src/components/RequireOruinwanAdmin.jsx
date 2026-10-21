import { useContext } from "react";
import { Navigate } from "react-router-dom";
import { AuthContext } from "../contexts/AuthContext";
import LoadingScreen from "../shared/components/ui/LoadingScreen";
import logger from '../utils/logger';

export default function RequireOruinwanAdmin({ children }) {
    const { user, loading } = useContext(AuthContext);

    
    if (loading) {
        return <LoadingScreen />;
    }

    
    if (!user) {
        return <Navigate to="/login" replace />;
    }

    
    const isOruinwanAdmin = user.roles && user.roles.includes('oruinwan_admin');

    
    if (!isOruinwanAdmin) {
        logger.warn("🚫 Access denied: User does not have oruinwan_admin role");
        return <Navigate to="/workspaces" replace />;
    }

    

    return children;
}
