-- Rollback-only Task 15 deletion and bulk-transfer verification. Requires an active Owner.
begin;
do $$
declare owner public.employees%rowtype;shop_a uuid;shop_b uuid;salesperson_auth uuid:=gen_random_uuid();item_a uuid;item_b uuid;sold_item uuid;sale_result record;single_sale record;report jsonb;
begin
 select * into owner from public.employees where role='owner' and is_active limit 1;if not found then raise exception 'Task 15 verification requires an active Owner';end if;
 perform set_config('request.jwt.claim.sub',owner.auth_user_id::text,true);
 insert into public.shops(name,code)values('Task 15 A','TASK15A')returning id into shop_a;insert into public.shops(name,code)values('Task 15 B','TASK15B')returning id into shop_b;
 insert into public.employees(auth_user_id,username,full_name,role,shop_id,is_active)values(salesperson_auth,'task15_sales','Task 15 Sales','salesperson',shop_a,true);
 insert into public.inventory_items(shop_id,article_number,weight_grams,price_per_gram,status,created_by)values(shop_a,'TASK15-A',1,100,'IN_STOCK',owner.id),(shop_a,'TASK15-B',2,100,'IN_STOCK',owner.id),(shop_a,'TASK15-SOLD',3,100,'IN_STOCK',owner.id);
 select id into item_a from public.inventory_items where article_number='TASK15-A';select id into item_b from public.inventory_items where article_number='TASK15-B';select id into sold_item from public.inventory_items where article_number='TASK15-SOLD';
 select * into sale_result from public.complete_sale(shop_a,jsonb_build_array(jsonb_build_object('inventory_item_id',item_a,'discount_percent',10),jsonb_build_object('inventory_item_id',item_b,'discount_percent',0)),null);
 select * into single_sale from public.complete_sale(shop_a,jsonb_build_array(jsonb_build_object('inventory_item_id',sold_item,'discount_percent',0)),null);
 begin perform public.delete_inventory_item_permanently(sold_item);raise exception 'SOLD deletion succeeded';exception when data_exception then null;end;
 update public.inventory_items set status='REMOVED' where id in(item_a,sold_item);perform public.delete_inventory_item_permanently(item_a);
 if exists(select 1 from public.inventory_items where id=item_a)or exists(select 1 from public.sale_items where inventory_item_id=item_a)or exists(select 1 from public.inventory_item_history where inventory_item_id=item_a)then raise exception 'Product footprint was not deleted';end if;
 if not exists(select 1 from public.sales where id=sale_result.sale_id and total_list_price=200 and total_sale_price=200)then raise exception 'Remaining sale totals were not recalculated';end if;
 if not exists(select 1 from public.sale_items where inventory_item_id=item_b)then raise exception 'Unrelated sale item was changed';end if;
 perform public.delete_inventory_item_permanently(sold_item);if exists(select 1 from public.sales where id=single_sale.sale_id)then raise exception 'Empty sale header remains';end if;
 report:=public.get_dashboard_report('TODAY',shop_a);if exists(select 1 from jsonb_array_elements(report->'recent_sales')r where r->>'id'=single_sale.sale_id::text)then raise exception 'Deleted product sale remains in Recent Sales';end if;
 if (report#>>'{kpis,revenue}')::numeric<>200 or (report#>>'{kpis,items_sold}')::int<>1 then raise exception 'Dashboard still includes deleted product';end if;
 update public.inventory_items set status='IN_STOCK' where id=item_b;if public.bulk_move_inventory_items(array[item_b],shop_b)<>1 then raise exception 'Bulk move count incorrect';end if;
 if not exists(select 1 from public.inventory_item_history where inventory_item_id=item_b and field_name='Shop' and old_value='Task 15 A' and new_value='Task 15 B' and source='SHOP_TRANSFER')then raise exception 'Bulk move history missing';end if;
 insert into public.inventory_items(shop_id,article_number,status,created_by)values(shop_a,'TASK15-BULK-SOLD','SOLD',owner.id)returning id into sold_item;
 begin perform public.bulk_move_inventory_items(array[item_b,sold_item],shop_a);raise exception 'Bulk SOLD selection succeeded';exception when data_exception then null;end;
 if not exists(select 1 from public.inventory_items where id=item_b and shop_id=shop_b)then raise exception 'Bulk SOLD rejection partially moved products';end if;
 perform set_config('request.jwt.claim.sub',salesperson_auth::text,true);
 begin perform public.delete_inventory_item_permanently(item_b);raise exception 'Salesperson deletion succeeded';exception when insufficient_privilege then null;end;
 begin perform public.bulk_move_inventory_items(array[item_b],shop_a);raise exception 'Salesperson bulk move succeeded';exception when insufficient_privilege then null;end;
 if has_function_privilege('anon','public.delete_inventory_item_permanently(uuid)','EXECUTE')or has_function_privilege('anon','public.bulk_move_inventory_items(uuid[],uuid)','EXECUTE')then raise exception 'Anonymous Task 15 RPC grant exists';end if;
end $$;
rollback;
