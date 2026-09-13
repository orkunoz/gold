-- Warehouse locations, immutable transfer notes, and atomic Owner bulk operations.
alter table public.shops add column if not exists location_type text not null default 'SHOP';
alter table public.shops add column if not exists address text;
alter table public.shops drop constraint if exists shops_location_type_check;
alter table public.shops add constraint shops_location_type_check check(location_type in('SHOP','WAREHOUSE'));
update public.shops set location_type='WAREHOUSE' where lower(btrim(name))='warehouse';
create unique index if not exists one_warehouse_location on public.shops(location_type) where location_type='WAREHOUSE';

create or replace function public.is_warehouse_location(p_shop_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.shops where id=p_shop_id and location_type='WAREHOUSE')
$$;

alter table public.employees drop constraint if exists employees_no_warehouse_assignment;
alter table public.employees add constraint employees_no_warehouse_assignment check(
  role<>'salesperson' or shop_id is null or not public.is_warehouse_location(shop_id)
) not valid;

create table public.transfers(
 id uuid primary key default gen_random_uuid(), transfer_number text not null unique,
 transferred_at timestamptz not null default now(), source_location_id uuid references public.shops(id) on delete set null,
 destination_location_id uuid references public.shops(id) on delete set null, source_name text not null,
 destination_name text not null, source_address text, destination_address text,
 performed_by_employee_id uuid references public.employees(id) on delete set null,
 performed_by_name text not null, item_count integer not null check(item_count>0),
 total_weight numeric(16,3) not null, total_value numeric(16,2) not null, created_at timestamptz not null default now()
);
create table public.transfer_items(
 id uuid primary key default gen_random_uuid(), transfer_id uuid not null references public.transfers(id) on delete cascade,
 line_number integer not null, inventory_item_id uuid, category_name text, producer text, fineness text, size text,
 weight_grams numeric, price_per_gram numeric(14,2), price numeric(14,2), article_number text, barcode text,
 unique(transfer_id,line_number)
);
alter table public.transfers enable row level security;
alter table public.transfer_items enable row level security;
create policy transfers_owner_read on public.transfers for select to authenticated using(public.is_owner());
create policy transfer_items_owner_read on public.transfer_items for select to authenticated using(public.is_owner());
revoke all on public.transfers,public.transfer_items from anon,authenticated;
grant select on public.transfers,public.transfer_items to authenticated;
create sequence if not exists public.transfer_number_seq;

create function public.bulk_move_inventory_items_with_transfer(p_inventory_item_ids uuid[],p_shop_id uuid)
returns uuid language plpgsql security definer set search_path='' set row_security=off as $$
declare v_actor public.employees%rowtype; v_requested int; v_source_count int; v_source_id uuid; v_source public.shops%rowtype; v_dest public.shops%rowtype; v_transfer uuid;
begin
 v_actor:=public.require_owner_employee(); v_requested:=coalesce(array_length(p_inventory_item_ids,1),0);
 if v_requested<1 or v_requested>50 or v_requested<>(select count(distinct x) from unnest(p_inventory_item_ids)x) then raise exception using errcode='22023',message='Select 1 to 50 unique products.'; end if;
 if p_shop_id is null then raise exception using errcode='22023',message='Select an active destination location.'; end if;
 select * into v_dest from public.shops where id=p_shop_id and is_active; if not found then raise exception using errcode='22023',message='Select an active destination location.'; end if;
 perform i.id from public.inventory_items i where i.id=any(p_inventory_item_ids) order by i.id for update;
 if (select count(*) from public.inventory_items where id=any(p_inventory_item_ids))<>v_requested then raise exception using errcode='22023',message='A selected product no longer exists.'; end if;
 if exists(select 1 from public.inventory_items where id=any(p_inventory_item_ids) and status not in('IN_STOCK','REMOVED')) then raise exception using errcode='22023',message='SOLD products cannot be moved.'; end if;
 select count(distinct shop_id),(array_agg(distinct shop_id))[1] into v_source_count,v_source_id from public.inventory_items where id=any(p_inventory_item_ids);
 if v_source_count<>1 or v_source_id is null then raise exception using errcode='22023',message='Selected products must have one assigned source location.'; end if;
 select * into v_source from public.shops where id=v_source_id;
 if v_source.id=v_dest.id then raise exception using errcode='22023',message='Source and destination must differ.'; end if;
 insert into public.transfers(transfer_number,source_location_id,destination_location_id,source_name,destination_name,source_address,destination_address,performed_by_employee_id,performed_by_name,item_count,total_weight,total_value)
 select 'TR-'||to_char(clock_timestamp(),'YYYYMMDD')||'-'||lpad(nextval('public.transfer_number_seq')::text,6,'0'),v_source.id,v_dest.id,v_source.name,v_dest.name,v_source.address,v_dest.address,v_actor.id,coalesce(v_actor.full_name,v_actor.username,'Owner'),count(*),coalesce(sum(weight_grams),0),coalesce(sum(price),0)
 from public.inventory_items where id=any(p_inventory_item_ids) returning id into v_transfer;
 insert into public.transfer_items(transfer_id,line_number,inventory_item_id,category_name,producer,fineness,size,weight_grams,price_per_gram,price,article_number,barcode)
 select v_transfer,row_number()over(order by i.id),i.id,c.name,i.producer,i.gold_fineness,i.size,i.weight_grams,i.price_per_gram,i.price,i.article_number,i.barcode from public.inventory_items i left join public.product_categories c on c.id=i.category_id where i.id=any(p_inventory_item_ids);
 perform set_config('gold.audit_source','SHOP_TRANSFER',true); update public.inventory_items set shop_id=p_shop_id where id=any(p_inventory_item_ids);
 return v_transfer;
