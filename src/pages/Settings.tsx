import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Moon, Sun, Trash2, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/hooks/useTheme";
import testioLogo from "@/assets/testio-logo.png";

const Settings = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleDeleteAccount = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }

    setDeleting(true);
    try {
      // Delete user data via edge function
      const { error } = await supabase.functions.invoke("delete-account", {
        body: {},
      });
      if (error) throw error;

      await signOut();
      navigate("/auth");
      toast({ title: "Account deleted", description: "Your account and all data have been removed." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to delete account", variant: "destructive" });
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate("/dashboard")} className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-bold text-foreground">Settings</h1>
          </div>
          <img src={testioLogo} alt="Testio" className="w-8 h-8" />
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
        {/* Theme Toggle */}
        <div className="bg-testio-card rounded-xl p-6">
          <h3 className="text-foreground font-semibold mb-4">Appearance</h3>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-foreground text-sm">Theme</p>
              <p className="text-muted-foreground text-xs mt-0.5">Switch between light and dark mode</p>
            </div>
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-foreground text-sm hover:bg-secondary transition-colors"
            >
              {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              {theme === "dark" ? "Light Mode" : "Dark Mode"}
            </button>
          </div>
        </div>

        {/* Account Info */}
        <div className="bg-testio-card rounded-xl p-6">
          <h3 className="text-foreground font-semibold mb-4">Account</h3>
          <div className="space-y-3">
            <div>
              <p className="text-muted-foreground text-xs">Email</p>
              <p className="text-foreground text-sm">{user?.email}</p>
            </div>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="bg-testio-card rounded-xl p-6 border border-destructive/20">
          <h3 className="text-destructive font-semibold mb-4">Danger Zone</h3>
          <p className="text-muted-foreground text-sm mb-4">
            Once you delete your account, there is no going back. All your documents, notes, flashcards, and quizzes will be permanently removed.
          </p>
          <button
            onClick={handleDeleteAccount}
            disabled={deleting}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              confirmDelete
                ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                : "border border-destructive text-destructive hover:bg-destructive/10"
            }`}
          >
            {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            {confirmDelete ? "Click again to confirm" : "Delete Account"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Settings;
