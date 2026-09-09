-- Task 5B: dynamic effective inventory pricing and authoritative sale snapshots.

create or replace function public.get_effective_inventory_price(p_inventory_item_id uuid)
returns table (
  effective_price numeric(14, 2),
  source text,
  pricing_rule_id uuid,
  rule_type text,
  rule_value numeric
)
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_item public.inventory_items%rowtype;
  v_calculation record;
begin
  if not (select public.is_active_employee()) then
    raise exception using errcode = '42501', message = 'An active employee account is required.';
  end if;

  select inventory.* into v_item
  from public.inventory_items as inventory
  where inventory.id = p_inventory_item_id;
  if not found then
    raise exception using errcode = '22023', message = 'Inventory item does not exist.';
  end if;
  if not (select public.can_access_shop(v_item.shop_id)) then
    raise exception using errcode = '42501', message = 'You are not authorized to price this inventory item.';
  end if;
  if not exists (select 1 from public.shops as shop where shop.id = v_item.shop_id and shop.is_active) then
    raise exception using errcode = '22023', message = 'The inventory shop does not exist or is inactive.';
  end if;

  if v_item.selling_price is not null then
    return query select v_item.selling_price, 'MANUAL'::text, null::uuid, null::text, null::numeric;
    return;
  end if;

  select * into v_calculation
  from public.calculate_selling_price(v_item.owner_price, v_item.shop_id, v_item.category_id);
  return query select
    v_calculation.calculated_price,
    case when v_calculation.pricing_rule_id is null then 'OWNER_PRICE_FALLBACK' else 'PRICING_RULE' end::text,
    v_calculation.pricing_rule_id,
    v_calculation.rule_type,
    v_calculation.rule_value;
end;
$$;

create or replace function public.get_effective_inventory_prices(p_inventory_item_ids uuid[])
returns table (
  inventory_item_id uuid,
  effective_price numeric(14, 2),
  source text,
  pricing_rule_id uuid,
  rule_type text,
  rule_value numeric
)
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
begin
  if p_inventory_item_ids is null or cardinality(p_inventory_item_ids) = 0 then return; end if;
  if cardinality(p_inventory_item_ids) > 500 then
    raise exception using errcode = '22023', message = 'Cannot price more than 500 inventory items at once.';
  end if;
  return query
  select requested.id, price.effective_price, price.source, price.pricing_rule_id, price.rule_type, price.rule_value
  from (select distinct unnest(p_inventory_item_ids) as id) as requested
  cross join lateral public.get_effective_inventory_price(requested.id) as price;
end;
$$;

revoke all on function public.get_effective_inventory_price(uuid) from public, anon;
revoke all on function public.get_effective_inventory_prices(uuid[]) from public, anon;
grant execute on function public.get_effective_inventory_price(uuid) to authenticated;
grant execute on function public.get_effective_inventory_prices(uuid[]) to authenticated;

create or replace function public.complete_sale(
  p_shop_id uuid,
  p_items jsonb,
  p_notes text default null
)
returns table (sale_id uuid, sale_number text, sold_at timestamptz, total_sale_price numeric, item_count integer)
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_employee public.employees%rowtype;
  v_sale_id uuid;
  v_sale_number text;
  v_sold_at timestamptz;
  v_total_list_price numeric(14, 2);
  v_total_sale_price numeric(14, 2);
  v_item_count integer;
  v_distinct_item_count integer;
  v_locked_count integer := 0;
  v_inventory_item public.inventory_items%rowtype;
  v_notes text;
