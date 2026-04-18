import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Mic, Download, AlertCircle, Play, Pause, SkipBack, SkipForward } from "lucide-react";

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

const PodcastPlayer = ({ documentId }: { documentId: string }) => {
  const [podcast, setPodcast] = useState<Podcast | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [script, setScript] = useState<PodcastSegment[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    fetchPodcast();
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

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      audio.play().catch(console.error);
    } else {
      audio.pause();
    }
  };

  const skip = (seconds: number) => {
    const audio = audioRef.current;
    if (!audio || !isFinite(audio.duration)) return;
    audio.currentTime = Math.min(Math.max(0, audio.currentTime + seconds), audio.duration);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    const time = parseFloat(e.target.value);
    if (audio && isFinite(time)) {
      audio.currentTime = time;
    }
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
      {/* Native audio element — let the browser handle all seeking/buffering */}
      <audio
        key={podcast.audio_url}
        ref={audioRef}
        src={podcast.audio_url}
        preload="auto"
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onDurationChange={(e) => {
          if (isFinite(e.currentTarget.duration)) setDuration(e.currentTarget.duration);
        }}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
      />

      {/* Custom UI */}
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
            className="w-full h-1.5 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary"
            style={{
              background: `linear-gradient(to right, var(--primary) ${progress}%, hsl(var(--border)) ${progress}%)`,
            }}
          />
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
