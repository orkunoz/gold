-- Rollback-only linked/local integration verification for Task 4A.
-- Requires at least one active owner employee. Run as a migration-capable role.

begin;

do $$
declare
  v_employee public.employees%rowtype;
  v_shop_a uuid := gen_random_uuid();
  v_shop_b uuid := gen_random_uuid();
  v_single uuid := gen_random_uuid();
  v_multi_a uuid := gen_random_uuid();
  v_multi_b uuid := gen_random_uuid();
  v_manager uuid := gen_random_uuid();
  v_owner uuid := gen_random_uuid();
  v_sold uuid := gen_random_uuid();
  v_reserved uuid := gen_random_uuid();
  v_removed uuid := gen_random_uuid();
  v_wrong_shop uuid := gen_random_uuid();
  v_atomic uuid := gen_random_uuid();
  v_missing uuid := gen_random_uuid();
  v_result record;
  v_sale_count bigint;
  v_item_count bigint;
  v_original_sequence bigint;
  v_original_sequence_called boolean;
begin
  select * into v_employee
  from public.employees
  where role = 'owner' and is_active
  order by created_at
  limit 1;
  if not found then raise exception 'Task 4A verification requires an active owner'; end if;

  select last_value, is_called
  into v_original_sequence, v_original_sequence_called
  from public.sale_number_sequence;

  begin
    perform set_config('request.jwt.claim.sub', v_employee.auth_user_id::text, true);

    insert into public.shops (id, name, code)
    values (v_shop_a, 'Task 4A Test Shop A', 'TASK4A-A'),
           (v_shop_b, 'Task 4A Test Shop B', 'TASK4A-B');

    insert into public.inventory_items
      (id, shop_id, barcode, owner_price, selling_price, status)
    values
      (v_single, v_shop_a, 'TASK4A-SINGLE', 100, 120, 'IN_STOCK'),
      (v_multi_a, v_shop_a, 'TASK4A-MULTI-A', 100, 120, 'IN_STOCK'),
      (v_multi_b, v_shop_a, 'TASK4A-MULTI-B', 200, null, 'IN_STOCK'),
      (v_manager, v_shop_a, 'TASK4A-MANAGER', 300, null, 'IN_STOCK'),
      (v_owner, v_shop_b, 'TASK4A-OWNER', 400, 450, 'IN_STOCK'),
      (v_sold, v_shop_a, 'TASK4A-SOLD', 10, null, 'SOLD'),
      (v_reserved, v_shop_a, 'TASK4A-RESERVED', 10, null, 'RESERVED'),
      (v_removed, v_shop_a, 'TASK4A-REMOVED', 10, null, 'REMOVED'),
      (v_wrong_shop, v_shop_b, 'TASK4A-WRONG-SHOP', 10, null, 'IN_STOCK'),
      (v_atomic, v_shop_a, 'TASK4A-ATOMIC', 50, 60, 'IN_STOCK');

    -- Salesperson: one item in assigned shop.
    update public.employees set role = 'salesperson', shop_id = v_shop_a where id = v_employee.id;
    select * into v_result from public.complete_sale(
      v_shop_a,
      jsonb_build_array(jsonb_build_object('inventory_item_id', v_single, 'sale_price', 110)),
      'rollback-only salesperson verification'
    );
    if v_result.item_count <> 1 or v_result.total_sale_price <> 110 then raise exception 'single sale totals failed'; end if;
    if not exists (
      select 1 from public.sales
      where id = v_result.sale_id and employee_id = v_employee.id and shop_id = v_shop_a
        and sale_number ~ '^SALE-[0-9]{8}-[0-9]{6,}$' and total_list_price = 120 and total_sale_price = 110
    ) then raise exception 'single sale header failed'; end if;
    if not exists (
      select 1 from public.sale_items
      where sale_id = v_result.sale_id and inventory_item_id = v_single and list_price = 120 and sale_price = 110
    ) then raise exception 'single sale item snapshot failed'; end if;
    if (select status from public.inventory_items where id = v_single) <> 'SOLD' then raise exception 'single inventory status failed'; end if;
    if not exists (select 1 from public.inventory_items where id = v_single) then raise exception 'sold inventory row was deleted'; end if;

    -- Salesperson: multiple items and fallback list pricing.
    select * into v_result from public.complete_sale(
      v_shop_a,
      jsonb_build_array(
        jsonb_build_object('inventory_item_id', v_multi_a, 'sale_price', 110),
        jsonb_build_object('inventory_item_id', v_multi_b, 'sale_price', 180)
      ),
      null
    );
    if v_result.item_count <> 2 or v_result.total_sale_price <> 290 then raise exception 'multi sale return failed'; end if;
    if (select total_list_price from public.sales where id = v_result.sale_id) <> 320 then raise exception 'multi list total failed'; end if;
    if (select count(*) from public.sale_items where sale_id = v_result.sale_id) <> 2 then raise exception 'multi sale item count failed'; end if;

    -- Manager: own shop succeeds.
    update public.employees set role = 'manager', shop_id = v_shop_a where id = v_employee.id;
    perform public.complete_sale(
      v_shop_a,
      jsonb_build_array(jsonb_build_object('inventory_item_id', v_manager, 'sale_price', 275)),
      null
    );

    -- Owner: any active shop succeeds.
    update public.employees set role = 'owner', shop_id = v_shop_a where id = v_employee.id;
    perform public.complete_sale(
      v_shop_b,
      jsonb_build_array(jsonb_build_object('inventory_item_id', v_owner, 'sale_price', 425)),
      null
    );

    -- Every validation failure must leave sales, sale items, and statuses unchanged.
    select count(*) into v_sale_count from public.sales;
    select count(*) into v_item_count from public.sale_items;

    begin
      perform public.complete_sale(v_shop_a, jsonb_build_array(jsonb_build_object('inventory_item_id', v_sold, 'sale_price', 1)), null);
      raise exception 'SOLD item unexpectedly succeeded';
    exception when sqlstate '22023' then null; end;
    begin
      perform public.complete_sale(v_shop_a, jsonb_build_array(jsonb_build_object('inventory_item_id', v_reserved, 'sale_price', 1)), null);
      raise exception 'RESERVED item unexpectedly succeeded';
    exception when sqlstate '22023' then null; end;
    begin
      perform public.complete_sale(v_shop_a, jsonb_build_array(jsonb_build_object('inventory_item_id', v_removed, 'sale_price', 1)), null);
      raise exception 'REMOVED item unexpectedly succeeded';
    exception when sqlstate '22023' then null; end;
    begin
      perform public.complete_sale(
        v_shop_a,
        jsonb_build_array(
          jsonb_build_object('inventory_item_id', v_atomic, 'sale_price', 1),
          jsonb_build_object('inventory_item_id', v_atomic, 'sale_price', 1)
        ), null
      );
      raise exception 'duplicate request item unexpectedly succeeded';
    exception when sqlstate '22023' then null; end;
    begin
      perform public.complete_sale(v_shop_a, jsonb_build_array(jsonb_build_object('inventory_item_id', v_wrong_shop, 'sale_price', 1)), null);
      raise exception 'wrong-shop item unexpectedly succeeded';
    exception when sqlstate '22023' then null; end;
    begin
      perform public.complete_sale(v_shop_a, jsonb_build_array(jsonb_build_object('inventory_item_id', v_atomic, 'sale_price', -1)), null);
      raise exception 'negative sale price unexpectedly succeeded';
    exception when sqlstate '22023' then null; end;
    begin
      perform public.complete_sale(v_shop_a, jsonb_build_array(jsonb_build_object('inventory_item_id', v_missing, 'sale_price', 1)), null);
      raise exception 'missing inventory item unexpectedly succeeded';
    exception when sqlstate '22023' then null; end;

    update public.employees set role = 'salesperson', shop_id = v_shop_a where id = v_employee.id;
    begin
      perform public.complete_sale(v_shop_b, jsonb_build_array(jsonb_build_object('inventory_item_id', v_wrong_shop, 'sale_price', 1)), null);
      raise exception 'salesperson other-shop sale unexpectedly succeeded';
    exception when insufficient_privilege then null; end;
    update public.employees set role = 'manager', shop_id = v_shop_a where id = v_employee.id;
    begin
      perform public.complete_sale(v_shop_b, jsonb_build_array(jsonb_build_object('inventory_item_id', v_wrong_shop, 'sale_price', 1)), null);
      raise exception 'manager other-shop sale unexpectedly succeeded';
    exception when insufficient_privilege then null; end;

    if (select count(*) from public.sales) <> v_sale_count then raise exception 'failed sale created a sale header'; end if;
    if (select count(*) from public.sale_items) <> v_item_count then raise exception 'failed sale created a sale item'; end if;
    if (select status from public.inventory_items where id = v_atomic) <> 'IN_STOCK' then raise exception 'failed sale changed inventory status'; end if;

    -- Database unique protection and atomic rollback after header creation.
    update public.employees set role = 'owner', shop_id = v_shop_a where id = v_employee.id;
    perform public.complete_sale(v_shop_a, jsonb_build_array(jsonb_build_object('inventory_item_id', v_atomic, 'sale_price', 55)), null);
    update public.inventory_items set status = 'IN_STOCK' where id = v_atomic;
    select count(*) into v_sale_count from public.sales;
    select count(*) into v_item_count from public.sale_items;
    begin
      perform public.complete_sale(v_shop_a, jsonb_build_array(jsonb_build_object('inventory_item_id', v_atomic, 'sale_price', 56)), null);
      raise exception 'database duplicate-sale guard unexpectedly succeeded';
    exception when unique_violation then null; end;
    if (select count(*) from public.sales) <> v_sale_count then raise exception 'unique failure left a sale header'; end if;
    if (select count(*) from public.sale_items) <> v_item_count then raise exception 'unique failure left a sale item'; end if;
    if (select status from public.inventory_items where id = v_atomic) <> 'IN_STOCK' then raise exception 'unique failure changed inventory status'; end if;

    if has_table_privilege('authenticated', 'public.sales', 'INSERT')
      or has_table_privilege('authenticated', 'public.sales', 'UPDATE')
      or has_table_privilege('authenticated', 'public.sales', 'DELETE')
      or has_table_privilege('authenticated', 'public.sale_items', 'INSERT')
      or has_table_privilege('authenticated', 'public.sale_items', 'UPDATE')
      or has_table_privilege('authenticated', 'public.sale_items', 'DELETE')
    then raise exception 'authenticated has direct sales write privileges'; end if;
    if not has_table_privilege('authenticated', 'public.sales', 'SELECT')
      or not has_table_privilege('authenticated', 'public.sale_items', 'SELECT')
    then raise exception 'authenticated sales read privileges missing'; end if;
    if not has_function_privilege('authenticated', 'public.complete_sale(uuid,jsonb,text)', 'EXECUTE')
      or has_function_privilege('anon', 'public.complete_sale(uuid,jsonb,text)', 'EXECUTE')
    then raise exception 'complete_sale execute privileges are incorrect'; end if;
    if not exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = 'inventory_items'
        and policyname = 'inventory_insert_owner_or_manager'
        and with_check like '%status%SOLD%'
    ) or not exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = 'inventory_items'
        and policyname = 'inventory_update_owner_or_manager'
        and qual like '%status%SOLD%'
        and with_check like '%status%SOLD%'
    ) then raise exception 'ordinary inventory policies do not protect SOLD status'; end if;

    perform setval('public.sale_number_sequence', v_original_sequence, v_original_sequence_called);
  exception when others then
    perform setval('public.sale_number_sequence', v_original_sequence, v_original_sequence_called);
    raise;
  end;
end;
$$;

rollback;
