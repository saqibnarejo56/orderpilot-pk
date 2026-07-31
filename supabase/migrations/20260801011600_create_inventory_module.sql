-- =========================================================
-- ORDERPILOT PK — INVENTORY MANAGEMENT MODULE
-- =========================================================

begin;


-- =========================================================
-- 1. INVENTORY MOVEMENT LEDGER
-- =========================================================

create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),

  store_id uuid not null
    references public.stores(id)
    on delete cascade,

  product_id uuid
    references public.products(id)
    on delete set null,

  product_name text not null,
  product_sku text,

  order_id uuid
    references public.orders(id)
    on delete set null,

  order_number text,

  movement_type text not null,

  quantity_change integer not null,
  quantity_before integer not null,
  quantity_after integer not null,

  reason text not null,
  notes text,

  created_by uuid,
  created_at timestamptz not null default now(),

  constraint inventory_movement_type_valid
    check (
      movement_type in (
        'opening_balance',
        'order_reserved',
        'order_released',
        'manual_increase',
        'manual_decrease',
        'product_edit'
      )
    ),

  constraint inventory_quantity_change_not_zero
    check (quantity_change <> 0),

  constraint inventory_quantity_before_valid
    check (quantity_before >= 0),

  constraint inventory_quantity_after_valid
    check (quantity_after >= 0),

  constraint inventory_quantity_calculation_valid
    check (
      quantity_after =
      quantity_before + quantity_change
    ),

  constraint inventory_product_name_not_blank
    check (length(trim(product_name)) > 0),

  constraint inventory_reason_not_blank
    check (length(trim(reason)) > 0)
);


-- =========================================================
-- 2. INVENTORY INDEXES
-- =========================================================

create index if not exists
  inventory_movements_store_created_idx
on public.inventory_movements (
  store_id,
  created_at desc
);

create index if not exists
  inventory_movements_product_created_idx
on public.inventory_movements (
  product_id,
  created_at desc
);

create index if not exists
  inventory_movements_order_idx
on public.inventory_movements(order_id);

create index if not exists
  inventory_movements_type_idx
on public.inventory_movements (
  store_id,
  movement_type
);

create unique index if not exists
  inventory_one_opening_balance_per_product_idx
on public.inventory_movements(product_id)
where movement_type = 'opening_balance'
  and product_id is not null;


-- =========================================================
-- 3. AUTOMATIC PRODUCT STOCK MOVEMENT LOGGER
-- =========================================================

create or replace function
public.log_product_inventory_movement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_movement_type text;
  selected_reason text;
  selected_notes text;

  selected_order_id uuid;
  selected_order_id_text text;
  selected_order_number text;

  previous_quantity integer;
  updated_quantity integer;
  changed_quantity integer;
begin
  -- New product opening stock

  if tg_op = 'INSERT' then
    previous_quantity := 0;

    updated_quantity := coalesce(
      new.stock_quantity,
      0
    );

    changed_quantity :=
      updated_quantity - previous_quantity;

    if changed_quantity = 0 then
      return new;
    end if;

    selected_movement_type :=
      'opening_balance';

    selected_reason :=
      'Initial stock recorded when the product was created.';

    selected_notes := null;

  -- Existing product stock change

  else
    previous_quantity := coalesce(
      old.stock_quantity,
      0
    );

    updated_quantity := coalesce(
      new.stock_quantity,
      0
    );

    changed_quantity :=
      updated_quantity - previous_quantity;

    if changed_quantity = 0 then
      return new;
    end if;

    selected_movement_type :=
      coalesce(
        nullif(
          current_setting(
            'orderpilot.inventory_movement_type',
            true
          ),
          ''
        ),
        'product_edit'
      );

    if selected_movement_type not in (
      'opening_balance',
      'order_reserved',
      'order_released',
      'manual_increase',
      'manual_decrease',
      'product_edit'
    ) then
      selected_movement_type :=
        'product_edit';
    end if;

    selected_reason :=
      coalesce(
        nullif(
          current_setting(
            'orderpilot.inventory_reason',
            true
          ),
          ''
        ),
        'Stock quantity changed from product management.'
      );

    selected_notes :=
      nullif(
        current_setting(
          'orderpilot.inventory_notes',
          true
        ),
        ''
      );

    selected_order_id_text :=
      nullif(
        current_setting(
          'orderpilot.inventory_order_id',
          true
        ),
        ''
      );

    if selected_order_id_text is not null
       and selected_order_id_text ~*
       '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then
      selected_order_id :=
        selected_order_id_text::uuid;

      select orders.order_number
      into selected_order_number
      from public.orders
      where orders.id = selected_order_id;
    end if;
  end if;


  insert into public.inventory_movements (
    store_id,
    product_id,
    product_name,
    product_sku,
    order_id,
    order_number,
    movement_type,
    quantity_change,
    quantity_before,
    quantity_after,
    reason,
    notes,
    created_by
  )
  values (
    new.store_id,
    new.id,
    new.name,
    new.sku,
    selected_order_id,
    selected_order_number,
    selected_movement_type,
    changed_quantity,
    previous_quantity,
    updated_quantity,
    selected_reason,
    selected_notes,
    auth.uid()
  );

  return new;
