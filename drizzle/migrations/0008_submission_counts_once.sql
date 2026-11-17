DROP TRIGGER IF EXISTS submission_initial_counts ON public.submission_rows;
CREATE OR REPLACE FUNCTION public.create_build_submission(_user uuid,_brand text,_entities jsonb,_path text,_rows jsonb) RETURNS uuid LANGUAGE plpgsql SET search_path=public AS $$
DECLARE sid uuid:=gen_random_uuid();
BEGIN
 INSERT INTO public.submissions(id,user_id,source,brand_activity,entities,status,file_path,submitted_at,counts) VALUES(sid,_user,'build',_brand,_entities,'submitted',_path,now(),jsonb_build_object('rows',jsonb_array_length(_rows),'errors',0,'warnings',0,'tickets',0));
 INSERT INTO public.submission_rows(submission_id,entity_code,cost_currency,row_no,item_code,alternative_code,description,alternate_description,brand_activity,sub_activity,cost_price,measurement_unit,checks)
 SELECT sid,r.entity_code,r.cost_currency,r.row_no,r.item_code,r.alternative_code,r.description,r.alternate_description,_brand,r.sub_activity,r.cost_price,r.measurement_unit,r.checks FROM jsonb_to_recordset(_rows) AS r(entity_code text,cost_currency text,row_no integer,item_code text,alternative_code text,description text,alternate_description text,sub_activity text,cost_price numeric,measurement_unit text,checks jsonb);
 RETURN sid;
END $$;