import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { supabase } from "@/integrations/supabase/client";
import { TopNav } from "@/components/TopNav";
import { AmbientOrbs } from "@/components/AmbientOrbs";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DIFFICULTIES, VERDICT_LABELS } from "@/lib/interview-config";
import { ArrowLeft, FileText, Loader2, Trophy } from "lucide-react";

type Interview = {
  id: string;
  difficulty: string;
  topic: string | null;
  overall_score: number | null;
  hire_recommendation: string | null;
  summary: string | null;
  completed_at: string | null;
};

type Scores = {
  interpretation_score: number | null;
  approach_score: number | null;
  code_quality_score: number | null;
  optimization_score: number | null;
};

type Message = {
  id: string;
  role: string;
  content: string;
  step: number;
  created_at: string;
};

const Summary = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [interview, setInterview] = useState<Interview | null>(null);
  const [scores, setScores] = useState<Scores | null>(null);
  const [finalReview, setFinalReview] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const [iv, sc, msgs] = await Promise.all([
        supabase.from("interviews").select("*").eq("id", id).maybeSingle(),
        supabase.from("interview_scores").select("*").eq("interview_id", id).maybeSingle(),
        supabase
          .from("interview_messages")
          .select("id, role, content, step, created_at")
          .eq("interview_id", id)
          .eq("step", 8)
          .order("created_at", { ascending: false })
          .limit(1),
      ]);
      if (iv.data) setInterview(iv.data as Interview);
      if (sc.data) setScores(sc.data as Scores);
      if (msgs.data?.[0]) setFinalReview(msgs.data[0].content);
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

  if (!interview) return null;

  const diff = DIFFICULTIES.find((d) => d.id === interview.difficulty);
  const verdict = interview.hire_recommendation && VERDICT_LABELS[interview.hire_recommendation];

  const dims = [
    { name: "Interpretation", value: scores?.interpretation_score ?? 0 },
    { name: "Approach", value: scores?.approach_score ?? 0 },
    { name: "Code quality", value: scores?.code_quality_score ?? 0 },
    { name: "Optimisation", value: scores?.optimization_score ?? 0 },
  ];

  return (
    <div className="min-h-screen relative">
      <AmbientOrbs />
      <TopNav />

      <main className="container py-10 max-w-5xl space-y-8 animate-fade-in">
        <button
          onClick={() => navigate("/app")}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-smooth"
        >
          <ArrowLeft className="h-4 w-4" /> Back to dashboard
        </button>

        <div className="glass-strong rounded-3xl p-8 md:p-10 space-y-6">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div className="space-y-2">
              <div className={`h-2 w-16 rounded-full bg-gradient-to-r ${diff?.accent}`} />
              <p className="text-sm text-muted-foreground uppercase tracking-widest">
                {diff?.name} interview · {interview.topic ?? "React"}
              </p>
              <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tight">
                Interview <span className="gradient-text">summary</span>
              </h1>
            </div>
            <div className="text-right space-y-2">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Overall</p>
              <p className="font-display text-6xl font-bold gradient-text leading-none">
                {interview.overall_score?.toFixed(1) ?? "—"}
                <span className="text-2xl text-muted-foreground">/10</span>
              </p>
              {verdict && (
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full text-sm font-semibold px-4 py-1.5 ${verdict.tone}`}
                >
                  <Trophy className="h-4 w-4" />
                  {verdict.label}
                </span>
              )}
            </div>
          </div>

          {interview.summary && (
            <div className="rounded-2xl bg-secondary/40 p-5 border border-border/40">
              <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Executive summary</p>
              <p className="text-base leading-relaxed">{interview.summary}</p>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {dims.map((d) => (
              <div key={d.name} className="rounded-2xl glass p-5 space-y-3">
                <p className="text-xs uppercase tracking-widest text-muted-foreground">{d.name}</p>
                <p className="font-display text-3xl font-bold">
                  {d.value.toFixed(1)}
                  <span className="text-base text-muted-foreground">/10</span>
                </p>
                <div className="h-2 rounded-full bg-secondary overflow-hidden">
                  <div
                    className="h-full gradient-bg rounded-full transition-all"
                    style={{ width: `${(d.value / 10) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {finalReview && (
          <div className="glass rounded-3xl p-8">
            <h2 className="font-display font-bold text-2xl mb-4">Detailed review</h2>
            <div className="prose prose-sm md:prose-base dark:prose-invert max-w-none prose-headings:font-display prose-headings:font-bold prose-pre:bg-secondary/80">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{finalReview}</ReactMarkdown>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <Button asChild variant="outline" className="rounded-full glass hover:scale-105 transition-smooth">
            <Link to={`/interview/${id}/transcript`}>
              <FileText className="h-4 w-4" /> View transcript
            </Link>
          </Button>
          <Button
            onClick={() => navigate("/app")}
            className="rounded-full gradient-bg text-primary-foreground hover:scale-105 transition-smooth"
          >
            New interview
          </Button>
        </div>
      </main>
    </div>
  );
};

export default Summary;
