

# Migrate DOMinator off Lovable to a self-hosted local stack

Goal: produce a local-runnable codebase with zero Lovable runtime/branding, talking to **your own Supabase project** and **Google Gemini-2.5-Flash** directly. ElevenLabs stays as-is.

---

## 1. Strip Lovable branding & runtime hooks

**Code/branding edits**
- `index.html` — remove `og:image` pointing to `lovable.dev`, replace with `/og-image.png` (placeholder you can swap). Keep DOMinator title/description.
- `src/pages/Landing.tsx` — change footer `"Powered by Lovable Cloud + AI"` → `"Built with React • Supabase • Gemini"`.
- `README.md` — rewrite as a normal local-dev README (install, env, supabase migrate, run).
- `public/favicon.ico` — replace with a DOMinator favicon (simple "D" mark generated as SVG → PNG, written to `/public/favicon.svg` + `/public/favicon.png`).
- `public/og-image.png` — generated DOMinator OG card.
- Toast: `src/components/ui/sonner.tsx` & `toaster.tsx` already use shadcn — no Lovable strings, but I'll grep all `*.tsx` for stray "Lovable" toast copy and rewrite if found.

**Dependency removals (`package.json`)**
- Remove `@lovable.dev/cloud-auth-js`
- Remove `lovable-tagger` (devDep)
- Remove `componentTagger()` plugin from `vite.config.ts`

**File deletions**
- `src/integrations/lovable/` (entire folder)
- `.lovable/plan.md` (optional; left untouched if you prefer history)

---

## 2. Replace Lovable Auth with native Supabase Google OAuth

- `src/pages/Landing.tsx`: replace `lovable.auth.signInWithOAuth("google", …)` with:
  ```ts
  await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${window.location.origin}/app` }
  });
  ```
- Rewrite `src/integrations/supabase/client.ts` so it is **no longer auto-managed** — it reads from `import.meta.env.VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (standard names, not the Lovable-prefixed `PUBLISHABLE_KEY`).
- `AuthContext.tsx` already uses pure Supabase — no change.
- Document in README: enable Google provider in Supabase dashboard, set authorized redirect to `http://localhost:8080/app`.

---

## 3. Swap Lovable AI Gateway → Google Gemini direct

Edit `supabase/functions/interview-turn/index.ts`:
- Replace `LOVABLE_API_KEY` with `GEMINI_API_KEY` (read via `Deno.env.get`).
- Replace endpoint `https://ai.gateway.lovable.dev/v1/chat/completions` with the **Gemini OpenAI-compatible endpoint**:
  `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions`
  (Authorization: `Bearer ${GEMINI_API_KEY}`) — keeps the existing tool-calling / messages payload intact.
- Change model from `google/gemini-3-flash-preview` → `gemini-2.5-flash` for both `callAITurn` and `callAIStructured`.
- Keep 429/402 → 429/500 error handling, drop the "Lovable workspace credits" wording.

`elevenlabs-stt` and `elevenlabs-tts` functions: no changes (already use `ELEVENLABS_API_KEY`).

---

## 4. Migrate Supabase to *your* project (RLS-safe)

Existing schema & RLS are already correct (per-user `user_id = auth.uid()` policies, EXISTS-based child policies on messages/scores — no recursion risk). I'll consolidate everything into a single fresh local migration so you can `supabase db reset` cleanly:

- `supabase/migrations/00000000000000_init.sql` — single self-contained init: enums, tables, RLS, `update_updated_at_column`, `handle_new_user` trigger on `auth.users`, indexes, FK cascades. (Replaces the two existing migrations, no behaviour change.)
- `supabase/config.toml` — replace Lovable `project_id = "ccrcuoimcrzrmveizjyw"` with a placeholder + comment telling you to run `supabase link --project-ref <yours>`.
- `src/integrations/supabase/types.ts` — keep current generated types; add a one-liner in README on regenerating with `supabase gen types typescript`.

**RLS verification I'll do before declaring done:** every table has RLS enabled; every policy keys off `auth.uid()`; no policy uses `true`; child tables (`interview_messages`, `interview_scores`) gate via `EXISTS (SELECT 1 FROM interviews WHERE user_id = auth.uid())` — no recursion, no leakage.

---

## 5. Local-dev surface

- New `.env.example` (committed) with:
  ```
  VITE_SUPABASE_URL=
  VITE_SUPABASE_ANON_KEY=
  ```
- `vite.config.ts` cleaned of `componentTagger`, alias kept.
- README documents:
  1. `npm install`
  2. Copy `.env.example` → `.env`, fill Supabase URL + anon key
  3. `supabase link --project-ref <ref>` → `supabase db push`
  4. Set Supabase function secrets: `supabase secrets set GEMINI_API_KEY=… ELEVENLABS_API_KEY=…`
  5. `supabase functions deploy interview-turn elevenlabs-stt elevenlabs-tts`
  6. Configure Google provider + redirect URL in Supabase dashboard
  7. `npm run dev`

---

## Files touched (summary)

| Action | Path |
|---|---|
| Edit | `index.html`, `vite.config.ts`, `package.json`, `README.md`, `src/pages/Landing.tsx`, `src/integrations/supabase/client.ts`, `supabase/functions/interview-turn/index.ts`, `supabase/config.toml` |
| Create | `.env.example`, `public/favicon.svg`, `public/favicon.png`, `public/og-image.png`, `supabase/migrations/00000000000000_init.sql` |
| Delete | `src/integrations/lovable/`, old two migration files, `bun.lock` (regenerated), `package-lock.json` (regenerated on `npm i`) |

## Open item before I implement

You said you'd paste the Gemini key — please drop it in the next message (or just say "use placeholder" and I'll wire `GEMINI_API_KEY` env var without hardcoding). I will **never hardcode it** either way; the question is only whether you want me to also stash it in `.env.example` as a comment for your reference.
