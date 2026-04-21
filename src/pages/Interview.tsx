import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { oneDark } from "@codemirror/theme-one-dark";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { TopNav } from "@/components/TopNav";
import { AmbientOrbs } from "@/components/AmbientOrbs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DIFFICULTIES, STEP_LABELS } from "@/lib/interview-config";
import { Bot, Code2, Loader2, Maximize2, Minimize2, Send, Sparkles, User as UserIcon } from "lucide-react";
import { toast } from "sonner";
import { SpeakerButton } from "@/components/SpeakerButton";
import { MicButton } from "@/components/MicButton";
import { voiceControl, playTTS } from "@/hooks/useVoice";

type Message = {
  id: string;
  step: number;
  role: "interviewer" | "candidate" | "system";
  content: string;
  code_submission: string | null;
  language: string | null;
  created_at: string;
};

type Interview = {
  id: string;
  user_id: string;
  difficulty: string;
  topic: string | null;
  current_step: number;
  status: string;
  started_at?: string | null;
  completed_at?: string | null;
};


const DEFAULT_TSX = `// Solution.tsx
import { useState } from "react";

export default function Solution() {
  return <div>Your code here</div>;
}
`;

const DEFAULT_JSX = `// Solution.jsx
import { useState } from "react";

export default function Solution() {
  return <div>Your code here</div>;
}
`;

