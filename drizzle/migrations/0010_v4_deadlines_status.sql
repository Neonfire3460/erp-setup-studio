ALTER TABLE public.ir_tickets
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'registration',
  ADD COLUMN IF NOT EXISTS needed_by date,
  ADD COLUMN IF NOT EXISTS effective_from date,
  ADD COLUMN IF NOT EXISTS incomplete jsonb NOT NULL DEFAULT '[]';
DO $$ BEGIN
  ALTER TABLE public.ir_tickets ADD CONSTRAINT ir_tickets_kind_check CHECK (kind IN ('registration','status_change'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS ir_tickets_needed_by ON public.ir_tickets (needed_by);

CREATE TABLE IF NOT EXISTS public.item_status_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.ir_tickets(id) ON DELETE CASCADE,
  entity_code text NOT NULL,
  item_code text NOT NULL,
  brand_activity text NOT NULL,
  inactive_from integer,
  inactive_to integer NOT NULL CHECK (inactive_to IN (0,1)),
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','approved','rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  UNIQUE (ticket_id, entity_code, item_code)
);
CREATE INDEX IF NOT EXISTS item_status_changes_item ON public.item_status_changes (entity_code, item_code, state);
CREATE INDEX IF NOT EXISTS item_status_changes_brand ON public.item_status_changes (upper(brand_activity), state);
ALTER TABLE public.item_status_changes ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.item_status_changes TO service_role;

CREATE TABLE IF NOT EXISTS public.ai_description_examples (
  id bigserial PRIMARY KEY,
  brand_activity text NOT NULL,
  item_code text NOT NULL,
  vendor_description text NOT NULL DEFAULT '',
  erp_description text NOT NULL DEFAULT '',
  ai_description text NOT NULL DEFAULT '',
  final_description text NOT NULL,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ai_description_examples_brand ON public.ai_description_examples (upper(brand_activity), created_at DESC);
ALTER TABLE public.ai_description_examples ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.ai_description_examples TO service_role;
GRANT USAGE ON SEQUENCE public.ai_description_examples_id_seq TO service_role;