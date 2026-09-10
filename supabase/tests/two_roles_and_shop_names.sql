-- Rollback-only verification for the two-role model and final shop names.
begin;
do $$
begin
  if (select name from public.shops where code = 'MAIN') <> 'Novovolynsk'
    or (select name from public.shops where code = 'SHOP2') <> 'Lutsk'
    or (select name from public.shops where code = 'SHOP3') <> 'Kyiv'
  then
    raise exception 'Shop names are incorrect';
  end if;
  if exists(select 1 from public.employees where role not in ('owner', 'salesperson')) then
    raise exception 'Unsupported employee role remains';
  end if;
  if exists(select 1 from public.employee_invitations where role not in ('owner', 'salesperson')) then
    raise exception 'Unsupported invitation role remains';
  end if;
  begin
    perform public.validate_admin_employee('manager', null, true);
    raise exception 'Manager role was accepted';
  exception when data_exception then null;
  end;
  if exists(
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'inventory_items'
      and (policyname ilike '%manager%' or coalesce(qual, '') ilike '%manager%' or coalesce(with_check, '') ilike '%manager%')
  ) then
    raise exception 'Manager inventory policy remains';
  end if;
end
$$;
rollback;
