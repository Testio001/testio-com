import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { ThemeProvider } from "@/hooks/useTheme";
import PWAInstallBanner from "@/components/PWAInstallBanner";
import Onboarding from "./pages/Onboarding";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import DocumentView from "./pages/DocumentView";
import Settings from "./pages/Settings";
import Profile from "./pages/Profile";
import LeaderboardPage from "./pages/LeaderboardPage";
import VerifyEmail from "./pages/VerifyEmail";
import TermsOfService from "./pages/TermsOfService";
import ResetPassword from "./pages/ResetPassword";
import Unsubscribe from "./pages/Unsubscribe";
import Pricing from "./pages/Pricing";
import Home from "./pages/Home";
import EntryPoint from "./pages/EntryPoint";
import WaitlistAnalytics from "./pages/WaitlistAnalytics";
import NotFound from "./pages/NotFound";
import PromoVideo from "./pages/PromoVideo";
import ThemeToggle from "./components/ThemeToggle";
import AdminStreakAssign from "./pages/AdminStreakAssign";
import AdminDashboard from "./pages/AdminDashboard";
import AuthCallback from "./pages/AuthCallback";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen bg-background" />;
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<EntryPoint />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/auth/callback" element={<AuthCallback />} />
              <Route path="/verify-email" element={<VerifyEmail />} />
              <Route path="/terms" element={<TermsOfService />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/unsubscribe" element={<Unsubscribe />} />
              <Route path="/pricing" element={<Pricing />} />
              <Route path="/home" element={<Home />} />
              <Route path="/promo" element={<PromoVideo />} />
              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/document/:id" element={<ProtectedRoute><DocumentView /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
              <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
              <Route path="/leaderboard" element={<ProtectedRoute><LeaderboardPage /></ProtectedRoute>} />
              <Route path="/waitlist-analytics" element={<ProtectedRoute><WaitlistAnalytics /></ProtectedRoute>} />
              <Route path="/admin-dashboard" element={<AdminDashboard />} />
              <Route path="/_internal/streak-admin-x7k2" element={<AdminStreakAssign />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
            <PWAInstallBanner />
            <ThemeToggle />
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
