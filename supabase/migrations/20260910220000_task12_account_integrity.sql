-- Account retries must never reassign or reactivate an existing identity.
create or replace function public.admin_link_employee_account(p_auth_user_id uuid,p_username text,p_full_name text,p_role text,p_shop_id uuid)
returns uuid language plpgsql security definer set search_path='' set row_security=off as $$
declare v_username text:=lower(btrim(p_username)); existing public.employees%rowtype;v_email text;v_id uuid;
begin
  perform public.require_owner_employee();
  if v_username is null or v_username !~ '^[a-z0-9][a-z0-9_-]{2,31}$' or btrim(coalesce(p_full_name,''))='' then raise exception using errcode='22023',message='Invalid account details.';end if;
  if p_role is distinct from 'salesperson' then raise exception using errcode='22023',message='Routine account creation supports Salesperson only.';end if;
  perform public.validate_admin_employee(p_role,p_shop_id,true);
  select lower(btrim(email)) into v_email from auth.users where id=p_auth_user_id;
  if v_email is distinct from v_username||'@internal.local' then raise exception using errcode='42501',message='Auth identity does not match username.';end if;
  select * into existing from public.employees where auth_user_id=p_auth_user_id or username=v_username for update;
  if found then
    if existing.auth_user_id=p_auth_user_id and existing.username=v_username and existing.role='salesperson' and existing.shop_id=p_shop_id and existing.is_active then return existing.id;end if;
    raise exception using errcode='23505',message='Account already exists with different attributes.';
  end if;
  insert into public.employees(auth_user_id,email,username,full_name,role,shop_id,is_active) values(p_auth_user_id,v_email,v_username,btrim(p_full_name),'salesperson',p_shop_id,true) returning id into v_id;
  return v_id;
end $$;
revoke all on function public.admin_link_employee_account(uuid,text,text,text,uuid) from public,anon;
grant execute on function public.admin_link_employee_account(uuid,text,text,text,uuid) to authenticated;

-- Sum sale lines for shop revenue, avoiding multiplication for multi-item sales.
do $$ declare definition text;begin
  definition:=pg_get_functiondef('public.get_dashboard_report(text,uuid)'::regprocedure);
  if position('sum(s.total_sale_price)revenue' in definition)=0 then raise exception 'Expected dashboard expression not found';end if;
  execute replace(definition,'sum(s.total_sale_price)revenue','sum(si.sale_price)revenue');
end $$;
