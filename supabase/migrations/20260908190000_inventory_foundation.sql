-- Gold Task 2: inventory schema and authorization foundation.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.shops (
  id uuid primary key default gen_random_uuid(),
  name text not null check (btrim(name) <> ''),
  code text unique check (code is null or btrim(code) <> ''),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.employees (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique not null references auth.users(id) on delete restrict,
  full_name text check (full_name is null or btrim(full_name) <> ''),
  role text not null check (role in ('owner', 'manager', 'salesperson')),
  shop_id uuid references public.shops(id) on delete restrict,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint assigned_shop_required_for_non_owner
    check (role = 'owner' or shop_id is not null)
);

create table public.product_categories (
  id uuid primary key default gen_random_uuid(),
  name text unique not null check (btrim(name) <> ''),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete restrict,
  barcode text unique not null,
  article_number text,
  category_id uuid references public.product_categories(id) on delete set null,
  gold_fineness text,
  gold_color text,
  weight_grams numeric(12, 3),
  size text,
  owner_price numeric(14, 2),
  selling_price numeric(14, 2),
  status text not null default 'IN_STOCK'
    check (status in ('IN_STOCK', 'SOLD', 'RESERVED', 'REMOVED')),
  received_at timestamptz,
  notes text,
  created_by uuid references public.employees(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint barcode_is_trimmed_and_not_empty
    check (barcode = btrim(barcode) and barcode <> ''),
  constraint article_number_not_empty
    check (article_number is null or btrim(article_number) <> ''),
  constraint weight_grams_nonnegative
    check (weight_grams is null or weight_grams >= 0),
  constraint owner_price_nonnegative
    check (owner_price is null or owner_price >= 0),
  constraint selling_price_nonnegative
    check (selling_price is null or selling_price >= 0)
);

create index employees_shop_id_idx on public.employees (shop_id);
create index inventory_items_shop_id_idx on public.inventory_items (shop_id);
create index inventory_items_status_idx on public.inventory_items (status);
create index inventory_items_article_number_idx on public.inventory_items (article_number)
  where article_number is not null;
create index inventory_items_shop_status_idx on public.inventory_items (shop_id, status);

create trigger shops_set_updated_at
before update on public.shops
for each row execute function public.set_updated_at();

create trigger employees_set_updated_at
before update on public.employees
for each row execute function public.set_updated_at();

create trigger product_categories_set_updated_at
before update on public.product_categories
for each row execute function public.set_updated_at();

create trigger inventory_items_set_updated_at
before update on public.inventory_items
for each row execute function public.set_updated_at();

-- SECURITY DEFINER helpers are owned by the migration owner and bypass employees
-- RLS, avoiding recursive policy evaluation. The empty search_path prevents object
-- shadowing; every referenced object is schema-qualified.
create or replace function public.current_employee_role()
returns text
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select employee.role
  from public.employees as employee
  where employee.auth_user_id = (select auth.uid())
    and employee.is_active
  limit 1
$$;

create or replace function public.current_employee_shop_id()
returns uuid
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select employee.shop_id
  from public.employees as employee
  where employee.auth_user_id = (select auth.uid())
    and employee.is_active
  limit 1
$$;

create or replace function public.is_active_employee()
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select exists (
    select 1
    from public.employees as employee
    where employee.auth_user_id = (select auth.uid())
      and employee.is_active
  )
$$;

create or replace function public.is_owner()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(public.current_employee_role() = 'owner', false)
$$;

create or replace function public.can_access_shop(target_shop_id uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(
    public.current_employee_role() = 'owner'
    or public.current_employee_shop_id() = target_shop_id,
    false
  )
$$;

revoke all on function public.current_employee_role() from public;
revoke all on function public.current_employee_shop_id() from public;
revoke all on function public.is_active_employee() from public;
revoke all on function public.is_owner() from public;
revoke all on function public.can_access_shop(uuid) from public;

grant execute on function public.current_employee_role() to authenticated;
grant execute on function public.current_employee_shop_id() to authenticated;
grant execute on function public.is_active_employee() to authenticated;
grant execute on function public.is_owner() to authenticated;
grant execute on function public.can_access_shop(uuid) to authenticated;

alter table public.shops enable row level security;
alter table public.employees enable row level security;
alter table public.product_categories enable row level security;
alter table public.inventory_items enable row level security;

revoke all on table public.shops from anon;
revoke all on table public.employees from anon;
revoke all on table public.product_categories from anon;
revoke all on table public.inventory_items from anon;

grant select, insert, update, delete on table public.shops to authenticated;
grant select, insert, update, delete on table public.employees to authenticated;
grant select, insert, update, delete on table public.product_categories to authenticated;
grant select, insert, update, delete on table public.inventory_items to authenticated;

create policy shops_select on public.shops
for select to authenticated
using (
  (select public.is_owner())
  or id = (select public.current_employee_shop_id())
);

create policy shops_insert_owner on public.shops
for insert to authenticated
with check ((select public.is_owner()));

create policy shops_update_owner on public.shops
for update to authenticated
using ((select public.is_owner()))
with check ((select public.is_owner()));

create policy shops_delete_owner on public.shops
for delete to authenticated
using ((select public.is_owner()));

create policy employees_select on public.employees
for select to authenticated
using (
  (select public.is_owner())
  or auth_user_id = (select auth.uid())
);

create policy employees_insert_owner on public.employees
for insert to authenticated
with check ((select public.is_owner()));

create policy employees_update_owner on public.employees
for update to authenticated
using ((select public.is_owner()))
with check ((select public.is_owner()));

create policy employees_delete_owner on public.employees
for delete to authenticated
using ((select public.is_owner()));

create policy categories_select on public.product_categories
for select to authenticated
using ((select public.is_active_employee()));

create policy categories_insert_owner on public.product_categories
for insert to authenticated
with check ((select public.is_owner()));

create policy categories_update_owner on public.product_categories
for update to authenticated
using ((select public.is_owner()))
with check ((select public.is_owner()));

create policy categories_delete_owner on public.product_categories
for delete to authenticated
using ((select public.is_owner()));

create policy inventory_select on public.inventory_items
for select to authenticated
using ((select public.can_access_shop(shop_id)));

create policy inventory_insert_owner_or_manager on public.inventory_items
for insert to authenticated
with check (
  (select public.is_owner())
  or (
    (select public.current_employee_role()) = 'manager'
    and shop_id = (select public.current_employee_shop_id())
  )
);

create policy inventory_update_owner_or_manager on public.inventory_items
for update to authenticated
using (
  (select public.is_owner())
  or (
    (select public.current_employee_role()) = 'manager'
    and shop_id = (select public.current_employee_shop_id())
  )
)
with check (
  (select public.is_owner())
  or (
    (select public.current_employee_role()) = 'manager'
    and shop_id = (select public.current_employee_shop_id())
  )
);

create policy inventory_delete_owner on public.inventory_items
for delete to authenticated
using ((select public.is_owner()));
