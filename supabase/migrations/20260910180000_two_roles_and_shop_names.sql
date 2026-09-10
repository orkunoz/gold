-- Simplify staff access to Owner and Salesperson, and apply final shop names.
update public.shops
set name = case code
  when 'MAIN' then 'Novovolynsk'
  when 'SHOP2' then 'Lutsk'
  when 'SHOP3' then 'Kyiv'
  else name
end
where code in ('MAIN', 'SHOP2', 'SHOP3');

-- Preserve any legacy staff or pending invitations by moving Manager to Salesperson.
update public.employees set role = 'salesperson' where role = 'manager';
update public.employee_invitations set role = 'salesperson' where role = 'manager';

alter table public.employees drop constraint if exists employees_role_check;
alter table public.employees add constraint employees_role_check check (role in ('owner', 'salesperson'));
alter table public.employee_invitations drop constraint if exists employee_invitations_role_check;
alter table public.employee_invitations add constraint employee_invitations_role_check check (role in ('owner', 'salesperson'));

create or replace function public.validate_admin_employee(p_role text, p_shop_id uuid, p_active boolean)
returns void
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
begin
  if p_role not in ('owner', 'salesperson') then
    raise exception using errcode = '22023', message = 'Select a valid employee role.';
  end if;
  if p_role = 'salesperson' and p_shop_id is null then
    raise exception using errcode = '22023', message = 'Salespeople require an active shop.';
  end if;
  if (p_role = 'salesperson' or (p_active and p_shop_id is not null))
    and not exists(select 1 from public.shops where id = p_shop_id and is_active)
  then
    raise exception using errcode = '22023', message = 'Select an active shop.';
  end if;
end;
$$;

drop policy if exists inventory_insert_owner_or_manager on public.inventory_items;
drop policy if exists inventory_update_owner_or_manager on public.inventory_items;
create policy inventory_insert_owner on public.inventory_items
for insert to authenticated
with check ((select public.is_owner()));
create policy inventory_update_owner on public.inventory_items
for update to authenticated
using ((select public.is_owner()))
with check ((select public.is_owner()));

create or replace function public.import_inventory_items(p_items jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  employee public.employees%rowtype;
  inserted_count integer;
begin
  select * into employee from public.employees
  where auth_user_id = (select auth.uid()) and is_active limit 1;
  if not found or employee.role <> 'owner' then
    raise exception using errcode = '42501', message = 'Owner access required.';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array'
    or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 100
  then
    raise exception using errcode = '22023', message = 'Import batch must contain 1 to 100 items.';
  end if;
  if exists(
    select 1 from jsonb_to_recordset(p_items) item(shop_id uuid, status text)
    where item.shop_id is null
      or not public.can_access_shop(item.shop_id)
      or not exists(select 1 from public.shops shop where shop.id = item.shop_id and shop.is_active)
      or coalesce(item.status, 'IN_STOCK') = 'SOLD'
  ) then
    raise exception using errcode = '42501', message = 'Import contains an unauthorized shop or SOLD status.';
  end if;
  perform set_config('gold.audit_source', 'XLSX_IMPORT', true);
  insert into public.inventory_items(shop_id, barcode, article_number, category_id, metal, producer, size, weight_grams, price_per_gram, discount, notes, status, created_by)
  select item.shop_id, nullif(btrim(item.barcode), ''), nullif(btrim(item.article_number), ''), item.category_id,
    item.metal, nullif(btrim(item.producer), ''), nullif(btrim(item.size), ''), item.weight_grams,
    item.price_per_gram, nullif(btrim(item.discount), ''), nullif(btrim(item.notes), ''),
    coalesce(item.status, 'IN_STOCK'), employee.id
  from jsonb_to_recordset(p_items) item(
    shop_id uuid, barcode text, article_number text, category_id uuid, metal text, producer text,
    size text, weight_grams numeric, price_per_gram numeric, discount text, notes text, status text
  );
  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

revoke all on function public.validate_admin_employee(text, uuid, boolean) from public, anon;
revoke all on function public.import_inventory_items(jsonb) from public, anon;
grant execute on function public.import_inventory_items(jsonb) to authenticated;

comment on function public.validate_admin_employee(text, uuid, boolean) is 'Validates the Owner or Salesperson role and required active-shop assignment.';
