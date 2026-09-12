-- Keep the public validation signature while validating every parameter explicitly.
create or replace function public.validate_admin_employee(p_role text,p_shop_id uuid,p_active boolean) returns void language plpgsql stable security definer set search_path='' set row_security=off as $$
begin
  if p_active is null then raise exception using errcode='22023',message='Select an account status.';end if;
  if p_role not in ('owner','salesperson') then raise exception using errcode='22023',message='Select a valid employee role.';end if;
  if p_shop_id is not null and not exists(select 1 from public.shops where id=p_shop_id and is_active) then raise exception using errcode='22023',message='Select an active shop.';end if;
end $$;
