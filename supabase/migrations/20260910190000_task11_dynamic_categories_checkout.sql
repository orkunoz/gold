-- Task 11: data-driven categories, authoritative discount pricing, and one salesperson per shop.

-- Inventory's formulated price is the checkout list price whenever it exists.
-- Legacy manual/rule fields remain as compatibility fallbacks for rows without a formula price.
create or replace function public.get_effective_inventory_price(p_inventory_item_id uuid)
returns table(effective_price numeric(14, 2), source text, pricing_rule_id uuid, rule_type text, rule_value numeric)
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
declare
  item public.inventory_items%rowtype;
  calculation record;
begin
  if not (select public.is_active_employee()) then
    raise exception using errcode = '42501', message = 'An active employee account is required.';
  end if;
  select inventory.* into item from public.inventory_items inventory where inventory.id = p_inventory_item_id;
  if not found then raise exception using errcode = '22023', message = 'Inventory item does not exist.'; end if;
  if not (select public.can_access_shop(item.shop_id)) then
    raise exception using errcode = '42501', message = 'You are not authorized to price this inventory item.';
  end if;
  if not exists(select 1 from public.shops shop where shop.id = item.shop_id and shop.is_active) then
    raise exception using errcode = '22023', message = 'The inventory shop does not exist or is inactive.';
  end if;
  if item.price is not null then
    return query select item.price, 'INVENTORY_FORMULA'::text, null::uuid, null::text, null::numeric;
    return;
  end if;
  if item.selling_price is not null then
    return query select item.selling_price, 'MANUAL'::text, null::uuid, null::text, null::numeric;
    return;
  end if;
  select * into calculation from public.calculate_selling_price(item.owner_price, item.shop_id, item.category_id);
  return query select calculation.calculated_price,
    case when calculation.pricing_rule_id is null then 'OWNER_PRICE_FALLBACK' else 'PRICING_RULE' end::text,
    calculation.pricing_rule_id, calculation.rule_type, calculation.rule_value;
end;
$$;

revoke all on function public.get_effective_inventory_price(uuid) from public, anon;
grant execute on function public.get_effective_inventory_price(uuid) to authenticated;

-- Normalize only whitespace, preserve category text, and prevent obvious case duplicates.
update public.product_categories
set name = regexp_replace(btrim(name), '\s+', ' ', 'g');

create unique index product_categories_normalized_name_unique
on public.product_categories (lower(name));

