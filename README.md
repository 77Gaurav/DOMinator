# DOMinator

Adaptive, AI-led React interviews across five difficulty tiers — Intern → Architect.

Stack: React 18 + Vite + Tailwind + shadcn/ui · Supabase (Auth/DB/Edge Functions) · Google Gemini 2.5 Flash · ElevenLabs (STT/TTS).

---

## Local setup

### 1. Install
```bash
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
```
Fill in:
- `VITE_SUPABASE_URL` — your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` — your Supabase anon/publishable key

### 3. Provision the Supabase project
Install the [Supabase CLI](https://supabase.com/docs/guides/cli), then:
```bash
supabase link --project-ref <YOUR_PROJECT_REF>
supabase db push
```
This applies the migrations in `supabase/migrations/` (tables, RLS policies, the `handle_new_user` trigger, etc.).

### 4. Set edge-function secrets
```bash
supabase secrets set GEMINI_API_KEY=your_gemini_key
supabase secrets set ELEVENLABS_API_KEY=your_elevenlabs_key
```
Get a Gemini key at https://aistudio.google.com/apikey.

### 5. Deploy edge functions
```bash
supabase functions deploy interview-turn
supabase functions deploy elevenlabs-stt
supabase functions deploy elevenlabs-tts
```

### 6. Enable Google OAuth
In the Supabase dashboard → **Authentication → Providers → Google**:
- Enable the provider
- Add OAuth credentials (Client ID + Secret) from Google Cloud Console
- Add authorized redirect URLs:
  - `http://localhost:8080/app`
  - your production URL

### 7. Run
```bash
npm run dev
```
Open http://localhost:8080.

---

## Regenerating Supabase types
After schema changes:
```bash
supabase gen types typescript --linked > src/integrations/supabase/types.ts
```

## Tests
```bash
npm test
```

## Project layout
```
src/
  pages/                 # Route components
  components/            # UI + feature components
  contexts/              # Auth, Theme
  integrations/supabase/ # client + generated types
  hooks/                 # useVoice, etc.
supabase/
  functions/             # interview-turn, elevenlabs-stt, elevenlabs-tts
  migrations/            # Schema + RLS
```
