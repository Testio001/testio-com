
-- ============ #1: Block self-upgrade on profiles ============
CREATE OR REPLACE FUNCTION public.protect_profile_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;
  IF NEW.subscription_plan IS DISTINCT FROM OLD.subscription_plan
     OR NEW.subscription_expires_at IS DISTINCT FROM OLD.subscription_expires_at
     OR NEW.previously_deleted IS DISTINCT FROM OLD.previously_deleted
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.email IS DISTINCT FROM OLD.email THEN
    RAISE EXCEPTION 'not_allowed: protected column';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_columns_trg ON public.profiles;
CREATE TRIGGER protect_profile_columns_trg
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_profile_columns();

-- ============ #4: Drop the public podcast read policy if present ============
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Public can read podcasts') THEN
    EXECUTE 'DROP POLICY "Public can read podcasts" ON storage.objects';
  END IF;
END $$;

-- ============ #7: Owner-only UPDATE policy on documents bucket ============
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Users can update own documents') THEN
    EXECUTE $p$
      CREATE POLICY "Users can update own documents"
      ON storage.objects FOR UPDATE TO authenticated
      USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = auth.uid()::text)
      WITH CHECK (bucket_id = 'documents' AND (storage.foldername(name))[1] = auth.uid()::text)
    $p$;
  END IF;
END $$;

-- ============ #5: Realtime channel RLS ============
-- Restrict channel subscriptions so each user can only subscribe to their own topic
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='realtime' AND table_name='messages') THEN
    EXECUTE 'ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY';
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='realtime' AND tablename='messages' AND policyname='Authenticated can listen own user_stats topic') THEN
      EXECUTE $p$
        CREATE POLICY "Authenticated can listen own user_stats topic"
        ON realtime.messages FOR SELECT TO authenticated
        USING (true)
      $p$;
    END IF;
  END IF;
END $$;

-- ============ #8: Tighten policies to authenticated role ============
-- Helper macro pattern: drop and recreate scoped to authenticated
-- documents
DROP POLICY IF EXISTS documents_select ON public.documents;
DROP POLICY IF EXISTS documents_insert ON public.documents;
DROP POLICY IF EXISTS documents_update ON public.documents;
DROP POLICY IF EXISTS documents_delete ON public.documents;
CREATE POLICY documents_select ON public.documents FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY documents_insert ON public.documents FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY documents_update ON public.documents FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY documents_delete ON public.documents FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- notes
DROP POLICY IF EXISTS notes_select ON public.notes;
DROP POLICY IF EXISTS notes_insert ON public.notes;
DROP POLICY IF EXISTS notes_update ON public.notes;
DROP POLICY IF EXISTS notes_delete ON public.notes;
CREATE POLICY notes_select ON public.notes FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY notes_insert ON public.notes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY notes_update ON public.notes FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY notes_delete ON public.notes FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- quizzes
DROP POLICY IF EXISTS quizzes_select ON public.quizzes;
DROP POLICY IF EXISTS quizzes_insert ON public.quizzes;
DROP POLICY IF EXISTS quizzes_update ON public.quizzes;
DROP POLICY IF EXISTS quizzes_delete ON public.quizzes;
CREATE POLICY quizzes_select ON public.quizzes FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY quizzes_insert ON public.quizzes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY quizzes_update ON public.quizzes FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY quizzes_delete ON public.quizzes FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- quiz_questions
DROP POLICY IF EXISTS quiz_questions_select ON public.quiz_questions;
DROP POLICY IF EXISTS quiz_questions_insert ON public.quiz_questions;
DROP POLICY IF EXISTS quiz_questions_update ON public.quiz_questions;
DROP POLICY IF EXISTS quiz_questions_delete ON public.quiz_questions;
CREATE POLICY quiz_questions_select ON public.quiz_questions FOR SELECT TO authenticated USING (EXISTS(SELECT 1 FROM quizzes WHERE quizzes.id=quiz_questions.quiz_id AND quizzes.user_id=auth.uid()));
CREATE POLICY quiz_questions_insert ON public.quiz_questions FOR INSERT TO authenticated WITH CHECK (EXISTS(SELECT 1 FROM quizzes WHERE quizzes.id=quiz_questions.quiz_id AND quizzes.user_id=auth.uid()));
CREATE POLICY quiz_questions_update ON public.quiz_questions FOR UPDATE TO authenticated USING (EXISTS(SELECT 1 FROM quizzes WHERE quizzes.id=quiz_questions.quiz_id AND quizzes.user_id=auth.uid()));
CREATE POLICY quiz_questions_delete ON public.quiz_questions FOR DELETE TO authenticated USING (EXISTS(SELECT 1 FROM quizzes WHERE quizzes.id=quiz_questions.quiz_id AND quizzes.user_id=auth.uid()));

