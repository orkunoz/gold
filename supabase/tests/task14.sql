-- Rollback-only Task 14 verification. Requires an active Owner.
begin;
do $$
declare owner public.employees%rowtype;shop_id uuid;item_id uuid;sale_result record;report jsonb;
begin
 select * into owner from public.employees where role='owner' and is_active limit 1;
 if not found then raise exception 'Task 14 verification requires an active Owner';end if;
 perform set_config('request.jwt.claim.sub',owner.auth_user_id::text,true);
 insert into public.shops(name,code)values('Task 14 Shop','TASK14')returning id into shop_id;
 insert into public.inventory_items(shop_id,category_id,metal,gold_fineness,weight_grams,price_per_gram,status,created_by)values(shop_id,public.resolve_product_category('Bracelet'),'Gold','585',1,100,'IN_STOCK',owner.id)returning id into item_id;
 update public.inventory_items set gold_fineness='750' where id=item_id;
 if not exists(select 1 from public.inventory_item_history where inventory_item_id=item_id and field_name='Fineness' and old_value='585' and new_value='750')then raise exception 'Fineness history missing';end if;
 select * into sale_result from public.complete_sale(shop_id,jsonb_build_array(jsonb_build_object('inventory_item_id',item_id,'discount_percent',10)),null);
 report:=public.get_dashboard_report('TODAY',shop_id);
 if not exists(select 1 from jsonb_array_elements(report->'recent_sales')r where r->>'id'=sale_result.sale_id::text and(r->>'item_count')::int=1 and r->>'category_summary'='Bracelet')then raise exception 'Recent sale summary missing';end if;
end $$;
rollback;
