import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { TopNav } from "@/components/TopNav";
import { AmbientOrbs } from "@/components/AmbientOrbs";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Calendar, Loader2, Plus, Trash2, Trophy } from "lucide-react";
import { DIFFICULTIES, VERDICT_LABELS } from "@/lib/interview-config";
import { format } from "date-fns";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

type Profile = {
  display_name: string | null;
  avatar_url: string | null;
  email: string | null;
};

type InterviewRow = {
  id: string;
  difficulty: string;
  topic: string | null;
  status: string;
  overall_score: number | null;
  hire_recommendation: string | null;
  started_at: string;
  completed_at: string | null;
};

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [interviews, setInterviews] = useState<InterviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingDelete, setPendingDelete] = useState<InterviewRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    const { error } = await supabase.from("interviews").delete().eq("id", pendingDelete.id);
    setDeleting(false);
    if (error) {
      toast.error(error.message || "Could not delete interview.");
      return;
    }
    setInterviews((prev) => prev.filter((i) => i.id !== pendingDelete.id));
    toast.success("Interview deleted.");
    setPendingDelete(null);
  };

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [p, i] = await Promise.all([
        supabase.from("profiles").select("display_name, avatar_url, email").eq("user_id", user.id).maybeSingle(),
        supabase
          .from("interviews")
          .select("id, difficulty, topic, status, overall_score, hire_recommendation, started_at, completed_at")
          .order("created_at", { ascending: false })
          .limit(20),
      ]);
      if (p.data) setProfile(p.data);
      if (i.data) setInterviews(i.data as InterviewRow[]);
      setLoading(false);
    })();
  }, [user]);

  const completed = interviews.filter((i) => i.status === "completed");
  const avgScore =
    completed.length > 0
      ? (completed.reduce((s, i) => s + (i.overall_score ?? 0), 0) / completed.length).toFixed(1)
      : "—";

  return (
    <div className="min-h-screen relative">
      <AmbientOrbs />
      <TopNav />

      <main className="container py-10 space-y-10">
        <div className="space-y-2 animate-fade-in">
          <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tight">
            Welcome back,{" "}
            <span className="gradient-text">
              {profile?.display_name?.split(" ")[0] ?? "candidate"}
            </span>
          </h1>
          <p className="text-muted-foreground text-lg">
            Pick up where you left off, or start a fresh interview.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Profile card */}
          <div className="glass rounded-3xl p-6 space-y-5">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16 ring-2 ring-primary/30">
                <AvatarImage src={profile?.avatar_url ?? user?.user_metadata?.avatar_url} />
                <AvatarFallback className="gradient-bg text-primary-foreground font-display text-xl">
                  {profile?.display_name?.[0] ?? "Y"}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="font-display font-bold text-lg truncate">
                  {profile?.display_name ?? user?.email}
                </p>
                <p className="text-sm text-muted-foreground truncate">{profile?.email ?? user?.email}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-secondary/60 p-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Interviews</p>
                <p className="font-display text-3xl font-bold mt-1">{interviews.length}</p>
              </div>
              <div className="rounded-xl bg-secondary/60 p-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Avg score</p>
                <p className="font-display text-3xl font-bold mt-1 gradient-text">{avgScore}</p>
              </div>
            </div>
          </div>

          {/* Start new interview */}
          <div className="glass rounded-3xl p-6 lg:col-span-2 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="h-10 w-10 rounded-xl gradient-bg grid place-items-center shadow-button">
                  <Plus className="h-5 w-5 text-primary-foreground" />
                </div>
                <h2 className="font-display font-bold text-2xl">Start a new interview</h2>
              </div>
              <p className="text-muted-foreground mb-6">
                Pick a difficulty. The AI Lead Engineer will guide you through 8 steps — semi-formed
                question, interpretation check, approach, code editor, optimisation, and a full
                review.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {DIFFICULTIES.map((d) => (
                <Link
                  key={d.id}
                  to={`/start/${d.id}`}
                  className="group rounded-2xl glass p-4 hover:scale-[1.04] hover:shadow-glow transition-smooth text-left"
                >
                  <div className={`h-2 w-10 rounded-full bg-gradient-to-r ${d.accent} mb-3`} />
                  <p className="font-display font-bold text-base">{d.name}</p>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{d.tagline}</p>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Previous interviews */}
        <div className="space-y-4">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display font-bold text-2xl">Previous interviews</h2>
            <span className="text-sm text-muted-foreground">{interviews.length} total</span>
          </div>

          {loading ? (
            <div className="glass rounded-2xl p-10 text-center text-muted-foreground">Loading...</div>
          ) : interviews.length === 0 ? (
            <div className="glass rounded-3xl p-12 text-center space-y-3">
              <Trophy className="h-10 w-10 mx-auto text-primary opacity-60" />
              <p className="font-display text-lg">No interviews yet</p>
              <p className="text-sm text-muted-foreground">Pick a difficulty above to get started.</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {interviews.map((iv) => {
                const diff = DIFFICULTIES.find((d) => d.id === iv.difficulty);
                const verdict = iv.hire_recommendation && VERDICT_LABELS[iv.hire_recommendation];
                const target =
                  iv.status === "completed" ? `/interview/${iv.id}/summary` : `/interview/${iv.id}`;
                return (
                  <div
                    key={iv.id}
                    className="glass rounded-2xl p-5 hover:scale-[1.02] hover:shadow-glow transition-smooth group relative"
                  >
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPendingDelete(iv);
                      }}
                      aria-label="Delete interview"
                      title="Delete interview"
                      className="absolute top-3 right-3 z-10 h-7 w-7 inline-flex items-center justify-center rounded-full border border-border/60 bg-background/70 text-muted-foreground hover:text-destructive hover:border-destructive/60 hover:bg-destructive/10 transition-smooth opacity-0 group-hover:opacity-100 focus:opacity-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => navigate(target)}
                      className="text-left w-full"
                    >
                      <div className="flex items-start justify-between gap-3 mb-3 pr-8">
                        <div>
                          <div className={`h-1.5 w-8 rounded-full bg-gradient-to-r ${diff?.accent} mb-2`} />
                          <p className="font-display font-bold text-lg">{diff?.name}</p>
                          <p className="text-sm text-muted-foreground line-clamp-1">
                            {iv.topic ?? "React interview"}
                          </p>
                        </div>
                        {iv.status === "in_progress" && (
                          <Badge variant="outline" className="border-warning text-warning">
                            In progress
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(iv.started_at), "MMM d, yyyy")}
                        </span>
                        {iv.overall_score != null && (
                          <span className="font-display font-bold text-base text-foreground">
                            {iv.overall_score.toFixed(1)}<span className="text-muted-foreground text-xs">/10</span>
                          </span>
                        )}
                      </div>

                      {verdict && (
                        <div className="mt-3">
                          <span className={`inline-block rounded-full text-xs font-semibold px-3 py-1 ${verdict.tone}`}>
                            {verdict.label}
                          </span>
                        </div>
                      )}

                      <div className="mt-3 text-xs text-primary inline-flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-smooth">
                        View {iv.status === "completed" ? "summary" : "interview"}
                        <ArrowRight className="h-3 w-3" />
                      </div>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      <AlertDialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this interview?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the {DIFFICULTIES.find((d) => d.id === pendingDelete?.difficulty)?.name}
              {pendingDelete?.topic ? ` · ${pendingDelete.topic}` : ""} session, including its transcript and
              scores. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Dashboard;
