-- Rollback-only Owner authorization, atomicity, audit, and confidentiality verification.
begin;
do $$
declare
  owner public.employees%rowtype;
  shop_id uuid;
  salesperson_auth uuid := gen_random_uuid();
  salesperson_id uuid;
  item_a uuid;
  item_b uuid;
  sold_item uuid;
begin
  select * into owner from public.employees where role = 'owner' and is_active limit 1;
  if not found then raise exception 'Bulk Purchase Price verification requires an active Owner'; end if;
  perform set_config('request.jwt.claim.sub', owner.auth_user_id::text, true);
  insert into public.shops(name, code) values('Bulk Purchase Test', 'BULKPURCHASE') returning id into shop_id;
  insert into public.employees(auth_user_id, username, full_name, role, shop_id, is_active)
  values(salesperson_auth, 'bulk_purchase_sales', 'Bulk Purchase Sales', 'salesperson', shop_id, true) returning id into salesperson_id;
  insert into public.inventory_items(shop_id, article_number, purchase_price, status, created_by) values
    (shop_id, 'BULK-PURCHASE-A', 100, 'IN_STOCK', owner.id),
    (shop_id, 'BULK-PURCHASE-B', 200, 'REMOVED', owner.id),
    (shop_id, 'BULK-PURCHASE-SOLD', 300, 'SOLD', owner.id);
  select id into item_a from public.inventory_items where article_number = 'BULK-PURCHASE-A';
  select id into item_b from public.inventory_items where article_number = 'BULK-PURCHASE-B';
  select id into sold_item from public.inventory_items where article_number = 'BULK-PURCHASE-SOLD';

  if public.bulk_change_purchase_price(array[item_a, item_b], 25000) <> 2 then raise exception 'Bulk Purchase Price count incorrect'; end if;
  if (select count(*) from public.inventory_items where id in(item_a, item_b) and purchase_price = 25000) <> 2 then raise exception 'Purchase Price was not applied to every selected product'; end if;
  if not exists(select 1 from public.inventory_items where id = sold_item and purchase_price = 300) then raise exception 'Unrelated product changed'; end if;
  if (select count(*) from public.inventory_item_history where inventory_item_id in(item_a, item_b) and field_name = 'Purchase Price' and new_value = '25000' and changed_by_employee_id = owner.id and source = 'MANUAL_EDIT') <> 2 then raise exception 'Purchase Price audit entries are incomplete'; end if;

  begin
    perform public.bulk_change_purchase_price(array[item_a, sold_item], 40000);
    raise exception 'Mixed SOLD selection succeeded';
  exception when data_exception then null;
  end;
  if not exists(select 1 from public.inventory_items where id = item_a and purchase_price = 25000) then raise exception 'Mixed SOLD rejection partially updated products'; end if;

  perform set_config('request.jwt.claim.sub', salesperson_auth::text, true);
  begin
    perform public.bulk_change_purchase_price(array[item_a], 50000);
    raise exception 'Salesperson Purchase Price change succeeded';
  exception when insufficient_privilege then null;
  end;
  if exists(select 1 from public.inventory_item_history where inventory_item_id = item_a and field_name = 'Purchase Price') then raise exception 'Purchase Price history leaked to salesperson'; end if;
  if has_function_privilege('anon', 'public.bulk_change_purchase_price(uuid[],numeric)', 'EXECUTE') then raise exception 'Anonymous bulk Purchase Price grant exists'; end if;
end $$;
rollback;
