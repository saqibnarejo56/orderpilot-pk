'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { createClient } from '@/lib/supabase/client';

type OrderStatus = 'shipped' | 'delivered';

type EligibleOrder = {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  status: OrderStatus;
  total_amount: number | string;
  paid_amount: number | string;
  stock_deducted: boolean;
  created_at: string;
};

type OrderItemRow = {
  id: string;
  product_id: string | null;
  product_name: string;
  product_sku: string | null;
  quantity: number;
  unit_price: number | string;
  unit_cost: number | string;
};

type ExistingReturnRow = {
  id: string;
};

type ExistingReturnItemRow = {
  order_item_id: string;
  quantity: number;
};

type ReturnReason =
  | 'damaged'
  | 'wrong_item'
  | 'size_issue'
  | 'quality_issue'
  | 'customer_changed_mind'
  | 'other';

type ReturnDraftItem = {
  selected: boolean;
  quantity: number;
  restock: boolean;
};

type ReturnDraftMap = Record<string, ReturnDraftItem>;

type CreateReturnResponse = {
  id?: string;
  return_number?: string;
  status?: string;
  return_value?: number;
};

function formatCurrency(value: number | string) {
  return new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-PK', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

function formatOrderStatus(status: OrderStatus) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function formatReason(reason: ReturnReason) {
  return reason.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function NewReturnPage() {
  const router = useRouter();

  const [storeName, setStoreName] = useState('');
  const [orders, setOrders] = useState<EligibleOrder[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState('');

  const [orderItems, setOrderItems] = useState<OrderItemRow[]>([]);
  const [alreadyReturned, setAlreadyReturned] = useState<Record<string, number>>({});

  const [draftItems, setDraftItems] = useState<ReturnDraftMap>({});

  const [reason, setReason] = useState<ReturnReason>('damaged');
  const [notes, setNotes] = useState('');

  const [isPageLoading, setIsPageLoading] = useState(true);
  const [isItemsLoading, setIsItemsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [loadError, setLoadError] = useState('');
  const [formError, setFormError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadPage() {
      setIsPageLoading(true);
      setLoadError('');

      try {
        const supabase = createClient();

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          router.replace('/login');
          return;
        }

        const { data: store, error: storeError } = await supabase
          .from('stores')
          .select('id, name')
          .eq('owner_id', user.id)
          .single();

        if (storeError || !store) {
          throw new Error('Your store could not be found. Please check your seller account.');
        }

        const { data: orderRows, error: ordersError } = await supabase
          .from('orders')
          .select(
            `
              id,
              order_number,
              customer_name,
              customer_phone,
              status,
              total_amount,
              paid_amount,
              stock_deducted,
              created_at
            `
          )
          .eq('store_id', store.id)
          .in('status', ['shipped', 'delivered'])
          .eq('stock_deducted', true)
          .order('created_at', { ascending: false });

        if (ordersError) {
          throw new Error(ordersError.message);
        }

        if (cancelled) {
          return;
        }

        const eligibleOrders = (orderRows ?? []) as EligibleOrder[];

        setStoreName(store.name);
        setOrders(eligibleOrders);

        const requestedOrderId = new URLSearchParams(window.location.search).get('order');

        if (requestedOrderId && eligibleOrders.some((order) => order.id === requestedOrderId)) {
          setSelectedOrderId(requestedOrderId);
        }
      } catch (error) {
        if (!cancelled) {
          setLoadError(
            error instanceof Error ? error.message : 'Returns setup could not be loaded.'
          );
        }
      } finally {
        if (!cancelled) {
          setIsPageLoading(false);
        }
      }
    }

    loadPage();

    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    let cancelled = false;

    async function loadOrderItems() {
      setFormError('');
      setOrderItems([]);
      setAlreadyReturned({});
      setDraftItems({});

      if (!selectedOrderId) {
        return;
      }

      setIsItemsLoading(true);

      try {
        const supabase = createClient();

        const [
          { data: itemRows, error: itemsError },
          { data: existingReturnRows, error: existingReturnsError },
        ] = await Promise.all([
          supabase
            .from('order_items')
            .select(
              `
                id,
                product_id,
                product_name,
                product_sku,
                quantity,
                unit_price,
                unit_cost
              `
            )
            .eq('order_id', selectedOrderId)
            .order('created_at', { ascending: true }),

          supabase
            .from('returns')
            .select('id')
            .eq('order_id', selectedOrderId)
            .in('status', ['requested', 'approved', 'completed']),
        ]);

        if (itemsError) {
          throw new Error(itemsError.message);
        }

        if (existingReturnsError) {
          throw new Error(existingReturnsError.message);
        }

        const loadedItems = (itemRows ?? []) as OrderItemRow[];

        const activeReturns = (existingReturnRows ?? []) as ExistingReturnRow[];

        const activeReturnIds = activeReturns.map((item) => item.id);

        const returnedQuantityMap: Record<string, number> = {};

        if (activeReturnIds.length > 0) {
          const { data: returnItemRows, error: returnItemsError } = await supabase
            .from('return_items')
            .select(
              `
                  order_item_id,
                  quantity
                `
            )
            .in('return_id', activeReturnIds);

          if (returnItemsError) {
            throw new Error(returnItemsError.message);
          }

          const existingItems = (returnItemRows ?? []) as ExistingReturnItemRow[];

          for (const returnItem of existingItems) {
            returnedQuantityMap[returnItem.order_item_id] =
              (returnedQuantityMap[returnItem.order_item_id] ?? 0) +
              Number(returnItem.quantity || 0);
          }
        }

        const initialDraft: ReturnDraftMap = {};

        for (const item of loadedItems) {
          initialDraft[item.id] = {
            selected: false,
            quantity: 1,
            restock: true,
          };
        }

        if (cancelled) {
          return;
        }

        setOrderItems(loadedItems);
        setAlreadyReturned(returnedQuantityMap);
        setDraftItems(initialDraft);
      } catch (error) {
        if (!cancelled) {
          setFormError(error instanceof Error ? error.message : 'Order items could not be loaded.');
        }
      } finally {
        if (!cancelled) {
          setIsItemsLoading(false);
        }
      }
    }

    loadOrderItems();

    return () => {
      cancelled = true;
    };
  }, [selectedOrderId]);

  const selectedOrder = useMemo(
    () => orders.find((order) => order.id === selectedOrderId) ?? null,
    [orders, selectedOrderId]
  );

  function getReturnableQuantity(item: OrderItemRow) {
    const previouslyReturned = alreadyReturned[item.id] ?? 0;

    return Math.max(Number(item.quantity || 0) - previouslyReturned, 0);
  }

  const selectedItems = useMemo(() => {
    return orderItems.filter((item) => {
      const draft = draftItems[item.id];

      return draft?.selected === true;
    });
  }, [orderItems, draftItems]);

  const selectedUnits = useMemo(() => {
    return selectedItems.reduce((total, item) => {
      return total + Number(draftItems[item.id]?.quantity || 0);
    }, 0);
  }, [selectedItems, draftItems]);

  const returnValue = useMemo(() => {
    return selectedItems.reduce((total, item) => {
      const quantity = Number(draftItems[item.id]?.quantity || 0);
      const unitPrice = Number(item.unit_price || 0);

      return total + quantity * unitPrice;
    }, 0);
  }, [selectedItems, draftItems]);

  function handleOrderChange(orderId: string) {
    setSelectedOrderId(orderId);
    setFormError('');
  }

  function toggleItem(item: OrderItemRow) {
    const returnableQuantity = getReturnableQuantity(item);

    if (returnableQuantity <= 0) {
      return;
    }

    setDraftItems((current) => {
      const currentItem = current[item.id] ?? {
        selected: false,
        quantity: 1,
        restock: true,
      };

      return {
        ...current,
        [item.id]: {
          ...currentItem,
          selected: !currentItem.selected,
          quantity: Math.min(Math.max(currentItem.quantity || 1, 1), returnableQuantity),
        },
      };
    });

    setFormError('');
  }

  function updateQuantity(item: OrderItemRow, value: string) {
    const returnableQuantity = getReturnableQuantity(item);

    let quantity = Math.floor(Number(value) || 1);

    quantity = Math.max(quantity, 1);
    quantity = Math.min(quantity, returnableQuantity);

    setDraftItems((current) => ({
      ...current,
      [item.id]: {
        ...(current[item.id] ?? {
          selected: true,
          quantity: 1,
          restock: true,
        }),
        selected: true,
        quantity,
      },
    }));

    setFormError('');
  }

  function updateRestock(item: OrderItemRow, restock: boolean) {
    setDraftItems((current) => ({
      ...current,
      [item.id]: {
        ...(current[item.id] ?? {
          selected: true,
          quantity: 1,
          restock: true,
        }),
        selected: true,
        restock,
      },
    }));

    setFormError('');
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setFormError('');

    if (!selectedOrderId) {
      setFormError('Select an order for this return.');
      return;
    }

    if (!selectedOrder) {
      setFormError('The selected order is no longer available.');
      return;
    }

    if (selectedItems.length === 0) {
      setFormError('Select at least one item to return.');
      return;
    }

    const returnPayload = [];

    for (const item of selectedItems) {
      const draft = draftItems[item.id];

      if (!draft) {
        setFormError('One of the selected return items is invalid.');
        return;
      }

      const quantity = Number(draft.quantity);
      const returnableQuantity = getReturnableQuantity(item);

      if (!Number.isInteger(quantity) || quantity <= 0 || quantity > returnableQuantity) {
        setFormError(
          `Enter a valid return quantity for ${item.product_name}. Maximum available: ${returnableQuantity}.`
        );
        return;
      }

      returnPayload.push({
        order_item_id: item.id,
        quantity,
        restock: draft.restock,
      });
    }

    setIsSaving(true);

    try {
      const supabase = createClient();

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.replace('/login');
        return;
      }

      const { data, error } = await supabase.rpc('create_return', {
        p_order_id: selectedOrderId,
        p_reason: reason,
        p_notes: notes.trim() || null,
        p_items: returnPayload,
      });

      if (error) {
        throw new Error(error.message);
      }

      const response = data as CreateReturnResponse | null;

      if (!response?.id) {
        throw new Error('Return was created, but its return record could not be opened.');
      }

      router.push(`/dashboard/returns/${response.id}`);
      router.refresh();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Return could not be created.');
    } finally {
      setIsSaving(false);
    }
  }

  const inputClass =
    'h-12 w-full rounded-xl border border-[#CFCBC2] bg-[#FAFAF8] px-4 text-sm text-[#17191C] outline-none transition focus:border-[#2F6C5B] focus:ring-4 focus:ring-[#2F6C5B]/10';

  const labelClass = 'mb-2 block text-[11px] font-extrabold tracking-[0.07em] text-[#343732]';

  if (isPageLoading) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#F6F5F1]">
        <div className="text-center">
          <div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-[#D7E4DF] border-t-[#173F36]" />

          <p className="mt-4 text-sm font-bold text-[#666963]">Loading returns setup...</p>
        </div>
      </main>
    );
  }

  if (loadError) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#F6F5F1] px-5">
        <section className="w-full max-w-lg rounded-2xl border border-[#D9D7D0] bg-white p-8 text-center">
          <p className="text-sm font-black text-red-700">Returns setup could not be loaded</p>

          <p className="mt-3 text-sm leading-7 text-[#777A75]">{loadError}</p>

          <Link
            href="/dashboard/returns"
            className="mt-6 inline-flex h-12 items-center justify-center rounded-xl bg-[#173F36] px-5 text-sm font-extrabold text-white"
          >
            Back to returns
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F6F5F1] text-[#17191C]">
      <header className="border-b border-[#D9D7D0] bg-white">
        <div className="mx-auto flex h-20 max-w-[1320px] items-center justify-between px-5 sm:px-8 lg:px-10">
          <Link href="/dashboard" className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-[10px] bg-[#173F36] text-[11px] font-black text-white">
              OP
            </span>

            <span>
              <span className="block text-[15px] font-extrabold">OrderPilot PK</span>

              <span className="block text-[10px] font-semibold tracking-[0.08em] text-[#777A75]">
                NEW RETURN
              </span>
            </span>
          </Link>

          <Link
            href="/dashboard/returns"
            className="rounded-xl border border-[#D9D7D0] bg-white px-4 py-2.5 text-sm font-bold text-[#434640] transition hover:bg-[#F3F2EE]"
          >
            Cancel
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-[1220px] px-5 py-10 sm:px-8 lg:px-10">
        <section className="mb-8">
          <p className="text-xs font-extrabold tracking-[0.14em] text-[#2F6C5B]">
            {storeName.toUpperCase()}
          </p>

          <h1 className="mt-3 text-4xl font-black tracking-[-0.045em] sm:text-5xl">
            Create return
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-7 text-[#666963]">
            Select a shipped or delivered order, choose the exact items being returned and decide
            whether eligible stock should be restored.
          </p>
        </section>

        {orders.length === 0 ? (
          <section className="rounded-2xl border border-[#D9D7D0] bg-white px-6 py-16 text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#EAF1ED] text-lg font-black text-[#173F36]">
              R
            </div>

            <h2 className="mt-5 text-xl font-black">No eligible orders</h2>

            <p className="mx-auto mt-3 max-w-lg text-sm leading-7 text-[#777A75]">
              A return can be created only for an order that is currently Shipped or Delivered and
              still has its stock reservation.
            </p>

            <Link
              href="/dashboard/orders"
              className="mt-6 inline-flex h-12 items-center justify-center rounded-xl bg-[#173F36] px-5 text-sm font-extrabold text-white"
            >
              View orders
            </Link>
          </section>
        ) : (
          <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-[1fr_340px]">
            <section className="space-y-6">
              <article className="rounded-2xl border border-[#D9D7D0] bg-white p-6 sm:p-8">
                <div className="border-b border-[#E2E0DA] pb-5">
                  <h2 className="text-xl font-black">Select order</h2>

                  <p className="mt-2 text-sm text-[#777A75]">
                    Only return-eligible orders are shown.
                  </p>
                </div>

                <div className="mt-6">
                  <label className={labelClass}>ORDER</label>

                  <select
                    value={selectedOrderId}
                    onChange={(event) => handleOrderChange(event.target.value)}
                    className={inputClass}
                  >
                    <option value="">Select an order</option>

                    {orders.map((order) => (
                      <option key={order.id} value={order.id}>
                        {order.order_number} — {order.customer_name} —{' '}
                        {formatOrderStatus(order.status)}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedOrder ? (
                  <div className="mt-6 grid gap-4 rounded-2xl bg-[#F7F7F4] p-5 sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <p className="text-[10px] font-extrabold tracking-[0.08em] text-[#8A8D87]">
                        CUSTOMER
                      </p>

                      <p className="mt-2 text-sm font-black">{selectedOrder.customer_name}</p>

                      <p className="mt-1 text-xs text-[#777A75]">{selectedOrder.customer_phone}</p>
                    </div>

                    <div>
                      <p className="text-[10px] font-extrabold tracking-[0.08em] text-[#8A8D87]">
                        STATUS
                      </p>

                      <p className="mt-2 text-sm font-black">
                        {formatOrderStatus(selectedOrder.status)}
                      </p>

                      <p className="mt-1 text-xs text-[#777A75]">
                        {formatDate(selectedOrder.created_at)}
                      </p>
                    </div>

                    <div>
                      <p className="text-[10px] font-extrabold tracking-[0.08em] text-[#8A8D87]">
                        ORDER TOTAL
                      </p>

                      <p className="mt-2 text-sm font-black">
                        {formatCurrency(selectedOrder.total_amount)}
                      </p>
                    </div>

                    <div>
                      <p className="text-[10px] font-extrabold tracking-[0.08em] text-[#8A8D87]">
                        COLLECTED
                      </p>

                      <p className="mt-2 text-sm font-black">
                        {formatCurrency(selectedOrder.paid_amount)}
                      </p>
                    </div>
                  </div>
                ) : null}
              </article>

              {selectedOrderId ? (
                <article className="rounded-2xl border border-[#D9D7D0] bg-white p-6 sm:p-8">
                  <div className="border-b border-[#E2E0DA] pb-5">
                    <h2 className="text-xl font-black">Return items</h2>

                    <p className="mt-2 text-sm leading-6 text-[#777A75]">
                      Select only the products and quantities actually being returned.
                    </p>
                  </div>

                  {isItemsLoading ? (
                    <div className="py-14 text-center">
                      <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-[#D7E4DF] border-t-[#173F36]" />

                      <p className="mt-4 text-sm font-bold text-[#777A75]">
                        Loading order items...
                      </p>
                    </div>
                  ) : orderItems.length === 0 ? (
                    <div className="py-14 text-center">
                      <p className="text-sm font-black">No order items found</p>
                    </div>
                  ) : (
                    <div className="mt-6 space-y-4">
                      {orderItems.map((item) => {
                        const returned = alreadyReturned[item.id] ?? 0;

                        const returnable = getReturnableQuantity(item);

                        const draft = draftItems[item.id] ?? {
                          selected: false,
                          quantity: 1,
                          restock: true,
                        };

                        const unavailable = returnable <= 0;

                        return (
                          <div
                            key={item.id}
                            className={`rounded-2xl border p-5 transition ${
                              draft.selected
                                ? 'border-[#2F6C5B] bg-[#F3F8F5]'
                                : 'border-[#DDDAD3] bg-white'
                            } ${unavailable ? 'opacity-60' : ''}`}
                          >
                            <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
                              <div className="flex flex-1 gap-4">
                                <input
                                  type="checkbox"
                                  checked={draft.selected && !unavailable}
                                  disabled={unavailable}
                                  onChange={() => toggleItem(item)}
                                  className="mt-1 h-5 w-5 accent-[#173F36]"
                                />

                                <div>
                                  <p className="font-black">{item.product_name}</p>

                                  <p className="mt-1 text-xs text-[#777A75]">
                                    SKU: {item.product_sku || 'Not available'}
                                  </p>

                                  <p className="mt-2 text-sm font-bold">
                                    {formatCurrency(item.unit_price)} each
                                  </p>

                                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                                    <span className="rounded-full bg-[#F0F0EC] px-3 py-1 font-bold text-[#666963]">
                                      Ordered: {item.quantity}
                                    </span>

                                    <span className="rounded-full bg-[#F0F0EC] px-3 py-1 font-bold text-[#666963]">
                                      Already in returns: {returned}
                                    </span>

                                    <span
                                      className={`rounded-full px-3 py-1 font-bold ${
                                        returnable > 0
                                          ? 'bg-emerald-100 text-emerald-800'
                                          : 'bg-red-100 text-red-800'
                                      }`}
                                    >
                                      Returnable: {returnable}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {draft.selected && !unavailable ? (
                                <div className="grid w-full gap-4 sm:w-[260px]">
                                  <div>
                                    <label className={labelClass}>RETURN QUANTITY</label>

                                    <input
                                      type="number"
                                      min={1}
                                      max={returnable}
                                      value={draft.quantity}
                                      onChange={(event) => updateQuantity(item, event.target.value)}
                                      className={inputClass}
                                    />
                                  </div>

                                  <div>
                                    <label className={labelClass}>STOCK ACTION</label>

                                    <select
                                      value={draft.restock ? 'restock' : 'do_not_restock'}
                                      onChange={(event) =>
                                        updateRestock(item, event.target.value === 'restock')
                                      }
                                      className={inputClass}
                                    >
                                      <option value="restock">Return to stock</option>

                                      <option value="do_not_restock">Do not restock</option>
                                    </select>
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </article>
              ) : null}

              <article className="rounded-2xl border border-[#D9D7D0] bg-white p-6 sm:p-8">
                <div className="border-b border-[#E2E0DA] pb-5">
                  <h2 className="text-xl font-black">Return details</h2>

                  <p className="mt-2 text-sm text-[#777A75]">
                    Record why the customer is returning these items.
                  </p>
                </div>

                <div className="mt-6">
                  <label className={labelClass}>RETURN REASON</label>

                  <select
                    value={reason}
                    onChange={(event) => setReason(event.target.value as ReturnReason)}
                    className={inputClass}
                  >
                    {(
                      [
                        'damaged',
                        'wrong_item',
                        'size_issue',
                        'quality_issue',
                        'customer_changed_mind',
                        'other',
                      ] as ReturnReason[]
                    ).map((returnReason) => (
                      <option key={returnReason} value={returnReason}>
                        {formatReason(returnReason)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mt-5">
                  <label className={labelClass}>NOTES</label>

                  <textarea
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    rows={5}
                    placeholder="Optional details about the return condition, customer request or inspection..."
                    className="w-full rounded-xl border border-[#CFCBC2] bg-[#FAFAF8] px-4 py-3 text-sm text-[#17191C] outline-none transition placeholder:text-[#A2A49F] focus:border-[#2F6C5B] focus:ring-4 focus:ring-[#2F6C5B]/10"
                  />
                </div>
              </article>
            </section>

            <aside className="h-fit space-y-5 lg:sticky lg:top-6">
              <article className="rounded-2xl border border-[#D9D7D0] bg-white p-6">
                <p className="text-xs font-extrabold tracking-[0.1em] text-[#777A75]">
                  RETURN SUMMARY
                </p>

                <div className="mt-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[#666963]">Selected items</span>

                    <strong>{selectedItems.length}</strong>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[#666963]">Units returning</span>

                    <strong>{selectedUnits}</strong>
                  </div>

                  <div className="border-t border-[#E2E0DA] pt-4">
                    <div className="flex items-end justify-between gap-4">
                      <span className="text-sm font-bold text-[#666963]">Return value</span>

                      <strong className="text-2xl font-black tracking-[-0.04em]">
                        {formatCurrency(returnValue)}
                      </strong>
                    </div>
                  </div>
                </div>

                <p className="mt-5 rounded-xl bg-[#F6F5F1] p-4 text-xs leading-6 text-[#666963]">
                  Return value is calculated from the original item selling price and selected
                  quantity. Refund processing happens after the return is approved.
                </p>
              </article>

              {formError ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
                  <p className="text-sm font-black text-red-700">Return could not be submitted</p>

                  <p className="mt-2 text-sm leading-6 text-red-700">{formError}</p>
                </div>
              ) : null}

              <button
                type="submit"
                disabled={
                  isSaving || isItemsLoading || !selectedOrderId || selectedItems.length === 0
                }
                className="flex h-13 w-full items-center justify-center rounded-xl bg-[#173F36] px-5 text-sm font-extrabold text-white transition hover:bg-[#0F3029] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSaving ? 'Creating return...' : 'Submit return request'}
              </button>

              <Link
                href="/dashboard/returns"
                className="flex h-12 w-full items-center justify-center rounded-xl border border-[#D9D7D0] bg-white px-5 text-sm font-extrabold text-[#434640] transition hover:bg-[#F3F2EE]"
              >
                Cancel
              </Link>
            </aside>
          </form>
        )}
      </div>
    </main>
  );
}
