-- Rollback-only integration verification for Task 5A. Requires an active owner.
begin;
do $$
declare
  v_employee public.employees%rowtype;
  v_shop uuid := gen_random_uuid();
  v_other_shop uuid := gen_random_uuid();
  v_category uuid := gen_random_uuid();
  v_result record;
  v_sales_before text;
  v_inventory_before text;
begin
  select * into v_employee from public.employees where role='owner' and is_active order by created_at limit 1;
  if not found then raise exception 'pricing verification requires an active owner'; end if;
  perform set_config('request.jwt.claim.sub',v_employee.auth_user_id::text,true);
  select md5(coalesce(jsonb_agg(to_jsonb(s) order by s.id)::text,'')) into v_sales_before from public.sales s;
  select md5(coalesce(jsonb_agg(to_jsonb(i) order by i.id)::text,'')) into v_inventory_before from public.inventory_items i;
  insert into public.shops(id,name,code) values
    (v_shop,'Task 5A Shop','TASK5A'),
    (v_other_shop,'Task 5A Other Shop','TASK5A-OTHER');
  insert into public.product_categories(id,name) values(v_category,'Task 5A Category');

  select * into v_result from public.calculate_selling_price(100,v_shop,v_category);
  if v_result.calculated_price<>100 or v_result.pricing_rule_id is not null then raise exception 'no-rule fallback failed'; end if;
  select * into v_result from public.calculate_selling_price(null,v_shop,v_category);
  if v_result.calculated_price is not null then raise exception 'null owner price failed'; end if;

  insert into public.pricing_rules(name,rule_type,rule_value,priority,created_by) values('Global fixed','FIXED_AMOUNT',50,1,v_employee.id);
  select * into v_result from public.calculate_selling_price(100,v_shop,v_category);
  if v_result.calculated_price<>150 or v_result.rule_type<>'FIXED_AMOUNT' then raise exception 'global fixed failed'; end if;
  update public.pricing_rules set rule_type='PERCENTAGE',rule_value=12.5 where name='Global fixed';
  select * into v_result from public.calculate_selling_price(10.01,v_shop,v_category);
  if v_result.calculated_price<>11.26 then raise exception 'percentage rounding failed'; end if;

  insert into public.pricing_rules(name,shop_id,rule_type,rule_value,priority,created_by) values('Shop',v_shop,'FIXED_AMOUNT',20,0,v_employee.id);
  insert into public.pricing_rules(name,category_id,rule_type,rule_value,priority,created_by) values('Category',v_category,'FIXED_AMOUNT',30,999,v_employee.id);
  select * into v_result from public.calculate_selling_price(100,v_other_shop,v_category);
  if v_result.calculated_price<>130 then raise exception 'category must beat global'; end if;
  select * into v_result from public.calculate_selling_price(100,v_shop,v_category);
  if v_result.calculated_price<>120 then raise exception 'shop must beat category/global'; end if;
  insert into public.pricing_rules(name,shop_id,category_id,rule_type,rule_value,priority,created_by) values('Specific low',v_shop,v_category,'FIXED_AMOUNT',40,1,v_employee.id),('Specific high',v_shop,v_category,'FIXED_AMOUNT',45,2,v_employee.id);
  select * into v_result from public.calculate_selling_price(100,v_shop,v_category);
  if v_result.calculated_price<>145 then raise exception 'specificity/priority failed'; end if;
  insert into public.pricing_rules(name,shop_id,category_id,rule_type,rule_value,priority,created_by,created_at) values('Specific tied newer',v_shop,v_category,'FIXED_AMOUNT',46,2,v_employee.id,now()+interval '1 second');
  select * into v_result from public.calculate_selling_price(100,v_shop,v_category);
  if v_result.calculated_price<>146 then raise exception 'deterministic newest-rule tie-break failed'; end if;
  update public.pricing_rules set is_active=false where name='Specific tied newer';
  select * into v_result from public.calculate_selling_price(100,v_shop,v_category);
  if v_result.calculated_price<>145 then raise exception 'owner deactivation failed'; end if;
  insert into public.pricing_rules(name,shop_id,category_id,rule_type,rule_value,priority,is_active,created_by) values('Inactive',v_shop,v_category,'FIXED_AMOUNT',99,100,false,v_employee.id);
  insert into public.pricing_rules(name,shop_id,category_id,rule_type,rule_value,priority,starts_at,created_by) values('Future',v_shop,v_category,'FIXED_AMOUNT',99,100,now()+interval '1 day',v_employee.id);
  insert into public.pricing_rules(name,shop_id,category_id,rule_type,rule_value,priority,ends_at,created_by) values('Expired',v_shop,v_category,'FIXED_AMOUNT',99,100,now()-interval '1 day',v_employee.id);
  select * into v_result from public.calculate_selling_price(100,v_shop,v_category);
  if v_result.calculated_price<>145 then raise exception 'inactive/date filtering failed'; end if;
  begin insert into public.pricing_rules(name,rule_type,rule_value,created_by) values('Negative','FIXED_AMOUNT',-1,v_employee.id); raise exception 'negative accepted'; exception when check_violation then null; end;

  -- SECURITY DEFINER calculation must still honor current employee shop access.
  select * into v_result from public.calculate_selling_price(100,v_shop,v_category);
  if v_result.calculated_price<>145 then raise exception 'owner active-shop calculation failed'; end if;
  update public.employees set role='manager',shop_id=v_shop where id=v_employee.id;
  perform public.calculate_selling_price(100,v_shop,v_category);
  begin
    perform public.calculate_selling_price(100,v_other_shop,v_category);
    raise exception 'manager other-shop calculation unexpectedly succeeded';
  exception when insufficient_privilege then null; end;
  update public.employees set role='salesperson',shop_id=v_shop where id=v_employee.id;
  perform public.calculate_selling_price(100,v_shop,v_category);
  begin
    perform public.calculate_selling_price(100,v_other_shop,v_category);
    raise exception 'salesperson other-shop calculation unexpectedly succeeded';
  exception when insufficient_privilege then null; end;
  update public.employees set role='owner',shop_id=v_shop where id=v_employee.id;
  update public.shops set is_active=false where id=v_other_shop;
  begin
    perform public.calculate_selling_price(100,v_other_shop,v_category);
    raise exception 'inactive shop calculation unexpectedly succeeded';
  exception when sqlstate '22023' then null; end;
  begin
    perform public.calculate_selling_price(100,gen_random_uuid(),v_category);
    raise exception 'nonexistent shop calculation unexpectedly succeeded';
  exception when sqlstate '22023' then null; end;

  begin
    update public.pricing_rules set created_by=null where name='Global fixed';
    raise exception 'created_by rewrite unexpectedly succeeded';
  exception when insufficient_privilege then null; end;

  if has_table_privilege('authenticated','public.pricing_rules','DELETE') then raise exception 'delete privilege exposed'; end if;
  if has_table_privilege('anon','public.pricing_rules','SELECT') or has_function_privilege('anon','public.calculate_selling_price(numeric,uuid,uuid)','EXECUTE') then raise exception 'anonymous pricing access exposed'; end if;
  if not exists(select 1 from pg_policies where tablename='pricing_rules' and policyname='pricing_rules_insert_owner' and with_check like '%is_owner%') then raise exception 'owner insert policy missing'; end if;
  if not exists(select 1 from pg_policies where tablename='pricing_rules' and policyname='pricing_rules_update_owner' and qual like '%is_owner%') then raise exception 'owner update policy missing'; end if;
  if exists(select 1 from pg_policies where tablename='pricing_rules' and policyname not like '%owner%') then raise exception 'non-owner pricing rule policy exposed'; end if;
  if exists(select 1 from pg_trigger where tgrelid='public.inventory_items'::regclass and not tgisinternal and pg_get_triggerdef(oid) ilike '%pricing%') then raise exception 'automatic inventory repricing trigger exists'; end if;
  if (select md5(coalesce(jsonb_agg(to_jsonb(s) order by s.id)::text,'')) from public.sales s)<>v_sales_before then raise exception 'sales history changed'; end if;
  if (select md5(coalesce(jsonb_agg(to_jsonb(i) order by i.id)::text,'')) from public.inventory_items i)<>v_inventory_before then raise exception 'inventory changed'; end if;
end $$;
rollback;
