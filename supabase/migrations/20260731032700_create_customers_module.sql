-- =========================================================
-- ORDERPILOT PK — CUSTOMERS MODULE
-- =========================================================

begin;

-- ---------------------------------------------------------
-- 1. Normalize Pakistani customer phone numbers
-- ---------------------------------------------------------

create or replace function public.normalize_customer_phone(
  input_phone text
)
returns text
language plpgsql
immutable
as $$
declare
  digits text;
begin
  digits := regexp_replace(
    coalesce(input_phone, ''),
    '[^0-9]',
    '',
    'g'
  );

  if digits like '0092%' then
    digits := substring(digits from 3);
  end if;

  if digits like '92%' and length(digits) = 12 then
    digits := '0' || substring(digits from 3);
  end if;

  if digits like '3%' and length(digits) = 10 then
    digits := '0' || digits;
  end if;

  return digits;
end;
$$;


-- ---------------------------------------------------------
-- 2. Customers table
-- ---------------------------------------------------------

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),

  store_id uuid not null
    references public.stores(id)
    on delete cascade,

  name text not null,
  phone text not null,

  phone_normalized text generated always as (
    public.normalize_customer_phone(phone)
  ) stored,

  email text,
  city text,
  address text,
  notes text,

  first_order_at timestamptz,
  last_order_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint customers_store_phone_unique
    unique (store_id, phone_normalized),

  constraint customers_name_not_blank
    check (length(trim(name)) > 0),

  constraint customers_phone_not_blank
    check (length(trim(phone)) > 0)
);


-- ---------------------------------------------------------
-- 3. Customer indexes
-- ---------------------------------------------------------

create index if not exists customers_store_id_idx
  on public.customers(store_id);

create index if not exists customers_phone_normalized_idx
  on public.customers(phone_normalized);

create index if not exists customers_name_search_idx
  on public.customers(store_id, name);


-- ---------------------------------------------------------
-- 4. Automatically update customers.updated_at
-- ---------------------------------------------------------

create or replace function public.set_customer_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists customers_set_updated_at
on public.customers;

create trigger customers_set_updated_at
before update on public.customers
for each row
execute function public.set_customer_updated_at();


-- ---------------------------------------------------------
-- 5. Create or update customer from an order
-- ---------------------------------------------------------

create or replace function public.sync_customer_from_order()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  old_phone_normalized text;
begin
  insert into public.customers (
    store_id,
    name,
    phone,
    city,
    address,
    first_order_at,
    last_order_at
  )
  values (
    new.store_id,
    trim(new.customer_name),
    trim(new.customer_phone),
    nullif(trim(new.customer_city), ''),
    nullif(trim(new.customer_address), ''),
    new.created_at,
    new.created_at
  )
  on conflict (store_id, phone_normalized)
  do update set
    name = excluded.name,
    phone = excluded.phone,

    city = coalesce(
      excluded.city,
      public.customers.city
    ),

    address = coalesce(
      excluded.address,
      public.customers.address
    ),

    first_order_at = least(
      coalesce(
        public.customers.first_order_at,
        excluded.first_order_at
      ),
      excluded.first_order_at
    ),

    last_order_at = greatest(
      coalesce(
        public.customers.last_order_at,
        excluded.last_order_at
      ),
      excluded.last_order_at
    ),

    updated_at = now();

  if tg_op = 'UPDATE' then
    old_phone_normalized :=
      public.normalize_customer_phone(
        old.customer_phone
      );

    if old.store_id is distinct from new.store_id
       or old_phone_normalized is distinct from
          public.normalize_customer_phone(
            new.customer_phone
          )
    then
      delete from public.customers customer
      where customer.store_id = old.store_id
        and customer.phone_normalized =
            old_phone_normalized
        and not exists (
          select 1
          from public.orders existing_order
          where existing_order.store_id =
                customer.store_id
            and public.normalize_customer_phone(
              existing_order.customer_phone
            ) = customer.phone_normalized
        );
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists orders_sync_customer
on public.orders;

create trigger orders_sync_customer
after insert or update of
  customer_name,
  customer_phone,
  customer_city,
  customer_address
on public.orders
for each row
execute function public.sync_customer_from_order();


