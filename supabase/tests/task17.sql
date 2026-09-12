-- Rollback-only structural checks; data-level dashboard tests remain in dashboard_reporting.sql.
begin;
do $$
declare definition text;
begin
  definition:=pg_get_functiondef('public.get_dashboard_report(text,uuid,date,date)'::regprocedure);
  if definition not ilike '%Europe/Kyiv%' or definition not ilike '%p_end_date + 1%' then raise exception 'inclusive Kyiv custom boundaries missing';end if;
  if definition not ilike '%count(si.id)%items_sold%' then raise exception 'daily physical sale-item count missing';end if;
  if definition ilike '%status_counts%REMOVED%' then raise exception 'removed status remains in dashboard summary';end if;
  if definition not ilike '%sold_at >= started%and%sold_at < ended%' then raise exception 'recent reporting is not period scoped';end if;
  if has_function_privilege('anon','public.get_dashboard_report(text,uuid,date,date)','EXECUTE') or not has_function_privilege('authenticated','public.get_dashboard_report(text,uuid,date,date)','EXECUTE') then raise exception 'custom dashboard grants incorrect';end if;
end $$;
rollback;
