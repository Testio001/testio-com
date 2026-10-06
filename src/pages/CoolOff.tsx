import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

const W = 360, H = 520, ROWS = 5, COLS = 7, PAD_W = 70, PAD_H = 10, R = 7;

const css = (name: string) => `hsl(${getComputedStyle(document.documentElement).getPropertyValue(name).trim()})`;

export default function CoolOff() {
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [status, setStatus] = useState<"ready" | "playing" | "won" | "lost">("ready");
  const [best, setBest] = useState(() => Number(localStorage.getItem("testio-brick-best") || 0));
  const state = useRef<any>(null);

  const reset = () => {
    const bw = (W - 20) / COLS;
    const bricks = [];
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++)
      bricks.push({ x: 10 + c * bw + 2, y: 50 + r * 22, w: bw - 4, h: 16, alive: true, row: r });
    state.current = { px: W / 2 - PAD_W / 2, bx: W / 2, by: H - 60, dx: 3, dy: -3.5, bricks, score: 0, lives: 3 };
    setScore(0); setLives(3);
  };

  useEffect(() => { reset(); }, []);

  useEffect(() => {
    const cv = canvasRef.current!; const ctx = cv.getContext("2d")!;
    let raf = 0;
    const primary = css("--primary"), fg = css("--foreground"), muted = css("--muted");
    const loop = () => {
      const s = state.current; if (!s) return;
      if (status === "playing") {
        s.bx += s.dx; s.by += s.dy;
        if (s.bx < R || s.bx > W - R) s.dx *= -1;
        if (s.by < R) s.dy *= -1;
        if (s.by > H - 30 - R && s.by < H - 30 && s.bx > s.px && s.bx < s.px + PAD_W && s.dy > 0) {
          const hit = (s.bx - (s.px + PAD_W / 2)) / (PAD_W / 2);
          const speed = Math.min(Math.hypot(s.dx, s.dy) * 1.02, 8);
          s.dx = speed * hit * 0.9; s.dy = -Math.sqrt(speed * speed - s.dx * s.dx);
        }
        for (const b of s.bricks) {
          if (b.alive && s.bx > b.x && s.bx < b.x + b.w && s.by - R < b.y + b.h && s.by + R > b.y) {
            b.alive = false; s.dy *= -1; s.score += 10; setScore(s.score); break;
          }
        }
        if (s.bricks.every((b: any) => !b.alive)) { setStatus("won"); saveBest(s.score); }
        if (s.by > H) {
          s.lives -= 1; setLives(s.lives);
          if (s.lives <= 0) { setStatus("lost"); saveBest(s.score); }
          else { s.bx = W / 2; s.by = H - 60; s.dx = 3; s.dy = -3.5; }
        }
      }
      ctx.clearRect(0, 0, W, H);
      for (const b of s.bricks) if (b.alive) {
        ctx.globalAlpha = 1 - b.row * 0.14; ctx.fillStyle = primary;
        ctx.fillRect(b.x, b.y, b.w, b.h);
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = fg; ctx.fillRect(s.px, H - 30, PAD_W, PAD_H);
      ctx.beginPath(); ctx.arc(s.bx, s.by, R, 0, Math.PI * 2); ctx.fillStyle = primary; ctx.fill();
      ctx.fillStyle = muted; ctx.fillRect(0, H - 2, W, 2);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [status]);

  const saveBest = (sc: number) => {
    if (sc > Number(localStorage.getItem("testio-brick-best") || 0)) {
      localStorage.setItem("testio-brick-best", String(sc)); setBest(sc);
    }
  };

  const move = (clientX: number) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * W;
    state.current.px = Math.max(0, Math.min(W - PAD_W, x - PAD_W / 2));
  };

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (!state.current) return;
      if (e.key === "ArrowLeft") state.current.px = Math.max(0, state.current.px - 25);
      if (e.key === "ArrowRight") state.current.px = Math.min(W - PAD_W, state.current.px + 25);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);

  const start = () => { if (status !== "playing") { if (status !== "ready") reset(); setStatus("playing"); } };

  return (
    <div className="min-h-screen bg-background text-foreground px-4 py-6">
      <div className="max-w-md mx-auto">
        <button onClick={() => navigate("/dashboard")} className="flex items-center gap-2 text-muted-foreground mb-4">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <h1 className="text-2xl font-bold">Cool Off Zone 🎮</h1>
        <p className="text-muted-foreground text-sm mb-4">Great work studying! Relax your mind with a quick round of Brick Breaker.</p>
        <div className="flex justify-between text-sm mb-2">
          <span>Score: <b>{score}</b></span><span>Lives: <b>{"❤️".repeat(lives)}</b></span><span>Best: <b>{best}</b></span>
        </div>
        <div className="relative">
          <canvas
            ref={canvasRef} width={W} height={H}
            className="w-full rounded-2xl border border-border bg-card touch-none"
            onMouseMove={(e) => move(e.clientX)}
            onTouchMove={(e) => move(e.touches[0].clientX)}
            onClick={start}
            onTouchStart={(e) => { move(e.touches[0].clientX); start(); }}
          />
          {status !== "playing" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/70 rounded-2xl">
              <p className="text-xl font-bold mb-3">
                {status === "ready" ? "Brick Breaker" : status === "won" ? "You cleared it! 🎉" : "Game over"}
              </p>
              <button onClick={start} className="bg-primary text-primary-foreground px-6 py-2 rounded-xl font-medium">
                {status === "ready" ? "Tap to play" : "Play again"}
              </button>
              <p className="text-xs text-muted-foreground mt-3">Drag or move your mouse to steer the paddle</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
