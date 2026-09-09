-- Gold Task 5A: configurable pricing rules without inventory repricing.

create table public.pricing_rules (
  id uuid primary key default gen_random_uuid(),
  name text not null check (btrim(name) <> ''),
  shop_id uuid references public.shops(id) on delete restrict,
  category_id uuid references public.product_categories(id) on delete restrict,
  rule_type text not null check (rule_type in ('FIXED_AMOUNT', 'PERCENTAGE')),
  rule_value numeric(14, 4) not null,
  priority integer not null default 0 check (priority between -1000000 and 1000000),
  is_active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  notes text check (notes is null or btrim(notes) <> ''),
  created_by uuid references public.employees(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pricing_rule_value_valid check (
    rule_value >= 0 and (
      (rule_type = 'FIXED_AMOUNT' and rule_value <= 999999999999.99)
      or (rule_type = 'PERCENTAGE' and rule_value <= 10000)
    )
  ),
  constraint pricing_rule_dates_valid check (starts_at is null or ends_at is null or ends_at > starts_at)
);

create index pricing_rules_resolution_idx on public.pricing_rules
  (is_active, shop_id, category_id, priority desc, created_at desc);

create trigger pricing_rules_set_updated_at
before update on public.pricing_rules
for each row execute function public.set_updated_at();

alter table public.pricing_rules enable row level security;
revoke all on table public.pricing_rules from anon, authenticated;
grant select, insert, update on table public.pricing_rules to authenticated;

create policy pricing_rules_select_owner on public.pricing_rules for select to authenticated
using ((select public.is_owner()));
create policy pricing_rules_insert_owner on public.pricing_rules for insert to authenticated
with check ((select public.is_owner()) and created_by = (
  select employee.id from public.employees as employee
  where employee.auth_user_id = (select auth.uid()) and employee.is_active limit 1
));
create policy pricing_rules_update_owner on public.pricing_rules for update to authenticated
using ((select public.is_owner())) with check ((select public.is_owner()));

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

comment on table public.pricing_rules is 'Owner-managed pricing configuration; does not mutate inventory or historical sales.';
comment on function public.calculate_selling_price(numeric, uuid, uuid) is 'Returns one deterministic active pricing rule result without modifying data.';
