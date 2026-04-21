import { useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw, Timer as TimerIcon, TimerReset, ChevronLeft } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Mode = "stopwatch" | "timer";
type View = "select" | "stopwatch" | "timer";

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

function formatHMS(ms: number) {
  if (ms < 0) ms = 0;
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

export function TimerWidget() {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>("select");
  const [activeMode, setActiveMode] = useState<Mode | null>(null);

  // Stopwatch state
  const [swElapsed, setSwElapsed] = useState(0);
  const [swRunning, setSwRunning] = useState(false);
  const swAnchorRef = useRef<number>(0); // performance.now() at start
  const swBaseRef = useRef<number>(0);   // accumulated ms before current run

  // Timer state
  const [tHours, setTHours] = useState(0);
  const [tMinutes, setTMinutes] = useState(1);
  const [tRemaining, setTRemaining] = useState(0); // ms
  const [tRunning, setTRunning] = useState(false);
  const tEndRef = useRef<number>(0); // performance.now() target

  // Tick loop
  useEffect(() => {
    if (!swRunning && !tRunning) return;
    const id = setInterval(() => {
      const now = performance.now();
      if (swRunning) setSwElapsed(swBaseRef.current + (now - swAnchorRef.current));
      if (tRunning) {
        const left = Math.max(0, tEndRef.current - now);
        setTRemaining(left);
        if (left <= 0) {
          setTRunning(false);
          setActiveMode((m) => (m === "timer" ? null : m));
        }
      }
    }, 250);
    return () => clearInterval(id);
  }, [swRunning, tRunning]);

  // Handlers — stopwatch
  const startStopwatch = () => {
    swAnchorRef.current = performance.now();
    setSwRunning(true);
    setActiveMode("stopwatch");
    setOpen(false);
  };
  const pauseStopwatch = () => {
    swBaseRef.current = swBaseRef.current + (performance.now() - swAnchorRef.current);
    setSwElapsed(swBaseRef.current);
    setSwRunning(false);
  };
  const resumeStopwatch = () => {
    swAnchorRef.current = performance.now();
    setSwRunning(true);
  };
  const resetStopwatch = () => {
    swBaseRef.current = 0;
    setSwElapsed(0);
    setSwRunning(false);
    setActiveMode(null);
  };

  // Handlers — timer
  const startTimer = () => {
    const totalMs = (tHours * 3600 + tMinutes * 60) * 1000;
    if (totalMs <= 0) return;
    tEndRef.current = performance.now() + totalMs;
    setTRemaining(totalMs);
    setTRunning(true);
    setActiveMode("timer");
    setOpen(false);
  };
  const pauseTimer = () => {
    setTRemaining(Math.max(0, tEndRef.current - performance.now()));
    setTRunning(false);
  };
  const resumeTimer = () => {
    tEndRef.current = performance.now() + tRemaining;
    setTRunning(true);
  };
  const resetTimer = () => {
    setTRunning(false);
    setTRemaining(0);
    setActiveMode(null);
  };

  // Compact running display (when something is active and popover closed)
  const runningDisplay = activeMode === "stopwatch"
    ? formatHMS(swElapsed)
    : activeMode === "timer"
      ? formatHMS(tRemaining)
      : null;

  const isRunning = activeMode === "stopwatch" ? swRunning : tRunning;
  const togglePause = () => {
    if (activeMode === "stopwatch") swRunning ? pauseStopwatch() : resumeStopwatch();
    if (activeMode === "timer") tRunning ? pauseTimer() : resumeTimer();
  };
  const resetActive = () => {
    if (activeMode === "stopwatch") resetStopwatch();
    if (activeMode === "timer") resetTimer();
  };

  // If popover opens with an active mode, jump straight to its panel
  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) setView(activeMode ?? "select");
  };

  return (
    <div className="flex items-center gap-2">
      {runningDisplay && (
        <div className="hidden sm:inline-flex items-center gap-1.5 rounded-md border border-border bg-secondary/60 px-2 py-1 text-xs">
          <button
            onClick={togglePause}
            className="grid place-items-center h-5 w-5 rounded hover:bg-accent transition-smooth"
            aria-label={isRunning ? "Pause" : "Resume"}
          >
            {isRunning ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
          </button>
          <span className="font-mono font-semibold tabular-nums text-primary">
            {runningDisplay}
          </span>
          <button
            onClick={resetActive}
            className="grid place-items-center h-5 w-5 rounded hover:bg-accent transition-smooth"
            aria-label="Reset"
          >
            <RotateCcw className="h-3 w-3" />
          </button>
        </div>
      )}

      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <button
            className={cn(
              "h-9 w-9 grid place-items-center rounded-md border border-border bg-secondary/40 hover:bg-secondary transition-smooth",
              activeMode && "ring-2 ring-primary/30",
            )}
            aria-label="Stopwatch and timer"
          >
            <TimerIcon className="h-4 w-4" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-[300px] p-3 glass-strong">
          {view === "select" && (
            <SelectorView
              onPick={(m) => setView(m)}
            />
          )}

          {view === "stopwatch" && (
            <StopwatchPanel
              elapsed={swElapsed}
              running={swRunning}
              onBack={() => setView("select")}
              onStart={startStopwatch}
              onPause={pauseStopwatch}
              onResume={resumeStopwatch}
              onReset={resetStopwatch}
              hasRun={swElapsed > 0 || swRunning}
            />
          )}

          {view === "timer" && (
            <TimerPanel
              hours={tHours}
              minutes={tMinutes}
              remaining={tRemaining}
              running={tRunning}
              setHours={setTHours}
              setMinutes={setTMinutes}
              onBack={() => setView("select")}
              onStart={startTimer}
              onPause={pauseTimer}
              onResume={resumeTimer}
              onReset={resetTimer}
              hasRun={tRemaining > 0 || tRunning}
            />
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}

function SelectorView({ onPick }: { onPick: (m: Mode) => void }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => onPick("stopwatch")}
          className="flex flex-col items-center justify-center gap-2 rounded-md border border-border bg-secondary/40 hover:bg-secondary transition-smooth py-5"
        >
          <TimerIcon className="h-6 w-6 text-primary" />
          <span className="text-sm font-medium">Stopwatch</span>
        </button>
        <button
          onClick={() => onPick("timer")}
          className="flex flex-col items-center justify-center gap-2 rounded-md border border-border bg-secondary/40 hover:bg-secondary transition-smooth py-5"
        >
          <TimerReset className="h-6 w-6 text-primary" />
          <span className="text-sm font-medium">Timer</span>
        </button>
      </div>
    </div>
  );
}

function StopwatchPanel({
  elapsed, running, hasRun, onBack, onStart, onPause, onResume, onReset,
}: {
  elapsed: number;
  running: boolean;
  hasRun: boolean;
  onBack: () => void;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onReset: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-smooth">
          <ChevronLeft className="h-3.5 w-3.5" /> Back
        </button>
        <div className="inline-flex items-center gap-1.5 text-xs font-medium">
          <TimerIcon className="h-3.5 w-3.5 text-primary" /> Stopwatch
        </div>
      </div>
      <div className="rounded-md border border-border bg-secondary/40 py-6 text-center">
        <div className="font-mono text-3xl font-bold tabular-nums">{formatHMS(elapsed)}</div>
      </div>
      <div className="flex gap-2">
        {!hasRun && (
          <Button onClick={onStart} className="flex-1 h-9">
            <Play className="h-3.5 w-3.5" /> Start Stopwatch
          </Button>
        )}
        {hasRun && running && (
          <Button onClick={onPause} variant="secondary" className="flex-1 h-9">
            <Pause className="h-3.5 w-3.5" /> Pause
          </Button>
        )}
        {hasRun && !running && (
          <Button onClick={onResume} className="flex-1 h-9">
            <Play className="h-3.5 w-3.5" /> Resume
          </Button>
        )}
        {hasRun && (
          <Button onClick={onReset} variant="outline" className="h-9">
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

function TimerPanel({
  hours, minutes, remaining, running, hasRun,
  setHours, setMinutes, onBack, onStart, onPause, onResume, onReset,
}: {
  hours: number;
  minutes: number;
  remaining: number;
  running: boolean;
  hasRun: boolean;
  setHours: (n: number) => void;
  setMinutes: (n: number) => void;
  onBack: () => void;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onReset: () => void;
}) {
  const showCountdown = hasRun;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-smooth">
          <ChevronLeft className="h-3.5 w-3.5" /> Back
        </button>
        <div className="inline-flex items-center gap-1.5 text-xs font-medium">
          <TimerReset className="h-3.5 w-3.5 text-primary" /> Timer
        </div>
      </div>

      <div className="rounded-md border border-border bg-secondary/40 py-5 px-3">
        {showCountdown ? (
          <div className="font-mono text-3xl font-bold tabular-nums text-center">
            {formatHMS(remaining)}
          </div>
        ) : (
          <div className="flex items-center justify-center gap-3">
            <div className="flex items-end gap-1">
              <Input
                type="number"
                min={0}
                max={99}
                value={pad(hours)}
                onChange={(e) => setHours(Math.max(0, Math.min(99, parseInt(e.target.value || "0", 10))))}
                className="w-20 h-12 px-3 text-center font-mono text-xl font-bold tabular-nums"
              />
              <span className="text-xs text-muted-foreground pb-1">hr</span>
            </div>
            <div className="flex items-end gap-1">
              <Input
                type="number"
                min={0}
                max={59}
                value={pad(minutes)}
                onChange={(e) => setMinutes(Math.max(0, Math.min(59, parseInt(e.target.value || "0", 10))))}
                className="w-20 h-12 px-3 text-center font-mono text-xl font-bold tabular-nums"
              />
              <span className="text-xs text-muted-foreground pb-1">min</span>
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        {!hasRun && (
          <Button onClick={onStart} disabled={hours === 0 && minutes === 0} className="flex-1 h-9">
            <Play className="h-3.5 w-3.5" /> Start Timer
          </Button>
        )}
        {hasRun && running && (
          <Button onClick={onPause} variant="secondary" className="flex-1 h-9">
            <Pause className="h-3.5 w-3.5" /> Pause
          </Button>
        )}
        {hasRun && !running && remaining > 0 && (
          <Button onClick={onResume} className="flex-1 h-9">
            <Play className="h-3.5 w-3.5" /> Resume
          </Button>
        )}
        {hasRun && (
          <Button onClick={onReset} variant="outline" className="h-9">
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}
