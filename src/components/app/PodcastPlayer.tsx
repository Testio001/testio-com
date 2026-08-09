import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Mic, Download, Play, Pause, SkipBack, SkipForward } from "lucide-react";

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

const PodcastPlayer = ({
  documentId,
  subscriptionPlan = "free",
}: {
  documentId: string;
  subscriptionPlan?: string;
}) => {
  const [podcast, setPodcast] = useState<Podcast | null>(null);
  const [signedUrl, setSignedUrl] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [script, setScript] = useState<PodcastSegment[]>([]);
  const [audioError, setAudioError] = useState<string>("");
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const plan = (subscriptionPlan || "free").toLowerCase();
  const showExpiryWarning = ["free", "starter", "basic"].includes(plan);
  const expiryWindow = plan === "free" ? "30 days" : "2 months";

  useEffect(() => {
    fetchPodcast();
  }, [documentId]);

  const resolveAudio = (val: string): { bucket: "podcasts" | "documents"; path: string; legacyUrl?: string } => {
    if (!val.startsWith("http")) {
      return { bucket: "podcasts", path: val };
    }
    const noQuery = val.split("?")[0];
    const podMarker = "/podcasts/";
    const docMarker = "/documents/";
    const pIdx = noQuery.indexOf(podMarker);
    if (pIdx >= 0) {
      return { bucket: "podcasts", path: noQuery.substring(pIdx + podMarker.length), legacyUrl: val };
    }
    const dIdx = noQuery.indexOf(docMarker);
    if (dIdx >= 0) {
      return { bucket: "documents", path: noQuery.substring(dIdx + docMarker.length), legacyUrl: val };
    }
    return { bucket: "podcasts", path: val, legacyUrl: val };
  };

  const signAudio = async (val: string): Promise<string> => {
    if (!val) return "";
    const { bucket, path, legacyUrl } = resolveAudio(val);
    console.log(`Signing audio: bucket=${bucket}, path=${path}`);

    try {
      const { data: signed, error } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);

      if (error) {
        console.error("Signed URL error:", error.message);
      }
      if (signed?.signedUrl) {
        console.log("Signed URL created successfully");
        return signed.signedUrl;
      }
    } catch (e) {
      console.error("signAudio threw:", e);
    }

    return legacyUrl || "";
  };

  const fetchPodcast = async () => {
    const { data, error } = await supabase
      .from("podcasts")
      .select("*")
      .eq("document_id", documentId)
      .order("created_at", { ascending: false })
      .limit(1);

    console.log("Podcast fetch:", data, error);

    if (data && data.length > 0) {
      const p = data[0] as Podcast;
      setPodcast(p);
      console.log("audio_url value:", p.audio_url);

      try {
        setScript(JSON.parse(p.script || "[]"));
      } catch {
        setScript([]);
      }

      if (p.audio_url) {
        const url = await signAudio(p.audio_url);
        console.log("Final signed URL:", url);
        if (url) {
          setSignedUrl(url);
          setAudioError("");
        } else {
          console.error("Could not generate signed URL");
          setAudioError("Could not load audio. Please try regenerating the podcast.");
        }
      } else {
        console.error("No audio_url in podcast record");
        setAudioError("Audio file not found. Please regenerate the podcast.");
      }
    }
    setLoading(false);
  };

  const handleDownload = async () => {
    if (!podcast?.audio_url) return;
    const url = (await signAudio(podcast.audio_url)) || signedUrl;
    if (!url) return;
    setDownloading(true);
    const filename = `${podcast.title.replace(/[^a-z0-9]/gi, "_")}.mp3`;
    try {
      const res = await fetch(url);
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
      window.open(url, "_blank");
    } finally {
      setDownloading(false);
    }
  };

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      audio.play().catch((e) => {
        console.error("Play failed:", e);
        setAudioError("Playback failed. Try downloading the MP3 instead.");
      });
    } else {
      audio.pause();
    }
  };

  const skip = (seconds: number) => {
    const audio = audioRef.current;
    if (!audio || !isFinite(audio.duration)) return;
    audio.currentTime = Math.min(Math.max(0, audio.currentTime + seconds), audio.duration);
  };

  const cyclePlaybackRate = () => {
    const rates = [0.5, 0.75, 1, 1.25, 1.5, 2];
    const next = rates[(rates.indexOf(playbackRate) + 1) % rates.length];
    setPlaybackRate(next);
    if (audioRef.current) audioRef.current.playbackRate = next;
  };

  const formatTime = (s: number) => {
    if (!isFinite(s) || s < 0) return "0:00";
    const min = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${min}:${sec.toString().padStart(2, "0")}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

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
      <audio
        key={signedUrl}
        ref={audioRef}
        src={signedUrl}
        preload="auto"
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onDurationChange={(e) => {
          if (isFinite(e.currentTarget.duration)) setDuration(e.currentTarget.duration);
        }}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onError={(e) => {
          console.error("Audio element error:", e);
          setAudioError("Audio failed to load. Please try downloading instead.");
        }}
      />

      <div className="bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 rounded-2xl p-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-4">
          <div className="w-14 h-14 rounded-xl bg-primary/30 flex items-center justify-center">
            <Mic className="w-7 h-7 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-foreground font-bold text-sm truncate">{podcast.title}</h3>
            <p className="text-muted-foreground text-xs">Alex & Sam · AI Generated</p>
          </div>
        </div>

        {/* Audio error banner */}
        {audioError && (
          <div className="mb-4 px-4 py-2.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs text-center">
            {audioError}
          </div>
        )}

        {/* Progress bar */}
        <div className="mb-4">
          <div className="w-full h-1.5 rounded-full bg-border overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-6">
          <button
            onClick={cyclePlaybackRate}
            className="text-xs font-bold text-muted-foreground hover:text-foreground transition-colors w-10 text-center"
          >
            {playbackRate}x
          </button>
          <button onClick={() => skip(-15)} className="text-muted-foreground hover:text-foreground transition-colors">
            <SkipBack className="w-5 h-5" />
          </button>
          <button
            onClick={togglePlay}
            disabled={!signedUrl}
            className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            {playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
          </button>
          <button onClick={() => skip(15)} className="text-muted-foreground hover:text-foreground transition-colors">
            <SkipForward className="w-5 h-5" />
          </button>
        </div>

        {/* Download */}
        <div className="mt-4 pt-4 border-t border-border/50 space-y-3">
          {showExpiryWarning && (
            <div className="px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs leading-relaxed">
              ⚠️ Your podcast will be automatically deleted after {expiryWindow} — tap{" "}
              <span className="font-semibold">Download</span> to keep it permanently.
            </div>
          )}
          <button
            onClick={handleDownload}
            disabled={downloading || !signedUrl}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {downloading ? "Downloading..." : "Download MP3"}
          </button>
          <p className="text-xs text-muted-foreground text-center">
            Download to listen in your podcast app with full seeking support
          </p>
        </div>
      </div>

      {/* Transcript */}
      {script.length > 0 && (
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
      )}
    </div>
  );
};

export default PodcastPlayer;
