-- Rollback-only regression verification for Sales defaults from Inventory formula price.
begin;
do $$
declare
  employee public.employees%rowtype;
  shop_id uuid := gen_random_uuid();
  category_id uuid := gen_random_uuid();
  formula_item_id uuid := gen_random_uuid();
  manual_item_id uuid := gen_random_uuid();
  resolved record;
  completed record;
begin
  select * into employee from public.employees where role = 'owner' and is_active order by created_at limit 1;
  if not found then raise exception 'Sales formula-price verification requires an active owner'; end if;
  perform set_config('request.jwt.claim.sub', employee.auth_user_id::text, true);

  insert into public.shops(id, name, code) values(shop_id, 'Sales formula rollback shop', 'SALES-FORMULA');
  insert into public.product_categories(id, name) values(category_id, 'Sales Formula Product');
  insert into public.inventory_items(
    id, shop_id, barcode, category_id, weight_grams, price_per_gram, owner_price, selling_price, status, created_by
  ) values
    (formula_item_id, shop_id, 'SALES-FORMULA-1', category_id, 2.5, 6000, null, null, 'IN_STOCK', employee.id),
    (manual_item_id, shop_id, 'SALES-FORMULA-2', category_id, 3, 6000, null, 17500, 'IN_STOCK', employee.id);

  select * into resolved from public.get_effective_inventory_price(formula_item_id);
  if resolved.effective_price <> 15000 or resolved.source <> 'INVENTORY_FORMULA' then
    raise exception 'Inventory formula price was not resolved for Sales';
  end if;

  select * into resolved from public.get_effective_inventory_price(manual_item_id);
  if resolved.effective_price <> 17500 or resolved.source <> 'MANUAL' then
    raise exception 'Manual selling price did not retain precedence';
  end if;

  select * into completed from public.complete_sale(
    shop_id,
    jsonb_build_array(jsonb_build_object('inventory_item_id', formula_item_id, 'discount_percent', 10, 'sale_price', 13500)),
    'FORMULA PRICE ROLLBACK TEST'
  );
  if (select list_price from public.sale_items where sale_id = completed.sale_id) <> 15000 then
    raise exception 'Sale did not snapshot the Inventory formula list price';
  end if;
end
$$;
rollback;