end;
$$;


-- =========================================================
-- 4. PRODUCT INVENTORY TRIGGERS
-- =========================================================

drop trigger if exists
  products_log_opening_inventory
on public.products;

create trigger
  products_log_opening_inventory
after insert
on public.products
for each row
execute function
  public.log_product_inventory_movement();


drop trigger if exists
  products_log_stock_change
on public.products;

create trigger
  products_log_stock_change
after update of stock_quantity
on public.products
for each row
when (
  old.stock_quantity is distinct from
  new.stock_quantity
)
execute function
  public.log_product_inventory_movement();


-- =========================================================
-- 5. EXISTING PRODUCT OPENING-BALANCE BACKFILL
-- =========================================================

insert into public.inventory_movements (
  store_id,
  product_id,
  product_name,
  product_sku,
  movement_type,
  quantity_change,
  quantity_before,
  quantity_after,
  reason,
  created_by
)
select
  product.store_id,
  product.id,
  product.name,
  product.sku,
  'opening_balance',
  product.stock_quantity,
  0,
  product.stock_quantity,
  'Opening balance captured when the Inventory Module was enabled.',
  null
from public.products product
where product.stock_quantity > 0
  and not exists (
    select 1
    from public.inventory_movements movement
    where movement.product_id = product.id
      and movement.movement_type =
          'opening_balance'
  );


-- =========================================================
-- 6. INVENTORY ROW LEVEL SECURITY
-- =========================================================

alter table public.inventory_movements
enable row level security;


drop policy if exists
  inventory_movements_select_own_store
on public.inventory_movements;

create policy
  inventory_movements_select_own_store
on public.inventory_movements
for select
to authenticated
using (
  exists (
    select 1
    from public.stores store
    where store.id =
          inventory_movements.store_id
      and store.owner_id = auth.uid()
  )
);


-- Inventory history is immutable for sellers.
-- Records are created through trusted functions and triggers.

revoke all
on public.inventory_movements
from anon;

revoke insert, update, delete
on public.inventory_movements
from authenticated;

grant select
on public.inventory_movements
to authenticated;


revoke all
on function
public.log_product_inventory_movement()
from public;


-- =========================================================
-- 7. CONNECT ORDER STOCK CHANGES TO INVENTORY HISTORY
-- =========================================================

create or replace function public.sync_order_stock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  item record;
  available_stock integer;
  order_item_count integer;
  movement_reason text;
