-- Rollback-only Task 12 schema and security verification.
begin;

do $$ begin
  if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='employees' and column_name='username') then raise exception 'username column missing';end if;
  if not exists(select 1 from pg_indexes where schemaname='public' and tablename='employees' and indexname='employees_username_unique') then raise exception 'username uniqueness missing';end if;
  if has_function_privilege('anon','public.admin_link_employee_account(uuid,text,text,text,uuid)','EXECUTE') then raise exception 'anonymous account linking exposed';end if;
  if not has_function_privilege('authenticated','public.admin_link_employee_account(uuid,text,text,text,uuid)','EXECUTE') then raise exception 'authenticated owner entry point missing';end if;
  if pg_get_constraintdef((select oid from pg_constraint where conrelid='public.inventory_items'::regclass and conname='inventory_items_status_check')) ilike '%RESERVED%' then raise exception 'RESERVED remains in inventory status constraint';end if;
  if pg_get_functiondef('public.get_dashboard_report(text,uuid)'::regprocedure) ilike '%v_period:=''TODAY''%' then raise exception 'salesperson reporting is still forced to today';end if;
end $$;

rollback;
