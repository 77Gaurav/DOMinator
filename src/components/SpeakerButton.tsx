import { Loader2, Volume2, VolumeX } from "lucide-react";
import { useTTS } from "@/hooks/useVoice";
import { cn } from "@/lib/utils";

interface SpeakerButtonProps {
  id: string;
  text: string;
  className?: string;
  size?: "sm" | "md";
}

export function SpeakerButton({ id, text, className, size = "sm" }: SpeakerButtonProps) {
  const { speak, isPlaying, isLoading } = useTTS(id);
  const dim = size === "md" ? "h-4 w-4" : "h-3.5 w-3.5";
  const box = size === "md" ? "h-8 w-8" : "h-7 w-7";

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        speak(text);
      }}
      aria-label={isPlaying ? "Stop speaking" : "Play message"}
      title={isPlaying ? "Stop" : "Play with voice"}
      className={cn(
        box,
        "inline-flex items-center justify-center rounded-full border border-border/60 bg-background/60 hover:bg-accent transition-smooth text-foreground/80 hover:text-foreground",
        isPlaying && "ring-1 ring-primary/40",
        className,
      )}
    >
      {isLoading ? (
        <Loader2 className={cn(dim, "animate-spin")} />
      ) : isPlaying ? (
        <VolumeX className={dim} />
      ) : (
        <Volume2 className={dim} />
      )}
    </button>
  );
}