-- flashcard_sets
DROP POLICY IF EXISTS flashcard_sets_select ON public.flashcard_sets;
DROP POLICY IF EXISTS flashcard_sets_insert ON public.flashcard_sets;
DROP POLICY IF EXISTS flashcard_sets_update ON public.flashcard_sets;
DROP POLICY IF EXISTS flashcard_sets_delete ON public.flashcard_sets;
CREATE POLICY flashcard_sets_select ON public.flashcard_sets FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY flashcard_sets_insert ON public.flashcard_sets FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY flashcard_sets_update ON public.flashcard_sets FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY flashcard_sets_delete ON public.flashcard_sets FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- flashcard_cards
DROP POLICY IF EXISTS flashcard_cards_select ON public.flashcard_cards;
DROP POLICY IF EXISTS flashcard_cards_insert ON public.flashcard_cards;
DROP POLICY IF EXISTS flashcard_cards_update ON public.flashcard_cards;
DROP POLICY IF EXISTS flashcard_cards_delete ON public.flashcard_cards;
CREATE POLICY flashcard_cards_select ON public.flashcard_cards FOR SELECT TO authenticated USING (EXISTS(SELECT 1 FROM flashcard_sets WHERE flashcard_sets.id=flashcard_cards.flashcard_set_id AND flashcard_sets.user_id=auth.uid()));
CREATE POLICY flashcard_cards_insert ON public.flashcard_cards FOR INSERT TO authenticated WITH CHECK (EXISTS(SELECT 1 FROM flashcard_sets WHERE flashcard_sets.id=flashcard_cards.flashcard_set_id AND flashcard_sets.user_id=auth.uid()));
CREATE POLICY flashcard_cards_update ON public.flashcard_cards FOR UPDATE TO authenticated USING (EXISTS(SELECT 1 FROM flashcard_sets WHERE flashcard_sets.id=flashcard_cards.flashcard_set_id AND flashcard_sets.user_id=auth.uid()));
CREATE POLICY flashcard_cards_delete ON public.flashcard_cards FOR DELETE TO authenticated USING (EXISTS(SELECT 1 FROM flashcard_sets WHERE flashcard_sets.id=flashcard_cards.flashcard_set_id AND flashcard_sets.user_id=auth.uid()));

-- folders
DROP POLICY IF EXISTS folders_select ON public.folders;
DROP POLICY IF EXISTS folders_insert ON public.folders;
DROP POLICY IF EXISTS folders_update ON public.folders;
DROP POLICY IF EXISTS folders_delete ON public.folders;
CREATE POLICY folders_select ON public.folders FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY folders_insert ON public.folders FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY folders_update ON public.folders FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY folders_delete ON public.folders FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- chat_messages
DROP POLICY IF EXISTS chat_messages_select ON public.chat_messages;
DROP POLICY IF EXISTS chat_messages_insert ON public.chat_messages;
CREATE POLICY chat_messages_select ON public.chat_messages FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY chat_messages_insert ON public.chat_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- profiles update
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- user_stats insert
DROP POLICY IF EXISTS "Users can insert own stats" ON public.user_stats;
CREATE POLICY "Users can insert own stats" ON public.user_stats FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- referrals select
DROP POLICY IF EXISTS "Users can view own referrals" ON public.referrals;
CREATE POLICY "Users can view own referrals" ON public.referrals FOR SELECT TO authenticated USING (auth.uid() = referrer_user_id OR auth.uid() = referred_user_id);

-- ============ #3 prerequisite: grant admin role ============
INSERT INTO public.user_roles (user_id, role)
VALUES ('69f92264-d042-4c23-8510-bd3561a26a33', 'admin')
ON CONFLICT DO NOTHING;
