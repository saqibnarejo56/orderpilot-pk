-- =========================================================
-- ORDERPILOT PK â€” RETURNS MANAGEMENT MODULE
-- =========================================================

begin;


-- =========================================================
-- 1. RETURN NUMBER SEQUENCE
-- =========================================================

create sequence if not exists public.return_number_seq
start with 1
increment by 1;


-- =========================================================
-- 2. RETURNS TABLE
-- =========================================================

create table if not exists public.returns (
  id uuid primary key default gen_random_uuid(),

  store_id uuid not null
    references public.stores(id)
    on delete cascade,

  order_id uuid not null
    references public.orders(id)
    on delete restrict,

  return_number text not null
    unique
    default (
      'RT-' ||
      lpad(
        nextval('public.return_number_seq'::regclass)::text,
        6,
        '0'
      )
    ),

  status text not null
    default 'requested',

  reason text not null,
  notes text,

  return_value numeric(12,2)
    not null
    default 0,

  refund_amount numeric(12,2)
    not null
    default 0,

  refund_status text not null
    default 'none',

  review_notes text,

  created_by uuid not null,
  reviewed_by uuid,
  completed_by uuid,

  created_at timestamptz
    not null
    default now(),

  updated_at timestamptz
    not null
    default now(),

  reviewed_at timestamptz,
  completed_at timestamptz,

  constraint returns_status_valid
    check (
      status in (
        'requested',
        'approved',
        'rejected',
        'completed'
      )
    ),

  constraint returns_reason_valid
    check (
      reason in (
        'damaged',
        'wrong_item',
        'size_issue',
        'quality_issue',
        'customer_changed_mind',
        'other'
      )
    ),

  constraint returns_return_value_nonnegative
    check (
      return_value >= 0
    ),

  constraint returns_refund_amount_nonnegative
    check (
      refund_amount >= 0
    ),

  constraint returns_refund_not_above_return_value
    check (
      refund_amount <= return_value
    ),

  constraint returns_refund_status_valid
    check (
      refund_status in (
        'none',
        'pending',
        'refunded'
      )
    )
);


-- =========================================================
-- 3. RETURN ITEMS TABLE
-- =========================================================

create table if not exists public.return_items (
  id uuid primary key default gen_random_uuid(),

  return_id uuid not null
    references public.returns(id)
    on delete cascade,

  order_item_id uuid not null
    references public.order_items(id)
    on delete restrict,

  product_id uuid
    references public.products(id)
    on delete set null,

  product_name text not null,
  product_sku text,

  quantity integer not null,

  unit_price numeric(12,2)
    not null,

  unit_cost numeric(12,2)
    not null,

  return_value numeric(12,2)
    not null,

  restock boolean
    not null
    default true,

  created_at timestamptz
    not null
    default now(),

  constraint return_items_quantity_positive
    check (
      quantity > 0
    ),

  constraint return_items_unit_price_nonnegative
    check (
      unit_price >= 0
    ),

  constraint return_items_unit_cost_nonnegative
    check (
      unit_cost >= 0
    ),

  constraint return_items_value_nonnegative
    check (
      return_value >= 0
    ),

  constraint return_items_value_matches_quantity
    check (
      return_value =
      unit_price * quantity
    ),

  constraint return_items_one_order_item_per_return
    unique (
      return_id,
      order_item_id
    )
);


-- =========================================================
-- 4. INDEXES
-- =========================================================

create index if not exists
  returns_store_created_idx
on public.returns (
  store_id,
  created_at desc
);

create index if not exists
  returns_order_created_idx
on public.returns (
  order_id,
  created_at desc
);

create index if not exists
  returns_store_status_idx
on public.returns (
  store_id,
  status
);

create index if not exists
  return_items_return_idx
on public.return_items (
  return_id
);

create index if not exists
  return_items_order_item_idx
on public.return_items (
  order_item_id
);

create index if not exists
  return_items_product_idx
on public.return_items (
  product_id
);


-- =========================================================
-- 5. UPDATED AT FUNCTION + TRIGGER
-- =========================================================

create or replace function public.set_return_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();

  return new;
end;
$$;