end $$;

create or replace function public.bulk_change_price_per_gram(p_inventory_item_ids uuid[],p_price_per_gram numeric)
returns integer language plpgsql security definer set search_path='' set row_security=off as $$
declare v_count int;
begin perform public.require_owner_employee(); v_count:=coalesce(array_length(p_inventory_item_ids,1),0);
 if v_count<1 or v_count>50 or v_count<>(select count(distinct x) from unnest(p_inventory_item_ids)x) then raise exception using errcode='22023',message='Select 1 to 50 unique products.'; end if;
 if p_price_per_gram is null or p_price_per_gram<0 then raise exception using errcode='22023',message='Price per gram must be nonnegative.'; end if;
 perform id from public.inventory_items where id=any(p_inventory_item_ids) order by id for update;
 if (select count(*) from public.inventory_items where id=any(p_inventory_item_ids) and status in('IN_STOCK','REMOVED'))<>v_count then raise exception using errcode='22023',message='Selection contains an ineligible or SOLD product.'; end if;
 perform set_config('gold.audit_source','MANUAL_EDIT',true); update public.inventory_items set price_per_gram=p_price_per_gram where id=any(p_inventory_item_ids); return v_count;
end $$;

create or replace function public.bulk_delete_inventory_items(p_inventory_item_ids uuid[])
returns integer language plpgsql security definer set search_path='' set row_security=off as $$
declare v_count int; v_id uuid;
begin perform public.require_owner_employee(); v_count:=coalesce(array_length(p_inventory_item_ids,1),0);
 if v_count<1 or v_count>50 or v_count<>(select count(distinct x) from unnest(p_inventory_item_ids)x) then raise exception using errcode='22023',message='Select 1 to 50 unique products.'; end if;
 perform id from public.inventory_items where id=any(p_inventory_item_ids) order by id for update;
 if (select count(*) from public.inventory_items where id=any(p_inventory_item_ids) and status in('IN_STOCK','REMOVED'))<>v_count then raise exception using errcode='22023',message='Selection contains an ineligible or SOLD product.'; end if;
 foreach v_id in array p_inventory_item_ids loop perform public.delete_inventory_item_permanently(v_id); end loop; return v_count;
end $$;

create or replace function public.import_inventory_items(p_items jsonb) returns integer language plpgsql security definer set search_path='' set row_security=off as $$
declare v_employee public.employees%rowtype; v_warehouse uuid; v_count int:=0; v_item jsonb;
begin v_employee:=public.require_owner_employee(); select id into v_warehouse from public.shops where location_type='WAREHOUSE' and is_active;
 if v_warehouse is null then raise exception using errcode='22023',message='Active Warehouse location is not configured.'; end if;
 if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)<1 or jsonb_array_length(p_items)>100 then raise exception using errcode='22023',message='Import must contain 1 to 100 rows.'; end if;
 for v_item in select value from jsonb_array_elements(p_items) loop
  insert into public.inventory_items(shop_id,barcode,article_number,category_id,gold_fineness,producer,size,weight_grams,price_per_gram,discount,notes,status,created_by)
  values(v_warehouse,nullif(btrim(v_item->>'barcode'),''),nullif(btrim(v_item->>'article_number'),''),public.resolve_product_category(nullif(btrim(v_item->>'category_name'),'')),nullif(btrim(v_item->>'gold_fineness'),''),nullif(btrim(v_item->>'producer'),''),nullif(btrim(v_item->>'size'),''),(v_item->>'weight_grams')::numeric,(v_item->>'price_per_gram')::numeric,nullif(btrim(v_item->>'discount'),''),nullif(v_item->>'notes',''),'IN_STOCK',v_employee.id); v_count:=v_count+1;
 end loop; return v_count; end $$;

revoke all on function public.bulk_move_inventory_items_with_transfer(uuid[],uuid),public.bulk_change_price_per_gram(uuid[],numeric),public.bulk_delete_inventory_items(uuid[]) from public,anon;
grant execute on function public.bulk_move_inventory_items_with_transfer(uuid[],uuid),public.bulk_change_price_per_gram(uuid[],numeric),public.bulk_delete_inventory_items(uuid[]) to authenticated;
create or replace function public.admin_update_location(p_shop_id uuid,p_name text,p_code text,p_address text,p_location_type text)returns void language plpgsql security definer set search_path='' set row_security=off as $$ begin perform public.require_owner_employee();if p_location_type not in('SHOP','WAREHOUSE')then raise exception using errcode='22023',message='Invalid location type.';end if;update public.shops set name=btrim(p_name),code=upper(btrim(p_code)),address=nullif(btrim(p_address),''),location_type=p_location_type where id=p_shop_id;if not found then raise exception using errcode='22023',message='Location not found.';end if;end $$;
create or replace function public.validate_admin_employee(p_role text,p_shop_id uuid,p_active boolean)returns void language plpgsql stable security definer set search_path='' set row_security=off as $$ begin if p_role not in('owner','salesperson')then raise exception using errcode='22023',message='Select a valid role.';end if;if p_role='salesperson'and(p_shop_id is null or not exists(select 1 from public.shops where id=p_shop_id and is_active and location_type='SHOP'))then raise exception using errcode='22023',message='Salespeople require an active selling shop.';end if;end $$;
revoke all on function public.admin_update_location(uuid,text,text,text,text)from public,anon;grant execute on function public.admin_update_location(uuid,text,text,text,text)to authenticated;
