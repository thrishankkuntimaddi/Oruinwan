import { useContext } from "react";
import { Navigate } from "react-router-dom";
import { AuthContext } from "../contexts/AuthContext";
import LoadingScreen from "../shared/components/ui/LoadingScreen";

export default function RequireAdmin({ children }) {
    const { user, loading } = useContext(AuthContext);

    
    if (loading) {
        return <LoadingScreen />;
    }

    
    if (!user) {
        return <Navigate to="/login" replace />;
    }

    
    const isAdmin = user.companyRole === 'admin' || user.companyRole === 'owner';

    
    if (!isAdmin) {
        return <Navigate to="/app" replace />;
    }

    
    return children;
}
