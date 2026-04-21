import { Loader2, Mic, Square } from "lucide-react";
import { useSTT } from "@/hooks/useVoice";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface MicButtonProps {
  onTranscript: (text: string) => void;
  disabled?: boolean;
  className?: string;
}

/** Toggle-style mic: click to start, click to stop & transcribe. */
export function MicButton({ onTranscript, disabled, className }: MicButtonProps) {
  const { start, stop, isRecording, isTranscribing } = useSTT();

  const handleClick = async () => {
    if (isTranscribing) return;
    if (isRecording) {
      const text = await stop();
      if (text) onTranscript(text);
    } else {
      await start();
    }
  };

  return (
    <Button
      type="button"
      onClick={handleClick}
      disabled={disabled || isTranscribing}
      variant="outline"
      size="icon"
      title={isRecording ? "Stop and transcribe" : "Speak your answer"}
      aria-label={isRecording ? "Stop recording" : "Start recording"}
      className={cn(
        "h-[52px] w-[52px] rounded-xl self-end transition-smooth border-border/60",
        isRecording && "bg-destructive/10 border-destructive/50 text-destructive animate-pulse",
        className,
      )}
    >
      {isTranscribing ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : isRecording ? (
        <Square className="h-4 w-4 fill-current" />
      ) : (
        <Mic className="h-4 w-4" />
      )}
    </Button>
  );
}