begin
  if (select auth.uid()) is null then raise exception using errcode='42501',message='Authentication required.'; end if;
  select employee.* into v_employee from public.employees employee
  where employee.auth_user_id=(select auth.uid()) and employee.is_active limit 1;
  if not found or v_employee.role not in ('owner','manager','salesperson') then
    raise exception using errcode='42501',message='An active employee account is required.';
  end if;
  if not exists(select 1 from public.shops shop where shop.id=p_shop_id and shop.is_active) then
    raise exception using errcode='22023',message='Select an active shop.';
  end if;
  if v_employee.role<>'owner' and v_employee.shop_id is distinct from p_shop_id then
    raise exception using errcode='42501',message='You cannot complete a sale for this shop.';
  end if;
  if p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 then
    raise exception using errcode='22023',message='At least one sale item is required.';
  end if;
  if jsonb_array_length(p_items)>100 then raise exception using errcode='22023',message='A sale cannot contain more than 100 items.'; end if;
  if exists (
    select 1 from jsonb_array_elements(p_items) requested(item)
    where jsonb_typeof(requested.item)<>'object' or not(requested.item?'inventory_item_id')
      or not(requested.item?'sale_price') or jsonb_typeof(requested.item->'inventory_item_id')<>'string'
      or jsonb_typeof(requested.item->'sale_price')<>'number'
      or requested.item-'inventory_item_id'-'sale_price'<>'{}'::jsonb
  ) then raise exception using errcode='22023',message='Each sale item must contain only inventory_item_id and sale_price.'; end if;
  begin
    select count(*)::integer,count(distinct (requested.item->>'inventory_item_id')::uuid)::integer
    into v_item_count,v_distinct_item_count from jsonb_array_elements(p_items) requested(item);
  exception when invalid_text_representation then
    raise exception using errcode='22023',message='Every inventory_item_id must be a valid UUID.';
  end;
  if v_item_count<>v_distinct_item_count then
    raise exception using errcode='22023',message='The same inventory item cannot appear twice in one sale.';
  end if;
  if exists(select 1 from jsonb_array_elements(p_items) requested(item)
    where (requested.item->>'sale_price')::numeric<0 or (requested.item->>'sale_price')::numeric>999999999999.99)
  then raise exception using errcode='22023',message='Sale prices must be non-negative and within the supported range.'; end if;

  -- Preserve the original row-locking and all-or-nothing concurrency behavior.
  for v_inventory_item in
    select inventory.* from public.inventory_items inventory
    join jsonb_array_elements(p_items) requested(item) on inventory.id=(requested.item->>'inventory_item_id')::uuid
    order by inventory.id for update of inventory
  loop
    v_locked_count:=v_locked_count+1;
    if v_inventory_item.shop_id<>p_shop_id then raise exception using errcode='22023',message='An inventory item does not belong to the sale shop.'; end if;
    if v_inventory_item.status<>'IN_STOCK' then raise exception using errcode='22023',message='Every inventory item must be IN_STOCK.'; end if;
  end loop;
  if v_locked_count<>v_item_count then raise exception using errcode='22023',message='One or more inventory items do not exist.'; end if;

  v_notes:=nullif(btrim(p_notes),'');
  if length(v_notes)>5000 then raise exception using errcode='22023',message='Sale notes cannot exceed 5000 characters.'; end if;
  v_sale_number:='SALE-'||to_char(statement_timestamp() at time zone 'UTC','YYYYMMDD')||'-'||lpad(nextval('public.sale_number_sequence'::regclass)::text,6,'0');
  insert into public.sales(shop_id,employee_id,sale_number,total_sale_price,notes)
  values(p_shop_id,v_employee.id,v_sale_number,0,v_notes)
  returning id,public.sales.sold_at into v_sale_id,v_sold_at;

  insert into public.sale_items(sale_id,inventory_item_id,list_price,sale_price)
  select v_sale_id,inventory.id,price.effective_price,(requested.item->>'sale_price')::numeric(14,2)
  from jsonb_array_elements(p_items) requested(item)
  join public.inventory_items inventory on inventory.id=(requested.item->>'inventory_item_id')::uuid
  cross join lateral public.get_effective_inventory_price(inventory.id) price;

  select sum(item.list_price),sum(item.sale_price) into v_total_list_price,v_total_sale_price
  from public.sale_items item where item.sale_id=v_sale_id;
  update public.sales set total_list_price=v_total_list_price,total_sale_price=v_total_sale_price where id=v_sale_id;
  update public.inventory_items inventory set status='SOLD' where inventory.id in (
    select (requested.item->>'inventory_item_id')::uuid from jsonb_array_elements(p_items) requested(item)
  );
  return query select v_sale_id,v_sale_number,v_sold_at,v_total_sale_price::numeric,v_item_count;
end;
$$;

revoke all on function public.complete_sale(uuid,jsonb,text) from public, anon;
grant execute on function public.complete_sale(uuid,jsonb,text) to authenticated;

comment on function public.get_effective_inventory_price(uuid) is 'Resolves manual override, pricing rule, or owner-price fallback for one accessible item.';
comment on function public.get_effective_inventory_prices(uuid[]) is 'Batch effective-price resolution for up to 500 accessible inventory items.';
comment on function public.complete_sale(uuid,jsonb,text) is 'Atomically completes a sale and snapshots the current authoritative effective list price.';
