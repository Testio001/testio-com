import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import Leaderboard from "@/components/app/Leaderboard";
import testioLogo from "@/assets/testio-logo.png";

const LeaderboardPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate("/dashboard")} className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-bold text-foreground">Leaderboard</h1>
          </div>
          <img src={testioLogo} alt="Testio" className="w-8 h-8" />
        </div>
      </header>
      <div className="max-w-2xl mx-auto px-6 py-8">
        <Leaderboard />
      </div>
    </div>
  );
};

export default LeaderboardPage;
