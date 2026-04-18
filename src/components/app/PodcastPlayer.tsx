import { useState, useEffect, useRef, useCallback, memo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Play, Pause, SkipBack, SkipForward, Loader2, Mic, Download, AlertCircle } from "lucide-react";

interface PodcastSegment {
  speaker: string;
  text: string;
}

interface Podcast {
  id: string;
  title: string;
  script: string;
  audio_url: string;
  status: string;
  created_at: string;
}

/**
 * Isolated audio element. Renders ONCE and never reacts to parent state changes.
 * The parent imperatively sets src via the ref provided in onReady.
 * This prevents React re-renders from resetting playback on seek/play/pause.
 */
const StableAudio = memo(
  ({ onReady }: { onReady: (el: HTMLAudioElement) => void }) => {
    const ref = useRef<HTMLAudioElement | null>(null);
    useEffect(() => {
      if (ref.current) onReady(ref.current);
    }, [onReady]);
    return <audio ref={ref} preload="metadata" controlsList="nodownload" crossOrigin="anonymous" />;
  },
  () => true, // never re-render — fully imperative
);
StableAudio.displayName = "StableAudio";

const PodcastPlayer = ({ documentId }: { documentId: string }) => {
  const [podcast, setPodcast] = useState<Podcast | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [script, setScript] = useState<PodcastSegment[]>([]);
  const [playbackRate, setPlaybackRate] = useState(1);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const currentSrcRef = useRef<string | null>(null);
  // FIX: flag to pause rAF updates while the user is seeking
  const isSeekingRef = useRef(false);

  useEffect(() => {
    fetchPodcast();
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [documentId]);

  const fetchPodcast = async () => {
    const { data } = await supabase
      .from("podcasts")
      .select("*")
      .eq("document_id", documentId)
      .order("created_at", { ascending: false })
      .limit(1);

    if (data && data.length > 0) {
      const p = data[0] as Podcast;
      setPodcast(p);
      try {
        setScript(JSON.parse(p.script || "[]"));
      } catch {
        setScript([]);
      }
    }
    setLoading(false);
  };

  const startTimeTracking = useCallback(() => {
    const update = () => {
      // FIX: skip rAF update while seeking to prevent overwriting the seek position
      if (audioRef.current && !audioRef.current.paused && !isSeekingRef.current) {
        setCurrentTime(audioRef.current.currentTime);
        animFrameRef.current = requestAnimationFrame(update);
      }
    };
    animFrameRef.current = requestAnimationFrame(update);
  }, []);

  const stopTimeTracking = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
  }, []);

  // Imperatively wire up the audio element ONCE — no re-renders touch it
  const handleAudioReady = useCallback(
    (el: HTMLAudioElement) => {
      audioRef.current = el;

      el.addEventListener("loadedmetadata", () => {
        if (isFinite(el.duration)) setDuration(el.duration);
      });
      el.addEventListener("durationchange", () => {
        if (isFinite(el.duration)) setDuration(el.duration);
      });
      el.addEventListener("play", () => {
        setPlaying(true);
        startTimeTracking();
      });
      el.addEventListener("pause", () => {
        setPlaying(false);
        stopTimeTracking();
      });
      el.addEventListener("ended", () => {
        setPlaying(false);
        stopTimeTracking();
      });
      // FIX: clear the seeking flag and sync time only after the browser confirms the seek
      el.addEventListener("seeked", () => {
        isSeekingRef.current = false;
        setCurrentTime(el.currentTime);
        // Resume rAF loop if audio is still playing after seek
        if (!el.paused) {
          startTimeTracking();
        }
      });
      el.addEventListener("timeupdate", () => {
        // Light backup; main updates come from rAF loop
        // FIX: also skip timeupdate while seeking
        if (el.paused && !isSeekingRef.current) setCurrentTime(el.currentTime);
      });

      // Set src ONCE if podcast already loaded
      if (podcast?.audio_url && currentSrcRef.current !== podcast.audio_url) {
        currentSrcRef.current = podcast.audio_url;
        el.src = podcast.audio_url;
        el.load();
      }
    },
    [], // intentional — we don't re-attach listeners
  );

  // When podcast becomes available AFTER audio element exists, set src once
  useEffect(() => {
    const el = audioRef.current;
    if (!el || !podcast?.audio_url) return;
    if (currentSrcRef.current === podcast.audio_url) return;
    currentSrcRef.current = podcast.audio_url;
    el.src = podcast.audio_url;
    el.load();
  }, [podcast?.audio_url]);

  const handleDownload = async () => {
    if (!podcast?.audio_url) return;
    setDownloading(true);
    const filename = `${podcast.title.replace(/[^a-z0-9]/gi, "_")}.mp3`;
    try {
      const res = await fetch(podcast.audio_url);
      if (!res.ok) throw new Error("download failed");
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(objUrl), 1000);
    } catch {
      window.open(podcast.audio_url, "_blank");
    } finally {
      setDownloading(false);
    }
  };

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      audio.play().catch((e) => console.error("Play failed:", e));
    } else {
      audio.pause();
    }
  }, []);

  const skip = useCallback((seconds: number) => {
    const audio = audioRef.current;
    if (!audio || !isFinite(audio.duration)) return;
    const newTime = Math.min(Math.max(0, audio.currentTime + seconds), audio.duration);
    // FIX: use seeking flag for skip buttons too
    isSeekingRef.current = true;
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  }, []);

  // FIX: set seeking flag on pointer down, BEFORE onChange fires
  const handleSeekStart = useCallback(() => {
    isSeekingRef.current = true;
    stopTimeTracking();
  }, [stopTimeTracking]);

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    const audio = audioRef.current;
    if (audio && isFinite(time)) {
      // isSeekingRef is already true from onPointerDown
      audio.currentTime = time;
      setCurrentTime(time);
    }
  }, []);

  const formatTime = (s: number) => {
    if (!isFinite(s)) return "0:00";
    const min = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${min}:${sec.toString().padStart(2, "0")}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    );
  }

  if (!podcast) {
    return (
      <div className="text-center py-16">
        <Mic className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
        <h3 className="text-foreground font-semibold mb-2">No Podcast Yet</h3>
        <p className="text-muted-foreground text-sm">
          Click "Generate Podcast" above to create an AI podcast from your notes.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Audio Player */}
      <div className="bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 rounded-2xl p-6">
        {/* Stable, isolated audio element — never re-renders */}
        <StableAudio onReady={handleAudioReady} />

        <div className="flex items-center gap-4 mb-4">
          <div className="w-14 h-14 rounded-xl bg-primary/30 flex items-center justify-center">
            <Mic className="w-7 h-7 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-foreground font-bold text-sm truncate">{podcast.title}</h3>
            <p className="text-muted-foreground text-xs">Alex & Sam · AI Generated</p>
          </div>
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary/15 hover:bg-primary/25 text-primary text-xs font-semibold transition-colors disabled:opacity-50"
            title="Download MP3"
          >
            {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            <span className="hidden sm:inline">MP3</span>
          </button>
        </div>

        {/* Progress bar */}
        <div className="mb-4">
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={currentTime}
            onChange={handleSeek}
            onPointerDown={handleSeekStart} // FIX: lock out rAF before drag begins
            className="w-full h-1.5 bg-border rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary"
          />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-6">
          <button
            onClick={() => {
              const rates = [0.5, 0.75, 1, 1.25, 1.5, 2];
              const idx = rates.indexOf(playbackRate);
              const next = rates[(idx + 1) % rates.length];
              setPlaybackRate(next);
              if (audioRef.current) audioRef.current.playbackRate = next;
            }}
            className="text-xs font-bold text-muted-foreground hover:text-foreground transition-colors w-10 text-center"
          >
            {playbackRate}x
          </button>
          <button onClick={() => skip(-15)} className="text-muted-foreground hover:text-foreground transition-colors">
            <SkipBack className="w-5 h-5" />
          </button>
          <button
            onClick={togglePlay}
            className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 transition-opacity"
          >
            {playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
          </button>
          <button onClick={() => skip(15)} className="text-muted-foreground hover:text-foreground transition-colors">
            <SkipForward className="w-5 h-5" />
          </button>
        </div>

        {/* Playback help */}
        <div className="mt-4 pt-4 border-t border-border/50 flex items-start gap-2 text-xs text-muted-foreground">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>
            Issues with playback?{" "}
            <button onClick={handleDownload} className="text-primary hover:underline font-medium">
              Download the audio here.
            </button>
          </span>
        </div>
      </div>

      {/* Transcript */}
      <div>
        <h3 className="text-foreground font-bold text-sm mb-3">Transcript</h3>
        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
          {script.map((segment, i) => (
            <div key={i} className={`flex gap-3 ${segment.speaker === "Alex" ? "" : "flex-row-reverse"}`}>
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                  segment.speaker === "Alex" ? "bg-primary/20 text-primary" : "bg-testio-green/20 text-testio-green"
                }`}
              >
                {segment.speaker[0]}
              </div>
              <div
                className={`rounded-xl px-4 py-2.5 max-w-[80%] text-sm ${
                  segment.speaker === "Alex" ? "bg-secondary text-foreground" : "bg-primary/10 text-foreground"
                }`}
              >
                <span className="font-semibold text-xs text-muted-foreground block mb-0.5">{segment.speaker}</span>
                {segment.text}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PodcastPlayer;
