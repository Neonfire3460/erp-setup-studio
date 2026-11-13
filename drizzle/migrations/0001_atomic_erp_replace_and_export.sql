CREATE TABLE public.erp_items_staging (
 batch_id uuid NOT NULL, created_by uuid NOT NULL DEFAULT auth.uid(), item_code text NOT NULL,
 family_name text, group_name text, category_name text, sub_category_name text, midwich_family text,
 measurement_unit text, inactive text, webactive text, b2b text, refreshed_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(batch_id, item_code)
);
GRANT SELECT, INSERT, DELETE ON public.erp_items_staging TO authenticated;
GRANT ALL ON public.erp_items_staging TO service_role;
ALTER TABLE public.erp_items_staging ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin own staging" ON public.erp_items_staging FOR ALL TO authenticated USING (created_by = auth.uid() AND public.has_role(auth.uid(), 'admin')) WITH CHECK (created_by = auth.uid() AND public.has_role(auth.uid(), 'admin'));
CREATE FUNCTION public.replace_erp_items(_batch_id uuid, _expected_count integer) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
 IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
 PERFORM pg_advisory_xact_lock(741239);
 SELECT count(*) INTO n FROM public.erp_items_staging WHERE batch_id = _batch_id AND created_by = auth.uid();
 IF n = 0 OR n <> _expected_count THEN RAISE EXCEPTION 'Staging row count mismatch'; END IF;
 DELETE FROM public.erp_items WHERE item_code IS NOT NULL;
 INSERT INTO public.erp_items(item_code, family_name, group_name, category_name, sub_category_name, midwich_family, measurement_unit, inactive, webactive, b2b, refreshed_at)
 SELECT upper(trim(item_code)), family_name, group_name, category_name, sub_category_name, midwich_family, measurement_unit, inactive, webactive, b2b, now() FROM public.erp_items_staging WHERE batch_id = _batch_id AND created_by = auth.uid();
 DELETE FROM public.erp_items_staging WHERE batch_id = _batch_id AND created_by = auth.uid();
 RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.replace_erp_items(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.replace_erp_items(uuid, integer) TO authenticated;
CREATE FUNCTION public.save_erp_export(_upload_id uuid, _user_id uuid, _entity_code text, _rows jsonb, _snapshot jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE eid uuid;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.uploads WHERE id = _upload_id AND user_id = _user_id) THEN RAISE EXCEPTION 'Upload not owned'; END IF;
 INSERT INTO public.exports(upload_id,user_id,entity_code,row_count,rows) VALUES(_upload_id,_user_id,_entity_code,jsonb_array_length(_rows),_rows) RETURNING id INTO eid;
 INSERT INTO public.export_audit(export_id,rule_snapshot) VALUES(eid,_snapshot);
 RETURN eid;
END $$;
REVOKE ALL ON FUNCTION public.save_erp_export(uuid, uuid, text, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_erp_export(uuid, uuid, text, jsonb, jsonb) TO service_role;