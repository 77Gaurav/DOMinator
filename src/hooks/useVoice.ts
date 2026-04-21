import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/** Shared <audio> element so only one TTS clip plays at a time. */
let sharedAudio: HTMLAudioElement | null = null;
let currentPlayingId: string | null = null;
const playStateListeners = new Set<(id: string | null) => void>();

function setCurrentPlaying(id: string | null) {
  currentPlayingId = id;
  playStateListeners.forEach((l) => l(id));
}

/** Play a piece of text via ElevenLabs TTS. Returns when playback starts. */
export async function playTTS(text: string, id: string): Promise<void> {
  if (!text?.trim()) return;

  // Stop any current playback
  if (sharedAudio) {
    sharedAudio.pause();
    sharedAudio.src = "";
  }
  setCurrentPlaying(id);

  const { data, error } = await supabase.functions.invoke("elevenlabs-tts", {
    body: { text },
  });

  if (error || !data?.audioContent) {
    setCurrentPlaying(null);
    const msg =
      (error as any)?.context?.response?.status === 402
        ? "Voice credits exhausted."
        : error?.message || "Failed to generate speech.";
    toast.error(msg);
    return;
  }

  const url = `data:${data.mimeType || "audio/mpeg"};base64,${data.audioContent}`;
  const audio = new Audio(url);
  sharedAudio = audio;
  audio.onended = () => {
    if (currentPlayingId === id) setCurrentPlaying(null);
  };
  audio.onerror = () => {
    if (currentPlayingId === id) setCurrentPlaying(null);
  };
  try {
    await audio.play();
  } catch {
    setCurrentPlaying(null);
  }
}

function stopTTS() {
  if (sharedAudio) {
    sharedAudio.pause();
    sharedAudio.src = "";
  }
  setCurrentPlaying(null);
}

/** Hook for a single message's speaker button. */
export function useTTS(id: string) {
  const [isPlaying, setIsPlaying] = useState(currentPlayingId === id);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const listener = (playingId: string | null) => {
      setIsPlaying(playingId === id);
    };
    playStateListeners.add(listener);
    return () => {
      playStateListeners.delete(listener);
    };
  }, [id]);

  const speak = useCallback(
    async (text: string) => {
      if (currentPlayingId === id) {
        stopTTS();
        return;
      }
      setIsLoading(true);
      try {
        await playTTS(text, id);
      } finally {
        setIsLoading(false);
      }
    },
    [id],
  );

  return { speak, isPlaying, isLoading, stop: stopTTS };
}

/** Hook for click-to-record / click-to-stop dictation via ElevenLabs Scribe. */
export function useSTT() {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const resolverRef = useRef<((text: string) => void) | null>(null);

  const cleanupStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const start = useCallback(async (): Promise<void> => {
    if (isRecording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      streamRef.current = stream;
      chunksRef.current = [];

      const mimeType =
        MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : MediaRecorder.isTypeSupported("audio/webm")
            ? "audio/webm"
            : "audio/mp4";

      const rec = new MediaRecorder(stream, { mimeType });
      recorderRef.current = rec;

      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };

      rec.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        cleanupStream();
        if (blob.size < 200) {
          setIsTranscribing(false);
          resolverRef.current?.("");
          resolverRef.current = null;
          return;
        }
        setIsTranscribing(true);
        try {
          const buf = await blob.arrayBuffer();
          // base64 encode in chunks (avoid stack overflow on large arrays)
          let binary = "";
          const bytes = new Uint8Array(buf);
          const chunk = 0x8000;
          for (let i = 0; i < bytes.length; i += chunk) {
            binary += String.fromCharCode.apply(
              null,
              Array.from(bytes.subarray(i, i + chunk)) as unknown as number[],
            );
          }
          const audioB64 = btoa(binary);

          const { data, error } = await supabase.functions.invoke("elevenlabs-stt", {
            body: { audio: audioB64, mimeType },
          });

          if (error) {
            toast.error(error.message || "Transcription failed.");
            resolverRef.current?.("");
          } else {
            resolverRef.current?.((data?.text ?? "").toString());
          }
        } catch (e: any) {
          toast.error(e?.message || "Transcription failed.");
          resolverRef.current?.("");
        } finally {
          setIsTranscribing(false);
          resolverRef.current = null;
        }
      };

      rec.start();
      setIsRecording(true);
    } catch (e: any) {
      cleanupStream();
      toast.error(
        e?.name === "NotAllowedError"
          ? "Microphone access denied. Enable it in your browser settings."
          : e?.message || "Could not start microphone.",
      );
    }
  }, [isRecording]);

  /** Stop recording and resolve with the transcribed text. */
  const stop = useCallback((): Promise<string> => {
    return new Promise((resolve) => {
      const rec = recorderRef.current;
      if (!rec || rec.state === "inactive") {
        resolve("");
        return;
      }
      resolverRef.current = resolve;
      setIsRecording(false);
      try {
        rec.stop();
      } catch {
        resolve("");
      }
    });
  }, []);

  useEffect(() => {
    return () => {
      try {
        recorderRef.current?.stop();
      } catch {}
      cleanupStream();
    };
  }, []);

  return { start, stop, isRecording, isTranscribing };
}

export const voiceControl = { stop: stopTTS };
