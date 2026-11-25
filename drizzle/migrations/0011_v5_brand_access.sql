CREATE TABLE IF NOT EXISTS public.user_brand_access (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  brand_activity text NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, brand_activity)
);
CREATE INDEX IF NOT EXISTS user_brand_access_brand ON public.user_brand_access (upper(brand_activity));
ALTER TABLE public.user_brand_access ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.user_brand_access TO service_role;
GRANT SELECT ON public.user_brand_access TO authenticated;
DROP POLICY IF EXISTS "own brand access read" ON public.user_brand_access;
CREATE POLICY "own brand access read" ON public.user_brand_access FOR SELECT TO authenticated USING (user_id = auth.uid());