create or replace function public.resolve_product_category(p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  normalized_name text := nullif(regexp_replace(btrim(p_name), '\s+', ' ', 'g'), '');
  category_id uuid;
begin
  if not (select public.is_owner()) then
    raise exception using errcode = '42501', message = 'Owner access is required to create product categories.';
  end if;
  if normalized_name is null then return null; end if;
  select id into category_id from public.product_categories where lower(name) = lower(normalized_name) limit 1;
  if category_id is not null then return category_id; end if;
  begin
    insert into public.product_categories(name) values(normalized_name) returning id into category_id;
  exception when unique_violation then
    select id into category_id from public.product_categories where lower(name) = lower(normalized_name) limit 1;
  end;
  return category_id;
end;
$$;

revoke all on function public.resolve_product_category(text) from public, anon;
grant execute on function public.resolve_product_category(text) to authenticated;

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
  select item.shop_id, nullif(btrim(item.barcode), ''), nullif(btrim(item.article_number), ''),
    public.resolve_product_category(item.category_name), item.metal, nullif(btrim(item.producer), ''),
    nullif(btrim(item.size), ''), item.weight_grams, item.price_per_gram, nullif(btrim(item.discount), ''),
    nullif(btrim(item.notes), ''), coalesce(item.status, 'IN_STOCK'), employee.id
  from jsonb_to_recordset(p_items) item(
    shop_id uuid, barcode text, article_number text, category_name text, metal text, producer text,
    size text, weight_grams numeric, price_per_gram numeric, discount text, notes text, status text
  );
  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

revoke all on function public.import_inventory_items(jsonb) from public, anon;
grant execute on function public.import_inventory_items(jsonb) to authenticated;

create or replace function public.get_inventory_category_options()
returns table(id uuid, name text, product_count bigint)
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
begin
  if not (select public.is_active_employee()) then
    raise exception using errcode = '42501', message = 'An active employee account is required.';
  end if;
  return query
  select category.id, category.name, count(*)
  from public.inventory_items item
  join public.product_categories category on category.id = item.category_id
  where public.can_access_shop(item.shop_id)
  group by category.id, category.name
  order by category.name;
end;
$$;

create or replace function public.get_sales_category_options()
returns table(name text, product_count bigint)
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
begin
  if not (select public.is_active_employee()) then
    raise exception using errcode = '42501', message = 'An active employee account is required.';
  end if;
  return query
  select line.category_name, count(*)
  from public.sale_items line
  join public.sales sale on sale.id = line.sale_id
  where line.category_name is not null and public.can_access_shop(sale.shop_id)
  group by line.category_name
  order by line.category_name;
end;
$$;

revoke all on function public.get_inventory_category_options() from public, anon;
revoke all on function public.get_sales_category_options() from public, anon;
grant execute on function public.get_inventory_category_options() to authenticated;
grant execute on function public.get_sales_category_options() to authenticated;

-- Sales register category filtering is based on immutable sale-line snapshots.
create or replace function public.get_sales_register(
  p_shop_id uuid default null,
  p_category_filter text default null,
  p_page integer default 1,
  p_page_size integer default 25
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
declare
  employee public.employees%rowtype;
  effective_shop_id uuid;
  category_filter text := nullif(btrim(p_category_filter), '');
  sale_count bigint;
  sale_rows jsonb;
begin
  select * into employee from public.employees
  where auth_user_id = (select auth.uid()) and is_active limit 1;
  if not found or employee.role not in ('owner', 'salesperson') then
    raise exception using errcode = '42501', message = 'An active employee account is required.';
  end if;
  if p_page is null or p_page < 1 or p_page_size is null or p_page_size < 1 or p_page_size > 100 then
    raise exception using errcode = '22023', message = 'Select a valid sales register page.';
  end if;
  if employee.role = 'owner' then
    effective_shop_id := p_shop_id;
    if effective_shop_id is not null and not exists(select 1 from public.shops where id = effective_shop_id) then
      raise exception using errcode = '22023', message = 'Shop not found.';
    end if;
  else
    if employee.shop_id is null then raise exception using errcode = '42501', message = 'An assigned shop is required.'; end if;
    if p_shop_id is not null and p_shop_id is distinct from employee.shop_id then
      raise exception using errcode = '42501', message = 'You cannot view another shop sales register.';
    end if;
    effective_shop_id := employee.shop_id;
  end if;

  with filtered as (
    select sale.id from public.sales sale
    where (effective_shop_id is null or sale.shop_id = effective_shop_id)
      and (category_filter is null or exists(
        select 1 from public.sale_items line
        where line.sale_id = sale.id and line.category_name = category_filter
      ))
  ) select count(*) into sale_count from filtered;

  with filtered as (
    select sale.* from public.sales sale
    where (effective_shop_id is null or sale.shop_id = effective_shop_id)
      and (category_filter is null or exists(
        select 1 from public.sale_items line
        where line.sale_id = sale.id and line.category_name = category_filter
      ))
    order by sale.sold_at desc, sale.id desc
    offset (p_page - 1) * p_page_size limit p_page_size
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', sale.id, 'sale_number', sale.sale_number, 'sold_at', sale.sold_at,
    'shop', shop.name, 'employee', coalesce(staff.full_name, 'Staff member'),
    'item_count', items.item_count, 'products', items.products,
    'total_sale_price', sale.total_sale_price
  ) order by sale.sold_at desc, sale.id desc), '[]'::jsonb)
  into sale_rows
  from filtered sale
  join public.shops shop on shop.id = sale.shop_id
  join public.employees staff on staff.id = sale.employee_id
  cross join lateral (
    select count(*)::integer item_count,
      coalesce(jsonb_agg(jsonb_build_object('category', category_name, 'count', category_count) order by category_name), '[]'::jsonb) products
    from (
      select coalesce(line.category_name, 'Uncategorized') category_name, count(*)::integer category_count
      from public.sale_items line where line.sale_id = sale.id
      group by coalesce(line.category_name, 'Uncategorized')
    ) product_groups
  ) items;
  return jsonb_build_object('sales', sale_rows, 'count', sale_count, 'page', p_page, 'page_size', p_page_size);
end;
$$;

revoke all on function public.get_sales_register(uuid, text, integer, integer) from public, anon;
grant execute on function public.get_sales_register(uuid, text, integer, integer) to authenticated;

