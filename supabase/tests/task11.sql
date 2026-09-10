-- Rollback-only Task 11 production regression verification.
begin;
do $$
declare
  owner_employee public.employees%rowtype;
  shop_a uuid := gen_random_uuid();
  shop_b uuid := gen_random_uuid();
  salesperson_auth uuid := gen_random_uuid();
  salesperson_id uuid := gen_random_uuid();
  item_a uuid;
  item_b uuid;
  other_item uuid := gen_random_uuid();
  sale_result record;
  price_result record;
  category_count bigint;
  sale_count_before bigint;
begin
  select * into owner_employee from public.employees
  where role = 'owner' and is_active order by created_at limit 1;
  if not found then raise exception 'Task 11 verification requires an active Owner'; end if;
  perform set_config('request.jwt.claim.sub', owner_employee.auth_user_id::text, true);

  insert into public.shops(id, name, code) values
    (shop_a, 'Task 11 empty salesperson shop', 'TASK11-A'),
    (shop_b, 'Task 11 other shop', 'TASK11-B');
  insert into auth.users(id, email) values(salesperson_auth, 'task11-salesperson@example.test');
  insert into public.employees(id, auth_user_id, email, full_name, role, shop_id, is_active)
  values(salesperson_id, salesperson_auth, 'task11-salesperson@example.test', 'Task 11 Salesperson', 'salesperson', shop_a, true);

  -- An accessible shop with no products yields no category choices.
  perform set_config('request.jwt.claim.sub', salesperson_auth::text, true);
  select count(*) into category_count from public.get_inventory_category_options();
  if category_count <> 0 then raise exception 'Empty Inventory exposed category options'; end if;

  perform set_config('request.jwt.claim.sub', owner_employee.auth_user_id::text, true);
  perform public.import_inventory_items(jsonb_build_array(
    jsonb_build_object('shop_id', shop_a, 'barcode', 'TASK11-UA-1', 'category_name', '  Браслет   оф  ', 'weight_grams', 2, 'price_per_gram', 10000),
    jsonb_build_object('shop_id', shop_a, 'barcode', 'TASK11-UA-2', 'category_name', 'браслет оф', 'weight_grams', 1, 'price_per_gram', 10000),
    jsonb_build_object('shop_id', shop_a, 'barcode', 'TASK11-UA-3', 'category_name', 'Браслет', 'weight_grams', 1, 'price_per_gram', 5000),
    jsonb_build_object('shop_id', shop_a, 'barcode', 'TASK11-BLANK', 'category_name', '   ', 'weight_grams', 1, 'price_per_gram', 100),
    jsonb_build_object('shop_id', shop_b, 'barcode', 'TASK11-OTHER', 'category_name', 'Кольє', 'weight_grams', 1, 'price_per_gram', 9000)
  ));
  if (select count(*) from public.product_categories where lower(name) = lower('Браслет оф')) <> 1 then
    raise exception 'Category whitespace/case duplicate handling failed';
  end if;
  if not exists(select 1 from public.product_categories where name = 'Браслет') then
    raise exception 'Genuinely distinct category was merged';
  end if;
  if (select category_id from public.inventory_items where barcode = 'TASK11-BLANK') is not null then
    raise exception 'Blank category was not stored as NULL';
  end if;
  select id into item_a from public.inventory_items where barcode = 'TASK11-UA-1';
  select id into item_b from public.inventory_items where barcode = 'TASK11-UA-2';
  select id into other_item from public.inventory_items where barcode = 'TASK11-OTHER';

  -- An unused master row must not leak into an Inventory dropdown.
  insert into public.product_categories(name) values('TASK11 UNUSED CATEGORY');
  if exists(select 1 from public.get_inventory_category_options() where name = 'TASK11 UNUSED CATEGORY') then
    raise exception 'Unused category appeared in Inventory options';
  end if;

  -- Formula price wins over legacy manual/rule compatibility data.
  update public.inventory_items set selling_price = 1 where id = item_a;
  select * into price_result from public.get_effective_inventory_price(item_a);
  if price_result.effective_price <> 20000 or price_result.source <> 'INVENTORY_FORMULA' then
    raise exception 'Inventory formula is not authoritative for checkout';
  end if;

  -- A browser-supplied sale_price is rejected and the transaction changes nothing.
  select count(*) into sale_count_before from public.sales;
  begin
    perform public.complete_sale(shop_a, jsonb_build_array(
      jsonb_build_object('inventory_item_id', item_a, 'discount_percent', 10, 'sale_price', 1)
    ), null);
    raise exception 'Client sale_price was trusted';
  exception when data_exception then null;
  end;
  if (select status from public.inventory_items where id = item_a) <> 'IN_STOCK'
    or (select count(*) from public.sales) <> sale_count_before then
    raise exception 'Rejected sale was not atomic';
  end if;

  select * into sale_result from public.complete_sale(shop_a, jsonb_build_array(
    jsonb_build_object('inventory_item_id', item_a, 'discount_percent', 10),
    jsonb_build_object('inventory_item_id', item_b, 'discount_percent', 12.5)
  ), 'Task 11 calculated prices');
  if sale_result.total_sale_price <> 26750 or sale_result.item_count <> 2 then
    raise exception 'Calculated Current Total is incorrect';
  end if;
  if not exists(select 1 from public.sale_items where sale_id = sale_result.sale_id and inventory_item_id = item_a and list_price = 20000 and discount_percent = 10 and sale_price = 18000)
    or not exists(select 1 from public.sale_items where sale_id = sale_result.sale_id and inventory_item_id = item_b and list_price = 10000 and discount_percent = 12.5 and sale_price = 8750) then
    raise exception 'Authoritative sale snapshots are incorrect';
  end if;
  begin
    perform public.complete_sale(shop_a, jsonb_build_array(jsonb_build_object('inventory_item_id', item_a, 'discount_percent', 0)), null);
    raise exception 'Double sale unexpectedly succeeded';
  exception when data_exception then null;
  end;

  -- Sales categories come from immutable accessible sold-line history.
  if not exists(select 1 from public.get_sales_category_options() where name = 'Браслет оф') then
    raise exception 'Sold category missing from Sales Register options';
  end if;
  update public.inventory_items set category_id = null where id in (item_a, item_b);
  if not exists(select 1 from public.get_sales_category_options() where name = 'Браслет оф') then
    raise exception 'Historical Sales category did not retain its snapshot';
  end if;
  if jsonb_array_length((public.get_sales_register(shop_a, 'Браслет оф', 1, 25)->'sales')) <> 1 then
    raise exception 'Sales Register category filtering failed';
  end if;

  -- Salesperson is scoped to exactly the assigned shop in option queries and sale RPC.
  perform set_config('request.jwt.claim.sub', salesperson_auth::text, true);
  if exists(select 1 from public.get_inventory_category_options() where name = 'Кольє')
    or exists(select 1 from public.get_sales_category_options() where name = 'Кольє') then
    raise exception 'Salesperson saw another shop category';
  end if;
  begin
    perform public.complete_sale(shop_b, jsonb_build_array(jsonb_build_object('inventory_item_id', other_item, 'discount_percent', 0)), null);
    raise exception 'Salesperson completed another-shop sale';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.complete_sale(shop_a, jsonb_build_array(jsonb_build_object('inventory_item_id', other_item, 'discount_percent', 0)), null);
    raise exception 'Salesperson sold another-shop inventory through assigned shop';
  exception when data_exception then null;
  end;
  begin
    perform public.complete_sale(shop_a, jsonb_build_array(jsonb_build_object('inventory_item_id', other_item, 'discount_percent', 101)), null);
    raise exception 'Invalid discount succeeded';
  exception when data_exception then null;
  end;
  begin
    insert into public.employees(auth_user_id, email, full_name, role, shop_id, is_active)
    values(gen_random_uuid(), 'task11-second@example.test', 'Second Salesperson', 'salesperson', shop_a, true);
    raise exception 'Second active salesperson was accepted for one shop';
  exception when unique_violation then null;
  end;
  begin
    insert into public.employees(auth_user_id, full_name, role, shop_id, is_active)
    values(gen_random_uuid(), 'Legacy Manager', 'manager', shop_a, false);
    raise exception 'Manager role was accepted';
  exception when check_violation then null;
  end;
  update public.employees set is_active = false where id = salesperson_id;
  begin
    perform public.get_inventory_category_options();
    raise exception 'Inactive salesperson remained operational';
  exception when insufficient_privilege then null;
  end;
end
$$;
rollback;
