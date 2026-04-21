export const DIFFICULTIES = [
  {
    id: "intern" as const,
    name: "Intern",
    tagline: "Foundations & syntax",
    description: "Controlled inputs, conditional rendering, basic hooks. JSX or TSX welcome.",
    accent: "from-foreground to-foreground",
  },
  {
    id: "junior" as const,
    name: "Junior",
    tagline: "Daily component work",
    description: "Forms, lists, fetching, useEffect pitfalls, lifting state, basic patterns.",
    accent: "from-foreground to-foreground",
  },
  {
    id: "senior" as const,
    name: "Senior",
    tagline: "Production-grade React",
    description: "Custom hooks, memoization, suspense, accessibility, debounce, virtualization.",
    accent: "from-foreground to-foreground",
  },
  {
    id: "lead" as const,
    name: "Lead",
    tagline: "Architecture & trade-offs",
    description: "State management strategy, render perf budgets, component APIs, error boundaries.",
    accent: "from-foreground to-foreground",
  },
  {
    id: "architect" as const,
    name: "Architect",
    tagline: "Systems & scale",
    description: "Concurrent features, streaming SSR, design systems, micro-frontends, perf at scale.",
    accent: "from-foreground to-foreground",
  },
];

export type DifficultyId = (typeof DIFFICULTIES)[number]["id"];

export const STEP_LABELS = [
  "Question",
  "Interpretation",
  "Confirm",
  "Approach",
  "Brainstorm",
  "Code",
  "Optimize",
  "Review",
];

export const VERDICT_LABELS: Record<string, { label: string; tone: string }> = {
  strong_no: { label: "Strong No", tone: "bg-muted text-muted-foreground border border-border" },
  no: { label: "No Hire", tone: "bg-muted text-muted-foreground border border-border" },
  lean_no: { label: "Lean No", tone: "bg-secondary text-secondary-foreground border border-border" },
  lean_hire: { label: "Lean Hire", tone: "bg-secondary text-secondary-foreground border border-border" },
  hire: { label: "Hire", tone: "bg-primary text-primary-foreground" },
  strong_hire: { label: "Strong Hire", tone: "bg-primary text-primary-foreground" },
};
