import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function RequireAuth({ children, admin = false }) {
  const { user, ready, isAdmin } = useAuth();
  const location = useLocation();
  if (!ready) return <div className="page"><div className="skeleton block" /></div>;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  if (admin && !isAdmin) return <Navigate to="/" replace />;
  return children;
}