-- The browser submits only inventory_item_id and discount_percent.
create or replace function public.complete_sale(p_shop_id uuid, p_items jsonb, p_notes text default null)
returns table(sale_id uuid, sale_number text, sold_at timestamptz, total_sale_price numeric, item_count integer)
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  employee public.employees%rowtype;
  new_sale_id uuid;
  new_sale_number text;
  new_sold_at timestamptz;
  total_list numeric(14,2);
  total_sale numeric(14,2);
  requested_count integer;
  distinct_count integer;
  locked_count integer := 0;
  inventory public.inventory_items%rowtype;
  normalized_notes text;
begin
  if (select auth.uid()) is null then raise exception using errcode = '42501', message = 'Authentication required.'; end if;
  select * into employee from public.employees where auth_user_id = (select auth.uid()) and is_active limit 1;
  if not found or employee.role not in ('owner', 'salesperson') then
    raise exception using errcode = '42501', message = 'An active employee account is required.';
  end if;
  if not exists(select 1 from public.shops where id = p_shop_id and is_active) then
    raise exception using errcode = '22023', message = 'Select an active shop.';
  end if;
  if employee.role = 'salesperson' and employee.shop_id is distinct from p_shop_id then
    raise exception using errcode = '42501', message = 'You cannot complete a sale for this shop.';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 100 then
    raise exception using errcode = '22023', message = 'A sale must contain between 1 and 100 items.';
  end if;
  if exists(
    select 1 from jsonb_array_elements(p_items) requested
    where jsonb_typeof(requested) <> 'object'
      or not (requested ? 'inventory_item_id')
      or jsonb_typeof(requested->'inventory_item_id') <> 'string'
      or (requested ? 'discount_percent' and jsonb_typeof(requested->'discount_percent') <> 'number')
      or requested - 'inventory_item_id' - 'discount_percent' <> '{}'::jsonb
  ) then
    raise exception using errcode = '22023', message = 'Each sale item may contain only inventory_item_id and discount_percent.';
  end if;
  begin
    select count(*), count(distinct (requested->>'inventory_item_id')::uuid)
    into requested_count, distinct_count from jsonb_array_elements(p_items) requested;
  exception when invalid_text_representation then
    raise exception using errcode = '22023', message = 'Every inventory_item_id must be a valid UUID.';
  end;
  if requested_count <> distinct_count then
    raise exception using errcode = '22023', message = 'The same inventory item cannot appear twice in one sale.';
  end if;
  if exists(
    select 1 from jsonb_array_elements(p_items) requested
    where coalesce((requested->>'discount_percent')::numeric, 0) < 0
      or coalesce((requested->>'discount_percent')::numeric, 0) > 100
  ) then
    raise exception using errcode = '22023', message = 'Discount must be from 0 to 100.';
  end if;

  for inventory in
    select item.* from public.inventory_items item
    join jsonb_array_elements(p_items) requested on item.id = (requested->>'inventory_item_id')::uuid
    order by item.id for update of item
  loop
    locked_count := locked_count + 1;
    if inventory.shop_id <> p_shop_id then raise exception using errcode = '22023', message = 'An inventory item does not belong to the sale shop.'; end if;
    if inventory.status <> 'IN_STOCK' then raise exception using errcode = '22023', message = 'Every inventory item must be IN_STOCK.'; end if;
  end loop;
  if locked_count <> requested_count then raise exception using errcode = '22023', message = 'One or more inventory items do not exist.'; end if;
  if exists(
    select 1 from jsonb_array_elements(p_items) requested
    join public.inventory_items item on item.id = (requested->>'inventory_item_id')::uuid
    cross join lateral public.get_effective_inventory_price(item.id) price
    where price.effective_price is null
  ) then
    raise exception using errcode = '22023', message = 'Every sale item requires a list price.';
  end if;

  normalized_notes := nullif(btrim(p_notes), '');
  if length(normalized_notes) > 5000 then raise exception using errcode = '22023', message = 'Sale notes cannot exceed 5000 characters.'; end if;
  new_sale_number := 'SALE-' || to_char(statement_timestamp() at time zone 'UTC', 'YYYYMMDD') || '-' || lpad(nextval('public.sale_number_sequence'::regclass)::text, 6, '0');
  insert into public.sales(shop_id, employee_id, sale_number, total_sale_price, notes)
  values(p_shop_id, employee.id, new_sale_number, 0, normalized_notes)
  returning id, public.sales.sold_at into new_sale_id, new_sold_at;

  insert into public.sale_items(sale_id, inventory_item_id, list_price, discount_percent, sale_price, category_name, producer, size, article_number, weight_grams, price_per_gram, metal, barcode, notes)
  select new_sale_id, item.id, price.effective_price, coalesce((requested->>'discount_percent')::numeric, 0),
    round(price.effective_price * (1 - coalesce((requested->>'discount_percent')::numeric, 0) / 100), 2),
    category.name, item.producer, item.size, item.article_number, item.weight_grams,
    item.price_per_gram, item.metal, item.barcode, item.notes
  from jsonb_array_elements(p_items) requested
  join public.inventory_items item on item.id = (requested->>'inventory_item_id')::uuid
  left join public.product_categories category on category.id = item.category_id
  cross join lateral public.get_effective_inventory_price(item.id) price;

  select sum(list_price), sum(sale_price) into total_list, total_sale
  from public.sale_items where public.sale_items.sale_id = new_sale_id;
  update public.sales set total_list_price = total_list, total_sale_price = total_sale where id = new_sale_id;
  perform set_config('gold.audit_source', 'SALE', true);
  perform set_config('gold.audit_sale_id', new_sale_id::text, true);
  update public.inventory_items set status = 'SOLD'
  where id in(select (requested->>'inventory_item_id')::uuid from jsonb_array_elements(p_items) requested);
  return query select new_sale_id, new_sale_number, new_sold_at, total_sale::numeric, requested_count;
