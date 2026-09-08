-- Optional local/development seed. Safe to run more than once.
insert into public.shops (name, code)
values ('Main Shop', 'MAIN')
on conflict (code) do nothing;

insert into public.product_categories (name)
values
  ('Ring'),
  ('Earrings'),
  ('Chain'),
  ('Bracelet'),
  ('Pendant'),
  ('Necklace'),
  ('Other')
on conflict (name) do nothing;

