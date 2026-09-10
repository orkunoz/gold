-- Rollback-only Owner/Salesperson administration verification; no email is sent.
begin;
do $$
declare
  owner_employee public.employees%rowtype;
  v_shop_id uuid;
  invite jsonb;
  salesperson_auth uuid := gen_random_uuid();
  salesperson_id uuid;
begin
  select * into owner_employee from public.employees where role = 'owner' and is_active order by created_at limit 1;
  if not found then raise exception 'Administration verification requires an active Owner'; end if;
  perform set_config('request.jwt.claim.sub', owner_employee.auth_user_id::text, true);
  v_shop_id := public.admin_create_shop('Task 11 Admin Shop', 'TASK11-ADMIN');

  begin
    perform public.admin_prepare_employee_invite('manager@example.test', 'Manager', 'manager', v_shop_id);
    raise exception 'Manager invitation unexpectedly succeeded';
  exception when data_exception then null;
  end;
  begin
    perform public.admin_prepare_employee_invite('owner2@example.test', 'Second Owner', 'owner', null);
    raise exception 'Owner invitation unexpectedly succeeded';
  exception when data_exception then null;
  end;

  insert into auth.users(id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values(salesperson_auth, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'task11-admin@example.test', '', now(), '{}', '{}', now(), now());
  invite := public.admin_prepare_employee_invite(' TASK11-ADMIN@example.test ', 'Shop Salesperson', 'salesperson', v_shop_id);
  salesperson_id := public.admin_finalize_employee_invite((invite->>'invitation_id')::uuid, salesperson_auth);
  if not exists(select 1 from public.employees where id = salesperson_id and role = 'salesperson' and shop_id = v_shop_id and is_active) then
    raise exception 'Salesperson invitation/finalization failed';
  end if;
  begin
    perform public.admin_prepare_employee_invite('second@example.test', 'Second Salesperson', 'salesperson', v_shop_id);
    raise exception 'Second active shop Salesperson invitation unexpectedly succeeded';
  exception when unique_violation then null;
  end;
  begin
    perform public.admin_update_employee(owner_employee.id, coalesce(owner_employee.full_name, 'Owner'), 'salesperson', v_shop_id, true);
    raise exception 'Last active Owner downgrade unexpectedly succeeded';
  exception when data_exception then null;
  end;
  if has_table_privilege('authenticated', 'public.employees', 'UPDATE')
    or has_function_privilege('anon', 'public.admin_prepare_employee_invite(text,text,text,uuid)', 'EXECUTE') then
    raise exception 'Administration privileges are unsafe';
  end if;
end
$$;
rollback;