end;
$$;

revoke all on function public.complete_sale(uuid, jsonb, text) from public, anon;
grant execute on function public.complete_sale(uuid, jsonb, text) to authenticated;

-- One production shop account per location, with inactive history unaffected.
create unique index employees_one_active_salesperson_per_shop
on public.employees(shop_id)
where role = 'salesperson' and is_active;

create unique index employees_one_active_owner
on public.employees(role)
where role = 'owner' and is_active;

-- Normal invitation flow creates shop Salespeople only; Owner changes remain protected separately.
create or replace function public.admin_prepare_employee_invite(p_email text, p_full_name text, p_role text, p_shop_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  owner_employee public.employees%rowtype;
  invitation_id uuid;
begin
  owner_employee := public.require_owner_employee();
  p_email := lower(btrim(p_email));
  p_full_name := btrim(p_full_name);
  if p_role <> 'salesperson' then raise exception using errcode = '22023', message = 'New employee accounts must be Salespeople.'; end if;
  if p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or length(p_email) > 320 then raise exception using errcode = '22023', message = 'Enter a valid email address.'; end if;
  if p_full_name = '' or length(p_full_name) > 200 then raise exception using errcode = '22023', message = 'Enter a valid full name.'; end if;
  perform public.validate_admin_employee(p_role, p_shop_id, true);
  if exists(select 1 from public.employees where email = p_email) then raise exception using errcode = '23505', message = 'An employee with this email already exists.'; end if;
  if exists(select 1 from public.employees where role = 'salesperson' and is_active and shop_id = p_shop_id) then raise exception using errcode = '23505', message = 'This shop already has an active Salesperson.'; end if;
  insert into public.employee_invitations(email, full_name, role, shop_id, created_by)
  values(p_email, p_full_name, p_role, p_shop_id, owner_employee.id)
  on conflict(email) do update set full_name = excluded.full_name, role = excluded.role, shop_id = excluded.shop_id
    where employee_invitations.status = 'PENDING'
  returning id into invitation_id;
  if invitation_id is null then raise exception using errcode = '23505', message = 'This invitation has already been accepted.'; end if;
  return jsonb_build_object('invitation_id', invitation_id, 'email', p_email);
end;
$$;

revoke all on function public.admin_prepare_employee_invite(text, text, text, uuid) from public, anon;
grant execute on function public.admin_prepare_employee_invite(text, text, text, uuid) to authenticated;

comment on function public.complete_sale(uuid, jsonb, text) is 'Atomically resolves list prices and calculates sale prices from validated discounts after locking inventory.';
comment on function public.get_effective_inventory_price(uuid) is 'Uses Inventory formula price first; legacy manual and pricing-rule values are compatibility fallbacks only.';
comment on function public.get_inventory_category_options() is 'Distinct categories referenced by accessible inventory rows, regardless of inventory status.';
comment on function public.get_sales_category_options() is 'Distinct category snapshots present in accessible sold-product history.';
