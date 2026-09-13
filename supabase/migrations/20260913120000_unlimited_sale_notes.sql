-- Remove only the sale notes character limit; keep transaction validation and text normalization.
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
