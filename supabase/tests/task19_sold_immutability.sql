-- Rollback-only Task 19 verification. Requires an active Owner and active shop.
begin;
do $$
declare
  owner public.employees%rowtype;
  shop_id uuid;
  item_id uuid;
begin
  select * into owner from public.employees where role='owner' and is_active limit 1;
  if not found then raise exception 'Task 19 verification requires an active Owner'; end if;
  select id into shop_id from public.shops where is_active order by created_at limit 1;
  if not found then raise exception 'Task 19 verification requires an active shop'; end if;
  perform set_config('request.jwt.claim.sub',owner.auth_user_id::text,true);

  insert into public.inventory_items(shop_id,article_number,weight_grams,price_per_gram,status,created_by)
  values(shop_id,'TASK19-SOLD-IMMUTABLE',1,100,'IN_STOCK',owner.id)
  returning id into item_id;

  perform public.complete_sale(shop_id,jsonb_build_array(jsonb_build_object('inventory_item_id',item_id,'discount_percent',0)),null);
  if (select status from public.inventory_items where id=item_id)<>'SOLD' then
    raise exception 'complete_sale could not transition the product to SOLD';
  end if;

  begin
    update public.inventory_items set notes='forbidden' where id=item_id;
    raise exception 'SOLD update succeeded';
  exception when data_exception then null;
  end;

  begin
    delete from public.inventory_items where id=item_id;
    raise exception 'SOLD delete succeeded';
  exception when data_exception then null;
  end;

  if not exists(select 1 from public.inventory_items where id=item_id and status='SOLD' and notes is null) then
    raise exception 'SOLD product changed during rejection checks';
  end if;
end $$;
rollback;
