-- NMK Unite v3 database change (Standard Item Registration, review/approval, PDF pricelists).
-- Additive: v2 tables stay until the v3 pages are live (a later cleanup drops them).
-- Tested on a copy of the v2 schema (migrations 0000-0008) with PostgreSQL 16.

-- ========== 1. Roles: User, Reviewer, Approver (one person can hold several) ==========
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'reviewer';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'approver';

CREATE OR REPLACE FUNCTION public.has_any_role(_user_id uuid, _roles text[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role::text = ANY(_roles))
$$;
-- Staff = admin, reviewer or approver: they run the admin side and Admin settings.
CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_any_role(_user_id, ARRAY['admin','reviewer','approver'])
$$;
REVOKE EXECUTE ON FUNCTION public.has_any_role(uuid, text[]) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_staff(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.has_any_role(uuid, text[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated, service_role;

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL DEFAULT '',
  full_name text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.profiles (id, email, full_name)
  SELECT u.id, coalesce(u.email, ''), coalesce(u.raw_user_meta_data->>'full_name', '') FROM auth.users u
  ON CONFLICT (id) DO NOTHING;
GRANT SELECT ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own or staff read" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid() OR public.is_staff(auth.uid()));

CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(424242);
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (new.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (new.id, 'user');
  END IF;
  INSERT INTO public.profiles (id, email, full_name)
    VALUES (new.id, coalesce(new.email, ''), coalesce(new.raw_user_meta_data->>'full_name', ''))
    ON CONFLICT (id) DO NOTHING;
  RETURN new;
END $$;

DROP FUNCTION IF EXISTS public.admin_list_users();
CREATE FUNCTION public.admin_list_users()
RETURNS TABLE (user_id uuid, email text, full_name text, roles text[], active boolean, created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  RETURN QUERY
    SELECT u.id, u.email::text, coalesce(p.full_name, ''),
      coalesce((SELECT array_agg(r.role::text ORDER BY r.role::text) FROM public.user_roles r WHERE r.user_id = u.id), '{}'),
      coalesce(p.active, true), u.created_at
    FROM auth.users u LEFT JOIN public.profiles p ON p.id = u.id ORDER BY u.created_at;
END $$;
REVOKE EXECUTE ON FUNCTION public.admin_list_users() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;

-- Replace all roles of a user. Keeps at least one admin.
CREATE OR REPLACE FUNCTION public.admin_set_roles(_user_id uuid, _roles text[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF EXISTS (SELECT 1 FROM unnest(_roles) x WHERE x NOT IN ('admin','reviewer','approver','user')) THEN RAISE EXCEPTION 'Unknown role'; END IF;
  IF NOT ('admin' = ANY(_roles)) AND public.has_role(_user_id, 'admin')
     AND (SELECT count(*) FROM public.user_roles WHERE role = 'admin') <= 1 THEN
    RAISE EXCEPTION 'The last admin cannot be removed';
  END IF;
  DELETE FROM public.user_roles WHERE user_id = _user_id;
  INSERT INTO public.user_roles (user_id, role) SELECT _user_id, x::public.app_role FROM unnest(_roles) x;
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id) THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (_user_id, 'user');
  END IF;
END $$;
REVOKE EXECUTE ON FUNCTION public.admin_set_roles(uuid, text[]) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.admin_set_roles(uuid, text[]) TO authenticated;

-- ========== 2. Change log for Admin settings (who, when, old, new) ==========
CREATE TABLE public.change_log (
  id bigserial PRIMARY KEY,
  table_name text NOT NULL,
  action text NOT NULL,
  old_row jsonb,
  new_row jsonb,
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.change_log TO authenticated;
GRANT ALL ON public.change_log TO service_role;
GRANT USAGE ON SEQUENCE public.change_log_id_seq TO service_role;
ALTER TABLE public.change_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read" ON public.change_log FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE OR REPLACE FUNCTION public.log_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.change_log (table_name, action, old_row, new_row, changed_by)
  VALUES (TG_TABLE_NAME, TG_OP,
    CASE WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD) END,
    CASE WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW) END, auth.uid());
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;

-- ========== 3. Settings tables ==========
ALTER TABLE public.entities
  ADD COLUMN IF NOT EXISTS is_master boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS legal_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS pdf_allowed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pdf_terms_line text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS pdf_logo_path text;

ALTER TABLE public.brands
  ADD COLUMN IF NOT EXISTS entity_codes text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS default_max_discount numeric,
  ADD COLUMN IF NOT EXISTS logo_path text,
  ADD COLUMN IF NOT EXISTS last_currency text;

ALTER TABLE public.brand_suppliers ADD COLUMN IF NOT EXISTS supplier_name text NOT NULL DEFAULT '';

-- One exchange-rate table for the whole site (gap 13): 1 unit of from_currency in to_currency.
CREATE TABLE public.fx_rates (
  from_currency text NOT NULL REFERENCES public.currencies(code) ON UPDATE CASCADE ON DELETE CASCADE,
  to_currency text NOT NULL REFERENCES public.currencies(code) ON UPDATE CASCADE ON DELETE CASCADE,
  rate numeric NOT NULL CHECK (rate > 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  PRIMARY KEY (from_currency, to_currency)
);
CREATE TRIGGER fx_rates_touch BEFORE INSERT OR UPDATE ON public.fx_rates FOR EACH ROW EXECUTE FUNCTION public.touch_updated();

CREATE TABLE public.units (
  code text PRIMARY KEY,
  name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0
);

-- Categories keyed by Sub Category (category codes repeat). Codes are text: leading zeros matter.
CREATE TABLE public.categories (
  sub_category_code text PRIMARY KEY,
  family_code text NOT NULL,
  family_name text NOT NULL,
  group_code text NOT NULL,
  group_name text NOT NULL,
  category_code text NOT NULL,
  category_name text NOT NULL,
  midwich_code text NOT NULL DEFAULT '',
  review_note text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.midwich_families (code text PRIMARY KEY, name text NOT NULL);

-- Learned PDF item order per brand (gap 22).
CREATE TABLE public.pdf_orders (
  brand_activity text PRIMARY KEY REFERENCES public.brands(brand_activity) ON UPDATE CASCADE ON DELETE CASCADE,
  item_codes text[] NOT NULL DEFAULT '{}',
  source_file text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid DEFAULT auth.uid()
);

-- Read for every signed-in user, write for staff.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.units, public.categories, public.midwich_families, public.pdf_orders TO authenticated;
GRANT ALL ON public.fx_rates, public.units, public.categories, public.midwich_families, public.pdf_orders TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fx_rates TO authenticated;
ALTER TABLE public.fx_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.midwich_families ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pdf_orders ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['entities','currencies','brands','sub_activities','brand_suppliers'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "admin write" ON public.%I', t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['entities','currencies','brands','sub_activities','brand_suppliers','units','categories','midwich_families','pdf_orders'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "signed in read" ON public.%I', t);
    EXECUTE format('CREATE POLICY "signed in read" ON public.%I FOR SELECT TO authenticated USING (true)', t);
    EXECUTE format('CREATE POLICY "staff write" ON public.%I FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()))', t);
  END LOOP;
  -- Confidential: staff only, read and write.
  FOREACH t IN ARRAY ARRAY['pricing_rules','app_settings','erp_items','erp_imports'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "admin only" ON public.%I', t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['fx_rates','pricing_rules','app_settings','erp_items','erp_imports'] LOOP
    EXECUTE format('CREATE POLICY "staff only" ON public.%I FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()))', t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['entities','currencies','brands','sub_activities','brand_suppliers','units','categories','midwich_families','pdf_orders','fx_rates','pricing_rules','app_settings'] LOOP
    EXECUTE format('CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.log_change()', t || '_log', t);
  END LOOP;
END $$;

-- ========== 4. ERP data: cost, currency, brand-scoped imports (gap 2, 18) ==========
ALTER TABLE public.erp_items
  ADD COLUMN IF NOT EXISTS cost_price numeric,
  ADD COLUMN IF NOT EXISTS cost_currency text;
CREATE INDEX IF NOT EXISTS erp_items_brand ON public.erp_items (entity_code, upper(brand_activity));
-- The view lists columns as they were when it was made: recreate it so it has the new ones.
CREATE OR REPLACE VIEW public.erp_items_active WITH (security_invoker = true) AS
  SELECT i.* FROM public.erp_items i JOIN public.erp_imports m ON m.id = i.import_id AND m.active;
GRANT SELECT ON public.erp_items_active TO authenticated, service_role;
ALTER TABLE public.erp_imports
  ADD COLUMN IF NOT EXISTS brands text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'full',
  ADD COLUMN IF NOT EXISTS counts jsonb;

CREATE OR REPLACE FUNCTION public.activate_erp_import(_import_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ent text; expected integer; n integer;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  SELECT entity_code, row_count INTO ent, expected FROM public.erp_imports WHERE id = _import_id FOR UPDATE;
  IF ent IS NULL THEN RAISE EXCEPTION 'Unknown import'; END IF;
  SELECT count(*) INTO n FROM public.erp_items WHERE import_id = _import_id;
  IF n = 0 OR n <> expected THEN RAISE EXCEPTION 'Row count mismatch: % of % rows loaded', n, expected; END IF;
  UPDATE public.erp_imports SET active = false WHERE entity_code = ent AND active AND id <> _import_id;
  UPDATE public.erp_imports SET active = true, imported_at = now() WHERE id = _import_id;
  RETURN n;
END $$;

CREATE OR REPLACE FUNCTION public.delete_erp_import_rows(_import_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF EXISTS (SELECT 1 FROM public.erp_imports WHERE id = _import_id AND active) THEN RAISE EXCEPTION 'Cannot delete the active import'; END IF;
  DELETE FROM public.erp_items WHERE ctid IN (SELECT ctid FROM public.erp_items WHERE import_id = _import_id LIMIT 10000);
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

-- Replace only the brands in the file: their rows in the active import are deleted and the
-- staged rows move into the active import, in one transaction. Other brands are untouched.
CREATE OR REPLACE FUNCTION public.merge_erp_import(_import_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ent text; expected integer; n integer; act uuid; b text[];
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  SELECT entity_code, row_count, brands INTO ent, expected, b FROM public.erp_imports WHERE id = _import_id AND NOT active FOR UPDATE;
  IF ent IS NULL THEN RAISE EXCEPTION 'Unknown import'; END IF;
  SELECT count(*) INTO n FROM public.erp_items WHERE import_id = _import_id;
  IF n = 0 OR n <> expected THEN RAISE EXCEPTION 'Row count mismatch: % of % rows loaded', n, expected; END IF;
  SELECT id INTO act FROM public.erp_imports WHERE entity_code = ent AND active FOR UPDATE;
  IF act IS NULL THEN
    UPDATE public.erp_imports SET active = true, imported_at = now() WHERE id = _import_id;
    RETURN n;
  END IF;
  DELETE FROM public.erp_items WHERE import_id = act
    AND upper(coalesce(brand_activity, '')) = ANY (SELECT upper(x) FROM unnest(b) x);
  DELETE FROM public.erp_items i WHERE i.import_id = act
    AND EXISTS (SELECT 1 FROM public.erp_items s WHERE s.import_id = _import_id AND s.item_code = i.item_code);
  UPDATE public.erp_items SET import_id = act WHERE import_id = _import_id;
  UPDATE public.erp_imports SET row_count = (SELECT count(*) FROM public.erp_items WHERE import_id = act), imported_at = now() WHERE id = act;
  UPDATE public.erp_imports SET mode = 'merged', imported_at = now() WHERE id = _import_id;
  RETURN n;
END $$;
REVOKE EXECUTE ON FUNCTION public.merge_erp_import(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.merge_erp_import(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.erp_entity_stats()
RETURNS TABLE(entity_code text, row_count bigint, active_count bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  RETURN QUERY SELECT i.entity_code, count(*), count(*) FILTER (WHERE coalesce(i.inactive,0) <> 1)
    FROM public.erp_items i JOIN public.erp_imports m ON m.id = i.import_id AND m.active GROUP BY i.entity_code;
END $$;

-- Brands for the wizard (no prices): entities, sub activities, unit, last currency.
CREATE OR REPLACE FUNCTION public.list_brands_v3()
RETURNS TABLE(brand_activity text, entity_codes text[], default_unit text, last_currency text, sub_activities text[], has_logo boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT b.brand_activity, b.entity_codes, b.default_unit, b.last_currency,
    coalesce(array_agg(s.sub_activity ORDER BY s.sub_activity) FILTER (WHERE s.sub_activity IS NOT NULL), '{}'),
    b.logo_path IS NOT NULL
  FROM public.brands b LEFT JOIN public.sub_activities s ON s.brand_activity = b.brand_activity AND s.active
  WHERE b.active AND auth.uid() IS NOT NULL
  GROUP BY b.brand_activity ORDER BY b.brand_activity
$$;
REVOKE EXECUTE ON FUNCTION public.list_brands_v3() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.list_brands_v3() TO authenticated;

-- ========== 5. Item Registration tickets ==========
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$ BEGIN new.updated_at := now(); RETURN new; END $$;

CREATE SEQUENCE public.ir_ticket_seq;
CREATE TABLE public.ir_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_no text UNIQUE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  brand_activity text NOT NULL,
  region text NOT NULL DEFAULT 'ME' CHECK (region IN ('ME','SEA')),
  std_currency text NOT NULL DEFAULT 'USD',
  entities jsonb NOT NULL DEFAULT '[]',
  source text NOT NULL DEFAULT 'template' CHECK (source IN ('ai','template')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','in_review','awaiting_approval','on_hold','approved','rejected','uploaded','verified')),
  step integer NOT NULL DEFAULT 1,
  draft jsonb,
  special_instructions text NOT NULL DEFAULT '',
  suppliers jsonb NOT NULL DEFAULT '[]',
  counts jsonb,
  price_summary jsonb,
  missing_setup jsonb NOT NULL DEFAULT '[]',
  reviewer_id uuid,
  approver_id uuid,
  reject_reason text,
  uploads jsonb NOT NULL DEFAULT '{}',
  cross_check jsonb,
  resubmit_of uuid REFERENCES public.ir_tickets(id) ON DELETE SET NULL,
  revision integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz,
  review_started_at timestamptz,
  proceeded_at timestamptz,
  decided_at timestamptz,
  uploaded_at timestamptz,
  verified_at timestamptz
);
CREATE INDEX ir_tickets_user ON public.ir_tickets (user_id, created_at DESC);
CREATE INDEX ir_tickets_status ON public.ir_tickets (status);
CREATE TRIGGER ir_tickets_touch BEFORE UPDATE ON public.ir_tickets FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.ir_ticket_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.ir_tickets(id) ON DELETE CASCADE,
  line_no integer NOT NULL,
  item_code text NOT NULL,
  alt_code text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  alt_description text NOT NULL DEFAULT '',
  cost numeric,
  entity_costs jsonb NOT NULL DEFAULT '{}',
  price_on_request boolean NOT NULL DEFAULT false,
  is_new boolean NOT NULL DEFAULT false,
  include boolean NOT NULL DEFAULT true,
  use_vendor_description boolean NOT NULL DEFAULT false,
  erp_description text,
  new_item jsonb,
  source jsonb,
  UNIQUE (ticket_id, line_no)
);
CREATE INDEX ir_ticket_items_ticket ON public.ir_ticket_items (ticket_id);

-- The calculated ERP rows (admin side only): 20 ERP columns + every step of the retail sum.
CREATE TABLE public.ir_ticket_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.ir_tickets(id) ON DELETE CASCADE,
  entity_code text NOT NULL,
  line_no integer NOT NULL,
  item_code text NOT NULL,
  is_new boolean NOT NULL DEFAULT false,
  erp jsonb NOT NULL,
  calc jsonb,
  current_retail numeric,
  retail_change_pct numeric,
  flags text[] NOT NULL DEFAULT '{}',
  names jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ticket_id, entity_code, line_no)
);
CREATE INDEX ir_ticket_rows_ticket ON public.ir_ticket_rows (ticket_id, entity_code);

CREATE TABLE public.ir_ticket_events (
  id bigserial PRIMARY KEY,
  ticket_id uuid NOT NULL REFERENCES public.ir_tickets(id) ON DELETE CASCADE,
  action text NOT NULL,
  from_status text,
  to_status text,
  comment text,
  internal boolean NOT NULL DEFAULT false, -- Hold comments: reviewer only (gap 15)
  actor uuid,
  at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ir_ticket_events_ticket ON public.ir_ticket_events (ticket_id, at);

CREATE TABLE public.ir_ticket_edits (
  id bigserial PRIMARY KEY,
  ticket_id uuid NOT NULL REFERENCES public.ir_tickets(id) ON DELETE CASCADE,
  row_id uuid,
  entity_code text,
  item_code text,
  column_name text NOT NULL,
  old_value jsonb,
  new_value jsonb,
  actor uuid,
  at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ir_ticket_edits_ticket ON public.ir_ticket_edits (ticket_id);

-- Latest approved retail per entity and item (PDF pricelists, current retail without entity ERP data: gap 21).
CREATE TABLE public.approved_prices (
  entity_code text NOT NULL,
  item_code text NOT NULL,
  brand_activity text NOT NULL,
  description text,
  retail_price numeric,
  currency text,
  inactive integer,
  ticket_id uuid REFERENCES public.ir_tickets(id) ON DELETE SET NULL,
  approved_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (entity_code, item_code)
);
CREATE INDEX approved_prices_brand ON public.approved_prices (entity_code, upper(brand_activity));

CREATE TABLE public.pdf_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_activity text NOT NULL,
  entity_code text NOT NULL,
  title text NOT NULL,
  item_count integer NOT NULL,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Option A learning: what the AI was told per brand (price column, discount, header names).
CREATE TABLE public.brand_ai_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_activity text NOT NULL,
  header_signature text NOT NULL,
  profile jsonb NOT NULL,
  times_used integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid DEFAULT auth.uid(),
  UNIQUE (brand_activity, header_signature)
);

CREATE TABLE public.email_log (
  id bigserial PRIMARY KEY,
  ticket_id uuid REFERENCES public.ir_tickets(id) ON DELETE SET NULL,
  kind text NOT NULL,
  to_address text NOT NULL,
  real_to text,
  subject text NOT NULL,
  status text NOT NULL,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ir_tickets, public.ir_ticket_items TO authenticated;
GRANT SELECT ON public.ir_ticket_rows, public.ir_ticket_events, public.ir_ticket_edits, public.approved_prices, public.email_log TO authenticated;
GRANT SELECT, INSERT ON public.pdf_history TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.brand_ai_profiles TO authenticated;
GRANT ALL ON public.ir_tickets, public.ir_ticket_items, public.ir_ticket_rows, public.ir_ticket_events, public.ir_ticket_edits,
  public.approved_prices, public.pdf_history, public.brand_ai_profiles, public.email_log TO service_role;
GRANT USAGE ON SEQUENCE public.ir_ticket_seq, public.ir_ticket_events_id_seq, public.ir_ticket_edits_id_seq, public.email_log_id_seq TO service_role;
ALTER TABLE public.ir_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ir_ticket_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ir_ticket_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ir_ticket_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ir_ticket_edits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approved_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pdf_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_ai_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_log ENABLE ROW LEVEL SECURITY;

-- Brand managers: read their own tickets; create and edit only while Draft. Everything after Draft goes
-- through server functions (service role) that check roles and status.
CREATE POLICY "owner read" ON public.ir_tickets FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "owner draft insert" ON public.ir_tickets FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND status = 'draft' AND ticket_no IS NULL);
CREATE POLICY "owner draft update" ON public.ir_tickets FOR UPDATE TO authenticated USING (user_id = auth.uid() AND status = 'draft') WITH CHECK (user_id = auth.uid() AND status = 'draft' AND ticket_no IS NULL);
CREATE POLICY "owner draft delete" ON public.ir_tickets FOR DELETE TO authenticated USING (user_id = auth.uid() AND status = 'draft');
CREATE POLICY "owner read" ON public.ir_ticket_items FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()) OR EXISTS (SELECT 1 FROM public.ir_tickets t WHERE t.id = ticket_id AND t.user_id = auth.uid()));
CREATE POLICY "owner draft write" ON public.ir_ticket_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.ir_tickets t WHERE t.id = ticket_id AND t.user_id = auth.uid() AND t.status = 'draft'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.ir_tickets t WHERE t.id = ticket_id AND t.user_id = auth.uid() AND t.status = 'draft'));
CREATE POLICY "staff read" ON public.ir_ticket_rows FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "owner public, staff all" ON public.ir_ticket_events FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()) OR (NOT internal AND EXISTS (SELECT 1 FROM public.ir_tickets t WHERE t.id = ticket_id AND t.user_id = auth.uid())));
CREATE POLICY "staff read" ON public.ir_ticket_edits FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "signed in read" ON public.approved_prices FOR SELECT TO authenticated USING (true);
CREATE POLICY "own or staff read" ON public.pdf_history FOR SELECT TO authenticated USING (created_by = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "own insert" ON public.pdf_history FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "signed in read" ON public.brand_ai_profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "signed in write" ON public.brand_ai_profiles FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "signed in update" ON public.brand_ai_profiles FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "staff delete" ON public.brand_ai_profiles FOR DELETE TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "staff read" ON public.email_log FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

-- Status change with a check of the current status, in one transaction, with its history line.
CREATE OR REPLACE FUNCTION public.ir_transition(_ticket uuid, _actor uuid, _from text[], _to text, _action text,
  _comment text DEFAULT NULL, _internal boolean DEFAULT false, _patch jsonb DEFAULT '{}')
RETURNS public.ir_tickets LANGUAGE plpgsql SET search_path = public AS $$
DECLARE t public.ir_tickets; prev text;
BEGIN
  SELECT * INTO t FROM public.ir_tickets WHERE id = _ticket FOR UPDATE;
  IF t.id IS NULL THEN RAISE EXCEPTION 'Unknown ticket'; END IF;
  IF NOT (t.status = ANY(_from)) THEN RAISE EXCEPTION 'This ticket is now %, reload the page', t.status; END IF;
  prev := t.status;
  UPDATE public.ir_tickets SET
    status = _to,
    ticket_no = coalesce(ticket_no, CASE WHEN _to = 'submitted' THEN 'IR-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.ir_ticket_seq')::text, 4, '0') END),
    submitted_at = CASE WHEN _to = 'submitted' THEN now() ELSE submitted_at END,
    review_started_at = CASE WHEN _to = 'in_review' AND review_started_at IS NULL THEN now() ELSE review_started_at END,
    reviewer_id = CASE WHEN _to = 'in_review' AND reviewer_id IS NULL THEN _actor WHEN _action = 'proceed' THEN _actor ELSE reviewer_id END,
    proceeded_at = CASE WHEN _to = 'awaiting_approval' THEN now() ELSE proceeded_at END,
    approver_id = CASE WHEN _to IN ('approved','on_hold') OR (_to = 'rejected' AND prev = 'awaiting_approval') THEN _actor ELSE approver_id END,
    decided_at = CASE WHEN _to IN ('approved','on_hold','rejected') THEN now() ELSE decided_at END,
    reject_reason = CASE WHEN _to = 'rejected' THEN _comment ELSE reject_reason END,
    uploaded_at = CASE WHEN _to = 'uploaded' THEN now() ELSE uploaded_at END,
    verified_at = CASE WHEN _to = 'verified' THEN now() ELSE verified_at END,
    special_instructions = coalesce(_patch->>'special_instructions', special_instructions),
    suppliers = coalesce(_patch->'suppliers', suppliers),
    counts = coalesce(_patch->'counts', counts),
    price_summary = coalesce(_patch->'price_summary', price_summary),
    missing_setup = coalesce(_patch->'missing_setup', missing_setup),
    uploads = coalesce(_patch->'uploads', uploads),
    cross_check = coalesce(_patch->'cross_check', cross_check),
    draft = CASE WHEN _to = 'submitted' THEN NULL ELSE draft END,
    revision = revision + 1
  WHERE id = _ticket RETURNING * INTO t;
  INSERT INTO public.ir_ticket_events (ticket_id, action, from_status, to_status, comment, internal, actor)
    VALUES (_ticket, _action, prev, _to, _comment, _internal, _actor);
  RETURN t;
END $$;
REVOKE ALL ON FUNCTION public.ir_transition(uuid, uuid, text[], text, text, text, boolean, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ir_transition(uuid, uuid, text[], text, text, text, boolean, jsonb) TO service_role;

-- Approve: status, history, and the approved retail per entity for PDFs (gap 21, 24), in one transaction.
CREATE OR REPLACE FUNCTION public.ir_approve(_ticket uuid, _actor uuid)
RETURNS public.ir_tickets LANGUAGE plpgsql SET search_path = public AS $$
DECLARE t public.ir_tickets;
BEGIN
  t := public.ir_transition(_ticket, _actor, ARRAY['awaiting_approval'], 'approved', 'approve');
  INSERT INTO public.approved_prices (entity_code, item_code, brand_activity, description, retail_price, currency, inactive, ticket_id, approved_at)
  SELECT r.entity_code, r.erp->>'Item Code', r.erp->>'Brand Activity', r.erp->>'Description',
         nullif(r.erp->>'Retail Price', '')::numeric, e.currency, nullif(r.erp->>'Inactive', '')::integer, _ticket, now()
  FROM public.ir_ticket_rows r JOIN public.entities e ON e.code = r.entity_code WHERE r.ticket_id = _ticket
  ON CONFLICT (entity_code, item_code) DO UPDATE SET brand_activity = excluded.brand_activity, description = excluded.description,
    retail_price = excluded.retail_price, currency = excluded.currency, inactive = excluded.inactive,
    ticket_id = excluded.ticket_id, approved_at = excluded.approved_at;
  RETURN t;
END $$;
REVOKE ALL ON FUNCTION public.ir_approve(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ir_approve(uuid, uuid) TO service_role;

-- ========== 6. Storage: brand and entity logos ==========
CREATE POLICY "brand-assets signed in read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'brand-assets');
CREATE POLICY "brand-assets staff write" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'brand-assets' AND public.is_staff(auth.uid()));
CREATE POLICY "brand-assets staff update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'brand-assets' AND public.is_staff(auth.uid()));
CREATE POLICY "brand-assets staff delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'brand-assets' AND public.is_staff(auth.uid()));
CREATE POLICY "pricelists staff read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'pricelists' AND public.is_staff(auth.uid()));
CREATE POLICY "erp-outputs staff all" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'erp-outputs' AND public.is_staff(auth.uid())) WITH CHECK (bucket_id = 'erp-outputs' AND public.is_staff(auth.uid()));

-- ========== 7. Seed (small lists only; categories and Midwich are imported in Admin) ==========
INSERT INTO public.currencies (code, name, sort_order) VALUES
  ('USD','US Dollar',1),('EUR','Euro',2),('AED','UAE Dirham',3),('QAR','Qatari Riyal',4),('SAR','Saudi Riyal',5),
  ('CHF','Swiss Franc',6),('IDR','Indonesian Rupiah',7),('MYR','Malaysian Ringgit',8),('SGD','Singapore Dollar',9),('GBP','British Pound',10)
ON CONFLICT (code) DO UPDATE SET name = CASE WHEN public.currencies.name = '' THEN excluded.name ELSE public.currencies.name END,
  sort_order = excluded.sort_order, active = true;

-- Carry the v2 per-entity rates over to the global table, then make sure the three known pairs exist.
INSERT INTO public.fx_rates (from_currency, to_currency, rate)
  SELECT DISTINCT ON (x.from_currency, e.currency) x.from_currency, e.currency, x.rate
  FROM public.exchange_rates x JOIN public.entities e ON e.code = x.entity_code
  WHERE x.from_currency <> e.currency ORDER BY x.from_currency, e.currency, e.sort_order
ON CONFLICT DO NOTHING;
INSERT INTO public.fx_rates (from_currency, to_currency, rate) VALUES ('USD','AED',3.675),('USD','QAR',3.65),('USD','SAR',3.75)
ON CONFLICT DO NOTHING;

UPDATE public.entities SET is_master = (code IN ('001','012'));
UPDATE public.entities SET pdf_allowed = true, legal_name = 'NMK Electronics Trading LLC Sole Proprietorship', pdf_terms_line = 'Ex-works Dubai, UAE, DDP, VAT is extra' WHERE code = '001';
UPDATE public.entities SET pdf_allowed = true, legal_name = 'NMK International FZE', pdf_terms_line = 'Ex-works Jebel Ali Freezone, Dubai, UAE' WHERE code = '011';
UPDATE public.entities SET pdf_allowed = true, legal_name = 'Edge Electronics Trading LLC', pdf_terms_line = 'Ex-works Doha, Qatar, DDP' WHERE code = '007';
UPDATE public.entities SET pdf_allowed = true, legal_name = 'NMK Middle East Trading Company', pdf_terms_line = 'Ex-works Riyadh, Saudi, DDP, 15% VAT is extra' WHERE code = '008';

INSERT INTO public.units (code, name, sort_order) VALUES ('pc','Pieces',1),('Met','Meter',2) ON CONFLICT (code) DO NOTHING;

INSERT INTO public.brands (brand_activity, default_unit) VALUES ('Turtle AV','pc'),('Lightware',NULL) ON CONFLICT (brand_activity) DO NOTHING;
UPDATE public.brands SET entity_codes = '{001,011,007,008}', default_max_discount = 25 WHERE brand_activity IN ('Turtle AV','Lightware');
INSERT INTO public.sub_activities (brand_activity, sub_activity) VALUES ('Turtle AV','Turtle AV'),('Lightware','Lightware') ON CONFLICT DO NOTHING;
INSERT INTO public.brand_suppliers (brand_activity, entity_code, supplier, supplier_name) VALUES
  ('Turtle AV','001','SUP101021','Turtle AV Supplier (test)'),('Turtle AV','011','SUP000077','Turtle AV Supplier (test)'),
  ('Turtle AV','007','SUP000377','Turtle AV Supplier (test)'),('Turtle AV','008','SUP002419','Turtle AV Supplier (test)'),
  ('Lightware','001','SUP101045','Lightware Supplier (test)'),('Lightware','011','SUP100611','Lightware Supplier (test)'),
  ('Lightware','007','SUP000160','Lightware Supplier (test)'),('Lightware','008','SUP002398','Lightware Supplier (test)')
ON CONFLICT (brand_activity, entity_code) DO UPDATE SET supplier = excluded.supplier,
  supplier_name = CASE WHEN public.brand_suppliers.supplier_name = '' THEN excluded.supplier_name ELSE public.brand_suppliers.supplier_name END;

-- Turtle AV (verified against the ERP and PDFs) and Lightware (special case: round to 100 in 007/008).
INSERT INTO public.pricing_rules (brand_activity, sub_activity, entity_code, overhead_pct, margin_divisors, round_to, max_discount_pct) VALUES
  ('Turtle AV',NULL,'001',10,'{0.5}',1,25),('Turtle AV',NULL,'011',5,'{0.5}',1,25),('Turtle AV',NULL,'007',15,'{0.5}',1,25),('Turtle AV',NULL,'008',15,'{0.5}',1,25),
  ('Lightware',NULL,'001',0,'{0.6}',1,25),('Lightware',NULL,'011',0,'{0.6}',1,25),('Lightware',NULL,'007',11,'{0.6}',100,25),('Lightware',NULL,'008',5,'{0.6}',100,25)
ON CONFLICT (brand_activity, coalesce(sub_activity,''), entity_code) DO NOTHING;

INSERT INTO public.app_settings (key, value) VALUES
  ('admin_inbox', '"surajsaini8@gmail.com"'),
  ('email_test_mode', 'true'),
  ('email_test_address', '"surajsaini8@gmail.com"'),
  ('email_from', '"NMK Unite <onboarding@resend.dev>"'),
  ('emails_enabled', '{"submitted_admin":true,"submitted_user":true,"awaiting_approval":true,"approved_user":true,"approved_reviewer":true,"hold_reviewer":true,"hold_user":true,"rejected_user":true,"uploaded_user":true}'),
  ('price_change_warn_pct', '10'),
  ('hold_comment_required', 'true'),
  ('block_self_approval', 'false'),
  ('pdf_confidential_line', '"This price list is confidential. It must not be shared, distributed, or disclosed to any third party."'),
  ('pdf_notice_line', '"All prices are subject to change without prior notice"')
ON CONFLICT (key) DO NOTHING;
UPDATE public.app_settings SET value = '10' WHERE key = 'retail_change_warn_pct';