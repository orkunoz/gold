-- Rollback-only Task 5B verification. Requires an active owner; leaves no rows behind.
begin;
do $$
declare
  v_employee public.employees%rowtype;
  v_shop uuid:=gen_random_uuid(); v_other_shop uuid:=gen_random_uuid(); v_category uuid:=gen_random_uuid();
  v_manual uuid:=gen_random_uuid(); v_rule uuid:=gen_random_uuid(); v_fallback uuid:=gen_random_uuid(); v_null uuid:=gen_random_uuid(); v_hold uuid:=gen_random_uuid(); v_other_item uuid:=gen_random_uuid();
  v_result record; v_sale record; v_rule_sale uuid; v_sequence bigint; v_sequence_called boolean;
begin
  select * into v_employee from public.employees where role='owner' and is_active order by created_at limit 1;
  if not found then raise exception 'Task 5B verification requires an active owner'; end if;
  select last_value,is_called into v_sequence,v_sequence_called from public.sale_number_sequence;
  begin
    perform set_config('request.jwt.claim.sub',v_employee.auth_user_id::text,true);
    insert into public.shops(id,name,code) values(v_shop,'Task 5B Shop','TASK5B'),(v_other_shop,'Task 5B Other','TASK5B-O');
    insert into public.product_categories(id,name) values(v_category,'Task 5B Category');
    insert into public.inventory_items(id,shop_id,barcode,category_id,owner_price,selling_price,status) values
      (v_manual,v_shop,'TASK5B-MANUAL',v_category,100,130,'IN_STOCK'),
      (v_rule,v_shop,'TASK5B-RULE',v_category,100,null,'IN_STOCK'),
      (v_fallback,v_shop,'TASK5B-FALLBACK',null,80,null,'IN_STOCK'),
      (v_null,v_shop,'TASK5B-NULL',null,null,null,'IN_STOCK'),
      (v_hold,v_shop,'TASK5B-HOLD',v_category,200,null,'IN_STOCK'),
      (v_other_item,v_other_shop,'TASK5B-OTHER',v_category,100,null,'IN_STOCK');

    insert into public.pricing_rules(name,rule_type,rule_value,priority,created_by) values('5B Global','FIXED_AMOUNT',5,0,v_employee.id);
    insert into public.pricing_rules(name,category_id,rule_type,rule_value,priority,created_by) values('5B Category',v_category,'FIXED_AMOUNT',20,0,v_employee.id);
    insert into public.pricing_rules(name,shop_id,rule_type,rule_value,priority,created_by) values('5B Shop',v_shop,'FIXED_AMOUNT',30,0,v_employee.id);
    insert into public.pricing_rules(name,shop_id,category_id,rule_type,rule_value,priority,created_by) values('5B Specific',v_shop,v_category,'FIXED_AMOUNT',45,0,v_employee.id);

    select * into v_result from public.get_effective_inventory_price(v_manual);
    if v_result.effective_price<>130 or v_result.source<>'MANUAL' then raise exception 'manual override precedence failed'; end if;
    select * into v_result from public.get_effective_inventory_price(v_rule);
    if v_result.effective_price<>145 or v_result.source<>'PRICING_RULE' or v_result.rule_value<>45 then raise exception 'rule effective price failed'; end if;
    select * into v_result from public.get_effective_inventory_price(v_null);
    if v_result.effective_price is not null or v_result.source<>'OWNER_PRICE_FALLBACK' then raise exception 'null pricing failed'; end if;
    if (select count(*) from public.get_effective_inventory_prices(array[v_manual,v_rule,v_null]))<>3 then raise exception 'batch pricing failed'; end if;

    update public.employees set role='salesperson',shop_id=v_shop where id=v_employee.id;
    perform public.get_effective_inventory_price(v_rule);
    begin perform public.get_effective_inventory_price(v_other_item); raise exception 'salesperson cross-shop item pricing succeeded'; exception when insufficient_privilege then null; end;
    begin perform public.calculate_selling_price(100,v_other_shop,v_category); raise exception 'salesperson cross-shop pricing succeeded'; exception when insufficient_privilege then null; end;
    update public.employees set role='owner',shop_id=v_shop where id=v_employee.id;

    select * into v_sale from public.complete_sale(v_shop,jsonb_build_array(jsonb_build_object('inventory_item_id',v_manual,'discount_percent',0)),null);
    if (select list_price from public.sale_items where sale_id=v_sale.sale_id)<>130 then raise exception 'manual sale snapshot failed'; end if;
    select * into v_sale from public.complete_sale(v_shop,jsonb_build_array(jsonb_build_object('inventory_item_id',v_rule,'discount_percent',0)),null);
    v_rule_sale:=v_sale.sale_id;
    if (select list_price from public.sale_items where sale_id=v_rule_sale)<>145 then raise exception 'rule sale snapshot failed'; end if;

    update public.pricing_rules set is_active=false where name like '5B %';
    select * into v_result from public.get_effective_inventory_price(v_fallback);
    if v_result.effective_price<>80 or v_result.source<>'OWNER_PRICE_FALLBACK' then raise exception 'owner fallback failed'; end if;
    select * into v_sale from public.complete_sale(v_shop,jsonb_build_array(jsonb_build_object('inventory_item_id',v_fallback,'discount_percent',0)),null);
    if (select list_price from public.sale_items where sale_id=v_sale.sale_id)<>80 then raise exception 'fallback sale snapshot failed'; end if;
    if (select list_price from public.sale_items where sale_id=v_rule_sale)<>145 then raise exception 'rule change altered historical snapshot'; end if;
    if (select selling_price from public.inventory_items where id=v_hold) is not null then raise exception 'pricing rule update repriced inventory'; end if;

    if pg_get_functiondef('public.complete_sale(uuid,jsonb,text)'::regprocedure) not ilike '%for update of %' then raise exception 'complete_sale row lock missing'; end if;
    if pg_get_functiondef('public.complete_sale(uuid,jsonb,text)'::regprocedure) not ilike '%get_effective_inventory_price%' then raise exception 'complete_sale does not use authoritative effective pricing'; end if;
    if exists(select 1 from pg_policies where tablename='pricing_rules' and policyname not like '%owner%') then raise exception 'non-owner pricing_rules policy exposed'; end if;
    if exists(select 1 from pg_trigger where tgrelid='public.inventory_items'::regclass and not tgisinternal and pg_get_triggerdef(oid) ilike '%pricing%') then raise exception 'inventory repricing trigger exists'; end if;
    perform setval('public.sale_number_sequence',v_sequence,v_sequence_called);
  exception when others then
    perform setval('public.sale_number_sequence',v_sequence,v_sequence_called); raise;
  end;
end $$;
rollback;
