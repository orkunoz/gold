-- Rollback-only Task 7 verification; no invitation email is sent.
begin;
do $$
declare
  v_owner public.employees%rowtype; v_shop uuid; v_safe_shop uuid; v_second_owner uuid:=gen_random_uuid(); v_staff_auth uuid:=gen_random_uuid();
  v_second_employee uuid; v_invite jsonb; v_staff uuid; v_sales_hash text; v_items_hash text;
begin
  select * into v_owner from public.employees where role='owner' and is_active order by created_at limit 1;
  if not found then raise exception 'Task 7 verification requires an active owner'; end if;
  perform set_config('request.jwt.claim.sub',v_owner.auth_user_id::text,true);
  select md5(coalesce(jsonb_agg(to_jsonb(s) order by id)::text,'')) into v_sales_hash from public.sales s;
  select md5(coalesce(jsonb_agg(to_jsonb(si) order by id)::text,'')) into v_items_hash from public.sale_items si;

  v_shop:=public.admin_create_shop('  Task 7 Shop  ',' task7 ');
  if (select code from public.shops where id=v_shop)<>'TASK7' then raise exception 'shop normalization failed'; end if;
  begin perform public.admin_create_shop('Duplicate','task7'); raise exception 'duplicate shop code accepted'; exception when unique_violation then null; end;
  perform public.admin_update_shop(v_shop,'Task 7 Updated','UPDATED7');
  if (select name from public.shops where id=v_shop)<>'Task 7 Updated' then raise exception 'shop update failed'; end if;
  v_safe_shop:=public.admin_create_shop('Task 7 Safe','SAFE7'); perform public.admin_set_shop_active(v_safe_shop,false);
  if (select is_active from public.shops where id=v_safe_shop) then raise exception 'safe deactivation failed'; end if;

  insert into public.inventory_items(shop_id,barcode,status) values(v_shop,'TASK7-STOCK','IN_STOCK');
  begin perform public.admin_set_shop_active(v_shop,false); raise exception 'in-stock shop deactivated'; exception when sqlstate '22023' then null; end;
  update public.inventory_items set status='RESERVED' where barcode='TASK7-STOCK';
  begin perform public.admin_set_shop_active(v_shop,false); raise exception 'reserved shop deactivated'; exception when sqlstate '22023' then null; end;
  update public.inventory_items set status='REMOVED' where barcode='TASK7-STOCK';

  insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
  values(v_second_owner,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','task7-owner@example.test','',now(),'{}','{}',now(),now()),
        (v_staff_auth,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','task7-staff@example.test','',now(),'{}','{}',now(),now());
  insert into public.employees(auth_user_id,email,full_name,role,is_active) values(v_second_owner,'task7-owner@example.test','Second Owner','owner',true) returning id into v_second_employee;
  v_invite:=public.admin_prepare_employee_invite(' TASK7-STAFF@example.test ','Staff Member','manager',v_shop);
  v_staff:=public.admin_finalize_employee_invite((v_invite->>'invitation_id')::uuid,v_staff_auth);
  if not exists(select 1 from public.employees where id=v_staff and email='task7-staff@example.test' and role='manager' and shop_id=v_shop) then raise exception 'employee finalize failed'; end if;
  begin perform public.admin_prepare_employee_invite('task7-staff@example.test','Duplicate','salesperson',v_shop); raise exception 'duplicate employee email accepted'; exception when unique_violation then null; end;
  begin perform public.admin_set_shop_active(v_shop,false); raise exception 'active employee shop deactivated'; exception when sqlstate '22023' then null; end;

  perform public.admin_update_employee(v_staff,'Staff Updated','salesperson',v_shop,false);
  if (select is_active from public.employees where id=v_staff) then raise exception 'employee deactivation failed'; end if;
  perform public.admin_set_shop_active(v_shop,false); perform public.admin_set_shop_active(v_shop,true);
  perform public.admin_update_employee(v_staff,'Staff Updated','salesperson',v_shop,true);
  begin perform public.admin_update_employee(v_staff,'Staff Updated','manager',v_safe_shop,true); raise exception 'inactive shop assignment accepted'; exception when sqlstate '22023' then null; end;
  begin perform public.admin_update_employee(v_staff,'Staff Updated','manager',null,true); raise exception 'manager without shop accepted'; exception when sqlstate '22023' then null; end;

  -- A second active Owner allows the first Owner to deactivate; the inactive account immediately loses operational access.
  perform public.admin_update_employee(v_owner.id,coalesce(v_owner.full_name,''),'owner',v_owner.shop_id,false);
  begin perform public.get_dashboard_report('TODAY',null); raise exception 'inactive employee retained operational access'; exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claim.sub',v_second_owner::text,true);
  perform public.admin_update_employee(v_owner.id,coalesce(v_owner.full_name,''),'owner',v_owner.shop_id,true);
  perform public.admin_update_employee(v_owner.id,coalesce(v_owner.full_name,''),'manager',v_shop,true);
  begin perform public.admin_update_employee(v_second_employee,'Second Owner','salesperson',v_shop,true); raise exception 'last Owner downgrade accepted'; exception when sqlstate '22023' then null; end;

  perform set_config('request.jwt.claim.sub',v_owner.auth_user_id::text,true);
  begin perform public.admin_create_shop('Manager forbidden','NOPE7'); raise exception 'manager admin mutation accepted'; exception when insufficient_privilege then null; end;
  update public.employees set role='salesperson' where id=v_owner.id;
  begin perform public.admin_update_shop(v_shop,'Forbidden','NOPE8'); raise exception 'salesperson admin mutation accepted'; exception when insufficient_privilege then null; end;

  if has_table_privilege('authenticated','public.shops','INSERT') or has_table_privilege('authenticated','public.shops','UPDATE') or has_table_privilege('authenticated','public.employees','UPDATE') or has_table_privilege('authenticated','public.employees','DELETE') then raise exception 'direct administration writes remain exposed'; end if;
  if has_function_privilege('anon','public.admin_create_shop(text,text)','EXECUTE') then raise exception 'anonymous admin execution exposed'; end if;
  if pg_get_functiondef('public.admin_update_employee(uuid,text,text,uuid,boolean)'::regprocedure) not ilike '%pg_advisory_xact_lock%' then raise exception 'Owner transition serialization missing'; end if;
  if (select md5(coalesce(jsonb_agg(to_jsonb(s) order by id)::text,'')) from public.sales s)<>v_sales_hash or (select md5(coalesce(jsonb_agg(to_jsonb(si) order by id)::text,'')) from public.sale_items si)<>v_items_hash then raise exception 'administration changed historical sales'; end if;
end $$;
rollback;
