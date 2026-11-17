CREATE TABLE public.brand_suppliers (
 brand_activity text NOT NULL REFERENCES public.brands(brand_activity) ON DELETE CASCADE,
 entity_code text NOT NULL REFERENCES public.entities(code),
 supplier text NOT NULL DEFAULT 'TO SET',
 PRIMARY KEY (brand_activity, entity_code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.brand_suppliers TO authenticated;
GRANT ALL ON public.brand_suppliers TO service_role;
ALTER TABLE public.brand_suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "signed in read" ON public.brand_suppliers FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin write" ON public.brand_suppliers FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
INSERT INTO public.brand_suppliers (brand_activity, entity_code, supplier) SELECT b.brand_activity,e.code,'TO SET' FROM public.brands b CROSS JOIN public.entities e;
COMMENT ON COLUMN public.brands.supplier IS 'DEPRECATED: replaced by brand_suppliers.supplier per entity';
ALTER TABLE public.pricing_rule_entities ADD COLUMN cost_basis text NOT NULL DEFAULT 'vendor_price' CHECK (cost_basis IN ('vendor_price','local_msrp'));
ALTER TABLE public.pricing_rule_entities ADD COLUMN retail_method text NOT NULL DEFAULT 'calculate' CHECK (retail_method IN ('calculate','local_msrp'));
ALTER TABLE public.pricing_rule_entities ADD COLUMN round_to numeric NOT NULL DEFAULT 1 CHECK (round_to > 0);