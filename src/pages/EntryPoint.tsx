import { Navigate } from "react-router-dom";
import Home from "./Home";
import { useAuth } from "@/hooks/useAuth";

const EntryPoint = () => {
  const { user, loading: authLoading } = useAuth();

  if (authLoading) {
    return <div className="min-h-screen bg-background" />;
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  // Keep the introductory product onboarding out of the entry flow.
  return <Home />;
};

export default EntryPoint;
