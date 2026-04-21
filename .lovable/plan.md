
# DOMinator — React Interview Platform

A glassmorphism-styled interview platform where an AI Lead Engineer ("X") conducts adaptive React interviews with candidates ("Y") across 5 difficulty tiers.

## Stack & Setup
- **Backend**: Lovable Cloud (auth, database, edge functions)
- **Auth**: Google OAuth 2.0 only
- **AI**: Lovable AI Gateway (`google/gemini-3-flash-preview`) via streaming edge function
- **Editor**: CodeMirror 6 with JSX/TSX language support + dark/light themes
- **Fonts**: Syne (headings), Inter (body) via Google Fonts
- **Theme**: Light/dark mode toggle, lavender→white gradient bg (light) / deep purple-black (dark), purple→violet gradient accent (`#A855F7 → #7C3AED`), glassmorphic cards (backdrop-blur, white/10 borders), crisp pill buttons with subtle scale + glow on hover

## Database Schema
- `profiles` — id, user_id, display_name, avatar_url, created_at
- `interviews` — id, user_id, difficulty, topic, status (in_progress/completed), started_at, completed_at, overall_score, hire_recommendation, summary
- `interview_messages` — id, interview_id, step (1–8), role (interviewer/candidate/system), content, code_submission, language (jsx/tsx), created_at
- `interview_scores` — id, interview_id, interpretation_score, approach_score, code_quality_score, optimization_score, notes
- RLS: users only access their own rows; roles in separate `user_roles` table

## Pages & Flows

**1. Landing / Login** — Hero with glassmorphic card, "Sign in with Google" CTA, animated gradient orb background.

**2. Dashboard (`/app`)** — Top nav (logo, theme toggle, avatar menu). Three primary glass cards in a responsive grid:
   - **Profile** — avatar, name, total interviews, average score
   - **Previous Interviews** — list of summary cards (date, difficulty, topic, score badge, hire verdict)
   - **Start New Interview** — opens difficulty selector

**3. Difficulty Selection** — Responsive grid (1/2/3/5 cols) of 5 glass tiles: Intern, Junior, Senior, Lead, Architect. Each shows what kind of real-world React problems will be asked.

**4. Interview Room (`/interview/:id`)** — Two-pane layout:
   - **Left**: chat transcript with X (interviewer) and Y (candidate) bubbles, markdown rendering, current step indicator (1–8 stepper at top)
   - **Right**: context panel — shows the active question, then morphs into the **CodeMirror editor** at Step 6 (with file tab "Solution.tsx", JSX/TSX toggle visible only for Intern, "Submit Code" button)
   - Streaming AI responses, typing indicator
   - Steps 1–5 happen via chat. Step 6 swaps right panel to editor + locks chat input until code is submitted. Steps 7–8 return to chat with the submitted code referenced.

**5. Interview Summary** — Shown after Step 8. Per-step scores (interpretation, approach, code quality, optimization) as radial/bar visuals, overall score, hire recommendation badge (Strong No → No → Lean No → Lean Hire → Hire → Strong Hire), full written review, "View Transcript" button.

**6. Transcript Replay (`/interview/:id/transcript`)** — Read-only full conversation + final code + scores.

## AI Interviewer Logic (edge function `interview-turn`)
- Stateful: receives full message history + current step + difficulty + (optionally) submitted code
- System prompt encodes the 8-step rulebook, difficulty-specific topic pools (real daily React problems: controlled inputs, list virtualization, debounce hooks, error boundaries, suspense, memoization pitfalls, render perf, custom hooks, accessibility, etc.)
- Returns: `{ next_step, message, advance: boolean }` so the frontend knows when to move the stepper
- Final scoring uses tool-calling for structured JSON output (per-step scores + verdict + review)
- Streams tokens for chat steps; non-streaming structured call for final review
- Handles 429 (rate limit) and 402 (credits) with friendly toasts

## Design System Details
- Glass cards: `bg-white/60 dark:bg-white/5 backdrop-blur-xl border border-white/40 dark:border-white/10 shadow-[0_8px_32px_rgba(124,58,237,0.12)]`
- Primary button: gradient fill, rounded-full, `hover:scale-[1.02] hover:shadow-purple-500/40` transition
- Headings: Syne, tight tracking, deep purple-black in light / near-white in dark
- Theme toggle persists in localStorage, respects `prefers-color-scheme` initially
- Subtle ambient gradient orbs (blurred, fixed) in background for depth

## Build Order
1. Theme system, fonts, design tokens, glass + button primitives
2. Lovable Cloud + Google OAuth + profile auto-creation trigger
3. Dashboard shell with three cards + navigation
4. Difficulty selector + interview creation
5. Interview room: chat + streaming edge function + 8-step state machine
6. CodeMirror integration with JSX/TSX toggle
7. Final scoring (structured AI output) + summary screen
8. Previous interviews list + transcript replay
