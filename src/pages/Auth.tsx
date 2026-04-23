import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
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
  const [isLogin, setIsLogin] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [resetStep, setResetStep] = useState<"request" | "verify">("request");
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && user) {
      navigate("/dashboard", { replace: true });
    }
  }, [user, authLoading, navigate]);

  // Store referral code for after signup
  useEffect(() => {
    if (referralCode) {
      localStorage.setItem("testio-referral", referralCode);
    }
  }, [referralCode]);

  const processReferral = async (code: string) => {
    try {
      // Import dynamically to avoid circular deps
      const { useGamification } = await import("@/hooks/useGamification");
      // We'll process this in the dashboard instead
    } catch {}
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        // Register device fingerprint for this session (best-effort)
        try {
          const fp = await getDeviceFingerprint();
          await supabase.functions.invoke("check-signup-abuse", { body: { fingerprint: fp } });
        } catch {}
        navigate("/dashboard");
      } else {
        // Pre-check: block obvious disposable emails before creating the account
        if (isDisposableEmail(email)) {
          throw new Error("Please use a permanent email address to sign up.");
        }
        const { data: signUpData, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { display_name: displayName },
          },
        });
        if (error) throw error;
        // Run anti-abuse check (silently flags account if duplicate device/email)
        try {
          const fp = await getDeviceFingerprint();
          await supabase.functions.invoke("check-signup-abuse", { body: { fingerprint: fp } });
        } catch {}
        navigate("/verify-email", { state: { email } });
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!forgotEmail) {
      toast({ title: "Error", description: "Please enter your email address", variant: "destructive" });
      return;
    }
    setForgotLoading(true);
    try {
      // Trigger the recovery email (OTP code, no link) via password reset flow.
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail);
      if (error) throw error;
      toast({ title: "Check your email", description: "We've sent you a 6-digit reset code." });
      setResetStep("verify");
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setForgotLoading(false);
    }
  };

  const handleVerifyResetCode = async () => {
    if (!resetCode || resetCode.length < 6) {
      toast({ title: "Error", description: "Enter the 6-digit code from your email", variant: "destructive" });
      return;
    }
    if (newPassword.length < 6) {
      toast({ title: "Error", description: "Password must be at least 6 characters", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmNewPassword) {
      toast({ title: "Error", description: "Passwords do not match", variant: "destructive" });
      return;
    }
    setForgotLoading(true);
    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: forgotEmail,
        token: resetCode.trim(),
        type: "recovery",
      });
      if (verifyError) throw verifyError;
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) throw updateError;
      toast({ title: "Success", description: "Your password has been updated!" });
      setShowForgotPassword(false);
      setResetStep("request");
      setResetCode("");
      setNewPassword("");
      setConfirmNewPassword("");
      navigate("/dashboard", { replace: true });
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Invalid or expired code", variant: "destructive" });
    } finally {
      setForgotLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    const { error } = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (error) {
      toast({ title: "Error", description: String(error), variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-testio-glow pointer-events-none" />
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md relative z-10"
      >
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <img src={testioLogo} alt="Testio" className="w-10 h-10" />
            <span className="text-foreground font-bold text-2xl" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>testio</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">
            {isLogin ? "Welcome back" : "Create your account"}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {isLogin ? "Sign in to your Testio account" : "Start turning anything into study materials"}
          </p>
          {referralCode && !isLogin && (
            <div className="mt-3 flex items-center justify-center gap-1.5 text-xs text-primary bg-primary/10 rounded-full px-3 py-1.5 w-fit mx-auto">
              <Gift className="w-3.5 h-3.5" />
              You'll get a bonus upload from this referral!
            </div>
          )}
        </div>

        <div className="bg-testio-card rounded-2xl p-8 space-y-4">
          {/* Google Sign In */}
          <button
            onClick={handleGoogleSignIn}
            type="button"
            className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-lg border border-border text-foreground text-sm font-medium hover:bg-secondary transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Continue with Google
          </button>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground">or</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Display name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg pl-10 pr-4 py-3 text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
            )}

            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-background border border-border rounded-lg pl-10 pr-4 py-3 text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>

            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full bg-background border border-border rounded-lg pl-10 pr-10 py-3 text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-testio-primary flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? "Loading..." : isLogin ? "Sign In" : "Create Account"}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {isLogin && !showForgotPassword && (
            <button
              type="button"
              onClick={() => { setShowForgotPassword(true); setForgotEmail(email); setResetStep("request"); }}
              className="w-full text-center text-sm text-primary hover:underline"
            >
              Forgot password?
            </button>
          )}

          {showForgotPassword && (
            <div className="space-y-3 pt-2 border-t border-border">
              {resetStep === "request" ? (
                <>
                  <p className="text-sm text-muted-foreground">Enter your email and we'll send you a 6-digit code:</p>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="email"
                      placeholder="Email address"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      className="w-full bg-background border border-border rounded-lg pl-10 pr-4 py-3 text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => { setShowForgotPassword(false); setResetStep("request"); }}
                      className="flex-1 px-4 py-2.5 rounded-lg border border-border text-foreground text-sm hover:bg-secondary transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleForgotPassword}
                      disabled={forgotLoading}
                      className="flex-1 btn-testio-primary !py-2.5 !text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {forgotLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send Code"}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    Enter the 6-digit code sent to <span className="text-foreground font-medium">{forgotEmail}</span> and choose a new password.
                  </p>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    placeholder="6-digit code"
                    value={resetCode}
                    onChange={(e) => setResetCode(e.target.value.replace(/\D/g, ""))}
                    className="w-full bg-background border border-border rounded-lg px-4 py-3 text-foreground placeholder:text-muted-foreground text-center tracking-[0.5em] text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type={showNewPassword ? "text" : "password"}
                      placeholder="New password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      minLength={6}
                      className="w-full bg-background border border-border rounded-lg pl-10 pr-10 py-3 text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type={showNewPassword ? "text" : "password"}
                      placeholder="Confirm new password"
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      minLength={6}
                      className="w-full bg-background border border-border rounded-lg pl-10 pr-4 py-3 text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setResetStep("request")}
                      className="flex-1 px-4 py-2.5 rounded-lg border border-border text-foreground text-sm hover:bg-secondary transition-colors"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={handleVerifyResetCode}
                      disabled={forgotLoading}
                      className="flex-1 btn-testio-primary !py-2.5 !text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {forgotLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Update Password"}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    disabled={forgotLoading}
                    className="w-full text-center text-xs text-primary hover:underline"
                  >
                    Resend code
                  </button>
                </>
              )}
            </div>
          )}

          <p className="text-center text-sm text-muted-foreground">
            {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
            <button
              type="button"
              onClick={() => { setIsLogin(!isLogin); setShowForgotPassword(false); }}
              className="text-primary hover:underline"
            >
              {isLogin ? "Sign up" : "Sign in"}
            </button>
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default Auth;
