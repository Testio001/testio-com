import { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { Mail, ArrowLeft, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import testioLogo from "@/assets/testio-logo.png";

const VerifyEmail = () => {
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  const email = location.state?.email || "";

  useEffect(() => {
    if (!email) {
      navigate("/auth");
    }
  }, [email, navigate]);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;

    const newCode = [...code];
    
    if (value.length > 1) {
      // Handle paste
      const digits = value.slice(0, 6).split("");
      digits.forEach((digit, i) => {
        if (index + i < 6) newCode[index + i] = digit;
      });
      setCode(newCode);
      const nextIndex = Math.min(index + digits.length, 5);
      inputRefs.current[nextIndex]?.focus();
    } else {
      newCode[index] = value;
      setCode(newCode);
      if (value && index < 5) {
        inputRefs.current[index + 1]?.focus();
      }
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted) {
      const newCode = [...code];
      pasted.split("").forEach((digit, i) => {
        if (i < 6) newCode[i] = digit;
      });
      setCode(newCode);
      inputRefs.current[Math.min(pasted.length, 5)]?.focus();
    }
  };

  const handleVerify = async () => {
    const otp = code.join("");
    if (otp.length !== 6) {
      toast({ title: "Error", description: "Please enter the full 6-digit code", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: otp,
        type: "signup",
      });
      if (error) throw error;
      toast({ title: "Email verified!", description: "Welcome to Testio" });
      navigate("/dashboard");
    } catch (error: any) {
      toast({ title: "Verification failed", description: error.message, variant: "destructive" });
      setCode(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
      });
      if (error) throw error;
      toast({ title: "Code resent!", description: "Check your email for the new code" });
      setCountdown(60);
      setCode(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setResending(false);
    }
  };

  // Auto-submit when all digits entered
  useEffect(() => {
    if (code.every((d) => d !== "")) {
      handleVerify();
    }
  }, [code]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-testio-glow pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md relative z-10"
      >
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-6">
            <img src={testioLogo} alt="Testio" className="w-10 h-10" />
            <span className="text-foreground font-bold text-2xl" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              testio
            </span>
          </div>

          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-5">
            <Mail className="w-8 h-8 text-primary" />
          </div>

          <h1 className="text-2xl font-bold text-foreground">Check your email</h1>
          <p className="text-muted-foreground mt-2 text-sm max-w-xs mx-auto">
            We sent a 6-digit verification code to{" "}
            <span className="text-foreground font-medium">{email}</span>
          </p>
        </div>

        <div className="bg-testio-card rounded-2xl p-8 space-y-6">
          {/* OTP Input */}
          <div className="flex justify-center gap-3" onPaste={handlePaste}>
            {code.map((digit, index) => (
              <motion.input
                key={index}
                ref={(el) => (inputRefs.current[index] = el)}
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={digit}
                onChange={(e) => handleChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.05 }}
                className={`w-12 h-14 text-center text-xl font-bold rounded-xl border-2 bg-background text-foreground focus:outline-none transition-all duration-200 ${
                  digit
                    ? "border-primary shadow-[0_0_12px_hsl(var(--primary)/0.3)]"
                    : "border-border hover:border-muted-foreground/50"
                } focus:border-primary focus:shadow-[0_0_12px_hsl(var(--primary)/0.3)]`}
              />
            ))}
          </div>

          {/* Verify Button */}
          <button
            onClick={handleVerify}
            disabled={loading || code.some((d) => d === "")}
            className="w-full btn-testio-primary flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              "Verify Email"
            )}
          </button>

          {/* Resend */}
          <div className="text-center">
            {countdown > 0 ? (
              <p className="text-sm text-muted-foreground">
                Resend code in{" "}
                <span className="text-foreground font-medium">{countdown}s</span>
              </p>
            ) : (
              <button
                onClick={handleResend}
                disabled={resending}
                className="text-sm text-primary hover:underline disabled:opacity-50 flex items-center justify-center gap-1 mx-auto"
              >
                {resending ? (
                  <RefreshCw className="w-3 h-3 animate-spin" />
                ) : null}
                Resend verification code
              </button>
            )}
          </div>

          {/* Back */}
          <button
            onClick={() => navigate("/auth")}
            className="w-full flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to sign in
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default VerifyEmail;
