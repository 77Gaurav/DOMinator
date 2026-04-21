import { useNavigate, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { TopNav } from "@/components/TopNav";
import { AmbientOrbs } from "@/components/AmbientOrbs";
import { Button } from "@/components/ui/button";
import { DIFFICULTIES, type DifficultyId } from "@/lib/interview-config";
import { ArrowLeft, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

const StartInterview = () => {
  const { difficulty } = useParams<{ difficulty: DifficultyId }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);

  const diff = DIFFICULTIES.find((d) => d.id === difficulty);

  useEffect(() => {
    if (!diff) navigate("/app");
  }, [diff, navigate]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") navigate("/app");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate]);

  const startInterview = async () => {
    if (!user || !diff) return;
    setCreating(true);
    const { data, error } = await supabase
      .from("interviews")
      .insert({
        user_id: user.id,
        difficulty: diff.id,
        status: "in_progress",
        current_step: 1,
      })
      .select("id")
      .single();
    setCreating(false);
    if (error || !data) {
      toast.error("Could not start the interview.");
      return;
    }
    navigate(`/interview/${data.id}`);
  };

  if (!diff) return null;

  return (
    <div className="min-h-screen relative">
      <AmbientOrbs />
      <TopNav />

      <main className="container py-10 max-w-3xl space-y-8 animate-fade-in">
        <button
          onClick={() => navigate("/app")}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-smooth"
        >
          <ArrowLeft className="h-4 w-4" /> Back to dashboard
        </button>

        <div className="glass-strong rounded-3xl p-10 space-y-6">
          <div className={`h-2 w-16 rounded-full bg-gradient-to-r ${diff.accent}`} />
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground uppercase tracking-widest">{diff.tagline}</p>
            <h1 className="font-display text-5xl md:text-6xl font-bold tracking-tight">
              {diff.name} <span className="gradient-text">interview</span>
            </h1>
            <p className="text-lg text-muted-foreground">{diff.description}</p>
          </div>

          <div className="rounded-2xl bg-secondary/50 p-5 space-y-3">
            <p className="font-display font-semibold text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              How it works
            </p>
            <ol className="text-sm text-muted-foreground space-y-1.5 list-decimal list-inside">
              <li>DOMinator gives you a semi-formulated question — you complete it.</li>
              <li>Explain what you understood from the question.</li>
              <li>Pitch your approach. DOMinator helps brainstorm if needed.</li>
              <li>Code your solution in the editor (TSX{diff.id === "intern" ? " or JSX" : ""}).</li>
              <li>Optimise, then receive a full review with scores and a hire verdict.</li>
            </ol>
          </div>

          <Button
            size="lg"
            onClick={startInterview}
            disabled={creating}
            className="w-full rounded-full gradient-bg text-primary-foreground h-14 text-base shadow-button hover:scale-[1.02] hover:shadow-glow transition-smooth"
          >
            {creating ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" /> Starting...
              </>
            ) : (
              <>Begin interview <Sparkles className="h-5 w-5" /></>
            )}
          </Button>
        </div>
      </main>
    </div>
  );
};

export default StartInterview;