begin
  /*
    Stock-holding statuses:

    confirmed
    processing
    shipped
    delivered
  */

  if new.status in (
      'confirmed',
      'processing',
      'shipped',
      'delivered'
    )
    and old.stock_deducted = false
  then

    select count(*)
    into order_item_count
    from public.order_items
    where order_id = new.id;

    if order_item_count = 0 then
      raise exception
        'An order cannot be confirmed without at least one product.';
    end if;


    -- Validate and lock every selected product

    for item in
      select
        order_item.product_id,

        sum(
          order_item.quantity
        )::integer as required_quantity,

        max(
          order_item.product_name
        ) as product_name

      from public.order_items order_item

      where order_item.order_id = new.id

      group by order_item.product_id

      order by order_item.product_id
    loop
      if item.product_id is null then
        raise exception
          'Product "%" is no longer available.',
          item.product_name;
      end if;

      select product.stock_quantity
      into available_stock
      from public.products product
      where product.id = item.product_id
        and product.store_id = new.store_id
      for update;

      if not found then
        raise exception
          'Product "%" does not belong to this store or no longer exists.',
          item.product_name;
      end if;

      if available_stock <
         item.required_quantity
      then
        raise exception
          'Insufficient stock for "%". Available: %, Required: %.',
          item.product_name,
          available_stock,
          item.required_quantity;
      end if;
    end loop;


    -- Pass inventory context to the product audit trigger

    perform set_config(
      'orderpilot.inventory_movement_type',
      'order_reserved',
      true
    );

    perform set_config(
      'orderpilot.inventory_reason',
      format(
        'Stock reserved for order %s.',
        coalesce(
          new.order_number,
          new.id::text
        )
      ),
      true
    );

    perform set_config(
      'orderpilot.inventory_notes',
      format(
        'Order status changed from %s to %s.',
        old.status,
        new.status
      ),
      true
    );

    perform set_config(
      'orderpilot.inventory_order_id',
      new.id::text,
      true
    );


    -- Deduct product stock

    update public.products as product
    set stock_quantity =
      product.stock_quantity -
      quantities.required_quantity

    from (
      select
        order_item.product_id,

        sum(
          order_item.quantity
        )::integer as required_quantity

      from public.order_items order_item

      where order_item.order_id = new.id
        and order_item.product_id is not null

      group by order_item.product_id
    ) as quantities

    where product.id =
          quantities.product_id

      and product.store_id =
          new.store_id;


    -- Clear temporary inventory context

    perform set_config(
      'orderpilot.inventory_movement_type',
      '',
      true
    );

    perform set_config(
      'orderpilot.inventory_reason',
      '',
      true
    );

    perform set_config(
      'orderpilot.inventory_notes',
      '',
      true
    );

    perform set_config(
      'orderpilot.inventory_order_id',
      '',
      true
    );

    new.stock_deducted := true;


  elsif new.status not in (
      'confirmed',
      'processing',
      'shipped',
      'delivered'
    )
    and old.stock_deducted = true
  then

    movement_reason :=
      case new.status
        when 'pending' then
          format(
            'Stock released because order %s returned to Pending.',
            coalesce(
              new.order_number,
              new.id::text
            )
          )

        when 'cancelled' then
          format(
            'Stock restored because order %s was cancelled.',
            coalesce(
              new.order_number,
              new.id::text
            )
          )

        when 'returned' then
          format(
            'Stock restored because order %s was returned.',
            coalesce(
              new.order_number,
              new.id::text
            )
          )

        else
          format(
            'Stock released for order %s.',
            coalesce(
              new.order_number,
              new.id::text
            )
          )
      end;


    -- Pass restoration context to product audit trigger

    perform set_config(
      'orderpilot.inventory_movement_type',
      'order_released',
      true
    );

    perform set_config(
      'orderpilot.inventory_reason',
      movement_reason,
      true
    );

    perform set_config(
      'orderpilot.inventory_notes',
      format(
        'Order status changed from %s to %s.',
        old.status,
        new.status
      ),
      true
    );

    perform set_config(
      'orderpilot.inventory_order_id',
      new.id::text,
      true
    );


    -- Restore product stock

    update public.products as product
    set stock_quantity =
      product.stock_quantity +
      quantities.restore_quantity

    from (
      select
        order_item.product_id,

        sum(
          order_item.quantity
        )::integer as restore_quantity

      from public.order_items order_item

      where order_item.order_id = new.id
        and order_item.product_id is not null

      group by order_item.product_id
    ) as quantities

    where product.id =
          quantities.product_id

      and product.store_id =
          new.store_id;


    -- Clear temporary inventory context

    perform set_config(
      'orderpilot.inventory_movement_type',
      '',
      true
    );

    perform set_config(
      'orderpilot.inventory_reason',
      '',
      true
    );

    perform set_config(
      'orderpilot.inventory_notes',
      '',
      true
    );

    perform set_config(
      'orderpilot.inventory_order_id',
      '',
      true
    );

    new.stock_deducted := false;


  else
    /*
      Prevent stock_deducted from
      being manually changed.
    */

    new.stock_deducted :=
      old.stock_deducted;
  end if;

  return new;
