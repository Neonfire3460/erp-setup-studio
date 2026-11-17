CREATE OR REPLACE FUNCTION public.touch_updated()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN new.updated_at := now(); new.updated_by := coalesce(auth.uid(), new.updated_by); RETURN new; END $$;

CREATE TABLE public.entities (code text PRIMARY KEY, name text NOT NULL, region text NOT NULL CHECK (region IN ('Middle East','South East Asia')), currency text NOT NULL, sort_order integer NOT NULL DEFAULT 0, active boolean NOT NULL DEFAULT true);
CREATE TABLE public.currencies (code text PRIMARY KEY, name text NOT NULL DEFAULT '', active boolean NOT NULL DEFAULT true, sort_order integer NOT NULL DEFAULT 0);
CREATE TABLE public.brands (brand_activity text PRIMARY KEY, default_unit text, active boolean NOT NULL DEFAULT true);
CREATE TABLE public.sub_activities (brand_activity text NOT NULL REFERENCES public.brands(brand_activity) ON UPDATE CASCADE ON DELETE CASCADE, sub_activity text NOT NULL, active boolean NOT NULL DEFAULT true, PRIMARY KEY (brand_activity, sub_activity));
CREATE TABLE public.brand_suppliers (brand_activity text NOT NULL REFERENCES public.brands(brand_activity) ON UPDATE CASCADE ON DELETE CASCADE, entity_code text NOT NULL REFERENCES public.entities(code) ON UPDATE CASCADE ON DELETE CASCADE, supplier text NOT NULL, PRIMARY KEY (brand_activity, entity_code));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.entities, public.currencies, public.brands, public.sub_activities, public.brand_suppliers TO authenticated;
GRANT ALL ON public.entities, public.currencies, public.brands, public.sub_activities, public.brand_suppliers TO service_role;
ALTER TABLE public.entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.currencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sub_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "signed in read" ON public.entities FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin write" ON public.entities FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "signed in read" ON public.currencies FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin write" ON public.currencies FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "signed in read" ON public.brands FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin write" ON public.brands FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "signed in read" ON public.sub_activities FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin write" ON public.sub_activities FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "signed in read" ON public.brand_suppliers FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin write" ON public.brand_suppliers FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.exchange_rates (from_currency text NOT NULL REFERENCES public.currencies(code) ON UPDATE CASCADE ON DELETE CASCADE, entity_code text NOT NULL REFERENCES public.entities(code) ON UPDATE CASCADE ON DELETE CASCADE, rate numeric NOT NULL CHECK (rate > 0), updated_at timestamptz NOT NULL DEFAULT now(), updated_by uuid, PRIMARY KEY (from_currency, entity_code));
CREATE TABLE public.pricing_rules (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), brand_activity text NOT NULL REFERENCES public.brands(brand_activity) ON UPDATE CASCADE ON DELETE CASCADE, sub_activity text, entity_code text NOT NULL REFERENCES public.entities(code) ON UPDATE CASCADE ON DELETE CASCADE, method text NOT NULL DEFAULT 'calculate' CHECK (method IN ('calculate','same_as_entity')), source_entity text, overhead_pct numeric NOT NULL DEFAULT 0, margin_divisors numeric[] NOT NULL DEFAULT '{}', round_to numeric NOT NULL DEFAULT 1 CHECK (round_to > 0), max_discount_pct numeric, compare_with_msrp boolean NOT NULL DEFAULT false, active boolean NOT NULL DEFAULT true, updated_at timestamptz NOT NULL DEFAULT now(), updated_by uuid);
CREATE UNIQUE INDEX pricing_rules_key ON public.pricing_rules (brand_activity, coalesce(sub_activity,''), entity_code);
CREATE TABLE public.app_settings (key text PRIMARY KEY, value jsonb NOT NULL);
CREATE TRIGGER exchange_rates_touch BEFORE INSERT OR UPDATE ON public.exchange_rates FOR EACH ROW EXECUTE FUNCTION public.touch_updated();
CREATE TRIGGER pricing_rules_touch BEFORE INSERT OR UPDATE ON public.pricing_rules FOR EACH ROW EXECUTE FUNCTION public.touch_updated();

