import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { Mail, Lock, User, ArrowRight, Eye, EyeOff, Gift, Loader2, CheckCircle2 } from "lucide-react";
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
  const [isLogin, setIsLogin] = useState(false); // Defaults to Signup view first
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showSignupVerification, setShowSignupVerification] = useState(false);

  // Form Fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [verificationCode, setVerificationCode] = useState("");

  // Forgot Password States & Fields
  const [forgotEmail, setForgotEmail] = useState("");
  const [resetStep, setResetStep] = useState<"request" | "verify_and_change">("request");
  const [forgotCode, setForgotCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  // UI States
  const [loading, setLoading] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

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

        if (data?.session) {
          toast({ title: "Account created!", description: "Welcome to Testio." });
          navigate("/dashboard");
        } else {
          toast({
            title: "Verification Email Sent ✉️",
            description: "Check your inbox for your 8-character confirmation code.",
          });
          setShowSignupVerification(true);
        }
      }
    } catch (err: any) {
      const errMsg = err.message || "";
      if (errMsg.toLowerCase().includes("user already registered") || err.code === "user_already_exists") {
        toast({
          title: "Account already exists",
          description: "This email is registered. Redirecting you to the Sign In window.",
        });
        setIsLogin(true); 
      } else {
        toast({
          title: "Authentication Failed",
          description: errMsg || "Something went wrong. Please try again.",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  // ---- VERIFY SIGNUP OTP CODE (8-DIGIT) ----
  const handleVerifySignupCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verificationCode) return;

    setLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: verificationCode.trim(),
        type: "email", 
      });

      if (error) {
        const { error: retryError } = await supabase.auth.verifyOtp({
          email,
          token: verificationCode.trim(),
          type: "signup",
        });
        if (retryError) throw retryError;
      }

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

  // ---- PASSWORD RESET REQUEST (STEP 1: SEND CODE) ----
  const handleForgotPasswordRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail) {
      toast({ title: "Email required", description: "Please type in your email address.", variant: "destructive" });
      return;
    }

    setForgotLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail);
      if (error) throw error;

      toast({ title: "Code Sent ✉️", description: "Check your inbox for an 8-character password recovery token." });
      setResetStep("verify_and_change");
    } catch (err: any) {
      toast({ title: "Request Failed", description: err.message, variant: "destructive" });
    } finally {
      setForgotLoading(false);
    }
  };

  // ---- VERIFY RESET CODE & SET NEW PASSWORD (STEP 2: UPDATE LIVE) ----
  const handleVerifyAndResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotCode || !newPassword || !confirmNewPassword) {
      toast({ title: "Incomplete fields", description: "Please provide the token code and both password entries.", variant: "destructive" });
      return;
    }

    if (newPassword !== confirmNewPassword) {
      toast({ title: "Passwords match error", description: "Your passwords do not match. Please re-enter.", variant: "destructive" });
      return;
    }

    setForgotLoading(true);
    try {
      // 1. Verify token code to gain immediate session recovery rights
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: forgotEmail,
        token: forgotCode.trim(),
        type: "recovery",
      });

      if (verifyError) throw verifyError;

      // 2. Token accepted! Apply password update onto authorized session instantly
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) throw updateError;

      toast({ title: "Password Updated! 🔐", description: "Your security credentials were reset successfully. Logging you in..." });
      
      // Clear fields and kick into active workspace
      setShowForgotPassword(false);
      setResetStep("request");
      setForgotCode("");
      setNewPassword("");
      setConfirmNewPassword("");
      navigate("/dashboard");
    } catch (err: any) {
      toast({
        title: "Reset Failed",
        description: err.message || "Could not complete update. Check your verification code and try again.",
        variant: "destructive",
      });
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
              ? resetStep === "request" ? "Enter your account email to receive a secure recovery code." : `Enter the 8-character token sent to ${forgotEmail}`
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
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">8-Character Verification Code</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70" />
                <input
                  type="text"
                  maxLength={8}
                  placeholder="XXXXXXXX"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  className="w-full bg-secondary/50 border border-border/80 focus:border-primary rounded-xl pl-10 pr-4 py-2.5 text-sm text-foreground focus:outline-none transition-all tracking-widest font-mono text-center text-lg uppercase"
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
          /* VIEW 2: FORGOT PASSWORD INTEGRATED CODE FLOW */
          resetStep === "request" ? (
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
                  {forgotLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send Code"}
                </button>
              </div>
            </form>
          ) : (
            /* SUB-VIEW: CODE RECEIVED -> COLLECT CODE + PASSWORD TOGETHER */
            <form onSubmit={handleVerifyAndResetPassword} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">8-Character Reset Token</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70" />
                  <input
                    type="text"
                    maxLength={8}
                    placeholder="XXXXXXXX"
                    value={forgotCode}
                    onChange={(e) => setForgotCode(e.target.value)}
                    className="w-full bg-secondary/50 border border-border/80 focus:border-primary rounded-xl pl-10 pr-4 py-2.5 text-sm text-foreground focus:outline-none transition-all tracking-widest font-mono text-center uppercase"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">New Password</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70" />
                  <input
                    type={showNewPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full bg-secondary/50 border border-border/80 focus:border-primary rounded-xl pl-10 pr-10 py-2.5 text-sm text-foreground focus:outline-none transition-all"
                  />
                  <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Confirm Password</label>
                <div className="relative">
                  <CheckCircle2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70" />
                  <input
                    type={showNewPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    className="w-full bg-secondary/50 border border-border/80 focus:border-primary rounded-xl pl-10 pr-4 py-2.5 text-sm text-foreground focus:outline-none transition-all"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setResetStep("request")}
                  className="flex-1 px-4 py-2.5 text-sm rounded-xl border border-border font-medium hover:bg-secondary transition-colors"
                >
                  Back
                </button>
                <button type="submit" disabled={forgotLoading} className="flex-1 btn-testio-primary !py-2.5 text-sm flex items-center justify-center gap-2">
                  {forgotLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Reset Password"}
                </button>
              </div>
            </form>
          )
        ) : (
          /* VIEW 3: MAIN SIGN UP / SIGN IN FORM */
          <div className="space-y-4">
            {/* GMAIL OAUTH — PRIMARY REGISTRATION METHOD */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 bg-primary text-primary-foreground text-base font-bold py-4 px-4 rounded-xl shadow-lg shadow-primary/25 hover:opacity-90 transition-all"
              >
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                {isLogin ? "Sign in with Gmail" : "Sign up with Gmail"}
              </button>
              <p className="text-center text-xs text-muted-foreground">
                Fastest &amp; recommended — one tap, no password to remember
              </p>
            </div>

            <div className="relative my-5 flex items-center justify-center">
              <div className="absolute w-full border-t border-border" />
              <span className="relative bg-card px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                or use email
              </span>
            </div>

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
