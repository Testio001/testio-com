import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { Mail, Lock, User, ArrowRight, Eye, EyeOff, Gift, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import testioLogo from "@/assets/testio-logo.png";
import { getDeviceFingerprint } from "@/hooks/useDeviceFingerprint";
import { isDisposableEmail } from "@/lib/disposableEmails";

const Auth = () => {
  const [searchParams] = useSearchParams();
  const referralCode = searchParams.get("ref");
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();

  // Screen/View States
  const [isLogin, setIsLogin] = useState(true);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showSignupVerification, setShowSignupVerification] = useState(false);

  // Form Fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [verificationCode, setVerificationCode] = useState("");

  // Forgot Password Fields
  const [forgotEmail, setForgotEmail] = useState("");
  const [resetStep, setResetStep] = useState<"request" | "verify">("request");
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");

  // UI States
  const [loading, setLoading] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Redirect if already authenticated
  useEffect(() => {
    if (user) {
      navigate("/dashboard", { replace: true });
    }
  }, [user, navigate]);

  // ---- GOOGLE / GMAIL OAUTH SIGN IN ----
  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) throw error;
    } catch (err: any) {
      toast({
        title: "Google Authentication Error",
        description: err.message || "Failed to initialize Google Sign-in.",
        variant: "destructive",
      });
      setLoading(null);
    } finally {
      setLoading(false);
    }
  };

  // ---- EMAIL & PASSWORD AUTHENTICATION ----
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast({ title: "Missing fields", description: "Please fill out all fields.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      if (isLogin) {
        // Log In Flow
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;

        toast({ title: "Welcome back!", description: "Successfully logged in." });
        navigate("/dashboard");
      } else {
        // Sign Up Flow
        if (!displayName.trim()) {
          toast({ title: "Name required", description: "Please enter your full name.", variant: "destructive" });
          setLoading(false);
          return;
        }

        if (isDisposableEmail(email)) {
          toast({
            title: "Temporary Email Blocked",
            description: "Please use a permanent email address (like Gmail, Outlook, or institutional email).",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }

        const deviceFingerprint = await getDeviceFingerprint();

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              display_name: displayName,
              device_fingerprint: deviceFingerprint,
              referred_by_code: referralCode || null,
            },
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });

        if (error) throw error;

        // If user session is returned immediately, email confirmation is off
        if (data?.session) {
          toast({ title: "Account created!", description: "Welcome to Testio." });
          navigate("/dashboard");
        } else {
          // Email confirmation is active, transition to verification code view
          toast({
            title: "Verification Email Sent ✉️",
            description: "Check your inbox for a 6-digit confirmation code or verification link.",
          });
          setShowSignupVerification(true);
        }
      }
    } catch (err: any) {
      toast({
        title: "Authentication Failed",
        description: err.message || "Something went wrong. Please check your network and try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // ---- VERIFY SIGNUP OTP CODE ----
  const handleVerifySignupCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verificationCode) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token: verificationCode,
        type: "signup",
      });

      if (error) throw error;

      toast({ title: "Account Verified! 🎉", description: "Your email has been confirmed. Welcome aboard." });
      navigate("/dashboard");
    } catch (err: any) {
      toast({
        title: "Verification Error",
        description: err.message || "The verification token is invalid or has expired.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // ---- PASSWORD RESET REQUESTS ----
  const handleForgotPasswordRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail) return;

    setForgotLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
        redirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
      });
      if (error) throw error;

      toast({ title: "Reset Link Sent", description: "Check your email inbox for password reset steps." });
      setResetStep("verify");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center items-center px-4 py-12 select-none">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-[420px] space-y-6 bg-card border border-border p-8 rounded-3xl shadow-sm"
      >
        {/* Header / Logo */}
        <div className="flex flex-col items-center text-center space-y-2">
          <img src={testioLogo} alt="Testio Logo" className="w-12 h-12 mb-1 object-contain" />
          <h1 className="text-2xl font-bold tracking-tight text-foreground" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            {showForgotPassword ? "Reset Password" : showSignupVerification ? "Verify Email" : isLogin ? "Welcome back" : "Create account"}
          </h1>
          <p className="text-sm text-muted-foreground max-w-[280px]">
            {showForgotPassword
              ? "Enter your email to receive a password recovery method."
              : showSignupVerification
              ? `We sent a code to ${email}`
              : isLogin
              ? "Sign in to turn your lecture notes into interactive podcasts."
              : "Start converting documents and lectures into interactive study assets."}
          </p>
        </div>

        {referralCode && !showForgotPassword && !showSignupVerification && (
          <div className="bg-primary/10 border border-primary/20 text-primary text-xs font-medium px-4 py-2.5 rounded-xl flex items-center gap-2">
            <Gift className="w-4 h-4 shrink-0 animate-bounce" />
            <span>You've been invited! Completing signup grants bonus credits.</span>
          </div>
        )}

        {/* VIEW 1: SIGNUP EMAIL CODE VERIFICATION */}
        {showSignupVerification ? (
          <form onSubmit={handleVerifySignupCode} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">6-Digit Verification Code</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70" />
                <input
                  type="text"
                  maxLength={6}
                  placeholder="123456"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ""))}
                  className="w-full bg-secondary/50 border border-border/80 focus:border-primary rounded-xl pl-10 pr-4 py-2.5 text-sm text-foreground focus:outline-none transition-all tracking-widest font-mono text-center text-lg"
                />
              </div>
            </div>

            <button type="submit" disabled={loading || verificationCode.length < 6} className="w-full btn-testio-primary !py-2.5 flex items-center justify-center gap-2 font-medium disabled:opacity-50">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Verify Code <ArrowRight className="w-4 h-4" /></>}
            </button>

            <button
              type="button"
              onClick={() => {
                setShowSignupVerification(false);
                setIsLogin(false);
              }}
              className="w-full text-center text-xs text-muted-foreground hover:text-foreground hover:underline pt-2"
            >
              Back to registration
            </button>
          </form>
        ) : showForgotPassword ? (
          /* VIEW 2: FORGOT PASSWORD REQUESTS */
          <form onSubmit={handleForgotPasswordRequest} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70" />
                <input
                  type="email"
                  placeholder="name@university.edu"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  className="w-full bg-secondary/50 border border-border/80 focus:border-primary rounded-xl pl-10 pr-4 py-2.5 text-sm text-foreground focus:outline-none transition-all"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowForgotPassword(false)}
                className="flex-1 px-4 py-2.5 text-sm rounded-xl border border-border font-medium hover:bg-secondary transition-colors"
              >
                Cancel
              </button>
              <button type="submit" disabled={forgotLoading} className="flex-1 btn-testio-primary !py-2.5 text-sm flex items-center justify-center gap-2">
                {forgotLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send Instructions"}
              </button>
            </div>
          </form>
        ) : (
          /* VIEW 3: MAIN SIGN IN / SIGN UP FORM */
          <div className="space-y-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Your Name</label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70" />
                    <input
                      type="text"
                      placeholder="Amaka O."
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="w-full bg-secondary/50 border border-border/80 focus:border-primary rounded-xl pl-10 pr-4 py-2.5 text-sm text-foreground focus:outline-none transition-all"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70" />
                  <input
                    type="email"
                    placeholder="student@domain.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-secondary/50 border border-border/80 focus:border-primary rounded-xl pl-10 pr-4 py-2.5 text-sm text-foreground focus:outline-none transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Password</label>
                  {isLogin && (
                    <button type="button" onClick={() => setShowForgotPassword(true)} className="text-xs text-primary hover:underline font-medium">
                      Forgot?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70" />
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-secondary/50 border border-border/80 focus:border-primary rounded-xl pl-10 pr-10 py-2.5 text-sm text-foreground focus:outline-none transition-all"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button type="submit" disabled={loading} className="w-full btn-testio-primary !py-2.5 mt-2 flex items-center justify-center gap-2 font-medium">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>{isLogin ? "Sign In" : "Create Account"} <ArrowRight className="w-4 h-4" /></>}
              </button>
            </form>

            {/* Separator Divider */}
            <div className="relative my-5 flex items-center justify-center">
              <div className="absolute w-full border-t border-border" />
              <span className="relative bg-card px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">or continue with</span>
            </div>

            {/* FIXED GOOGLE OAUTH BUTTON */}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2.5 bg-secondary hover:bg-secondary/80 border border-border text-foreground text-sm font-medium py-2.5 px-4 rounded-xl transition-all"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Sign up with Gmail
            </button>

            {/* Toggle Footer */}
            <p className="text-center text-sm text-muted-foreground pt-2">
              {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
              <button
                type="button"
                onClick={() => {
                  setIsLogin(!isLogin);
                  setShowForgotPassword(false);
                  setShowSignupVerification(false);
                }}
                className="text-primary hover:underline font-semibold"
              >
                {isLogin ? "Sign up" : "Sign in"}
              </button>
            </p>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default Auth;
