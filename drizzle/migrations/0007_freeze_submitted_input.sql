REVOKE INSERT,UPDATE,DELETE ON public.submission_rows FROM authenticated;
CREATE OR REPLACE FUNCTION public.submission_initial_counts() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 UPDATE public.submissions SET counts=jsonb_build_object('rows',(SELECT count(*) FROM public.submission_rows WHERE submission_id=NEW.submission_id),'errors',0,'warnings',0,'tickets',0) WHERE id=NEW.submission_id AND status='submitted';
 RETURN NEW;
END $$;
CREATE TRIGGER submission_initial_counts AFTER INSERT ON public.submission_rows FOR EACH ROW EXECUTE FUNCTION public.submission_initial_counts();