-- ---------------------------------------------------------
-- 6. Backfill customers from existing orders
-- ---------------------------------------------------------

insert into public.customers (
  store_id,
  name,
  phone,
  city,
  address,
  first_order_at,
  last_order_at
)
select distinct on (
  order_row.store_id,
  public.normalize_customer_phone(
    order_row.customer_phone
  )
)
  order_row.store_id,
  trim(order_row.customer_name),
  trim(order_row.customer_phone),

  nullif(
    trim(order_row.customer_city),
    ''
  ),

  nullif(
    trim(order_row.customer_address),
    ''
  ),

  min(order_row.created_at) over (
    partition by
      order_row.store_id,
      public.normalize_customer_phone(
        order_row.customer_phone
      )
  ),

  max(order_row.created_at) over (
    partition by
      order_row.store_id,
      public.normalize_customer_phone(
        order_row.customer_phone
      )
  )

from public.orders order_row

where trim(order_row.customer_phone) <> ''

order by
  order_row.store_id,
  public.normalize_customer_phone(
    order_row.customer_phone
  ),
  order_row.created_at desc

on conflict (store_id, phone_normalized)
do update set
  name = excluded.name,
  phone = excluded.phone,

  city = coalesce(
    excluded.city,
    public.customers.city
  ),

  address = coalesce(
    excluded.address,
    public.customers.address
  ),

  first_order_at = excluded.first_order_at,
  last_order_at = excluded.last_order_at,
  updated_at = now();


-- ---------------------------------------------------------
-- 7. Link orders with customers
-- ---------------------------------------------------------

alter table public.orders
add column if not exists customer_id uuid
references public.customers(id)
on delete set null;

create index if not exists orders_customer_id_idx
  on public.orders(customer_id);


-- Link existing orders with their customers

update public.orders order_row
set customer_id = customer.id
from public.customers customer
where customer.store_id = order_row.store_id
  and customer.phone_normalized =
      public.normalize_customer_phone(
        order_row.customer_phone
      )
  and order_row.customer_id is distinct from
      customer.id;


-- Automatically link future orders

create or replace function public.link_order_to_customer()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  matched_customer_id uuid;
begin
  select customer.id
  into matched_customer_id
  from public.customers customer
  where customer.store_id = new.store_id
    and customer.phone_normalized =
        public.normalize_customer_phone(
          new.customer_phone
        )
  limit 1;

  if matched_customer_id is not null
     and new.customer_id is distinct from
         matched_customer_id
  then
    update public.orders
    set customer_id = matched_customer_id
    where id = new.id;
  end if;

  return new;
end;
$$;

drop trigger if exists zz_orders_link_customer
on public.orders;

create trigger zz_orders_link_customer
after insert or update of
  customer_name,
  customer_phone,
  customer_city,
  customer_address
on public.orders
for each row
execute function public.link_order_to_customer();


-- ---------------------------------------------------------
-- 8. Customers Row Level Security
-- ---------------------------------------------------------

alter table public.customers
enable row level security;


drop policy if exists customers_select_own_store
on public.customers;

create policy customers_select_own_store
on public.customers
for select
to authenticated
using (
  exists (
    select 1
    from public.stores store
    where store.id = customers.store_id
      and store.owner_id = auth.uid()
  )
);


drop policy if exists customers_insert_own_store
on public.customers;

create policy customers_insert_own_store
on public.customers
for insert
to authenticated
with check (
  exists (
    select 1
    from public.stores store
    where store.id = customers.store_id
      and store.owner_id = auth.uid()
  )
);


drop policy if exists customers_update_own_store
on public.customers;

create policy customers_update_own_store
on public.customers
for update
to authenticated
using (
  exists (
    select 1
    from public.stores store
    where store.id = customers.store_id
      and store.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.stores store
    where store.id = customers.store_id
      and store.owner_id = auth.uid()
  )
);


drop policy if exists customers_delete_own_store
on public.customers;

create policy customers_delete_own_store
on public.customers
for delete
to authenticated
using (
  exists (
    select 1
    from public.stores store
    where store.id = customers.store_id
      and store.owner_id = auth.uid()
  )
);


-- Public visitors cannot read customer information

revoke all
on public.customers
from anon;

grant select, insert, update, delete
on public.customers
to authenticated;

commit;