CREATE TABLE public.erp_items (entity_code text NOT NULL REFERENCES public.entities(code) ON UPDATE CASCADE ON DELETE CASCADE, item_code text NOT NULL, alternative_code text, description text, alternative_description text, measurement_unit text, retail_price numeric, brand_activity text, sub_activity text, family_code text, group_code text, category_code text, sub_category_code text, midwich_family_code text, family_name text, group_name text, category_name text, sub_category_name text, midwich_family_name text, max_discount_pct numeric, supplier_code text, inactive integer, webactive integer, b2b integer, refreshed_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (entity_code, item_code));
CREATE INDEX erp_items_upper_code ON public.erp_items (upper(item_code));
CREATE TABLE public.erp_items_staging (batch_id uuid NOT NULL, created_by uuid NOT NULL DEFAULT auth.uid(), entity_code text NOT NULL, item_code text NOT NULL, alternative_code text, description text, alternative_description text, measurement_unit text, retail_price numeric, brand_activity text, sub_activity text, family_code text, group_code text, category_code text, sub_category_code text, midwich_family_code text, family_name text, group_name text, category_name text, sub_category_name text, midwich_family_name text, max_discount_pct numeric, supplier_code text, inactive integer, webactive integer, b2b integer);
CREATE INDEX erp_items_staging_batch ON public.erp_items_staging (batch_id);
CREATE TABLE public.erp_imports (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), entity_code text NOT NULL REFERENCES public.entities(code) ON UPDATE CASCADE ON DELETE CASCADE, file_name text, row_count integer NOT NULL DEFAULT 0, imported_at timestamptz NOT NULL DEFAULT now(), imported_by uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.exchange_rates, public.pricing_rules, public.app_settings, public.erp_items, public.erp_items_staging, public.erp_imports TO authenticated;
GRANT ALL ON public.exchange_rates, public.pricing_rules, public.app_settings, public.erp_items, public.erp_items_staging, public.erp_imports TO service_role;
ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erp_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erp_items_staging ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erp_imports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin only" ON public.exchange_rates FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin only" ON public.pricing_rules FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin only" ON public.app_settings FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin only" ON public.erp_items FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin own staging" ON public.erp_items_staging FOR ALL TO authenticated USING (created_by = auth.uid() AND public.has_role(auth.uid(),'admin')) WITH CHECK (created_by = auth.uid() AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin only" ON public.erp_imports FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.conversions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL DEFAULT auth.uid(), brand_activity text, files jsonb NOT NULL DEFAULT '[]', ai_response jsonb, detected_rows jsonb, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.submissions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL DEFAULT auth.uid(), source text NOT NULL CHECK (source IN ('build','convert')), conversion_id uuid REFERENCES public.conversions(id) ON DELETE SET NULL, brand_activity text NOT NULL, entities jsonb NOT NULL DEFAULT '[]', status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('draft','submitted','needs_pricing','in_review','approved','rejected')), file_path text, counts jsonb, created_at timestamptz NOT NULL DEFAULT now(), submitted_at timestamptz, reviewed_by uuid, reviewed_at timestamptz, review_comment text, output_path text);
CREATE TABLE public.submission_rows (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), submission_id uuid NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE, entity_code text NOT NULL, cost_currency text NOT NULL, row_no integer NOT NULL, item_code text NOT NULL, alternative_code text, description text, alternate_description text, brand_activity text, sub_activity text, cost_price numeric, measurement_unit text, vendor_msrp numeric, checks jsonb);
CREATE INDEX submission_rows_sub ON public.submission_rows (submission_id);
CREATE TABLE public.output_rows (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), submission_id uuid NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE, entity_code text NOT NULL, row_no integer NOT NULL, "values" jsonb NOT NULL, names jsonb, current_erp_retail numeric, checks jsonb);
CREATE INDEX output_rows_sub ON public.output_rows (submission_id);
CREATE TABLE public.catalogue_items (entity_code text NOT NULL, item_code text NOT NULL, brand_activity text, sub_activity text, alternative_code text, description text, alternate_description text, retail_price numeric, currency text, family_name text, group_name text, category_name text, sub_category_name text, midwich_family_name text, submission_id uuid, approved_at timestamptz, PRIMARY KEY (entity_code, item_code));
CREATE TABLE public.tickets (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), submission_id uuid REFERENCES public.submissions(id) ON DELETE CASCADE, kind text NOT NULL CHECK (kind IN ('pricing_rule','exchange_rate','supplier')), brand_activity text, sub_activity text, entity_code text, currency text, row_count integer NOT NULL DEFAULT 0, note text, status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved')), created_at timestamptz NOT NULL DEFAULT now(), resolved_at timestamptz, resolved_by uuid);
CREATE TABLE public.vendor_profiles (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), brand_activity text NOT NULL, header_signature text NOT NULL, mapping jsonb NOT NULL, times_used integer NOT NULL DEFAULT 0, created_by uuid DEFAULT auth.uid(), last_used_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.mapping_corrections (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), brand_activity text, headers jsonb, field text, ai_value text, user_value text, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.description_examples (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), brand_activity text, item_code text, original text, final text, created_at timestamptz NOT NULL DEFAULT now());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversions, public.submissions, public.submission_rows, public.output_rows, public.tickets, public.vendor_profiles TO authenticated;
GRANT SELECT ON public.catalogue_items TO authenticated;
GRANT INSERT ON public.mapping_corrections, public.description_examples TO authenticated;
GRANT ALL ON public.conversions, public.submissions, public.submission_rows, public.output_rows, public.catalogue_items, public.tickets, public.vendor_profiles, public.mapping_corrections, public.description_examples TO service_role;
ALTER TABLE public.conversions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submission_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.output_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalogue_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mapping_corrections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.description_examples ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner or admin" ON public.conversions FOR ALL TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin')) WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "owner read" ON public.submissions FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "owner insert" ON public.submissions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND status IN ('draft','submitted') AND reviewed_by IS NULL AND output_path IS NULL);
CREATE POLICY "owner delete unapproved" ON public.submissions FOR DELETE TO authenticated USING (user_id = auth.uid() AND status <> 'approved');
CREATE POLICY "admin all" ON public.submissions FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "owner or admin" ON public.submission_rows FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin') OR EXISTS (SELECT 1 FROM public.submissions s WHERE s.id = submission_id AND s.user_id = auth.uid())) WITH CHECK (public.has_role(auth.uid(),'admin') OR EXISTS (SELECT 1 FROM public.submissions s WHERE s.id = submission_id AND s.user_id = auth.uid() AND s.status <> 'approved'));
CREATE POLICY "admin only" ON public.output_rows FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "signed in read" ON public.catalogue_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin only" ON public.tickets FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "signed in all" ON public.vendor_profiles FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "signed in insert" ON public.mapping_corrections FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "signed in insert" ON public.description_examples FOR INSERT TO authenticated WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.list_brands()
RETURNS TABLE(brand_activity text, default_unit text, sub_activities text[])
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT b.brand_activity, b.default_unit,
    coalesce(array_agg(s.sub_activity ORDER BY s.sub_activity) FILTER (WHERE s.sub_activity IS NOT NULL), '{}')
  FROM public.brands b LEFT JOIN public.sub_activities s ON s.brand_activity = b.brand_activity AND s.active
  WHERE b.active AND auth.uid() IS NOT NULL
  GROUP BY b.brand_activity, b.default_unit ORDER BY b.brand_activity
