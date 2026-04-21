ALTER TABLE public.interview_messages
  DROP CONSTRAINT interview_messages_interview_id_fkey,
  ADD CONSTRAINT interview_messages_interview_id_fkey
    FOREIGN KEY (interview_id)
    REFERENCES public.interviews(id)
    ON DELETE CASCADE;

ALTER TABLE public.interview_scores
  DROP CONSTRAINT interview_scores_interview_id_fkey,
  ADD CONSTRAINT interview_scores_interview_id_fkey
    FOREIGN KEY (interview_id)
    REFERENCES public.interviews(id)
    ON DELETE CASCADE;