-- Owner-confidential acquisition cost, immutable sale snapshots, and cleaned transfer snapshots.
alter table public.inventory_items add column purchase_price numeric(14,2)
  check (purchase_price is null or purchase_price >= 0);
alter table public.sale_items add column purchase_price_snapshot numeric(14,2)
  check (purchase_price_snapshot is null or purchase_price_snapshot >= 0);
alter table public.transfer_items add column purchase_price numeric(14,2)
  check (purchase_price is null or purchase_price >= 0);

create or replace function public.snapshot_sale_purchase_price() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  select purchase_price into new.purchase_price_snapshot
  from public.inventory_items where id=new.inventory_item_id;
  return new;
end $$;
create trigger snapshot_sale_purchase_price before insert on public.sale_items
for each row execute function public.snapshot_sale_purchase_price();

create or replace function public.get_net_profit_report(p_period text,p_shop_id uuid,p_start_date date,p_end_date date)
returns jsonb language plpgsql stable security definer set search_path='' set row_security=off as $$
declare e public.employees%rowtype; today date:=(statement_timestamp() at time zone 'Europe/Kyiv')::date; started timestamptz; ended timestamptz; period text:=upper(coalesce(p_period,'')); result jsonb;
begin
 select x.* into e from public.employees x where x.auth_user_id=(select auth.uid()) and x.is_active limit 1;
 if not found or e.role<>'owner' then raise exception using errcode='42501',message='Owner access required.'; end if;
 if p_shop_id is not null and not exists(select 1 from public.shops where id=p_shop_id and is_active and location_type='SHOP') then raise exception using errcode='42501',message='Invalid reporting shop.'; end if;
 if period='TODAY' then started:=today::timestamp at time zone 'Europe/Kyiv'; ended:=(today+1)::timestamp at time zone 'Europe/Kyiv';
 elsif period='LAST_7_DAYS' then started:=(today-6)::timestamp at time zone 'Europe/Kyiv'; ended:=(today+1)::timestamp at time zone 'Europe/Kyiv';
 elsif period='THIS_MONTH' then started:=date_trunc('month',today::timestamp) at time zone 'Europe/Kyiv'; ended:=(today+1)::timestamp at time zone 'Europe/Kyiv';
 elsif period='LAST_30_DAYS' then started:=(today-29)::timestamp at time zone 'Europe/Kyiv'; ended:=(today+1)::timestamp at time zone 'Europe/Kyiv';
 elsif period='CUSTOM' and p_start_date is not null and p_end_date is not null and p_start_date<=p_end_date then started:=p_start_date::timestamp at time zone 'Europe/Kyiv'; ended:=(p_end_date+1)::timestamp at time zone 'Europe/Kyiv';
 else raise exception using errcode='22023',message='Select a valid reporting period.'; end if;
 select jsonb_build_object('net_profit',coalesce(sum(si.sale_price-coalesce(si.purchase_price_snapshot,0)),0),'missing_purchase_cost_items',count(*) filter(where si.purchase_price_snapshot is null)::int)
 into result from public.sale_items si join public.sales s on s.id=si.sale_id
 where s.sold_at>=started and s.sold_at<ended and(p_shop_id is null or s.shop_id=p_shop_id);
 return result;
end $$;
revoke all on function public.get_net_profit_report(text,uuid,date,date) from public,anon;
grant execute on function public.get_net_profit_report(text,uuid,date,date) to authenticated;

-- Legacy fineness, notes, discount, and metal columns remain nullable for migration safety,
-- but current import and transfer workflows no longer populate or snapshot them.
create or replace function public.import_inventory_items(p_items jsonb) returns integer language plpgsql security definer set search_path='' set row_security=off as $$
declare v_employee public.employees%rowtype; v_warehouse uuid; v_count int:=0; v_item jsonb;
begin v_employee:=public.require_owner_employee(); select id into v_warehouse from public.shops where location_type='WAREHOUSE' and is_active;
 if v_warehouse is null then raise exception using errcode='22023',message='Active Warehouse location is not configured.'; end if;
 if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)<1 or jsonb_array_length(p_items)>100 then raise exception using errcode='22023',message='Import must contain 1 to 100 rows.'; end if;
 for v_item in select value from jsonb_array_elements(p_items) loop
  insert into public.inventory_items(shop_id,barcode,article_number,category_id,producer,size,weight_grams,purchase_price,price_per_gram,status,created_by)
  values(v_warehouse,nullif(btrim(v_item->>'barcode'),''),nullif(btrim(v_item->>'article_number'),''),public.resolve_product_category(nullif(btrim(v_item->>'category_name'),'')),nullif(btrim(v_item->>'producer'),''),nullif(btrim(v_item->>'size'),''),(v_item->>'weight_grams')::numeric,(v_item->>'purchase_price')::numeric,(v_item->>'price_per_gram')::numeric,'IN_STOCK',v_employee.id); v_count:=v_count+1;
 end loop; return v_count; end $$;

