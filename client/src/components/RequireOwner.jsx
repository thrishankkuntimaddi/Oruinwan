import { useContext } from "react";
import { Navigate } from "react-router-dom";
import { AuthContext } from "../contexts/AuthContext";
import LoadingScreen from "../shared/components/ui/LoadingScreen";
import { isOwnerUser } from "./company-dash/dashNav";

export default function RequireOwner({ children }) {
    const { user, loading } = useContext(AuthContext);

    
    if (loading) {
        return <LoadingScreen />;
    }

    
    if (!user) {
        return <Navigate to="/login" replace />;
    }

    
    const isOwner = isOwnerUser(user);

    
    if (!isOwner) {

        return <Navigate to="/workspaces" replace />;
    }

    

    return children;
}
