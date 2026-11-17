ALTER TABLE public.submissions ADD COLUMN processing_revision integer NOT NULL DEFAULT 0;
REVOKE SELECT ON public.submission_rows FROM authenticated;
GRANT SELECT (id,submission_id,entity_code,cost_currency,row_no,item_code,alternative_code,description,alternate_description,brand_activity,sub_activity,measurement_unit,checks) ON public.submission_rows TO authenticated;
CREATE OR REPLACE FUNCTION public.lock_approved_submission() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE sid uuid;
BEGIN
 IF TG_TABLE_NAME='submissions' THEN
  IF OLD.status='approved' THEN RAISE EXCEPTION 'Approved submissions are locked'; END IF;
 ELSE
  IF TG_OP='INSERT' THEN sid:=NEW.submission_id; ELSE sid:=OLD.submission_id; END IF;
  IF EXISTS (SELECT 1 FROM public.submissions WHERE id=sid AND status='approved') THEN RAISE EXCEPTION 'Approved submissions are locked'; END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $$;
CREATE TRIGGER submissions_lock BEFORE UPDATE OR DELETE ON public.submissions FOR EACH ROW EXECUTE FUNCTION public.lock_approved_submission();
CREATE TRIGGER submission_rows_lock BEFORE INSERT OR UPDATE OR DELETE ON public.submission_rows FOR EACH ROW EXECUTE FUNCTION public.lock_approved_submission();
CREATE TRIGGER output_rows_lock BEFORE INSERT OR UPDATE OR DELETE ON public.output_rows FOR EACH ROW EXECUTE FUNCTION public.lock_approved_submission();
CREATE OR REPLACE FUNCTION public.active_erp_for_codes(_codes text[]) RETURNS SETOF public.erp_items LANGUAGE sql STABLE SET search_path=public AS $$ SELECT i.* FROM public.erp_items i JOIN public.erp_imports m ON m.id=i.import_id AND m.active WHERE upper(btrim(i.item_code))=ANY(_codes) $$;
REVOKE ALL ON FUNCTION public.active_erp_for_codes(text[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.active_erp_for_codes(text[]) TO service_role;
CREATE OR REPLACE FUNCTION public.create_build_submission(_user uuid,_brand text,_entities jsonb,_path text,_rows jsonb) RETURNS uuid LANGUAGE plpgsql SET search_path=public AS $$
DECLARE sid uuid:=gen_random_uuid();
BEGIN
 INSERT INTO public.submissions(id,user_id,source,brand_activity,entities,status,file_path,submitted_at) VALUES(sid,_user,'build',_brand,_entities,'submitted',_path,now());
 INSERT INTO public.submission_rows(submission_id,entity_code,cost_currency,row_no,item_code,alternative_code,description,alternate_description,brand_activity,sub_activity,cost_price,measurement_unit,checks)
 SELECT sid,r.entity_code,r.cost_currency,r.row_no,r.item_code,r.alternative_code,r.description,r.alternate_description,_brand,r.sub_activity,r.cost_price,r.measurement_unit,r.checks FROM jsonb_to_recordset(_rows) AS r(entity_code text,cost_currency text,row_no integer,item_code text,alternative_code text,description text,alternate_description text,sub_activity text,cost_price numeric,measurement_unit text,checks jsonb);
 RETURN sid;
END $$;
REVOKE ALL ON FUNCTION public.create_build_submission(uuid,text,jsonb,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.create_build_submission(uuid,text,jsonb,text,jsonb) TO service_role;
CREATE OR REPLACE FUNCTION public.persist_submission_processing(_id uuid,_revision integer,_status text,_counts jsonb,_outputs jsonb,_tickets jsonb) RETURNS integer LANGUAGE plpgsql SET search_path=public AS $$
DECLARE s public.submissions; t jsonb; tid uuid;
BEGIN
 SELECT * INTO s FROM public.submissions WHERE id=_id FOR UPDATE;
 IF s.id IS NULL OR s.status='approved' OR s.processing_revision<>_revision THEN RAISE EXCEPTION 'Submission changed; reload and try again'; END IF;
 DELETE FROM public.output_rows WHERE submission_id=_id;
 INSERT INTO public.output_rows(submission_id,entity_code,row_no,"values",names,current_erp_retail,checks)
 SELECT _id,r."entityCode",r.row,r.values,r.names,r."currentErpRetail",r.checks FROM jsonb_to_recordset(_outputs) AS r("entityCode" text,row integer,values jsonb,names jsonb,"currentErpRetail" numeric,checks jsonb);
 FOR t IN SELECT * FROM jsonb_array_elements(_tickets) LOOP
  SELECT id INTO tid FROM public.tickets WHERE submission_id=_id AND status='open' AND kind=t->>'kind' AND brand_activity=t->>'brandActivity' AND sub_activity IS NOT DISTINCT FROM t->>'subActivity' AND entity_code=t->>'entityCode' AND currency IS NOT DISTINCT FROM t->>'currency' LIMIT 1;
  IF tid IS NULL THEN INSERT INTO public.tickets(submission_id,kind,brand_activity,sub_activity,entity_code,currency,row_count,note) VALUES(_id,t->>'kind',t->>'brandActivity',t->>'subActivity',t->>'entityCode',t->>'currency',(t->>'rowCount')::integer,t->>'note');
  ELSE UPDATE public.tickets SET row_count=(t->>'rowCount')::integer,note=t->>'note' WHERE id=tid; END IF;
 END LOOP;
 UPDATE public.tickets k SET status='resolved',resolved_at=now() WHERE submission_id=_id AND status='open' AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(_tickets) t WHERE k.kind=t->>'kind' AND k.brand_activity=t->>'brandActivity' AND k.sub_activity IS NOT DISTINCT FROM t->>'subActivity' AND k.entity_code=t->>'entityCode' AND k.currency IS NOT DISTINCT FROM t->>'currency');
 UPDATE public.submissions SET status=_status,counts=_counts,processing_revision=processing_revision+1 WHERE id=_id;
 RETURN _revision+1;
END $$;
REVOKE ALL ON FUNCTION public.persist_submission_processing(uuid,integer,text,jsonb,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.persist_submission_processing(uuid,integer,text,jsonb,jsonb,jsonb) TO service_role;
CREATE OR REPLACE FUNCTION public.approve_submission(_id uuid,_actor uuid,_revision integer,_path text) RETURNS void LANGUAGE plpgsql SET search_path=public AS $$
DECLARE s public.submissions;
BEGIN
 IF NOT public.has_role(_actor,'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
 SELECT * INTO s FROM public.submissions WHERE id=_id FOR UPDATE;
 IF s.id IS NULL OR s.status<>'in_review' OR s.processing_revision<>_revision THEN RAISE EXCEPTION 'Submission changed; reload and try again'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.output_rows WHERE submission_id=_id) OR EXISTS(SELECT 1 FROM public.output_rows o,jsonb_array_elements(o.checks) c WHERE o.submission_id=_id AND c->>'level'='error') THEN RAISE EXCEPTION 'Errors block approval'; END IF;
 IF _path NOT LIKE _id::text||'/%' THEN RAISE EXCEPTION 'Invalid file path'; END IF;
 INSERT INTO public.catalogue_items(entity_code,item_code,brand_activity,sub_activity,alternative_code,description,alternate_description,retail_price,currency,family_name,group_name,category_name,sub_category_name,midwich_family_name,submission_id,approved_at)
 SELECT o.entity_code,o.values->>'Item Code',o.values->>'Brand Activity',o.values->>'Sub Activity',o.values->>'Alternative Code',o.values->>'Description',o.values->>'Alternate Description',(o.values->>'Retail Price')::numeric,e.currency,o.names->>'family',o.names->>'group',o.names->>'category',o.names->>'subCategory',o.names->>'midwichFamily',_id,now() FROM public.output_rows o JOIN public.entities e ON e.code=o.entity_code WHERE o.submission_id=_id
 ON CONFLICT(entity_code,item_code) DO UPDATE SET brand_activity=excluded.brand_activity,sub_activity=excluded.sub_activity,alternative_code=excluded.alternative_code,description=excluded.description,alternate_description=excluded.alternate_description,retail_price=excluded.retail_price,currency=excluded.currency,family_name=excluded.family_name,group_name=excluded.group_name,category_name=excluded.category_name,sub_category_name=excluded.sub_category_name,midwich_family_name=excluded.midwich_family_name,submission_id=excluded.submission_id,approved_at=excluded.approved_at;
 UPDATE public.submissions SET status='approved',output_path=_path,reviewed_by=_actor,reviewed_at=now(),review_comment=NULL WHERE id=_id;
END $$;
REVOKE ALL ON FUNCTION public.approve_submission(uuid,uuid,integer,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.approve_submission(uuid,uuid,integer,text) TO service_role;