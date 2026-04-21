-- Updated_at helper
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, avatar_url, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data ->> 'avatar_url',
    NEW.email
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ INTERVIEWS ============
CREATE TYPE public.interview_difficulty AS ENUM ('intern','junior','senior','lead','architect');
CREATE TYPE public.interview_status AS ENUM ('in_progress','completed','abandoned');
CREATE TYPE public.hire_verdict AS ENUM ('strong_no','no','lean_no','lean_hire','hire','strong_hire');

CREATE TABLE public.interviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  difficulty public.interview_difficulty NOT NULL,
  topic TEXT,
  current_step SMALLINT NOT NULL DEFAULT 1,
  status public.interview_status NOT NULL DEFAULT 'in_progress',
  overall_score NUMERIC(4,1),
  hire_recommendation public.hire_verdict,
  summary TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.interviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own interviews"
  ON public.interviews FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own interviews"
  ON public.interviews FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own interviews"
  ON public.interviews FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own interviews"
  ON public.interviews FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_interviews_user ON public.interviews(user_id, created_at DESC);

CREATE TRIGGER update_interviews_updated_at
  BEFORE UPDATE ON public.interviews
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ INTERVIEW MESSAGES ============
CREATE TABLE public.interview_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  interview_id UUID NOT NULL REFERENCES public.interviews(id) ON DELETE CASCADE,
  step SMALLINT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('interviewer','candidate','system')),
  content TEXT NOT NULL,
  code_submission TEXT,
  language TEXT CHECK (language IN ('jsx','tsx')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.interview_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own interview messages"
  ON public.interview_messages FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.interviews i
    WHERE i.id = interview_id AND i.user_id = auth.uid()
  ));
CREATE POLICY "Users can insert messages into their own interviews"
  ON public.interview_messages FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.interviews i
    WHERE i.id = interview_id AND i.user_id = auth.uid()
  ));

CREATE INDEX idx_interview_messages_interview ON public.interview_messages(interview_id, created_at);

-- ============ INTERVIEW SCORES ============
CREATE TABLE public.interview_scores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  interview_id UUID NOT NULL UNIQUE REFERENCES public.interviews(id) ON DELETE CASCADE,
  interpretation_score NUMERIC(4,1),
  approach_score NUMERIC(4,1),
  code_quality_score NUMERIC(4,1),
  optimization_score NUMERIC(4,1),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.interview_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own interview scores"
  ON public.interview_scores FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.interviews i
    WHERE i.id = interview_id AND i.user_id = auth.uid()
  ));
CREATE POLICY "Users can insert scores for their own interviews"
  ON public.interview_scores FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.interviews i
    WHERE i.id = interview_id AND i.user_id = auth.uid()
  ));