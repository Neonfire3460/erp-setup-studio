ALTER TABLE public.erp_imports ADD COLUMN active boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX erp_imports_one_active ON public.erp_imports (entity_code) WHERE active;

ALTER TABLE public.erp_items DROP CONSTRAINT erp_items_pkey;
ALTER TABLE public.erp_items ADD COLUMN import_id uuid NOT NULL REFERENCES public.erp_imports(id) ON DELETE CASCADE;
ALTER TABLE public.erp_items ADD PRIMARY KEY (import_id, item_code);
CREATE INDEX erp_items_entity ON public.erp_items (entity_code);

CREATE OR REPLACE VIEW public.erp_items_active WITH (security_invoker = true) AS
  SELECT i.* FROM public.erp_items i JOIN public.erp_imports m ON m.id = i.import_id AND m.active;
GRANT SELECT ON public.erp_items_active TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.activate_erp_import(_import_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ent text; expected integer; n integer;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
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
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF EXISTS (SELECT 1 FROM public.erp_imports WHERE id = _import_id AND active) THEN RAISE EXCEPTION 'Cannot delete the active import'; END IF;
  DELETE FROM public.erp_items WHERE ctid IN (SELECT ctid FROM public.erp_items WHERE import_id = _import_id LIMIT 10000);
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;
REVOKE EXECUTE ON FUNCTION public.activate_erp_import(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.delete_erp_import_rows(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.activate_erp_import(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_erp_import_rows(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.erp_check(codes text[])
RETURNS TABLE(code text, in_erp boolean, description text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.code, coalesce(d.found, false), d.description
  FROM (SELECT DISTINCT x AS code FROM unnest(codes) x WHERE auth.uid() IS NOT NULL) c
  LEFT JOIN LATERAL (
    SELECT true AS found, i.description FROM public.erp_items i
    JOIN public.erp_imports m ON m.id = i.import_id AND m.active
    JOIN public.entities e ON e.code = i.entity_code
    WHERE upper(i.item_code) = upper(btrim(c.code)) ORDER BY e.sort_order LIMIT 1
  ) d ON true
$$;

CREATE OR REPLACE FUNCTION public.erp_entity_stats()
RETURNS TABLE(entity_code text, row_count bigint, active_count bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  RETURN QUERY SELECT i.entity_code, count(*), count(*) FILTER (WHERE coalesce(i.inactive,0) <> 1)
    FROM public.erp_items i JOIN public.erp_imports m ON m.id = i.import_id AND m.active GROUP BY i.entity_code;
END $$;

DROP FUNCTION IF EXISTS public.swap_erp_items(uuid, text, uuid, integer, text);
DROP TABLE IF EXISTS public.erp_items_staging;