drop trigger if exists
  returns_set_updated_at
on public.returns;

create trigger
  returns_set_updated_at
before update
on public.returns
for each row
execute function
  public.set_return_updated_at();


revoke all
on function public.set_return_updated_at()
from public;


-- =========================================================
-- 6. ROW LEVEL SECURITY
-- =========================================================

alter table public.returns
enable row level security;

alter table public.return_items
enable row level security;


-- ---------------------------------------------------------
-- RETURNS SELECT POLICY
-- ---------------------------------------------------------

drop policy if exists
  returns_select_own_store
on public.returns;

create policy
  returns_select_own_store
on public.returns
for select
to authenticated
using (
  exists (
    select 1
    from public.stores store
    where store.id = returns.store_id
      and store.owner_id = auth.uid()
  )
);


-- ---------------------------------------------------------
-- RETURN ITEMS SELECT POLICY
-- ---------------------------------------------------------

drop policy if exists
  return_items_select_own_store
on public.return_items;

create policy
  return_items_select_own_store
on public.return_items
for select
to authenticated
using (
  exists (
    select 1
    from public.returns return_record

    join public.stores store
      on store.id =
         return_record.store_id

    where return_record.id =
          return_items.return_id

      and store.owner_id =
          auth.uid()
  )
);


-- ---------------------------------------------------------
-- DIRECT WRITE PERMISSIONS
-- ---------------------------------------------------------

revoke all
on public.returns
from anon;

revoke all
on public.return_items
from anon;


revoke insert, update, delete
on public.returns
from authenticated;

revoke insert, update, delete
on public.return_items
from authenticated;


grant select
on public.returns
to authenticated;

grant select
on public.return_items
to authenticated;


-- =========================================================
-- 7. CREATE RETURN RPC
-- =========================================================

