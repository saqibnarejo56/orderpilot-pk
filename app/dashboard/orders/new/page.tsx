'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { createClient } from '@/lib/supabase/client';

type ProductOption = {
  id: string;
  name: string;
  sku: string | null;
  selling_price: number | string;
  cost_price: number | string;
  stock_quantity: number;
};

type OrderItemDraft = {
  key: string;
  productId: string;
  quantity: string;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    maximumFractionDigits: 0,
  }).format(value);
}

function createEmptyItem(): OrderItemDraft {
  return {
    key: crypto.randomUUID(),
    productId: '',
    quantity: '1',
  };
}

export default function NewOrderPage() {
  const router = useRouter();

  const [storeId, setStoreId] = useState('');
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [items, setItems] = useState<OrderItemDraft[]>([createEmptyItem()]);

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerCity, setCustomerCity] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [notes, setNotes] = useState('');

  const [paymentMethod, setPaymentMethod] = useState('cod');
  const [deliveryCharges, setDeliveryCharges] = useState('0');
  const [discountAmount, setDiscountAmount] = useState('0');
  const [paidAmount, setPaidAmount] = useState('0');

  const [isPageLoading, setIsPageLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [formError, setFormError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadOrderSetup() {
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
          .select('id')
          .eq('owner_id', user.id)
          .single();

        if (storeError || !store) {
          throw new Error('Your store could not be found. Please check your seller account.');
        }

        const { data: productRows, error: productsError } = await supabase
          .from('products')
          .select(
            `
                id,
                name,
                sku,
                selling_price,
                cost_price,
                stock_quantity
              `
          )
          .eq('store_id', store.id)
          .eq('status', 'active')
          .order('name', { ascending: true });

        if (productsError) {
          throw new Error(productsError.message);
        }

        if (cancelled) return;

        setStoreId(store.id);
        setProducts((productRows ?? []) as ProductOption[]);
      } catch (error) {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : 'Order setup could not be loaded.');
        }
      } finally {
        if (!cancelled) {
          setIsPageLoading(false);
        }
      }
    }

    loadOrderSetup();

    return () => {
      cancelled = true;
    };
  }, [router]);

  const productMap = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products]
  );

  const calculatedItems = useMemo(
    () =>
      items.map((item) => {
        const product = productMap.get(item.productId);
        const quantity = Number(item.quantity) || 0;
        const unitPrice = Number(product?.selling_price || 0);

        return {
          ...item,
          product,
          quantity,
          unitPrice,
          lineTotal: quantity * unitPrice,
        };
      }),
    [items, productMap]
  );

  const subtotal = useMemo(
    () => calculatedItems.reduce((total, item) => total + item.lineTotal, 0),
    [calculatedItems]
  );

  const deliveryNumber = Number(deliveryCharges) || 0;
  const discountNumber = Number(discountAmount) || 0;
  const paidNumber = Number(paidAmount) || 0;

  const totalAmount = subtotal + deliveryNumber - discountNumber;

  const balanceDue = Math.max(totalAmount - paidNumber, 0);

  function updateItem(key: string, field: 'productId' | 'quantity', value: string) {
    setItems((currentItems) =>
      currentItems.map((item) =>
        item.key === key
          ? {
              ...item,
              [field]: value,
            }
          : item
      )
    );

    setFormError('');
  }

  function addItem() {
    setItems((currentItems) => [...currentItems, createEmptyItem()]);
  }

  function removeItem(key: string) {
    setItems((currentItems) => {
      if (currentItems.length === 1) {
        return [createEmptyItem()];
      }

      return currentItems.filter((item) => item.key !== key);
    });

    setFormError('');
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setFormError('');

    const cleanCustomerName = customerName.trim();
    const cleanCustomerPhone = customerPhone.trim();

    if (cleanCustomerName.length < 2) {
      setFormError('Customer name must contain at least 2 characters.');
      return;
    }

    if (cleanCustomerPhone.length < 7) {
      setFormError('Enter a valid customer phone number.');
      return;
    }

    if (!storeId) {
      setFormError('Your store connection is unavailable.');
      return;
    }

    if (calculatedItems.length === 0) {
      setFormError('Add at least one product to the order.');
      return;
    }

    const selectedProductIds = calculatedItems.map((item) => item.productId);

    if (selectedProductIds.some((productId) => !productId)) {
      setFormError('Select a product for every order item.');
      return;
    }

    if (new Set(selectedProductIds).size !== selectedProductIds.length) {
      setFormError('The same product cannot be added more than once.');
      return;
    }

    for (const item of calculatedItems) {
      if (!item.product) {
        setFormError('One of the selected products is unavailable.');
        return;
      }

      if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
        setFormError(`Enter a valid quantity for ${item.product.name}.`);
        return;
      }

      if (item.quantity > item.product.stock_quantity) {
        setFormError(
          `${item.product.name} only has ${item.product.stock_quantity} units available.`
        );
        return;
      }
    }

    if (!Number.isFinite(deliveryNumber) || deliveryNumber < 0) {
      setFormError('Enter valid delivery charges.');
      return;
    }

    if (!Number.isFinite(discountNumber) || discountNumber < 0) {
      setFormError('Enter a valid discount amount.');
      return;
    }

    if (totalAmount < 0) {
      setFormError('Discount cannot be greater than the order total.');
      return;
    }

    if (!Number.isFinite(paidNumber) || paidNumber < 0) {
      setFormError('Enter a valid paid amount.');
      return;
    }

    if (paidNumber > totalAmount) {
      setFormError('Paid amount cannot be greater than the order total.');
      return;
    }

    setIsSaving(true);

    const supabase = createClient();
    let createdOrderId: string | null = null;

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.replace('/login');
        return;
      }

      const { data: createdOrder, error: orderError } = await supabase
        .from('orders')
        .insert({
          store_id: storeId,
          customer_name: cleanCustomerName,
          customer_phone: cleanCustomerPhone,
          customer_city: customerCity.trim() || null,
          customer_address: customerAddress.trim() || null,
          notes: notes.trim() || null,
          status: 'pending',
          payment_method: paymentMethod,
          delivery_charges: 0,
          discount_amount: 0,
          paid_amount: 0,
        })
        .select('id, order_number')
        .single();

      if (orderError || !createdOrder) {
        throw new Error(orderError?.message || 'Order could not be created.');
      }

      createdOrderId = createdOrder.id;

      const orderItems = calculatedItems.map((item) => ({
        order_id: createdOrder.id,
        product_id: item.product!.id,
        product_name: item.product!.name,
        product_sku: item.product!.sku,
        quantity: item.quantity,
        unit_price: Number(item.product!.selling_price),
        unit_cost: Number(item.product!.cost_price || 0),
      }));

      const { error: itemsError } = await supabase.from('order_items').insert(orderItems);

      if (itemsError) {
        throw new Error(`Order products could not be saved: ${itemsError.message}`);
      }

      const { error: financialError } = await supabase
        .from('orders')
        .update({
          delivery_charges: deliveryNumber,
          discount_amount: discountNumber,
          paid_amount: paidNumber,
        })
        .eq('id', createdOrder.id);

      if (financialError) {
        throw new Error(`Order totals could not be saved: ${financialError.message}`);
      }

      router.push('/dashboard/orders');
      router.refresh();
    } catch (error) {
      if (createdOrderId) {
        await supabase.from('orders').delete().eq('id', createdOrderId);
      }

      setFormError(error instanceof Error ? error.message : 'Order could not be created.');
    } finally {
      setIsSaving(false);
    }
  }

  const inputClass =
    'h-13 w-full rounded-xl border border-[#CFCBC2] bg-[#FAFAF8] px-4 text-sm text-[#17191C] outline-none transition placeholder:text-[#A2A49F] focus:border-[#2F6C5B] focus:ring-4 focus:ring-[#2F6C5B]/10';

  const labelClass = 'mb-2 block text-[11px] font-extrabold tracking-[0.07em] text-[#343732]';

  if (isPageLoading) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#F6F5F1]">
        <div className="text-center">
          <div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-[#D7E4DF] border-t-[#173F36]" />

          <p className="mt-4 text-sm font-bold text-[#666963]">Loading order setup...</p>
        </div>
      </main>
    );
  }

  if (loadError) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#F6F5F1] px-5">
        <section className="w-full max-w-lg rounded-2xl border border-[#D9D7D0] bg-white p-8 text-center">
          <p className="text-sm font-black text-red-700">Order setup could not be loaded</p>

          <p className="mt-3 text-sm leading-7 text-[#777A75]">{loadError}</p>

          <Link
            href="/dashboard/orders"
            className="mt-6 inline-flex h-12 items-center justify-center rounded-xl bg-[#173F36] px-5 text-sm font-extrabold text-white"
          >
            Return to orders
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
                NEW ORDER
              </span>
            </span>
          </Link>

          <Link
            href="/dashboard/orders"
            className="rounded-xl border border-[#D9D7D0] bg-white px-4 py-2.5 text-sm font-bold"
          >
            Cancel
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-[1180px] px-5 py-10 sm:px-8 lg:px-10">
        <section className="mb-8">
          <p className="text-xs font-extrabold tracking-[0.14em] text-[#2F6C5B]">
            ORDER MANAGEMENT
          </p>

          <h1 className="mt-3 text-4xl font-black tracking-[-0.045em] sm:text-5xl">
            Create a new order
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-7 text-[#666963]">
            Add customer information, products, payment and delivery details.
          </p>
        </section>

        <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <section className="space-y-6">
            <article className="rounded-2xl border border-[#D9D7D0] bg-white p-6 sm:p-8">
              <div className="border-b border-[#E2E0DA] pb-5">
                <h2 className="text-xl font-black">Customer information</h2>
              </div>

              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>CUSTOMER NAME</label>

                  <input
                    value={customerName}
                    onChange={(event) => setCustomerName(event.target.value)}
                    placeholder="Example: Ali Khan"
                    className={inputClass}
                    required
                  />
                </div>

                <div>
                  <label className={labelClass}>PHONE NUMBER</label>

                  <input
                    value={customerPhone}
                    onChange={(event) => setCustomerPhone(event.target.value)}
                    placeholder="03XX XXXXXXX"
                    className={inputClass}
                    required
                  />
                </div>

                <div>
                  <label className={labelClass}>CITY</label>

                  <input
                    value={customerCity}
                    onChange={(event) => setCustomerCity(event.target.value)}
                    placeholder="Karachi"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>DELIVERY ADDRESS</label>

                  <input
                    value={customerAddress}
                    onChange={(event) => setCustomerAddress(event.target.value)}
                    placeholder="House, street and area"
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="mt-5">
                <label className={labelClass}>NOTES</label>

                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={4}
                  placeholder="Optional order instructions"
                  className="w-full rounded-xl border border-[#CFCBC2] bg-[#FAFAF8] px-4 py-3 text-sm outline-none"
                />
              </div>
            </article>

            <article className="rounded-2xl border border-[#D9D7D0] bg-white p-6 sm:p-8">
              <div className="flex items-center justify-between border-b border-[#E2E0DA] pb-5">
                <div>
                  <h2 className="text-xl font-black">Order products</h2>

                  <p className="mt-2 text-sm text-[#777A75]">
                    Select products and enter quantities.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={addItem}
                  disabled={products.length === 0}
                  className="rounded-xl border border-[#CFCBC2] px-4 py-2.5 text-sm font-extrabold text-[#173F36] disabled:opacity-50"
                >
                  Add item +
                </button>
              </div>

              {products.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="text-sm font-black">No active products available</p>

                  <Link
                    href="/dashboard/products/new"
                    className="mt-4 inline-flex text-sm font-extrabold text-[#175B46] underline"
                  >
                    Add a product first
                  </Link>
                </div>
              ) : (
                <div className="mt-6 space-y-4">
                  {calculatedItems.map((item, index) => {
                    const selectedByOtherItem = new Set(
                      items
                        .filter((currentItem) => currentItem.key !== item.key)
                        .map((currentItem) => currentItem.productId)
                    );

                    return (
                      <div
                        key={item.key}
                        className="rounded-2xl border border-[#E2E0DA] bg-[#FAFAF8] p-4"
                      >
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-extrabold text-[#777A75]">ITEM {index + 1}</p>

                          <button
                            type="button"
                            onClick={() => removeItem(item.key)}
                            className="text-xs font-extrabold text-red-700"
                          >
                            Remove
                          </button>
                        </div>

                        <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_120px]">
                          <div>
                            <label className={labelClass}>PRODUCT</label>

                            <select
                              value={item.productId}
                              onChange={(event) =>
                                updateItem(item.key, 'productId', event.target.value)
                              }
                              className={inputClass}
                            >
                              <option value="">Select product</option>

                              {products.map((product) => (
                                <option
                                  key={product.id}
                                  value={product.id}
                                  disabled={selectedByOtherItem.has(product.id)}
                                >
                                  {product.name} · Stock {product.stock_quantity}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className={labelClass}>QUANTITY</label>

                            <input
                              type="number"
                              min="1"
                              max={item.product?.stock_quantity}
                              step="1"
                              value={item.quantity}
                              onChange={(event) =>
                                updateItem(item.key, 'quantity', event.target.value)
                              }
                              className={inputClass}
                            />
                          </div>
                        </div>

                        {item.product && (
                          <div className="mt-4 flex flex-wrap justify-between gap-3 border-t border-[#E2E0DA] pt-4 text-sm">
                            <span className="text-[#777A75]">
                              {formatCurrency(item.unitPrice)} each
                            </span>

                            <strong>{formatCurrency(item.lineTotal)}</strong>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </article>

            <article className="rounded-2xl border border-[#D9D7D0] bg-white p-6 sm:p-8">
              <div className="border-b border-[#E2E0DA] pb-5">
                <h2 className="text-xl font-black">Payment and delivery</h2>
              </div>

              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>PAYMENT METHOD</label>

                  <select
                    value={paymentMethod}
                    onChange={(event) => setPaymentMethod(event.target.value)}
                    className={inputClass}
                  >
                    <option value="cod">Cash on delivery</option>
                    <option value="bank_transfer">Bank transfer</option>
                    <option value="easypaisa">Easypaisa</option>
                    <option value="jazzcash">JazzCash</option>
                    <option value="card">Card</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className={labelClass}>DELIVERY CHARGES</label>

                  <input
                    type="number"
                    min="0"
                    value={deliveryCharges}
                    onChange={(event) => setDeliveryCharges(event.target.value)}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>DISCOUNT</label>

                  <input
                    type="number"
                    min="0"
                    value={discountAmount}
                    onChange={(event) => setDiscountAmount(event.target.value)}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>PAID AMOUNT</label>

                  <input
                    type="number"
                    min="0"
                    value={paidAmount}
                    onChange={(event) => setPaidAmount(event.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>
            </article>
          </section>

          <aside className="space-y-6">
            <article className="rounded-2xl bg-[#173F36] p-6 text-white">
              <p className="text-[11px] font-extrabold tracking-[0.1em] text-white/60">
                ORDER SUMMARY
              </p>

              <div className="mt-5 space-y-4">
                <div className="flex justify-between">
                  <span className="text-white/65">Subtotal</span>
                  <strong>{formatCurrency(subtotal)}</strong>
                </div>

                <div className="flex justify-between">
                  <span className="text-white/65">Delivery</span>
                  <strong>{formatCurrency(deliveryNumber)}</strong>
                </div>

                <div className="flex justify-between">
                  <span className="text-white/65">Discount</span>
                  <strong>-{formatCurrency(discountNumber)}</strong>
                </div>

                <div className="flex justify-between border-t border-white/15 pt-4">
                  <span className="text-white/65">Total</span>
                  <strong>{formatCurrency(Math.max(totalAmount, 0))}</strong>
                </div>

                <div className="flex justify-between">
                  <span className="text-white/65">Balance due</span>
                  <strong>{formatCurrency(balanceDue)}</strong>
                </div>
              </div>

              <p className="mt-6 border-t border-white/15 pt-4 text-xs leading-6 text-white/60">
                New orders are created as Pending. Stock will only be deducted after confirmation.
              </p>
            </article>

            {formError && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold leading-6 text-red-700">
                {formError}
              </div>
            )}

            <button
              type="submit"
              disabled={isSaving || products.length === 0}
              className="flex h-13 w-full items-center justify-center rounded-xl bg-[#173F36] px-5 text-sm font-extrabold text-white disabled:opacity-60"
            >
              {isSaving ? 'Creating order...' : 'Create order →'}
            </button>

            <Link
              href="/dashboard/orders"
              className="flex h-12 w-full items-center justify-center rounded-xl border border-[#D9D7D0] bg-white text-sm font-bold"
            >
              Cancel
            </Link>
          </aside>
        </form>
      </div>
    </main>
  );
}
