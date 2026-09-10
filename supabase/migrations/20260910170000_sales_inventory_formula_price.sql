-- Use the Inventory formula price as the default Sales list price.
create or replace function public.get_effective_inventory_price(p_inventory_item_id uuid)
returns table (
  effective_price numeric(14, 2),
  source text,
  pricing_rule_id uuid,
  rule_type text,
  rule_value numeric
)
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_item public.inventory_items%rowtype;
  v_calculation record;
begin
  if not (select public.is_active_employee()) then
    raise exception using errcode = '42501', message = 'An active employee account is required.';
  end if;

  select inventory.* into v_item
  from public.inventory_items as inventory
  where inventory.id = p_inventory_item_id;
  if not found then
    raise exception using errcode = '22023', message = 'Inventory item does not exist.';
  end if;
  if not (select public.can_access_shop(v_item.shop_id)) then
    raise exception using errcode = '42501', message = 'You are not authorized to price this inventory item.';
  end if;
  if not exists (select 1 from public.shops as shop where shop.id = v_item.shop_id and shop.is_active) then
    raise exception using errcode = '22023', message = 'The inventory shop does not exist or is inactive.';
  end if;

  if v_item.selling_price is not null then
    return query select v_item.selling_price, 'MANUAL'::text, null::uuid, null::text, null::numeric;
    return;
  end if;

  if v_item.price is not null then
    return query select v_item.price, 'INVENTORY_FORMULA'::text, null::uuid, null::text, null::numeric;
    return;
  end if;

  select * into v_calculation
  from public.calculate_selling_price(v_item.owner_price, v_item.shop_id, v_item.category_id);
  return query select
    v_calculation.calculated_price,
    case when v_calculation.pricing_rule_id is null then 'OWNER_PRICE_FALLBACK' else 'PRICING_RULE' end::text,
    v_calculation.pricing_rule_id,
    v_calculation.rule_type,
    v_calculation.rule_value;
end;
$$;

revoke all on function public.get_effective_inventory_price(uuid) from public, anon;
grant execute on function public.get_effective_inventory_price(uuid) to authenticated;

comment on function public.get_effective_inventory_price(uuid) is
  'Resolves manual override, Inventory formula price, pricing rule, or owner-price fallback for one accessible item.';
