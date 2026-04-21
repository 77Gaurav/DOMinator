import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { supabase } from "@/integrations/supabase/client";
import { TopNav } from "@/components/TopNav";
import { AmbientOrbs } from "@/components/AmbientOrbs";
import { Button } from "@/components/ui/button";
import { DIFFICULTIES, STEP_LABELS } from "@/lib/interview-config";
import { ArrowLeft, Bot, Loader2, User as UserIcon } from "lucide-react";

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
  difficulty: string;
  topic: string | null;
};

const Transcript = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [interview, setInterview] = useState<Interview | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const [iv, msgs] = await Promise.all([
        supabase.from("interviews").select("id, difficulty, topic").eq("id", id).maybeSingle(),
        supabase
          .from("interview_messages")
          .select("*")
          .eq("interview_id", id)
          .order("created_at", { ascending: true }),
      ]);
      if (iv.data) setInterview(iv.data as Interview);
      if (msgs.data) setMessages(msgs.data as Message[]);
      setLoading(false);
    })();
  }, [id]);

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

  const diff = DIFFICULTIES.find((d) => d.id === interview?.difficulty);

  return (
    <div className="min-h-screen relative">
      <AmbientOrbs />
      <TopNav />

      <main className="container py-10 max-w-3xl space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate(`/interview/${id}/summary`)}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-smooth"
          >
            <ArrowLeft className="h-4 w-4" /> Back to summary
          </button>
          <Button onClick={() => navigate("/app")} variant="outline" className="rounded-full glass">
            Dashboard
          </Button>
        </div>

        <div className="glass-strong rounded-3xl p-6 space-y-2">
          <div className={`h-2 w-16 rounded-full bg-gradient-to-r ${diff?.accent}`} />
          <h1 className="font-display text-3xl font-bold">
            {diff?.name} · {interview?.topic ?? "React interview"}
          </h1>
          <p className="text-sm text-muted-foreground">Full transcript ({messages.length} messages)</p>
        </div>

        <div className="space-y-4">
          {messages.map((m) => {
            const isInterviewer = m.role === "interviewer";
            return (
              <div key={m.id} className="space-y-1">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground px-2">
                  Step {m.step} · {STEP_LABELS[m.step - 1]} · {isInterviewer ? "X (Interviewer)" : "Y (Candidate)"}
                </div>
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
                    className={`rounded-2xl px-4 py-3 max-w-[85%] ${
                      isInterviewer ? "glass" : "bg-primary/10 border border-primary/20"
                    }`}
                  >
                    <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:font-display prose-pre:bg-secondary/80 prose-pre:text-xs">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                    </div>
                    {m.code_submission && (
                      <pre className="mt-3 rounded-lg bg-background/60 border border-border/40 p-3 overflow-x-auto text-xs font-mono">
                        <code>{m.code_submission}</code>
                      </pre>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
};

export default Transcript;
