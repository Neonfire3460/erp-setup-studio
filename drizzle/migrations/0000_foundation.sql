
-- ROLES
create type public.app_role as enum ('admin', 'user');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create policy "read own or admin reads all" on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

-- first account becomes admin
create or replace function public.handle_new_user_role()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform pg_advisory_xact_lock(424242);
  if not exists (select 1 from public.user_roles where role = 'admin') then
    insert into public.user_roles (user_id, role) values (new.id, 'admin');
  else
    insert into public.user_roles (user_id, role) values (new.id, 'user');
  end if;
  return new;
end $$;
create trigger on_auth_user_created_role after insert on auth.users
  for each row execute function public.handle_new_user_role();

-- admin: list users with role
create or replace function public.admin_list_users()
returns table (user_id uuid, email text, role public.app_role, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'Forbidden'; end if;
  return query
    select u.id, u.email::text,
      case when exists (select 1 from public.user_roles r where r.user_id = u.id and r.role = 'admin')
        then 'admin'::public.app_role else 'user'::public.app_role end,
      u.created_at
    from auth.users u order by u.created_at;
end $$;

create or replace function public.admin_set_role(_user_id uuid, _role public.app_role)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'Forbidden'; end if;
  if _role = 'user' and public.has_role(_user_id, 'admin')
     and (select count(*) from public.user_roles where role = 'admin') <= 1 then
    raise exception 'Cannot remove the last admin';
  end if;
  delete from public.user_roles where user_id = _user_id;
  insert into public.user_roles (user_id, role) values (_user_id, _role);
end $$;
revoke execute on function public.admin_list_users() from anon, public;
revoke execute on function public.admin_set_role(uuid, public.app_role) from anon, public;
grant execute on function public.admin_list_users() to authenticated;
grant execute on function public.admin_set_role(uuid, public.app_role) to authenticated;

-- ENTITIES
create table public.entities (
  code text primary key,
  name text not null,
  region text not null,
  currency text not null,
  sort_order int not null default 0
);
grant select, insert, update, delete on public.entities to authenticated;
grant all on public.entities to service_role;
alter table public.entities enable row level security;
create policy "signed in read" on public.entities for select to authenticated using (true);
create policy "admin write" on public.entities for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- BRANDS
create table public.brands (
  brand_activity text primary key,
  supplier text not null default 'TO SET',
  default_unit text
);
grant select, insert, update, delete on public.brands to authenticated;
grant all on public.brands to service_role;
alter table public.brands enable row level security;
create policy "signed in read" on public.brands for select to authenticated using (true);
create policy "admin write" on public.brands for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- PRICING RULES (admin only)
create table public.pricing_rules (
  id uuid primary key default gen_random_uuid(),
  brand_activity text not null,
  sub_activity text not null,
  vendor_currency text not null,
  cost_method text not null check (cost_method in ('discount_from_msrp', 'net_price')),
  discount_pct numeric not null default 0,
  margin_divisors numeric[] not null,
  max_discount_pct numeric,
  is_test boolean not null default false,
  active boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  unique (brand_activity, sub_activity, vendor_currency)
);
grant select, insert, update, delete on public.pricing_rules to authenticated;
grant all on public.pricing_rules to service_role;
alter table public.pricing_rules enable row level security;
create policy "admin only" on public.pricing_rules for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

create or replace function public.touch_pricing_rule()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  return new;
end $$;
create trigger pricing_rules_touch before insert or update on public.pricing_rules
  for each row execute function public.touch_pricing_rule();

create table public.pricing_rule_entities (
  rule_id uuid not null references public.pricing_rules(id) on delete cascade,
  entity_code text not null references public.entities(code) on update cascade,
  ex_rate numeric not null,
  overhead_pct numeric not null default 0,
  primary key (rule_id, entity_code)
);
grant select, insert, update, delete on public.pricing_rule_entities to authenticated;
grant all on public.pricing_rule_entities to service_role;
alter table public.pricing_rule_entities enable row level security;
create policy "admin only" on public.pricing_rule_entities for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- ERP ITEMS
create table public.erp_items (
  item_code text primary key,
  family_name text, group_name text, category_name text, sub_category_name text,
  midwich_family text, measurement_unit text, inactive text, webactive text, b2b text,
  refreshed_at timestamptz not null default now()
);
grant select, insert, update, delete on public.erp_items to authenticated;
grant all on public.erp_items to service_role;
alter table public.erp_items enable row level security;
create policy "signed in read" on public.erp_items for select to authenticated using (true);
create policy "admin write" on public.erp_items for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

create or replace function public.normalize_erp_item_code()
returns trigger language plpgsql set search_path = public as $$
begin
  new.item_code := upper(btrim(new.item_code));
  return new;
end $$;
create trigger erp_items_normalize before insert or update on public.erp_items
  for each row execute function public.normalize_erp_item_code();

-- VENDOR PROFILES
create table public.vendor_profiles (
  id uuid primary key default gen_random_uuid(),
  brand_activity text not null,
  header_signature text not null,
  mapping jsonb not null,
  created_by uuid default auth.uid(),
  last_used_at timestamptz not null default now()
);
grant select, insert, update, delete on public.vendor_profiles to authenticated;
grant all on public.vendor_profiles to service_role;
alter table public.vendor_profiles enable row level security;
create policy "signed in all" on public.vendor_profiles for all to authenticated using (true) with check (true);

-- UPLOADS
create table public.uploads (
  id uuid primary key default gen_random_uuid(),
  tool text not null check (tool in ('convert', 'build')),
  user_id uuid not null default auth.uid(),
  brand_activity text,
  vendor_currency text,
  file_name text,
  file_path text,
  mapping jsonb,
  ai_response jsonb,
  counts jsonb,
  detected_rows jsonb,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.uploads to authenticated;
grant all on public.uploads to service_role;
alter table public.uploads enable row level security;
create policy "owner or admin" on public.uploads for all to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'))
  with check (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

-- EXPORTS
create table public.exports (
  id uuid primary key default gen_random_uuid(),
  upload_id uuid references public.uploads(id) on delete set null,
  user_id uuid not null default auth.uid(),
  entity_code text not null,
  row_count int not null default 0,
  rows jsonb,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.exports to authenticated;
grant all on public.exports to service_role;
alter table public.exports enable row level security;
create policy "owner or admin" on public.exports for all to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'))
  with check (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

-- EXPORT AUDIT (admin only)
create table public.export_audit (
  export_id uuid primary key references public.exports(id) on delete cascade,
  rule_snapshot jsonb not null
);
grant select, insert, update, delete on public.export_audit to authenticated;
grant all on public.export_audit to service_role;
alter table public.export_audit enable row level security;
create policy "admin only" on public.export_audit for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- FUNCTIONS EXPOSING NO NUMBERS
create or replace function public.list_activities()
returns table (brand_activity text, sub_activity text, vendor_currency text, cost_method text, entity_codes text[])
language sql stable security definer set search_path = public as $$
  select r.brand_activity, r.sub_activity, r.vendor_currency, r.cost_method,
    coalesce(array_agg(e.entity_code order by en.sort_order, e.entity_code) filter (where e.entity_code is not null), '{}')
  from public.pricing_rules r
  left join public.pricing_rule_entities e on e.rule_id = r.id
  left join public.entities en on en.code = e.entity_code
  where r.active and auth.uid() is not null
  group by r.id, r.brand_activity, r.sub_activity, r.vendor_currency, r.cost_method
  order by r.brand_activity, r.sub_activity, r.vendor_currency
$$;

create or replace function public.count_erp_matches(codes text[])
returns integer language sql stable security definer set search_path = public as $$
  select case when auth.uid() is null then 0 else (
    select count(distinct c)::int from (select upper(btrim(x)) as c from unnest(codes) x) s
    where exists (select 1 from public.erp_items i where i.item_code = s.c)
  ) end
$$;
revoke execute on function public.list_activities() from anon, public;
revoke execute on function public.count_erp_matches(text[]) from anon, public;
grant execute on function public.list_activities() to authenticated;
grant execute on function public.count_erp_matches(text[]) to authenticated;

-- STORAGE POLICIES (bucket pricelists, path {user_id}/{upload_id}/{file})
create policy "pricelists owner or admin read" on storage.objects for select to authenticated
  using (bucket_id = 'pricelists' and ((storage.foldername(name))[1] = auth.uid()::text or public.has_role(auth.uid(), 'admin')));
create policy "pricelists owner insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'pricelists' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "pricelists owner or admin delete" on storage.objects for delete to authenticated
  using (bucket_id = 'pricelists' and ((storage.foldername(name))[1] = auth.uid()::text or public.has_role(auth.uid(), 'admin')));

-- SEED
insert into public.entities (code, name, region, currency, sort_order) values
  ('001', 'NMK 001', 'Middle East', 'AED', 1),
  ('011', 'NMK 011', 'Middle East', 'AED', 2),
  ('007', 'EDGE Qatar 007', 'Middle East', 'QAR', 3),
  ('008', 'Saudi 008', 'Middle East', 'SAR', 4),
  ('012', 'Singapore 012', 'South East Asia', 'SGD', 5),
  ('013', 'Malaysia 013', 'South East Asia', 'MYR', 6),
  ('014', 'Indonesia 014', 'South East Asia', 'IDR', 7);

insert into public.pricing_rules (brand_activity, sub_activity, vendor_currency, cost_method, discount_pct, margin_divisors, is_test) values
  ('Brightsign', 'Brightsign', 'USD', 'discount_from_msrp', 35, '{0.75,0.75}', false),
  ('Brightsign', 'Brightsign Service', 'USD', 'discount_from_msrp', 35, '{0.75,0.75}', false),
  ('LDA', 'LDA', 'EUR', 'discount_from_msrp', 50, '{0.50}', false),
  ('LDA', 'LDA License', 'EUR', 'discount_from_msrp', 50, '{0.50}', false),
  ('7thSense', '7th Sense', 'USD', 'net_price', 0, '{0.60}', false),
  ('7thSense', '7th Sense Warranty', 'USD', 'net_price', 0, '{0.60}', false),
  ('7thSense', 'Medialon', 'USD', 'discount_from_msrp', 40, '{0.60}', false),
  ('Ampetronic', 'Ampetronic', 'GBP', 'net_price', 0, '{0.50}', false),
  ('Ampetronic', 'Listen', 'GBP', 'net_price', 0, '{0.50}', false),
  ('Ampetronic', 'Auri', 'GBP', 'net_price', 0, '{0.50}', false),
  ('Lightware', 'Lightware', 'AED', 'discount_from_msrp', 40, '{0.60}', true),
  ('Lightware', 'Lightware', 'USD', 'discount_from_msrp', 40, '{0.60}', true),
  ('DTEN', 'DTEN', 'USD', 'net_price', 0, '{0.70}', true);

insert into public.pricing_rule_entities (rule_id, entity_code, ex_rate, overhead_pct)
select r.id, v.entity, v.ex_rate, v.overhead
from (values
  ('Brightsign','Brightsign','USD','001',3.675,10), ('Brightsign','Brightsign','USD','011',3.675,5),
  ('Brightsign','Brightsign','USD','007',3.65,18), ('Brightsign','Brightsign','USD','008',3.75,11),
  ('Brightsign','Brightsign Service','USD','001',3.675,0), ('Brightsign','Brightsign Service','USD','011',3.675,0),
  ('Brightsign','Brightsign Service','USD','007',3.65,0), ('Brightsign','Brightsign Service','USD','008',3.75,0),
  ('LDA','LDA','EUR','008',4.5,18),
  ('LDA','LDA License','EUR','008',4.5,0),
  ('7thSense','7th Sense','USD','001',3.675,8), ('7thSense','7th Sense','USD','011',3.675,5),
  ('7thSense','7th Sense','USD','007',3.65,10), ('7thSense','7th Sense','USD','008',3.75,10),
  ('7thSense','7th Sense Warranty','USD','001',3.675,0), ('7thSense','7th Sense Warranty','USD','011',3.675,0),
  ('7thSense','7th Sense Warranty','USD','007',3.65,0), ('7thSense','7th Sense Warranty','USD','008',3.75,0),
  ('7thSense','Medialon','USD','001',3.675,8), ('7thSense','Medialon','USD','011',3.675,5),
  ('7thSense','Medialon','USD','007',3.65,10), ('7thSense','Medialon','USD','008',3.75,10),
  ('Ampetronic','Ampetronic','GBP','001',5.1,16), ('Ampetronic','Ampetronic','GBP','011',5.1,11),
  ('Ampetronic','Ampetronic','GBP','007',5.1,16), ('Ampetronic','Ampetronic','GBP','008',5.2,16),
  ('Ampetronic','Listen','GBP','001',5.1,16), ('Ampetronic','Listen','GBP','011',5.1,11),
  ('Ampetronic','Listen','GBP','007',5.1,16), ('Ampetronic','Listen','GBP','008',5.2,16),
  ('Ampetronic','Auri','GBP','001',5.1,16), ('Ampetronic','Auri','GBP','011',5.1,11),
  ('Ampetronic','Auri','GBP','007',5.1,16), ('Ampetronic','Auri','GBP','008',5.2,16),
  ('Lightware','Lightware','AED','001',1,10), ('Lightware','Lightware','AED','011',1,5),
  ('Lightware','Lightware','USD','007',3.65,18), ('Lightware','Lightware','USD','008',3.75,11),
  ('DTEN','DTEN','USD','012',1.35,10), ('DTEN','DTEN','USD','013',4.70,10), ('DTEN','DTEN','USD','014',16000,10)
) as v(brand, sub, cur, entity, ex_rate, overhead)
join public.pricing_rules r on r.brand_activity = v.brand and r.sub_activity = v.sub and r.vendor_currency = v.cur;

insert into public.brands (brand_activity, supplier, default_unit) values
  ('Brightsign', 'TO SET', null), ('LDA', 'TO SET', null), ('7thSense', 'TO SET', null),
  ('Ampetronic', 'TO SET', null), ('Lightware', 'TO SET', null), ('DTEN', 'TO SET', null);