$$;
CREATE OR REPLACE FUNCTION public.erp_check(codes text[])
RETURNS TABLE(code text, in_erp boolean, description text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.code, coalesce(d.found, false), d.description
  FROM (SELECT DISTINCT x AS code FROM unnest(codes) x WHERE auth.uid() IS NOT NULL) c
  LEFT JOIN LATERAL (
    SELECT true AS found, i.description FROM public.erp_items i
    JOIN public.entities e ON e.code = i.entity_code
    WHERE upper(i.item_code) = upper(btrim(c.code)) ORDER BY e.sort_order LIMIT 1
  ) d ON true
$$;
REVOKE EXECUTE ON FUNCTION public.list_brands() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.erp_check(text[]) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.list_brands() TO authenticated;
GRANT EXECUTE ON FUNCTION public.erp_check(text[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.erp_entity_stats()
RETURNS TABLE(entity_code text, row_count bigint, active_count bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  RETURN QUERY SELECT i.entity_code, count(*), count(*) FILTER (WHERE coalesce(i.inactive,0) <> 1) FROM public.erp_items i GROUP BY i.entity_code;
END $$;
REVOKE EXECUTE ON FUNCTION public.erp_entity_stats() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.erp_entity_stats() TO authenticated;

CREATE OR REPLACE FUNCTION public.swap_erp_items(_user_id uuid, _entity_code text, _batch_id uuid, _expected_count integer, _file_name text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  IF NOT public.has_role(_user_id,'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  PERFORM pg_advisory_xact_lock(741240);
  SELECT count(*) INTO n FROM public.erp_items_staging WHERE batch_id = _batch_id AND created_by = _user_id AND entity_code = _entity_code;
  IF n = 0 OR n <> _expected_count THEN RAISE EXCEPTION 'Staging row count mismatch'; END IF;
  DELETE FROM public.erp_items WHERE entity_code = _entity_code;
  INSERT INTO public.erp_items (entity_code, item_code, alternative_code, description, alternative_description, measurement_unit, retail_price, brand_activity, sub_activity, family_code, group_code, category_code, sub_category_code, midwich_family_code, family_name, group_name, category_name, sub_category_name, midwich_family_name, max_discount_pct, supplier_code, inactive, webactive, b2b, refreshed_at)
  SELECT entity_code, btrim(item_code), alternative_code, description, alternative_description, measurement_unit, retail_price, brand_activity, sub_activity, family_code, group_code, category_code, sub_category_code, midwich_family_code, family_name, group_name, category_name, sub_category_name, midwich_family_name, max_discount_pct, supplier_code, inactive, webactive, b2b, now()
  FROM public.erp_items_staging WHERE batch_id = _batch_id AND created_by = _user_id AND entity_code = _entity_code;
  DELETE FROM public.erp_items_staging WHERE batch_id = _batch_id;
  INSERT INTO public.erp_imports (entity_code, file_name, row_count, imported_by) VALUES (_entity_code, _file_name, n, _user_id);
  RETURN n;
END $$;
REVOKE EXECUTE ON FUNCTION public.swap_erp_items(uuid, text, uuid, integer, text) FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.swap_erp_items(uuid, text, uuid, integer, text) TO service_role;

CREATE POLICY "erp-outputs admin all" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'erp-outputs' AND public.has_role(auth.uid(),'admin'))
  WITH CHECK (bucket_id = 'erp-outputs' AND public.has_role(auth.uid(),'admin'));