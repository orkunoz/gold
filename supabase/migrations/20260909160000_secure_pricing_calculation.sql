-- Task 5A security follow-up: scope pricing calculations to accessible active shops.

create or replace function public.calculate_selling_price(
  p_owner_price numeric,
  p_shop_id uuid,
  p_category_id uuid
)
returns table (
  calculated_price numeric(14, 2),
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
  v_rule public.pricing_rules%rowtype;
  v_calculated numeric;
begin
  if not (select public.is_active_employee()) then
    raise exception using errcode = '42501', message = 'An active employee account is required.';
  end if;

  if p_shop_id is not null then
    if not (select public.can_access_shop(p_shop_id)) then
      raise exception using errcode = '42501', message = 'You are not authorized to calculate prices for this shop.';
    end if;
    if not exists (
      select 1 from public.shops as shop
      where shop.id = p_shop_id and shop.is_active
    ) then
      raise exception using errcode = '22023', message = 'The pricing shop does not exist or is inactive.';
    end if;
  end if;

  if p_owner_price is null then
    return query select null::numeric(14, 2), null::uuid, null::text, null::numeric;
    return;
  end if;
  if p_owner_price < 0 or p_owner_price > 999999999999.99 then
    raise exception using errcode = '22023', message = 'Owner price is outside the supported range.';
  end if;

  select rule.* into v_rule
  from public.pricing_rules as rule
  where rule.is_active
    and (rule.starts_at is null or rule.starts_at <= statement_timestamp())
    and (rule.ends_at is null or rule.ends_at > statement_timestamp())
    and (rule.shop_id is null or rule.shop_id = p_shop_id)
    and (rule.category_id is null or rule.category_id = p_category_id)
  order by
    case
      when rule.shop_id is not null and rule.category_id is not null then 4
      when rule.shop_id is not null then 3
      when rule.category_id is not null then 2
      else 1
    end desc,
    rule.priority desc,
    rule.created_at desc,
    rule.id desc
  limit 1;

  if not found then
    return query select round(p_owner_price, 2)::numeric(14, 2), null::uuid, null::text, null::numeric;
    return;
  end if;

  if v_rule.rule_type = 'FIXED_AMOUNT' then
    v_calculated := p_owner_price + v_rule.rule_value;
  else
    v_calculated := p_owner_price + (p_owner_price * v_rule.rule_value / 100);
  end if;
  if v_calculated > 999999999999.99 then
    raise exception using errcode = '22003', message = 'Calculated price exceeds the supported range.';
  end if;
  return query select round(v_calculated, 2)::numeric(14, 2), v_rule.id, v_rule.rule_type, v_rule.rule_value;
end;
$$;

revoke all on function public.calculate_selling_price(numeric, uuid, uuid) from public, anon;
grant execute on function public.calculate_selling_price(numeric, uuid, uuid) to authenticated;

create or replace function public.preserve_pricing_rule_creator()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.created_by is distinct from old.created_by then
    raise exception using errcode = '42501', message = 'The pricing rule creator cannot be changed.';
  end if;
  return new;
end;
$$;

revoke all on function public.preserve_pricing_rule_creator() from public, anon, authenticated;

create trigger pricing_rules_preserve_created_by
before update on public.pricing_rules
for each row execute function public.preserve_pricing_rule_creator();

comment on function public.calculate_selling_price(numeric, uuid, uuid) is
  'Returns one deterministic active pricing result; non-null shops must be active and accessible to the current employee.';
comment on function public.preserve_pricing_rule_creator() is
  'Prevents authenticated updates from rewriting pricing rule creator attribution.';
