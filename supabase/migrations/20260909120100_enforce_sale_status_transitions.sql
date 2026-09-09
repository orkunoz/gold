-- A SOLD status represents immutable sale history and may only be written by
-- the SECURITY DEFINER complete_sale transaction. Ordinary inventory clients
-- cannot create SOLD rows, mark rows SOLD, or modify an already-sold row.

drop policy inventory_insert_owner_or_manager on public.inventory_items;
drop policy inventory_update_owner_or_manager on public.inventory_items;

create policy inventory_insert_owner_or_manager on public.inventory_items
for insert to authenticated
with check (
  status <> 'SOLD'
  and (
    (select public.is_owner())
    or (
      (select public.current_employee_role()) = 'manager'
      and shop_id = (select public.current_employee_shop_id())
    )
  )
);

create policy inventory_update_owner_or_manager on public.inventory_items
for update to authenticated
using (
  status <> 'SOLD'
  and (
    (select public.is_owner())
    or (
      (select public.current_employee_role()) = 'manager'
      and shop_id = (select public.current_employee_shop_id())
    )
  )
)
with check (
  status <> 'SOLD'
  and (
    (select public.is_owner())
    or (
      (select public.current_employee_role()) = 'manager'
      and shop_id = (select public.current_employee_shop_id())
    )
  )
);
