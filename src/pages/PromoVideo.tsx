import { Play, Download, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState, useRef } from "react";

const PromoVideo = () => {
  const navigate = useNavigate();
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const handlePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleDownload = () => {
    const a = document.createElement("a");
    a.href = "/testio-promo.mp4";
    a.download = "testio-promo.mp4";
    a.click();
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-12">
      {/* Back button */}
      <div className="w-full max-w-4xl mb-8">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">Back</span>
        </button>
      </div>

      {/* Title */}
      <h1 className="text-3xl md:text-5xl font-bold text-foreground mb-2 text-center">
        Testio <span className="text-primary">Promo Video</span>
      </h1>
      <p className="text-muted-foreground mb-8 text-center">
        See what Testio can do for your studying
      </p>

      {/* Video Player */}
      <div className="w-full max-w-4xl rounded-2xl overflow-hidden border border-border bg-card shadow-xl relative group">
        <video
          ref={videoRef}
          className="w-full aspect-video bg-black"
          controls
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          poster=""
        >
          <source src="/testio-promo.mp4" type="video/mp4" />
          Your browser does not support the video tag.
        </video>
      </div>

      {/* Download button */}
      <button
        onClick={handleDownload}
        className="mt-8 btn-testio-primary flex items-center gap-3 px-8 py-4 text-lg"
      >
        <Download className="w-5 h-5" />
        Download Video
      </button>

      <p className="text-muted-foreground text-sm mt-4">
        MP4 · 1920×1080 · 15 seconds
      </p>
    </div>
  );
};

export default PromoVideo;
