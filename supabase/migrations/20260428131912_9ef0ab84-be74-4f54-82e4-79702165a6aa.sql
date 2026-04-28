WITH duplicate_notes AS (
  SELECT id
  FROM (
    SELECT
      id,
      row_number() OVER (PARTITION BY document_id ORDER BY created_at ASC, id ASC) AS note_rank
    FROM public.notes
    WHERE document_id IS NOT NULL
  ) ranked_notes
  WHERE note_rank > 1
)
DELETE FROM public.notes
WHERE id IN (SELECT id FROM duplicate_notes);

CREATE UNIQUE INDEX IF NOT EXISTS notes_one_per_document_idx
ON public.notes (document_id)
WHERE document_id IS NOT NULL;
