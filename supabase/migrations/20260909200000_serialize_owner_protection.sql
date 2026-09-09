-- Serialize sensitive Owner transitions so concurrent requests cannot remove every active Owner.
create or replace function public.admin_update_employee(p_employee_id uuid,p_full_name text,p_role text,p_shop_id uuid,p_active boolean) returns void language plpgsql security definer set search_path='' set row_security=off as $$
declare v_old public.employees%rowtype;
begin
  perform public.require_owner_employee();
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('gold-active-owner-protection',0));
  select * into v_old from public.employees where id=p_employee_id for update;
  if not found then raise exception using errcode='22023',message='Employee not found.'; end if;
  perform public.validate_admin_employee(p_role,p_shop_id,p_active);
  if v_old.role='owner' and v_old.is_active and (p_role<>'owner' or not p_active)
    and not exists(select 1 from public.employees where id<>p_employee_id and role='owner' and is_active)
  then raise exception using errcode='22023',message='The last active Owner cannot be deactivated or changed to another role.'; end if;
  p_full_name:=nullif(btrim(p_full_name),'');
  if p_full_name is not null and length(p_full_name)>200 then raise exception using errcode='22023',message='Full name is too long.'; end if;
  update public.employees set full_name=p_full_name,role=p_role,shop_id=p_shop_id,is_active=p_active where id=p_employee_id;
end $$;
revoke all on function public.admin_update_employee(uuid,text,text,uuid,boolean) from public,anon;
grant execute on function public.admin_update_employee(uuid,text,text,uuid,boolean) to authenticated;
