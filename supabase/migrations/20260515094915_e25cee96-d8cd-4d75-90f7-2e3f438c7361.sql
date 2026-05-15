
CREATE INDEX IF NOT EXISTS idx_quizzes_user ON public.quizzes(user_id);
CREATE INDEX IF NOT EXISTS idx_quizzes_document ON public.quizzes(document_id);

CREATE INDEX IF NOT EXISTS idx_flashcard_sets_user ON public.flashcard_sets(user_id);
CREATE INDEX IF NOT EXISTS idx_flashcard_sets_document ON public.flashcard_sets(document_id);

CREATE INDEX IF NOT EXISTS idx_podcasts_user ON public.podcasts(user_id);
CREATE INDEX IF NOT EXISTS idx_podcasts_document ON public.podcasts(document_id);

CREATE INDEX IF NOT EXISTS idx_quiz_questions_quiz ON public.quiz_questions(quiz_id, order_index);
CREATE INDEX IF NOT EXISTS idx_flashcard_cards_set ON public.flashcard_cards(flashcard_set_id, order_index);

CREATE INDEX IF NOT EXISTS idx_chat_messages_user_doc_time ON public.chat_messages(user_id, document_id, created_at);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON public.push_subscriptions(user_id);

CREATE INDEX IF NOT EXISTS idx_notes_user ON public.notes(user_id);
CREATE INDEX IF NOT EXISTS idx_notes_document ON public.notes(document_id);

CREATE INDEX IF NOT EXISTS idx_folders_user ON public.folders(user_id);

ANALYZE public.quizzes;
ANALYZE public.flashcard_sets;
ANALYZE public.podcasts;
ANALYZE public.quiz_questions;
ANALYZE public.flashcard_cards;
ANALYZE public.chat_messages;
ANALYZE public.push_subscriptions;
ANALYZE public.notes;
ANALYZE public.folders;
