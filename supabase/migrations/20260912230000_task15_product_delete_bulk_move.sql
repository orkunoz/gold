-- Owner-only permanent product deletion and atomic current-page inventory transfers.
create or replace function public.delete_inventory_item_permanently(p_inventory_item_id uuid)
returns void language plpgsql security definer set search_path='' set row_security=off as $$
declare
  v_status text;
  v_sale_ids uuid[];
begin
  perform public.require_owner_employee();

  select status into v_status
  from public.inventory_items
  where id=p_inventory_item_id
  for update;

  if not found then
    raise exception using errcode='22023',message='Product not found.';
  end if;
  if v_status='SOLD' then
    raise exception using errcode='22023',message='SOLD products cannot be permanently deleted.';
  end if;
  if v_status not in('IN_STOCK','REMOVED') then
    raise exception using errcode='22023',message='Only IN_STOCK or REMOVED products can be permanently deleted.';
  end if;

  select coalesce(array_agg(distinct sale_id),'{}'::uuid[]) into v_sale_ids
  from public.sale_items where inventory_item_id=p_inventory_item_id;

  delete from public.inventory_item_history where inventory_item_id=p_inventory_item_id;
  delete from public.sale_items where inventory_item_id=p_inventory_item_id;

  update public.sales s set
    total_list_price=x.total_list_price,
    total_sale_price=x.total_sale_price
  from (
    select si.sale_id,sum(si.list_price)::numeric(14,2) total_list_price,sum(si.sale_price)::numeric(14,2) total_sale_price
    from public.sale_items si where si.sale_id=any(v_sale_ids) group by si.sale_id
  ) x where s.id=x.sale_id;

  delete from public.sales s
  where s.id=any(v_sale_ids) and not exists(select 1 from public.sale_items si where si.sale_id=s.id);

  delete from public.inventory_items where id=p_inventory_item_id;
end $$;
revoke all on function public.delete_inventory_item_permanently(uuid) from public,anon;
grant execute on function public.delete_inventory_item_permanently(uuid) to authenticated;
comment on function public.delete_inventory_item_permanently(uuid) is 'Owner-only atomic product deletion with product-specific sale footprint cleanup.';

create or replace function public.bulk_move_inventory_items(p_inventory_item_ids uuid[],p_shop_id uuid default null)
returns integer language plpgsql security definer set search_path='' set row_security=off as $$
declare
  v_requested integer;
  v_locked integer;
  v_updated integer;
begin
  perform public.require_owner_employee();
  v_requested:=coalesce(array_length(p_inventory_item_ids,1),0);
  if v_requested<1 or v_requested>50 or v_requested<>(select count(distinct id) from unnest(p_inventory_item_ids) as requested(id)) then
    raise exception using errcode='22023',message='Select between 1 and 50 unique products.';
  end if;
  if p_shop_id is not null and not exists(select 1 from public.shops where id=p_shop_id and is_active) then
    raise exception using errcode='22023',message='Select an active destination shop or Unassigned.';
  end if;

  select count(*) into v_locked from (
    select i.id from public.inventory_items i where i.id=any(p_inventory_item_ids) order by i.id for update
  ) locked;
  if v_locked<>v_requested then
    raise exception using errcode='22023',message='One or more selected products no longer exist.';
  end if;
  if exists(select 1 from public.inventory_items where id=any(p_inventory_item_ids) and status='SOLD') then
    raise exception using errcode='22023',message='Selection contains a SOLD product. No products were moved.';
  end if;
  if exists(select 1 from public.inventory_items where id=any(p_inventory_item_ids) and status not in('IN_STOCK','REMOVED')) then
    raise exception using errcode='22023',message='Only IN_STOCK or REMOVED products can be moved.';
  end if;

  perform set_config('gold.audit_source','SHOP_TRANSFER',true);
  update public.inventory_items set shop_id=p_shop_id where id=any(p_inventory_item_ids) and shop_id is distinct from p_shop_id;
  get diagnostics v_updated=row_count;
  return v_updated;
end $$;
revoke all on function public.bulk_move_inventory_items(uuid[],uuid) from public,anon;
grant execute on function public.bulk_move_inventory_items(uuid[],uuid) to authenticated;
comment on function public.bulk_move_inventory_items(uuid[],uuid) is 'Owner-only atomic transfer of up to one inventory page; rejects any SOLD selection.';
