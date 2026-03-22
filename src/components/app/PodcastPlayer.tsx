import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Play, Pause, SkipBack, SkipForward, Volume2, Loader2, Mic } from "lucide-react";

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
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [script, setScript] = useState<PodcastSegment[]>([]);
  const [playbackRate, setPlaybackRate] = useState(1);
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

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setPlaying(!playing);
  };

  const skip = (seconds: number) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime + seconds);
  };

  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    setCurrentTime(audioRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    if (!audioRef.current) return;
    setDuration(audioRef.current.duration);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const formatTime = (s: number) => {
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
        <audio
          ref={audioRef}
          src={podcast.audio_url}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={() => setPlaying(false)}
        />

        <div className="flex items-center gap-4 mb-4">
          <div className="w-14 h-14 rounded-xl bg-primary/30 flex items-center justify-center">
            <Mic className="w-7 h-7 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-foreground font-bold text-sm truncate">{podcast.title}</h3>
            <p className="text-muted-foreground text-xs">Alex & Sam · AI Generated</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mb-4">
          <input
            type="range"
            min={0}
            max={duration || 0}
            value={currentTime}
            onChange={handleSeek}
            className="w-full h-1.5 bg-border rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary"
          />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-6">
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
      </div>

      {/* Transcript */}
      <div>
        <h3 className="text-foreground font-bold text-sm mb-3">Transcript</h3>
        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
          {script.map((segment, i) => (
            <div key={i} className={`flex gap-3 ${segment.speaker === "Alex" ? "" : "flex-row-reverse"}`}>
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                  segment.speaker === "Alex"
                    ? "bg-primary/20 text-primary"
                    : "bg-testio-green/20 text-testio-green"
                }`}
              >
                {segment.speaker[0]}
              </div>
              <div
                className={`rounded-xl px-4 py-2.5 max-w-[80%] text-sm ${
                  segment.speaker === "Alex"
                    ? "bg-secondary text-foreground"
                    : "bg-primary/10 text-foreground"
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