end;
$$;


-- =========================================================
-- 8. MANUAL STOCK ADJUSTMENT RPC
-- =========================================================

create or replace function public.adjust_inventory_stock(
  p_product_id uuid,
  p_quantity_change integer,
  p_reason text,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_product public.products%rowtype;

  previous_quantity integer;
  updated_quantity integer;

  clean_reason text;
  clean_notes text;

  selected_movement_type text;
begin
  if auth.uid() is null then
    raise exception
      'You must be signed in to adjust inventory.';
  end if;

  if p_quantity_change is null
     or p_quantity_change = 0
  then
    raise exception
      'Stock adjustment quantity cannot be zero.';
  end if;

  clean_reason :=
    trim(
      coalesce(
        p_reason,
        ''
      )
    );

  clean_notes :=
    nullif(
      trim(
        coalesce(
          p_notes,
          ''
        )
      ),
      ''
    );

  if length(clean_reason) < 3 then
    raise exception
      'Enter a valid reason for this stock adjustment.';
  end if;


  -- Verify store ownership and lock product

  select product.*
  into selected_product
  from public.products product

  join public.stores store
    on store.id = product.store_id

  where product.id = p_product_id
    and store.owner_id = auth.uid()

  for update of product;

  if not found then
    raise exception
      'Product could not be found or you do not have permission to adjust it.';
  end if;


  previous_quantity :=
    coalesce(
      selected_product.stock_quantity,
      0
    );

  updated_quantity :=
    previous_quantity +
    p_quantity_change;

  if updated_quantity < 0 then
    raise exception
      'Stock cannot become negative. Current stock: %, requested change: %.',
      previous_quantity,
      p_quantity_change;
  end if;


  selected_movement_type :=
    case
      when p_quantity_change > 0 then
        'manual_increase'
      else
        'manual_decrease'
    end;


  -- Pass adjustment context to audit trigger

  perform set_config(
    'orderpilot.inventory_movement_type',
    selected_movement_type,
    true
  );

  perform set_config(
    'orderpilot.inventory_reason',
    clean_reason,
    true
  );

  perform set_config(
    'orderpilot.inventory_notes',
    coalesce(
      clean_notes,
      ''
    ),
    true
  );

  perform set_config(
    'orderpilot.inventory_order_id',
    '',
    true
  );


  -- Atomic stock update

  update public.products
  set stock_quantity = updated_quantity
  where id = selected_product.id;


  -- Clear temporary inventory context

  perform set_config(
    'orderpilot.inventory_movement_type',
    '',
    true
  );

  perform set_config(
    'orderpilot.inventory_reason',
    '',
    true
  );

  perform set_config(
    'orderpilot.inventory_notes',
    '',
    true
  );

  perform set_config(
    'orderpilot.inventory_order_id',
    '',
    true
  );


  return jsonb_build_object(
    'product_id',
    selected_product.id,

    'product_name',
    selected_product.name,

    'quantity_change',
    p_quantity_change,

    'quantity_before',
    previous_quantity,

    'quantity_after',
    updated_quantity,

    'movement_type',
    selected_movement_type
  );


exception
  when others then
    perform set_config(
      'orderpilot.inventory_movement_type',
      '',
      true
    );

    perform set_config(
      'orderpilot.inventory_reason',
      '',
      true
    );

    perform set_config(
      'orderpilot.inventory_notes',
      '',
      true
    );

    perform set_config(
      'orderpilot.inventory_order_id',
      '',
      true
    );

    raise;
end;
$$;


-- =========================================================
-- 9. MANUAL ADJUSTMENT PERMISSIONS
-- =========================================================

revoke all
on function public.adjust_inventory_stock(
  uuid,
  integer,
  text,
  text
)
from public;

revoke all
on function public.adjust_inventory_stock(
  uuid,
  integer,
  text,
  text
)
from anon;

grant execute
on function public.adjust_inventory_stock(
  uuid,
  integer,
  text,
  text
)
to authenticated;


commit;