create or replace function public.create_return(
  p_order_id uuid,
  p_reason text,
  p_notes text,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_order record;
  selected_item record;

  item_json jsonb;

  selected_order_item_id uuid;
  selected_quantity integer;
  selected_restock boolean;

  already_returned_quantity integer;

  new_return_id uuid;
  new_return_number text;

  total_return_value numeric(12,2)
    := 0;

  clean_reason text;
  clean_notes text;

  seen_order_items uuid[]
    := array[]::uuid[];

begin

  -- -------------------------------------------------------
  -- AUTH
  -- -------------------------------------------------------

  if auth.uid() is null then
    raise exception
      'You must be signed in to create a return.';
  end if;


  -- -------------------------------------------------------
  -- CLEAN INPUT
  -- -------------------------------------------------------

  clean_reason :=
    lower(
      trim(
        coalesce(
          p_reason,
          ''
        )
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


  -- -------------------------------------------------------
  -- VALIDATE REASON
  -- -------------------------------------------------------

  if clean_reason not in (
      'damaged',
      'wrong_item',
      'size_issue',
      'quality_issue',
      'customer_changed_mind',
      'other'
    )
  then
    raise exception
      'Select a valid return reason.';
  end if;


  -- -------------------------------------------------------
  -- VALIDATE ITEMS JSON
  -- -------------------------------------------------------

  if p_items is null
     or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0
  then
    raise exception
      'Select at least one item to return.';
  end if;


  -- -------------------------------------------------------
  -- LOAD + LOCK ORDER
  -- -------------------------------------------------------

  select
    orders.id,
    orders.store_id,
    orders.order_number,
    orders.status,
    orders.stock_deducted
  into selected_order

  from public.orders

  join public.stores
    on stores.id =
       orders.store_id

  where orders.id =
        p_order_id

    and stores.owner_id =
        auth.uid()

  for update of orders;


  if not found then
    raise exception
      'Order could not be found or does not belong to your store.';
  end if;


  -- -------------------------------------------------------
  -- RETURN ELIGIBILITY
  -- -------------------------------------------------------

  /*
    Dedicated customer returns are available only
    once the order is Shipped or Delivered.

    Confirmed / Processing orders should use the
    cancellation workflow instead.
  */

  if selected_order.status not in (
      'shipped',
      'delivered'
    )
  then
    raise exception
      'Returns can only be created for Shipped or Delivered orders.';
  end if;


  if selected_order.stock_deducted = false then
    raise exception
      'This order does not currently hold reserved stock.';
  end if;


  -- -------------------------------------------------------
  -- CREATE RETURN HEADER
  -- -------------------------------------------------------

  insert into public.returns (
    store_id,
    order_id,
    reason,
    notes,
    created_by
  )
  values (
    selected_order.store_id,
    selected_order.id,
    clean_reason,
    clean_notes,
    auth.uid()
  )
  returning
    id,
    return_number
  into
    new_return_id,
    new_return_number;


  -- -------------------------------------------------------
  -- PROCESS RETURN ITEMS
  -- -------------------------------------------------------

  for item_json in

    select value
    from jsonb_array_elements(
      p_items
    )

  loop

    -- -----------------------------------------------------
    -- READ JSON ITEM
    -- -----------------------------------------------------

    begin

      selected_order_item_id :=
        (item_json ->> 'order_item_id')::uuid;

      selected_quantity :=
        (item_json ->> 'quantity')::integer;

      selected_restock :=
        coalesce(
          (item_json ->> 'restock')::boolean,
          true
        );

    exception
      when others then

        raise exception
          'Each return item must contain a valid order_item_id, quantity and restock value.';

    end;


    -- -----------------------------------------------------
    -- VALIDATE BASIC ITEM INPUT
    -- -----------------------------------------------------

    if selected_order_item_id is null then
      raise exception
        'Return item is missing its order item reference.';
    end if;


    if selected_quantity is null
       or selected_quantity <= 0
    then
      raise exception
        'Returned quantity must be greater than zero.';
    end if;


    -- -----------------------------------------------------
    -- DUPLICATE ITEM IN SAME REQUEST
    -- -----------------------------------------------------

    if selected_order_item_id =
       any(
         seen_order_items
       )
    then
      raise exception
        'The same order item cannot be added to one return more than once.';
    end if;


    seen_order_items :=
      array_append(
        seen_order_items,
        selected_order_item_id
      );


    -- -----------------------------------------------------
    -- LOAD ORIGINAL ORDER ITEM
    -- -----------------------------------------------------

    select
      order_item.id,
      order_item.product_id,
      order_item.product_name,
      order_item.product_sku,
      order_item.quantity,
      order_item.unit_price,
      order_item.unit_cost
    into selected_item

    from public.order_items
      as order_item

    where order_item.id =
          selected_order_item_id

      and order_item.order_id =
          selected_order.id;


    if not found then
      raise exception
        'One of the selected items does not belong to this order.';
    end if;


    -- -----------------------------------------------------
    -- CALCULATE PREVIOUS ACTIVE/COMPLETED RETURNS
    -- -----------------------------------------------------

    select
      coalesce(
        sum(
          return_item.quantity
        ),
        0
      )::integer
    into already_returned_quantity

    from public.return_items
      as return_item

    join public.returns
      as existing_return

      on existing_return.id =
         return_item.return_id

    where return_item.order_item_id =
          selected_order_item_id

      and existing_return.status in (
        'requested',
        'approved',
        'completed'
      );


    -- -----------------------------------------------------
    -- PREVENT OVER-RETURN
    -- -----------------------------------------------------

    if selected_quantity >
       (
         selected_item.quantity -
         already_returned_quantity
       )
    then
      raise exception
        'Return quantity for "%" exceeds the remaining returnable quantity.',
        selected_item.product_name;
    end if;


    -- -----------------------------------------------------
    -- INSERT RETURN ITEM SNAPSHOT
    -- -----------------------------------------------------

    insert into public.return_items (
      return_id,
      order_item_id,
      product_id,
      product_name,
      product_sku,
      quantity,
      unit_price,
      unit_cost,
      return_value,
      restock
    )
    values (
      new_return_id,
      selected_item.id,
      selected_item.product_id,
      selected_item.product_name,
      selected_item.product_sku,
      selected_quantity,
      selected_item.unit_price,
      selected_item.unit_cost,
      selected_item.unit_price *
      selected_quantity,
      selected_restock
    );


    -- -----------------------------------------------------
    -- RETURN VALUE
    -- -----------------------------------------------------

    total_return_value :=
      total_return_value +
      (
        selected_item.unit_price *
        selected_quantity
      );

  end loop;


  -- -------------------------------------------------------
  -- SAVE RETURN VALUE
  -- -------------------------------------------------------

  update public.returns
  set return_value =
      total_return_value
  where id =
        new_return_id;


  -- -------------------------------------------------------
  -- RESPONSE
  -- -------------------------------------------------------

  return jsonb_build_object(
    'id',
    new_return_id,

    'return_number',
    new_return_number,

    'status',
    'requested',

    'return_value',
    total_return_value
  );

end;
$$;


-- =========================================================
-- 8. REVIEW RETURN RPC
-- =========================================================

create or replace function public.review_return(
  p_return_id uuid,
  p_decision text,
  p_review_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_return record;

  clean_decision text;
  clean_review_notes text;

begin

  -- -------------------------------------------------------
  -- AUTH
  -- -------------------------------------------------------

  if auth.uid() is null then
    raise exception
      'You must be signed in to review a return.';
  end if;


  -- -------------------------------------------------------
  -- CLEAN INPUT
  -- -------------------------------------------------------

  clean_decision :=
    lower(
      trim(
        coalesce(
          p_decision,
          ''
        )
      )
    );


  clean_review_notes :=
    nullif(
      trim(
        coalesce(
          p_review_notes,
          ''
        )
      ),
      ''
    );


  -- -------------------------------------------------------
  -- VALIDATE DECISION
  -- -------------------------------------------------------

  if clean_decision not in (
      'approved',
      'rejected'
    )
  then
    raise exception
      'Return decision must be Approved or Rejected.';
  end if;


  -- -------------------------------------------------------
  -- LOAD + LOCK RETURN
  -- -------------------------------------------------------

  select
    return_record.id,
    return_record.return_number,
    return_record.status
  into selected_return

  from public.returns
    as return_record

  join public.stores
    as store

    on store.id =
       return_record.store_id

  where return_record.id =
        p_return_id

    and store.owner_id =
        auth.uid()

  for update of return_record;


  if not found then
    raise exception
      'Return could not be found or does not belong to your store.';
  end if;


  -- -------------------------------------------------------
  -- ONLY REQUESTED RETURNS CAN BE REVIEWED
  -- -------------------------------------------------------

  if selected_return.status <>
     'requested'
  then
    raise exception
      'Only Requested returns can be reviewed.';
  end if;


  -- -------------------------------------------------------
  -- SAVE DECISION
  -- -------------------------------------------------------

  update public.returns
  set
    status =
      clean_decision,

    review_notes =
      clean_review_notes,

    reviewed_by =
      auth.uid(),

    reviewed_at =
      now()

  where id =
        selected_return.id;


  -- -------------------------------------------------------
  -- RESPONSE
  -- -------------------------------------------------------

  return jsonb_build_object(
    'id',
    selected_return.id,

    'return_number',
    selected_return.return_number,

    'status',
    clean_decision
  );

end;
$$;


-- =========================================================
-- 9. COMPLETE RETURN RPC
-- =========================================================

create or replace function public.complete_return(
  p_return_id uuid,
  p_refund_amount numeric default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_return record;
  selected_order record;

  item record;

  requested_refund numeric(12,2);

  previous_return_refunds numeric(12,2);

  refundable_amount numeric(12,2);

begin

  -- -------------------------------------------------------
  -- AUTH
  -- -------------------------------------------------------

  if auth.uid() is null then
    raise exception
      'You must be signed in to complete a return.';
  end if;


  requested_refund :=
    coalesce(
      p_refund_amount,
      0
    );


  if requested_refund < 0 then
    raise exception
      'Refund amount cannot be negative.';
  end if;


  -- -------------------------------------------------------
  -- LOAD + LOCK RETURN
  -- -------------------------------------------------------

  select
    return_record.id,
    return_record.store_id,
    return_record.order_id,
    return_record.return_number,
    return_record.status,
    return_record.return_value
  into selected_return

  from public.returns
    as return_record

  join public.stores
    as store

    on store.id =
       return_record.store_id

  where return_record.id =
        p_return_id

    and store.owner_id =
        auth.uid()

  for update of return_record;


  if not found then
    raise exception
      'Return could not be found or does not belong to your store.';
  end if;


  -- -------------------------------------------------------
  -- MUST BE APPROVED
  -- -------------------------------------------------------

  if selected_return.status <>
     'approved'
  then
    raise exception
      'Only Approved returns can be completed.';
  end if;


  -- -------------------------------------------------------
  -- REFUND CANNOT EXCEED THIS RETURN VALUE
  -- -------------------------------------------------------

  if requested_refund >
     selected_return.return_value
  then
    raise exception
      'Refund amount cannot be greater than the value of this return. Maximum refundable return value: %.',
      selected_return.return_value;
  end if;


  -- -------------------------------------------------------
  -- LOAD + LOCK ORIGINAL ORDER
  -- -------------------------------------------------------

  select
    orders.id,
    orders.order_number,
    orders.status,
    orders.stock_deducted,
    orders.paid_amount,
    orders.refunded_amount
  into selected_order

  from public.orders

  where orders.id =
        selected_return.order_id

    and orders.store_id =
        selected_return.store_id

  for update;


  if not found then
    raise exception
      'The original order could not be found.';
  end if;


  -- -------------------------------------------------------
  -- VERIFY STOCK-HOLDING ORDER STATE
  -- -------------------------------------------------------

  if selected_order.status not in (
      'shipped',
      'delivered'
    )
     or selected_order.stock_deducted = false
  then
    raise exception
      'The order is no longer eligible for return completion because its stock state has changed.';
  end if;


  -- -------------------------------------------------------
  -- PREVIOUS DEDICATED RETURN REFUNDS
  -- -------------------------------------------------------

  select
    coalesce(
      sum(
        return_record.refund_amount
      ),
      0
    )
  into previous_return_refunds

  from public.returns
    as return_record

  where return_record.order_id =
        selected_return.order_id

    and return_record.id <>
        selected_return.id

    and return_record.status =
        'completed';


  -- -------------------------------------------------------
  -- MAXIMUM REMAINING CASH REFUND
  -- -------------------------------------------------------

  refundable_amount :=
    greatest(
      (
        coalesce(
          selected_order.paid_amount,
          0
        )

        -

        coalesce(
          selected_order.refunded_amount,
          0
        )

        -

        previous_return_refunds
      ),
      0
    );


  if requested_refund >
     refundable_amount
  then
    raise exception
      'Refund amount exceeds the remaining amount collected from this order. Maximum refundable amount: %.',
      refundable_amount;
  end if;


  -- -------------------------------------------------------
  -- RESTOCK EXACT RETURNED QUANTITIES
  -- -------------------------------------------------------

  /*
    IMPORTANT:

    We intentionally do NOT change the original
    order status to legacy "returned".

    Existing sync_order_stock() restores the
    entire original order when status becomes
    returned.

    Dedicated Returns Management restores only
    the exact returned quantities.
  */

  for item in

    select
      return_item.product_id,
      return_item.product_name,
      return_item.quantity,
      return_item.restock

    from public.return_items
      as return_item

    where return_item.return_id =
          selected_return.id

    order by return_item.id

  loop

    if item.restock then

      if item.product_id is null then
        raise exception
          'Product "%" no longer exists and cannot be restocked automatically.',
          item.product_name;
      end if;


      -- ---------------------------------------------------
      -- INVENTORY AUDIT CONTEXT
      -- ---------------------------------------------------

      perform set_config(
        'orderpilot.inventory_movement_type',
        'order_released',
        true
      );


      perform set_config(
        'orderpilot.inventory_reason',
        format(
          'Return %s restocked %s unit(s) from order %s.',
          selected_return.return_number,
          item.quantity,
          selected_order.order_number
        ),
        true
      );


      perform set_config(
        'orderpilot.inventory_notes',
        'Stock restored through the dedicated Returns Management module.',
        true
      );


      perform set_config(
        'orderpilot.inventory_order_id',
        selected_order.id::text,
        true
      );


      -- ---------------------------------------------------
      -- RESTOCK PRODUCT
      -- ---------------------------------------------------

      update public.products
      set stock_quantity =
          stock_quantity +
          item.quantity

      where id =
            item.product_id

        and store_id =
            selected_return.store_id;


      if not found then
        raise exception
          'Product "%" does not belong to this store or no longer exists.',
          item.product_name;
      end if;

    end if;

  end loop;


  -- -------------------------------------------------------
  -- CLEAR INVENTORY AUDIT CONTEXT
  -- -------------------------------------------------------

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


  -- -------------------------------------------------------
  -- COMPLETE RETURN
  -- -------------------------------------------------------

  update public.returns
  set
    status =
      'completed',

    refund_amount =
      requested_refund,

    refund_status =
      case
        when requested_refund > 0
          then 'refunded'
        else
          'none'
      end,

    completed_by =
      auth.uid(),

    completed_at =
      now()

  where id =
        selected_return.id;


  -- -------------------------------------------------------
  -- RESPONSE
  -- -------------------------------------------------------

  return jsonb_build_object(
    'id',
    selected_return.id,

    'return_number',
    selected_return.return_number,

    'status',
    'completed',

    'return_value',
    selected_return.return_value,

    'refund_amount',
    requested_refund
  );

end;
$$;


-- =========================================================
-- 10. PROTECT EXISTING ORDER RETURN WORKFLOW
-- =========================================================

create or replace function
public.protect_order_return_workflow()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin

  /*
    Existing legacy order status "returned"
    restores the ENTIRE original order stock.

    New customer returns must therefore go
    through Returns Management.
  */

  if new.status is distinct from old.status
     and new.status = 'returned'
  then
    raise exception
      'Use Returns Management for customer returns instead of changing the order status to Returned.';
  end if;


  /*
    Once an active/completed dedicated return
    exists, Pending/Cancelled must not restore
    the full order stock.
  */

  if new.status is distinct from old.status

     and new.status in (
       'pending',
       'cancelled'
     )

     and old.stock_deducted = true

     and exists (
       select 1

       from public.returns
         return_record

       where return_record.order_id =
             old.id

         and return_record.status in (
           'requested',
           'approved',
           'completed'
         )
     )

  then
    raise exception
      'This order has a dedicated return record. Manage its return through Returns Management.';
  end if;


  return new;

end;
$$;


-- ---------------------------------------------------------
-- Trigger name begins with 00 so it executes before
-- the existing stock-sync status trigger.
-- ---------------------------------------------------------

drop trigger if exists
  orders_00_protect_return_workflow
on public.orders;


create trigger
  orders_00_protect_return_workflow

before update of status

on public.orders

for each row

execute function
  public.protect_order_return_workflow();


revoke all
on function
public.protect_order_return_workflow()
from public;


-- =========================================================
-- 11. RPC PERMISSIONS
-- =========================================================

-- CREATE RETURN

revoke all
on function public.create_return(
  uuid,
  text,
  text,
  jsonb
)
from public;

revoke execute
on function public.create_return(
  uuid,
  text,
  text,
  jsonb
)
from anon;

grant execute
on function public.create_return(
  uuid,
  text,
  text,
  jsonb
)
to authenticated;


-- REVIEW RETURN

revoke all
on function public.review_return(
  uuid,
  text,
  text
)
from public;

revoke execute
on function public.review_return(
  uuid,
  text,
  text
)
from anon;

grant execute
on function public.review_return(
  uuid,
  text,
  text
)
to authenticated;


-- COMPLETE RETURN

revoke all
on function public.complete_return(
  uuid,
  numeric
)
from public;

revoke execute
on function public.complete_return(
  uuid,
  numeric
)
from anon;

grant execute
on function public.complete_return(
  uuid,
  numeric
)
to authenticated;


-- =========================================================
-- 12. SEQUENCE PERMISSIONS
-- =========================================================

revoke all
on sequence public.return_number_seq
from public;

revoke all
on sequence public.return_number_seq
from anon;

revoke all
on sequence public.return_number_seq
from authenticated;


-- =========================================================
-- DONE
-- =========================================================

commit;