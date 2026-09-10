-- Rollback-only authoritative complete_sale verification. Requires an active Owner.
begin;
do $$
declare
  employee public.employees%rowtype;
  shop_id uuid := gen_random_uuid();
  item_a uuid := gen_random_uuid();
  item_b uuid := gen_random_uuid();
  result record;
  sales_before bigint;
  lines_before bigint;
begin
  select * into employee from public.employees where role = 'owner' and is_active order by created_at limit 1;
  if not found then raise exception 'complete_sale verification requires an active Owner'; end if;
  perform set_config('request.jwt.claim.sub', employee.auth_user_id::text, true);
  insert into public.shops(id, name, code) values(shop_id, 'Complete sale rollback shop', 'COMPLETE-SALE');
  insert into public.inventory_items(id, shop_id, barcode, weight_grams, price_per_gram, selling_price, status, created_by) values
    (item_a, shop_id, 'COMPLETE-A', 2, 100, 1, 'IN_STOCK', employee.id),
    (item_b, shop_id, 'COMPLETE-B', 3, 100, null, 'IN_STOCK', employee.id);

  select count(*) into sales_before from public.sales;
  select count(*) into lines_before from public.sale_items;
  begin
    perform public.complete_sale(shop_id, jsonb_build_array(
      jsonb_build_object('inventory_item_id', item_a, 'discount_percent', 10, 'sale_price', 1)
    ), null);
    raise exception 'Browser sale_price unexpectedly succeeded';
  exception when data_exception then null;
  end;
  if (select count(*) from public.sales) <> sales_before
    or (select count(*) from public.sale_items) <> lines_before
    or (select status from public.inventory_items where id = item_a) <> 'IN_STOCK' then
    raise exception 'Rejected sale was not atomic';
  end if;

  select * into result from public.complete_sale(shop_id, jsonb_build_array(
    jsonb_build_object('inventory_item_id', item_a, 'discount_percent', 10),
    jsonb_build_object('inventory_item_id', item_b, 'discount_percent', 12.5)
  ), 'authoritative price test');
  if result.item_count <> 2 or result.total_sale_price <> 442.50 then raise exception 'Sale totals failed'; end if;
  if not exists(select 1 from public.sale_items where sale_id = result.sale_id and inventory_item_id = item_a and list_price = 200 and discount_percent = 10 and sale_price = 180)
    or not exists(select 1 from public.sale_items where sale_id = result.sale_id and inventory_item_id = item_b and list_price = 300 and discount_percent = 12.5 and sale_price = 262.50) then
    raise exception 'Sale line snapshots failed';
  end if;
  if exists(select 1 from public.inventory_items where id in (item_a, item_b) and status <> 'SOLD') then
    raise exception 'Inventory was not marked SOLD';
  end if;
  begin
    perform public.complete_sale(shop_id, jsonb_build_array(jsonb_build_object('inventory_item_id', item_a)), null);
    raise exception 'Double sale unexpectedly succeeded';
  exception when data_exception then null;
  end;
  if pg_get_functiondef('public.complete_sale(uuid,jsonb,text)'::regprocedure) not ilike '%for update of item%' then
    raise exception 'Inventory row locking is missing';
  end if;
  if has_table_privilege('authenticated', 'public.sales', 'INSERT')
    or has_table_privilege('authenticated', 'public.sale_items', 'INSERT')
    or has_function_privilege('anon', 'public.complete_sale(uuid,jsonb,text)', 'EXECUTE') then
    raise exception 'Sale write privileges are unsafe';
  end if;
end
$$;
rollback;