const Interview = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();

  const [interview, setInterview] = useState<Interview | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [language, setLanguage] = useState<"jsx" | "tsx">("tsx");
  const [code, setCode] = useState(DEFAULT_TSX);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const diff = useMemo(
    () => DIFFICULTIES.find((d) => d.id === interview?.difficulty),
    [interview?.difficulty],
  );
  const isCodeStep = interview?.current_step === 6;
  const isCompleted = interview?.status === "completed";
  const allowJsxToggle = interview?.difficulty === "intern";

  // ── Timers ──────────────────────────────────────────────
  // (Header timers removed; per-step / total time tracking lives in the TopNav widget.)


  // Load interview + history; auto-trigger first turn if empty
  useEffect(() => {
    if (!id || !user) return;
    (async () => {
      const [iv, msgs] = await Promise.all([
        supabase.from("interviews").select("*").eq("id", id).maybeSingle(),
        supabase
          .from("interview_messages")
          .select("*")
          .eq("interview_id", id)
          .order("created_at", { ascending: true }),
      ]);

      if (!iv.data) {
        toast.error("Interview not found");
        navigate("/app");
        return;
      }
      setInterview(iv.data as Interview);
      setMessages((msgs.data ?? []) as Message[]);
      setLoading(false);

      if (iv.data.status === "completed") {
        navigate(`/interview/${id}/summary`);
        return;
      }

      // First turn: trigger AI
      if ((msgs.data ?? []).length === 0) {
        triggerTurn(undefined, undefined, undefined, iv.data.current_step);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user]);

  useEffect(() => {
    setCode(language === "tsx" ? DEFAULT_TSX : DEFAULT_JSX);
  }, [language]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  // Auto-play newest interviewer message via TTS
  const lastSpokenIdRef = useRef<string | null>(null);
  useEffect(() => {
    const lastInterviewer = [...messages].reverse().find((m) => m.role === "interviewer");
    if (!lastInterviewer || lastInterviewer.id.startsWith("tmp-")) return;
    if (lastSpokenIdRef.current === lastInterviewer.id) return;
    // Skip auto-play on initial load (when we already have multiple messages)
    if (lastSpokenIdRef.current === null && messages.length > 1) {
      lastSpokenIdRef.current = lastInterviewer.id;
      return;
    }
    lastSpokenIdRef.current = lastInterviewer.id;
    playTTS(lastInterviewer.content, lastInterviewer.id).catch(() => {});
  }, [messages]);

  // Stop any TTS playback when leaving the page
  useEffect(() => {
    return () => voiceControl.stop();
  }, []);

  const triggerTurn = async (
    candidate_message?: string,
    code_submission?: string,
    lang?: "jsx" | "tsx",
    _stepHint?: number,
  ) => {
    if (!id) return;
    setSending(true);

    // Optimistically add candidate message
    if (candidate_message || code_submission) {
      setMessages((m) => [
        ...m,
        {
          id: `tmp-${Date.now()}`,
          step: interview?.current_step ?? 1,
          role: "candidate",
          content: candidate_message ?? "(submitted code)",
          code_submission: code_submission ?? null,
          language: lang ?? null,
          created_at: new Date().toISOString(),
        },
      ]);
    }

    try {
      const { data, error } = await supabase.functions.invoke("interview-turn", {
        body: {
          interview_id: id,
          candidate_message,
          code_submission,
          language: lang,
        },
      });

      if (error) {
        const status = (error as any).context?.response?.status ?? 0;
        if (status === 429) toast.error("Rate limit hit. Wait a moment.");
        else if (status === 402) toast.error("AI credits exhausted. Add credits in workspace settings.");
        else toast.error(error.message ?? "Something went wrong.");
        // Roll back optimistic
        await refresh();
        return;
      }

      if (data?.done) {
        await refresh();
        toast.success("Interview complete!");
        navigate(`/interview/${id}/summary`);
        return;
      }

      await refresh();
    } catch (e: any) {
      toast.error(e.message ?? "Something went wrong.");
      await refresh();
    } finally {
      setSending(false);
    }
  };

  const refresh = async () => {
    if (!id) return;
    const [iv, msgs] = await Promise.all([
      supabase.from("interviews").select("*").eq("id", id).maybeSingle(),
      supabase
        .from("interview_messages")
        .select("*")
        .eq("interview_id", id)
        .order("created_at", { ascending: true }),
    ]);
    if (iv.data) setInterview(iv.data as Interview);
    if (msgs.data) setMessages(msgs.data as Message[]);
  };

  const handleSend = async () => {
    if (!input.trim() || sending) return;
    if (isCodeStep) {
      toast.info("Submit your code from the editor on the right.");
      return;
    }
    const text = input.trim();
    setInput("");
    await triggerTurn(text);
  };

  const handleSubmitCode = async () => {
    if (!code.trim() || sending) return;
    await triggerTurn("Submitting my solution.", code, language);
  };

  if (loading) {
    return (
      <div className="min-h-screen relative">
        <AmbientOrbs />
        <TopNav />
        <div className="container py-20 grid place-items-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen relative flex flex-col overflow-hidden">
      <AmbientOrbs />
      <TopNav />

      {/* Progress bar with checkpoints */}
      <div className="container pt-6">
        <div className="glass rounded-2xl px-5 py-4 space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-display font-bold text-sm uppercase tracking-wider">
                {diff?.name}
              </span>
              {interview?.topic && (
                <>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-sm text-muted-foreground truncate">{interview.topic}</span>
                </>
              )}
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="text-xs font-medium text-muted-foreground tabular-nums">
                Step {interview?.current_step ?? 1} of {STEP_LABELS.length}
                <span className="mx-2">·</span>
                {STEP_LABELS[(interview?.current_step ?? 1) - 1]}
              </div>
            </div>
          </div>

          <div className="relative pt-1 pb-1">
            {/* Checkpoints */}
            <div className="relative flex justify-between">
              {/* Track — sits exactly on the dot row (dots are h-3, track h-1, so top 4px centers it) */}
              <div className="absolute left-0 right-0 top-1 h-1 rounded-full bg-secondary z-0" />
              {/* Fill — green liquid + glitter, overlapping the grey track */}
              <div
                className="absolute left-0 top-1 h-1 rounded-full overflow-hidden progress-liquid z-10"
                style={{
                  width: `${Math.max(
                    0,
                    Math.min(100, (((interview?.current_step ?? 1) - 1) / (STEP_LABELS.length - 1)) * 100),
                  )}%`,
                  background:
                    "linear-gradient(90deg, hsl(142 70% 38%) 0%, hsl(142 80% 48%) 50%, hsl(150 85% 55%) 100%)",
                  boxShadow:
                    "0 0 8px hsl(142 80% 50% / 0.55), 0 0 16px hsl(142 80% 50% / 0.35)",
                }}
              >
                <span className="progress-glitter" aria-hidden />
              </div>
              {STEP_LABELS.map((label, i) => {
                const step = i + 1;
                const current = interview?.current_step ?? 1;
                const isActive = current === step;
                const isDone = current > step;
                return (
                  <div key={label} className="relative z-20 flex flex-col items-center gap-2 flex-1 min-w-0">
                    <div
                      className={`h-3 w-3 rounded-full border-2 transition-all duration-300 ${
                        isActive
                          ? "bg-primary border-primary scale-125 shadow-button"
                          : isDone
                            ? "bg-primary border-primary"
                            : "bg-background border-border"
                      }`}
                    />
                    <span
                      className={`text-[10px] md:text-xs font-medium truncate max-w-full transition-colors ${
                        isActive
                          ? "text-foreground"
                          : isDone
                            ? "text-foreground/70"
                            : "text-muted-foreground"
                      }`}
                    >
                      {label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="container flex-1 py-6 grid gap-6 lg:grid-cols-[1fr_1fr] min-h-0 overflow-hidden">
        {/* Left: chat */}
        <div className="glass rounded-2xl flex flex-col min-h-0 h-full overflow-hidden">
          <ScrollArea ref={scrollRef as any} className="flex-1 min-h-0 p-5">
            <div className="space-y-4">
              {messages.map((m) => (
                <MessageBubble key={m.id} m={m} />
              ))}
              {sending && (
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-full gradient-bg grid place-items-center flex-shrink-0">
                    <Bot className="h-4 w-4 text-primary-foreground" />
                  </div>
                  <div className="glass rounded-2xl px-4 py-3 inline-flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-primary animate-blink" />
                    <span className="h-2 w-2 rounded-full bg-primary animate-blink" style={{ animationDelay: "0.2s" }} />
                    <span className="h-2 w-2 rounded-full bg-primary animate-blink" style={{ animationDelay: "0.4s" }} />
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          {!isCompleted && (
            <div className="border-t border-border/40 p-3 flex flex-col gap-2">
              <div className="relative">
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder={
                    isCodeStep
                      ? "Submit your code from the editor →"
                      : "Type your response..."
                  }
                  disabled={sending || isCodeStep}
                  rows={6}
                  className="w-full resize-y min-h-[140px] max-h-[400px] bg-background/60 border-border/60 rounded-xl px-4 py-3 pr-12 leading-relaxed"
                />
                <button
                  type="button"
                  onClick={() => setExpanded(true)}
                  disabled={isCodeStep}
                  aria-label="Expand editor"
                  className="absolute top-2 right-2 h-8 w-8 grid place-items-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors disabled:opacity-40"
                >
                  <Maximize2 className="h-4 w-4" />
                </button>
              </div>
              <div className="flex items-center justify-center gap-3">
                <MicButton
                  disabled={sending || isCodeStep}
                  onTranscript={(text) => {
                    if (!text) return;
                    setInput((prev) => (prev ? `${prev} ${text}` : text));
                  }}
                />
                <Button
                  onClick={handleSend}
                  disabled={sending || !input.trim() || isCodeStep}
                  className="rounded-xl gradient-bg text-primary-foreground h-[52px] px-4 hover:scale-105 transition-smooth"
                >
                  <Send className="h-4 w-4" />
                </Button>
                <span className="text-xs text-muted-foreground">
                  Press <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border/60 text-[10px] font-mono">Enter</kbd> to send
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Expanded composer overlay */}
        {expanded && !isCompleted && (
          <div
            className="fixed inset-0 z-50 bg-background/70 backdrop-blur-md grid place-items-center p-6 animate-in fade-in"
            onClick={() => setExpanded(false)}
          >
            <div
              className="glass rounded-2xl w-full max-w-3xl flex flex-col gap-3 p-4 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">Compose your response</span>
                <button
                  type="button"
                  onClick={() => setExpanded(false)}
                  aria-label="Collapse editor"
                  className="h-8 w-8 grid place-items-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                >
                  <Minimize2 className="h-4 w-4" />
                </button>
              </div>
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                    setExpanded(false);
                  }
                  if (e.key === "Escape") setExpanded(false);
                }}
                placeholder="Type your response..."
                disabled={sending || isCodeStep}
                autoFocus
                className="w-full resize-none bg-background/60 border-border/60 rounded-xl px-4 py-3 leading-relaxed h-[60vh]"
              />
              <div className="flex items-center justify-center gap-3">
                <MicButton
                  disabled={sending || isCodeStep}
                  onTranscript={(text) => {
                    if (!text) return;
                    setInput((prev) => (prev ? `${prev} ${text}` : text));
                  }}
                />
                <Button
                  onClick={() => {
                    handleSend();
                    setExpanded(false);
                  }}
                  disabled={sending || !input.trim() || isCodeStep}
                  className="rounded-xl gradient-bg text-primary-foreground h-[52px] px-4 hover:scale-105 transition-smooth"
                >
                  <Send className="h-4 w-4" />
                </Button>
                <span className="text-xs text-muted-foreground">
                  <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border/60 text-[10px] font-mono">Esc</kbd> to close
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Right: context / editor */}
        <div className="glass rounded-2xl flex flex-col min-h-0 h-full overflow-hidden">
          {isCodeStep ? (
            <>
              <div className="flex items-center justify-between border-b border-border/40 p-3 bg-secondary/30">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <span className="h-3 w-3 rounded-full bg-destructive/80" />
                    <span className="h-3 w-3 rounded-full bg-warning" />
                    <span className="h-3 w-3 rounded-full bg-success" />
                  </div>
                  <span className="ml-2 font-mono text-sm font-medium">
                    Solution.{language}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {allowJsxToggle && (
                    <div className="flex rounded-lg bg-background/60 p-0.5">
                      {(["jsx", "tsx"] as const).map((l) => (
                        <button
                          key={l}
                          onClick={() => setLanguage(l)}
                          className={`px-3 py-1 rounded-md text-xs font-mono font-semibold transition-smooth ${
                            language === l
                              ? "gradient-bg text-primary-foreground shadow-button"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {l.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  )}
                  <Button
                    onClick={handleSubmitCode}
                    disabled={sending}
                    size="sm"
                    className="rounded-full gradient-bg text-primary-foreground hover:scale-105 transition-smooth"
                  >
                    {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Sparkles className="h-3.5 w-3.5" /> Submit code</>}
                  </Button>
                </div>
              </div>
              <div className="flex-1 overflow-auto">
                <CodeMirror
                  value={code}
                  onChange={(v) => setCode(v)}
                  theme={theme === "dark" ? oneDark : "light"}
                  extensions={[javascript({ jsx: true, typescript: language === "tsx" })]}
                  basicSetup={{
                    lineNumbers: true,
                    highlightActiveLine: true,
                    foldGutter: true,
                    autocompletion: true,
                  }}
                  height="100%"
                  className="text-sm h-full"
                />
              </div>
            </>
          ) : (
            <ContextPanel messages={messages} difficulty={diff?.name ?? ""} />
          )}
        </div>
      </div>
    </div>
  );
};

function MessageBubble({ m }: { m: Message }) {
  const isInterviewer = m.role === "interviewer";
  return (
    <div className={`flex items-start gap-3 ${isInterviewer ? "" : "flex-row-reverse"}`}>
      <div
        className={`h-8 w-8 rounded-full grid place-items-center flex-shrink-0 ${
          isInterviewer ? "gradient-bg" : "bg-secondary"
        }`}
      >
        {isInterviewer ? (
          <Bot className="h-4 w-4 text-primary-foreground" />
        ) : (
          <UserIcon className="h-4 w-4" />
        )}
      </div>
      <div
        className={`rounded-2xl px-4 py-3 max-w-[85%] relative group ${
          isInterviewer ? "glass" : "bg-primary/10 border border-primary/20"
        }`}
      >
        <div className="prose prose-sm dark:prose-invert max-w-none prose-pre:bg-secondary/80 prose-pre:text-xs prose-code:font-mono prose-code:text-xs prose-headings:font-display prose-headings:font-bold">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
        </div>
        {m.code_submission && (
          <pre className="mt-2 rounded-lg bg-background/60 border border-border/40 p-3 overflow-x-auto text-xs font-mono">
            <code>{m.code_submission}</code>
          </pre>
        )}
        {isInterviewer && !m.id.startsWith("tmp-") && (
          <div className="mt-2 flex justify-end">
            <SpeakerButton id={m.id} text={m.content} />
          </div>
        )}
      </div>
    </div>
  );
}

function ContextPanel({ messages, difficulty }: { messages: Message[]; difficulty: string }) {
  const lastInterviewer = [...messages].reverse().find((m) => m.role === "interviewer");

  return (
    <div className="flex-1 p-6 flex flex-col">
      <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground mb-4">
        <Code2 className="h-3.5 w-3.5" />
        Context · {difficulty}
      </div>
      {lastInterviewer ? (
        <>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display font-bold text-lg">Current focus</h3>
            <SpeakerButton id={`ctx-${lastInterviewer.id}`} text={lastInterviewer.content} size="md" />
          </div>
          <ScrollArea className="flex-1">
            <div className="prose prose-sm dark:prose-invert max-w-none prose-pre:bg-secondary/80 prose-headings:font-display">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{lastInterviewer.content}</ReactMarkdown>
            </div>
          </ScrollArea>
        </>
      ) : (
        <div className="flex-1 grid place-items-center text-center text-muted-foreground space-y-3">
          <Sparkles className="h-10 w-10 text-primary opacity-60" />
          <p>X is preparing your question...</p>
        </div>
      )}
    </div>
  );
}

export default Interview;
