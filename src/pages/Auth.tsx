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
  const referralCode = searchParams.get("ref") || (typeof window !== "undefined" ? localStorage.getItem("testio_pending_ref") : null);
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

  const title = showForgotPassword
    ? "Reset your password"
    : showSignupVerification
    ? "Check your inbox"
    : isLogin
    ? "Welcome back"
    : "Create your account";

  const subtitle = showForgotPassword
    ? resetStep === "request"
      ? "Enter your account email and we'll send you a recovery code."
      : `Enter the 8-character code sent to ${forgotEmail}.`
    : showSignupVerification
    ? `We sent an 8-character code to ${email}.`
    : isLogin
    ? "Sign in to pick up where you left off."
    : "Turn your lecture notes into notes, quizzes and podcasts.";

  const viewKey = showSignupVerification ? "verify" : showForgotPassword ? `forgot-${resetStep}` : isLogin ? "login" : "signup";

  return (
    <div className="min-h-screen bg-background grid lg:grid-cols-[1fr_1.05fr]">
      {/* Form column */}
      <div className="flex flex-col px-5 sm:px-8 py-6">
        <a href="/home" className="flex items-center gap-2 self-start" aria-label="Testio home">
          <img src={testioLogo} alt="" className="w-8 h-8 rounded-lg object-contain bg-white" />
          <span className="text-lg font-semibold tracking-tight text-foreground">testio</span>
        </a>

        <div className="flex-1 flex items-center justify-center py-10">
          <motion.div
            initial={{ opacity: 0, transform: "translateY(12px)" }}
            animate={{ opacity: 1, transform: "translateY(0px)" }}
            transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
            className="w-full max-w-[400px]"
          >
            <motion.div
              key={viewKey}
              initial={{ opacity: 0, filter: "blur(2px)" }}
              animate={{ opacity: 1, filter: "blur(0px)" }}
              transition={{ duration: 0.25, ease: "easeOut" }}
            >
              <h1 className="font-display text-3xl sm:text-[2.1rem] font-medium tracking-tight text-foreground">{title}</h1>
              <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>

              {referralCode && !showForgotPassword && !showSignupVerification && (
                <div className="mt-6 rounded-xl border border-border bg-card px-4 py-3 flex items-start gap-3 text-sm">
                  <Gift className="w-4 h-4 shrink-0 mt-0.5 text-primary" />
                  <span className="text-foreground">You've been invited. Finish signing up to get bonus credits.</span>
                </div>
              )}

              <div className="mt-8">
                {/* VIEW 1: SIGNUP EMAIL CODE VERIFICATION */}
                {showSignupVerification ? (
                  <form onSubmit={handleVerifySignupCode} className="space-y-5">
                    <div className="space-y-1.5">
                      <label htmlFor="verify-code" className="text-sm font-medium text-foreground">Verification code</label>
                      <input
                        id="verify-code"
                        type="text"
                        maxLength={8}
                        autoComplete="one-time-code"
                        placeholder="XXXXXXXX"
                        value={verificationCode}
                        onChange={(e) => setVerificationCode(e.target.value)}
                        className="field !py-3.5 tracking-[0.4em] font-mono text-center text-lg uppercase"
                      />
                    </div>

                    <button type="submit" disabled={loading || verificationCode.length < 6} className="w-full btn-testio-primary disabled:opacity-50">
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Verify code <ArrowRight className="w-4 h-4" /></>}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setShowSignupVerification(false);
                        setIsLogin(false);
                      }}
                      className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Back to sign up
                    </button>
                  </form>
                ) : showForgotPassword ? (
                  /* VIEW 2: FORGOT PASSWORD INTEGRATED CODE FLOW */
                  resetStep === "request" ? (
                    <form onSubmit={handleForgotPasswordRequest} className="space-y-5">
                      <div className="space-y-1.5">
                        <label htmlFor="forgot-email" className="text-sm font-medium text-foreground">Email</label>
                        <div className="relative">
                          <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <input
                            id="forgot-email"
                            type="email"
                            autoComplete="email"
                            placeholder="name@university.edu"
                            value={forgotEmail}
                            onChange={(e) => setForgotEmail(e.target.value)}
                            className="field pl-10"
                          />
                        </div>
                      </div>

                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={() => setShowForgotPassword(false)}
                          className="pressable flex-1 px-4 py-3 text-sm rounded-xl border border-border bg-card font-medium hover:bg-secondary"
                        >
                          Cancel
                        </button>
                        <button type="submit" disabled={forgotLoading} className="flex-1 btn-testio-primary disabled:opacity-50">
                          {forgotLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send code"}
                        </button>
                      </div>
                    </form>
                  ) : (
                    /* SUB-VIEW: CODE RECEIVED -> COLLECT CODE + PASSWORD TOGETHER */
                    <form onSubmit={handleVerifyAndResetPassword} className="space-y-5">
                      <div className="space-y-1.5">
                        <label htmlFor="reset-code" className="text-sm font-medium text-foreground">Reset code</label>
                        <input
                          id="reset-code"
                          type="text"
                          maxLength={8}
                          autoComplete="one-time-code"
                          placeholder="XXXXXXXX"
                          value={forgotCode}
                          onChange={(e) => setForgotCode(e.target.value)}
                          className="field tracking-[0.4em] font-mono text-center uppercase"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label htmlFor="new-password" className="text-sm font-medium text-foreground">New password</label>
                        <div className="relative">
                          <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <input
                            id="new-password"
                            type={showNewPassword ? "text" : "password"}
                            autoComplete="new-password"
                            placeholder="At least 8 characters"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="field pl-10 pr-10"
                          />
                          <button
                            type="button"
                            aria-label={showNewPassword ? "Hide password" : "Show password"}
                            onClick={() => setShowNewPassword(!showNewPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          >
                            {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label htmlFor="confirm-password" className="text-sm font-medium text-foreground">Confirm password</label>
                        <div className="relative">
                          <CheckCircle2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <input
                            id="confirm-password"
                            type={showNewPassword ? "text" : "password"}
                            autoComplete="new-password"
                            placeholder="Repeat new password"
                            value={confirmNewPassword}
                            onChange={(e) => setConfirmNewPassword(e.target.value)}
                            className="field pl-10"
                          />
                        </div>
                      </div>

                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={() => setResetStep("request")}
                          className="pressable flex-1 px-4 py-3 text-sm rounded-xl border border-border bg-card font-medium hover:bg-secondary"
                        >
                          Back
                        </button>
                        <button type="submit" disabled={forgotLoading} className="flex-1 btn-testio-primary disabled:opacity-50">
                          {forgotLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Reset password"}
                        </button>
                      </div>
                    </form>
                  )
                ) : (
                  /* VIEW 3: MAIN SIGN UP / SIGN IN FORM */
                  <div>
                    <button
                      type="button"
                      onClick={handleGoogleSignIn}
                      disabled={loading}
                      className="pressable w-full flex items-center justify-center gap-3 rounded-xl border border-border bg-card py-3 px-4 text-[15px] font-medium text-foreground hover:bg-secondary disabled:opacity-60"
                    >
                      <svg className="w-[18px] h-[18px] shrink-0" viewBox="0 0 24 24" aria-hidden>
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                      </svg>
                      {isLogin ? "Continue with Google" : "Sign up with Google"}
                    </button>
                    <p className="mt-2 text-center text-xs text-muted-foreground">Fastest — one tap, no password to remember.</p>

                    <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="h-px flex-1 bg-border" />
                      or with email
                      <span className="h-px flex-1 bg-border" />
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                      {!isLogin && (
                        <div className="space-y-1.5">
                          <label htmlFor="name" className="text-sm font-medium text-foreground">Full name</label>
                          <div className="relative">
                            <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <input
                              id="name"
                              type="text"
                              autoComplete="name"
                              placeholder="Amaka O."
                              value={displayName}
                              onChange={(e) => setDisplayName(e.target.value)}
                              className="field pl-10"
                            />
                          </div>
                        </div>
                      )}

                      <div className="space-y-1.5">
                        <label htmlFor="email" className="text-sm font-medium text-foreground">Email</label>
                        <div className="relative">
                          <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <input
                            id="email"
                            type="email"
                            autoComplete="email"
                            placeholder="you@university.edu"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="field pl-10"
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center">
                          <label htmlFor="password" className="text-sm font-medium text-foreground">Password</label>
                          {isLogin && (
                            <button type="button" onClick={() => setShowForgotPassword(true)} className="text-xs text-primary hover:underline font-medium">
                              Forgot password?
                            </button>
                          )}
                        </div>
                        <div className="relative">
                          <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <input
                            id="password"
                            type={showPassword ? "text" : "password"}
                            autoComplete={isLogin ? "current-password" : "new-password"}
                            placeholder={isLogin ? "Your password" : "At least 8 characters"}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="field pl-10 pr-10"
                          />
                          <button
                            type="button"
                            aria-label={showPassword ? "Hide password" : "Show password"}
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      <button type="submit" disabled={loading} className="w-full btn-testio-primary !mt-6 disabled:opacity-60">
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>{isLogin ? "Sign in" : "Create account"} <ArrowRight className="w-4 h-4" /></>}
                      </button>
                    </form>

                    <p className="text-center text-sm text-muted-foreground mt-6">
                      {isLogin ? "New to Testio?" : "Already have an account?"}{" "}
                      <button
                        type="button"
                        onClick={() => {
                          setIsLogin(!isLogin);
                          setShowForgotPassword(false);
                          setShowSignupVerification(false);
                        }}
                        className="text-foreground font-medium underline underline-offset-4 decoration-border hover:decoration-foreground transition-colors"
                      >
                        {isLogin ? "Create an account" : "Sign in"}
                      </button>
                    </p>
                    {!isLogin && (
                      <p className="mt-4 text-center text-xs text-muted-foreground">
                        By signing up you agree to our{" "}
                        <a href="/terms" className="underline underline-offset-2 hover:text-foreground">Terms of Service</a>.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>

      {/* Brand column (desktop only) */}
      <aside className="hidden lg:flex relative flex-col justify-between bg-card border-l border-border p-12 overflow-hidden">
        <div className="absolute inset-0 dot-grid pointer-events-none" aria-hidden />
        <div className="relative">
          <p className="eyebrow">Study smarter</p>
        </div>

        <motion.div
          initial={{ opacity: 0, transform: "translateY(16px)" }}
          animate={{ opacity: 1, transform: "translateY(0px)" }}
          transition={{ duration: 0.8, ease: [0.23, 1, 0.32, 1], delay: 0.15 }}
          className="relative max-w-md"
        >
          <div className="space-y-3">
            {[
              { k: "Notes", v: "Key ideas from 24 pages" },
              { k: "Flashcards", v: "36 cards ready to review" },
              { k: "Quiz", v: "20 exam-style questions" },
              { k: "Podcast", v: "7 min · two-host episode" },
            ].map((row, i) => (
              <motion.div
                key={row.k}
                initial={{ opacity: 0, transform: "translateY(10px)" }}
                animate={{ opacity: 1, transform: "translateY(0px)" }}
                transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1], delay: 0.3 + i * 0.07 }}
                className="flex items-center justify-between rounded-xl border border-border bg-background px-4 py-3 shadow-soft"
              >
                <span className="text-sm font-medium text-foreground">{row.k}</span>
                <span className="text-sm text-muted-foreground">{row.v}</span>
              </motion.div>
            ))}
          </div>
          <p className="mt-10 font-display text-[1.75rem] leading-snug text-foreground">
            “Reading PDFs used to put me to sleep. Now I get a podcast in 30 seconds and revise while I cook.”
          </p>
          <p className="mt-4 text-sm text-muted-foreground">Bankole O. · Final Year Law Student</p>
        </motion.div>

        <p className="relative text-xs text-muted-foreground">© 2026 Testio</p>
      </aside>
    </div>
  );
};

export default Auth;