create or replace function public.bulk_move_inventory_items_with_transfer(p_inventory_item_ids uuid[],p_shop_id uuid)
returns uuid language plpgsql security definer set search_path='' set row_security=off as $$
declare v_actor public.employees%rowtype;v_requested int;v_source_count int;v_source_id uuid;v_source public.shops%rowtype;v_dest public.shops%rowtype;v_transfer uuid;
begin v_actor:=public.require_owner_employee();v_requested:=coalesce(array_length(p_inventory_item_ids,1),0);
 if v_requested<1 or v_requested>50 or v_requested<>(select count(distinct x)from unnest(p_inventory_item_ids)x)then raise exception using errcode='22023',message='Select 1 to 50 unique products.';end if;
 select * into v_dest from public.shops where id=p_shop_id and is_active;if not found then raise exception using errcode='22023',message='Select an active destination location.';end if;
 perform i.id from public.inventory_items i where i.id=any(p_inventory_item_ids)order by i.id for update;
 if(select count(*)from public.inventory_items where id=any(p_inventory_item_ids))<>v_requested then raise exception using errcode='22023',message='A selected product no longer exists.';end if;
 if exists(select 1 from public.inventory_items where id=any(p_inventory_item_ids)and status not in('IN_STOCK','REMOVED'))then raise exception using errcode='22023',message='SOLD products cannot be moved.';end if;
 select count(distinct shop_id),(array_agg(distinct shop_id))[1]into v_source_count,v_source_id from public.inventory_items where id=any(p_inventory_item_ids);
 if v_source_count<>1 or v_source_id is null then raise exception using errcode='22023',message='Selected products must have one assigned source location.';end if;
 select * into v_source from public.shops where id=v_source_id;if v_source.id=v_dest.id then raise exception using errcode='22023',message='Source and destination must differ.';end if;
 insert into public.transfers(transfer_number,source_location_id,destination_location_id,source_name,destination_name,source_address,destination_address,performed_by_employee_id,performed_by_name,item_count,total_weight,total_value)
 select'TR-'||to_char(clock_timestamp(),'YYYYMMDD')||'-'||lpad(nextval('public.transfer_number_seq')::text,6,'0'),v_source.id,v_dest.id,v_source.name,v_dest.name,v_source.address,v_dest.address,v_actor.id,coalesce(v_actor.full_name,v_actor.username,'Owner'),count(*),coalesce(sum(weight_grams),0),coalesce(sum(price),0)from public.inventory_items where id=any(p_inventory_item_ids)returning id into v_transfer;
 insert into public.transfer_items(transfer_id,line_number,inventory_item_id,category_name,producer,size,weight_grams,purchase_price,price_per_gram,price,article_number,barcode)
 select v_transfer,row_number()over(order by i.id),i.id,c.name,i.producer,i.size,i.weight_grams,i.purchase_price,i.price_per_gram,i.price,i.article_number,i.barcode from public.inventory_items i left join public.product_categories c on c.id=i.category_id where i.id=any(p_inventory_item_ids);
 perform set_config('gold.audit_source','SHOP_TRANSFER',true);update public.inventory_items set shop_id=p_shop_id where id=any(p_inventory_item_ids);
 if(select count(*)from public.inventory_items where id=any(p_inventory_item_ids)and shop_id=p_shop_id)<>v_requested then raise exception using errcode='40001',message='Inventory location update failed.';end if;
 return v_transfer;end $$;
