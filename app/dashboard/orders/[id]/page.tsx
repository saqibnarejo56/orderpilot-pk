'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { createClient } from '@/lib/supabase/client';

type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'returned';

type PaymentStatus = 'unpaid' | 'partial' | 'paid' | 'refunded';

type PaymentMethod = 'cod' | 'bank_transfer' | 'easypaisa' | 'jazzcash' | 'card' | 'other';

type OrderRow = {
  id: string;
  store_id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  customer_city: string | null;
  customer_address: string | null;
  notes: string | null;
  status: OrderStatus;
  payment_status: PaymentStatus;
  payment_method: PaymentMethod;
  subtotal: number | string;
  delivery_charges: number | string;
  discount_amount: number | string;
  total_amount: number | string;
  paid_amount: number | string;
  refunded_amount: number | string;
  balance_due: number | string;
  stock_deducted: boolean;
  created_at: string;
  updated_at: string;
};

type OrderItemRow = {
  id: string;
  product_id: string | null;
  product_name: string;
  product_sku: string | null;
  quantity: number;
  unit_price: number | string;
  unit_cost: number | string;
  line_total: number | string;
};
type ProductOption = {
  id: string;
  name: string;
  sku: string | null;
  selling_price: number | string;
  cost_price: number | string;
  stock_quantity: number;
};

type EditableOrderItem = {
  key: string;
  productId: string;
  productName: string;
  productSku: string | null;
  quantity: number;
  unitPrice: number;
  unitCost: number;
  stockQuantity: number;
  isUnavailable: boolean;
};

function formatCurrency(value: number | string) {
  return new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

function getStatusStyles(status: OrderStatus) {
  if (status === 'delivered') {
    return 'bg-emerald-100 text-emerald-800';
  }

  if (status === 'confirmed' || status === 'processing') {
    return 'bg-blue-100 text-blue-800';
  }

  if (status === 'shipped') {
    return 'bg-cyan-100 text-cyan-800';
  }

  if (status === 'cancelled' || status === 'returned') {
    return 'bg-red-100 text-red-800';
  }

  return 'bg-amber-100 text-amber-800';
}

function getPaymentStyles(status: PaymentStatus) {
  if (status === 'paid') {
    return 'bg-emerald-100 text-emerald-800';
  }

  if (status === 'partial') {
    return 'bg-blue-100 text-blue-800';
  }

  if (status === 'refunded') {
    return 'bg-slate-200 text-slate-700';
  }

  return 'bg-red-100 text-red-800';
}
function getAllowedOrderStatuses(currentStatus: OrderStatus): OrderStatus[] {
  if (currentStatus === 'pending') {
    return ['pending', 'confirmed', 'cancelled'];
  }

  if (currentStatus === 'confirmed') {
    return ['confirmed', 'pending', 'processing', 'cancelled'];
  }

  if (currentStatus === 'processing') {
    return ['processing', 'pending', 'shipped', 'cancelled'];
  }

  if (currentStatus === 'shipped') {
    return ['shipped', 'delivered', 'returned'];
  }

  if (currentStatus === 'delivered') {
    return ['delivered', 'returned'];
  }

  if (currentStatus === 'cancelled') {
    return ['cancelled', 'pending'];
  }

  return ['returned'];
}

function formatStatusLabel(status: OrderStatus) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}
export default function ManageOrderPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const orderId = params.id;

  const [orderNumber, setOrderNumber] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerCity, setCustomerCity] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [notes, setNotes] = useState('');

  const [status, setStatus] = useState<OrderStatus>('pending');

  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('unpaid');

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cod');

  const [subtotal, setSubtotal] = useState(0);
  const [deliveryCharges, setDeliveryCharges] = useState('0');
  const [discountAmount, setDiscountAmount] = useState('0');
  const [paidAmount, setPaidAmount] = useState('0');
  const [refundedAmount, setRefundedAmount] = useState('0');
  const [stockDeducted, setStockDeducted] = useState(false);

  const [createdAt, setCreatedAt] = useState('');
  const [updatedAt, setUpdatedAt] = useState('');

  const [items, setItems] = useState<OrderItemRow[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [editableItems, setEditableItems] = useState<EditableOrderItem[]>([]);
  const [itemsDirty, setItemsDirty] = useState(false);
  const [isSavingItems, setIsSavingItems] = useState(false);

  const [persistedStatus, setPersistedStatus] = useState<OrderStatus>('pending');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [formError, setFormError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadOrder() {
      setIsLoading(true);
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

        const { data: orderData, error: orderError } = await supabase
          .from('orders')
          .select(
            `
                id,
                store_id,
                order_number,
                customer_name,
                customer_phone,
                customer_city,
                customer_address,
                notes,
                status,
                payment_status,
                payment_method,
                subtotal,
                delivery_charges,
                discount_amount,
                total_amount,
                paid_amount,
                refunded_amount,
                balance_due,
                stock_deducted,
                created_at,
                updated_at
              `
          )
          .eq('id', orderId)
          .single();

        if (orderError || !orderData) {
          throw new Error('Order could not be found or you do not have permission to access it.');
        }

        const { data: itemRows, error: itemsError } = await supabase
          .from('order_items')
          .select(
            `
                id,
                product_id,
                product_name,
                product_sku,
                quantity,
                unit_price,
                unit_cost,
                line_total
              `
          )
          .eq('order_id', orderId)
          .order('created_at', { ascending: true });

        if (itemsError) {
          throw new Error(itemsError.message);
        }

        if (cancelled) return;

        const order = orderData as OrderRow;
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
          .eq('store_id', order.store_id)
          .eq('status', 'active')
          .order('name', { ascending: true });

        if (productsError) {
          throw new Error(productsError.message);
        }

        const availableProducts = (productRows ?? []) as ProductOption[];
        const loadedItems = (itemRows ?? []) as OrderItemRow[];
        setOrderNumber(order.order_number);
        setCustomerName(order.customer_name);
        setCustomerPhone(order.customer_phone);
        setCustomerCity(order.customer_city ?? '');
        setCustomerAddress(order.customer_address ?? '');
        setNotes(order.notes ?? '');

        setStatus(order.status);
        setPersistedStatus(order.status);
        setPaymentStatus(order.payment_status);
        setPaymentMethod(order.payment_method);

        setSubtotal(Number(order.subtotal) || 0);
        setDeliveryCharges(String(order.delivery_charges ?? 0));
        setDiscountAmount(String(order.discount_amount ?? 0));
        setPaidAmount(String(order.paid_amount ?? 0));
        setRefundedAmount(String(order.refunded_amount ?? 0));
        setStockDeducted(order.stock_deducted);
        setCreatedAt(order.created_at);
        setUpdatedAt(order.updated_at);
        setProducts(availableProducts);
        setItems(loadedItems);

        setEditableItems(
          loadedItems.map((item) => {
            const linkedProduct = availableProducts.find(
              (product) => product.id === item.product_id
            );

            return {
              key: item.id,
              productId: item.product_id ?? '',
              productName: linkedProduct?.name ?? item.product_name,
              productSku: linkedProduct?.sku ?? item.product_sku,
              quantity: item.quantity,
              unitPrice: Number(item.unit_price),
              unitCost: Number(item.unit_cost),
              stockQuantity: linkedProduct?.stock_quantity ?? 0,
              isUnavailable: !linkedProduct || !item.product_id,
            };
          })
        );

        setItemsDirty(false);
      } catch (error) {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : 'Order could not be loaded.');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadOrder();

    return () => {
      cancelled = true;
    };
  }, [orderId, router]);
  const availableStatusOptions = getAllowedOrderStatuses(persistedStatus);
  const canEditProducts = persistedStatus === 'pending' && !stockDeducted;

  const editableSubtotal = useMemo(
    () => editableItems.reduce((total, item) => total + item.quantity * item.unitPrice, 0),
    [editableItems]
  );

  const effectiveSubtotal = canEditProducts ? editableSubtotal : subtotal;
  const deliveryNumber = Number(deliveryCharges) || 0;

  const discountNumber = Number(discountAmount) || 0;

  const paidNumber = Number(paidAmount) || 0;
  const refundedNumber = Number(refundedAmount) || 0;
  const totalAmount = useMemo(
    () => Math.max(effectiveSubtotal + deliveryNumber - discountNumber, 0),
    [effectiveSubtotal, deliveryNumber, discountNumber]
  );

  const balanceDue = useMemo(
    () => Math.max(totalAmount - paidNumber, 0),
    [totalAmount, paidNumber]
  );
  const displayedBalanceDue = status === 'cancelled' || status === 'returned' ? 0 : balanceDue;
  function markItemsChanged(nextItems: EditableOrderItem[]) {
    setEditableItems(nextItems);
    setItemsDirty(true);
    setFormError('');
    setSuccessMessage('');
  }

  function handleAddProduct() {
    if (!canEditProducts) {
      setFormError('Products can only be edited while the order is pending.');
      return;
    }

    const selectedProductIds = new Set(editableItems.map((item) => item.productId));

    const availableProduct = products.find(
      (product) => product.stock_quantity > 0 && !selectedProductIds.has(product.id)
    );

    if (!availableProduct) {
      setFormError('No additional in-stock product is available.');
      return;
    }

    markItemsChanged([
      ...editableItems,
      {
        key: crypto.randomUUID(),
        productId: availableProduct.id,
        productName: availableProduct.name,
        productSku: availableProduct.sku,
        quantity: 1,
        unitPrice: Number(availableProduct.selling_price),
        unitCost: Number(availableProduct.cost_price),
        stockQuantity: availableProduct.stock_quantity,
        isUnavailable: false,
      },
    ]);
  }

  function handleProductChange(itemKey: string, productId: string) {
    const selectedProduct = products.find((product) => product.id === productId);

    if (!selectedProduct) {
      setFormError('Selected product could not be found.');
      return;
    }

    if (selectedProduct.stock_quantity < 1) {
      setFormError('Selected product is currently out of stock.');
      return;
    }

    const duplicateProduct = editableItems.some(
      (item) => item.key !== itemKey && item.productId === selectedProduct.id
    );

    if (duplicateProduct) {
      setFormError('The same product cannot be added more than once.');
      return;
    }

    const nextItems = editableItems.map((item) => {
      if (item.key !== itemKey) {
        return item;
      }

      return {
        ...item,
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        productSku: selectedProduct.sku,
        quantity: Math.min(Math.max(item.quantity, 1), selectedProduct.stock_quantity),
        unitPrice: Number(selectedProduct.selling_price),
        unitCost: Number(selectedProduct.cost_price),
        stockQuantity: selectedProduct.stock_quantity,
        isUnavailable: false,
      };
    });

    markItemsChanged(nextItems);
  }

  function handleQuantityChange(itemKey: string, value: string) {
    const quantity = Math.max(1, Math.floor(Number(value) || 1));

    const selectedItem = editableItems.find((item) => item.key === itemKey);

    if (!selectedItem) {
      return;
    }

    if (quantity > selectedItem.stockQuantity) {
      setFormError(
        `Only ${selectedItem.stockQuantity} unit(s) are available for ${selectedItem.productName}.`
      );
      return;
    }

    const nextItems = editableItems.map((item) =>
      item.key === itemKey
        ? {
            ...item,
            quantity,
          }
        : item
    );

    markItemsChanged(nextItems);
  }

  function handleRemoveProduct(itemKey: string) {
    if (!canEditProducts) {
      setFormError('Products can only be edited while the order is pending.');
      return;
    }

    if (editableItems.length === 1) {
      setFormError('An order must contain at least one product.');
      return;
    }

    const nextItems = editableItems.filter((item) => item.key !== itemKey);

    markItemsChanged(nextItems);
  }
  async function handleSaveItems() {
    setFormError('');
    setSuccessMessage('');

    if (!canEditProducts) {
      setFormError('Products can only be edited while the order is pending.');
      return;
    }

    if (!itemsDirty) {
      setSuccessMessage('There are no product changes to save.');
      return;
    }

    if (editableItems.length === 0) {
      setFormError('Add at least one product to the order.');
      return;
    }

    const invalidItem = editableItems.find(
      (item) =>
        !item.productId ||
        item.isUnavailable ||
        item.quantity < 1 ||
        item.quantity > item.stockQuantity
    );

    if (invalidItem) {
      setFormError('Check all selected products and quantities before saving.');
      return;
    }

    setIsSavingItems(true);

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

      const { error: saveItemsError } = await supabase.rpc('replace_pending_order_items', {
        p_order_id: orderId,
        p_items: editableItems.map((item) => ({
          product_id: item.productId,
          quantity: item.quantity,
        })),
      });

      if (saveItemsError) {
        throw new Error(saveItemsError.message);
      }

      const { data: refreshedOrder, error: orderRefreshError } = await supabase
        .from('orders')
        .select(
          `
          subtotal,
          payment_status,
          updated_at
        `
        )
        .eq('id', orderId)
        .single();

      if (orderRefreshError || !refreshedOrder) {
        throw new Error(orderRefreshError?.message || 'Updated order could not be loaded.');
      }

      const { data: refreshedItems, error: itemsRefreshError } = await supabase
        .from('order_items')
        .select(
          `
          id,
          product_id,
          product_name,
          product_sku,
          quantity,
          unit_price,
          unit_cost,
          line_total
        `
        )
        .eq('order_id', orderId)
        .order('created_at', { ascending: true });

      if (itemsRefreshError) {
        throw new Error(itemsRefreshError.message);
      }

      const savedItems = (refreshedItems ?? []) as OrderItemRow[];

      setItems(savedItems);

      setEditableItems(
        savedItems.map((item) => {
          const linkedProduct = products.find((product) => product.id === item.product_id);

          return {
            key: item.id,
            productId: item.product_id ?? '',
            productName: linkedProduct?.name ?? item.product_name,
            productSku: linkedProduct?.sku ?? item.product_sku,
            quantity: item.quantity,
            unitPrice: Number(item.unit_price),
            unitCost: Number(item.unit_cost),
            stockQuantity: linkedProduct?.stock_quantity ?? 0,
            isUnavailable: !linkedProduct || !item.product_id,
          };
        })
      );

      setSubtotal(Number(refreshedOrder.subtotal) || 0);

      setPaymentStatus(refreshedOrder.payment_status as PaymentStatus);

      setUpdatedAt(refreshedOrder.updated_at);
      setItemsDirty(false);

      setSuccessMessage('Order products saved successfully.');

      router.refresh();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Order products could not be saved.');
    } finally {
      setIsSavingItems(false);
    }
  }
  function handleMarkFullRefund() {
    if (status !== 'cancelled' && status !== 'returned') {
      setFormError('Only cancelled or returned orders can be refunded.');
      return;
    }

    if (paidNumber <= 0) {
      setFormError('This order has no paid amount to refund.');
      return;
    }

    setRefundedAmount(String(paidNumber));
    setFormError('');
    setSuccessMessage('');
  }

  function handleClearRefund() {
    setRefundedAmount('0');
    setFormError('');
    setSuccessMessage('');
  }
  async function handleDeleteOrder() {
    const confirmed = window.confirm(
      `Delete order ${orderNumber} permanently?\n\n` +
        'This order and its order items will be permanently deleted. ' +
        'Reserved stock will be restored automatically.'
    );
    if (!confirmed) {
      return;
    }

    setFormError('');
    setSuccessMessage('');
    setIsDeleting(true);

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

      const { error: deleteError } = await supabase.rpc('delete_order_safely', {
        p_order_id: orderId,
      });

      if (deleteError) {
        throw new Error(deleteError.message);
      }

      router.replace('/dashboard/orders');
      router.refresh();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Order could not be deleted.');

      setIsDeleting(false);
    }
  }
  async function handleUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setFormError('');
    setSuccessMessage('');
    if (itemsDirty) {
      setFormError('Save product changes first, then update the order.');
      return;
    }
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

    if (!Number.isFinite(deliveryNumber) || deliveryNumber < 0) {
      setFormError('Enter valid delivery charges.');
      return;
    }

    if (!Number.isFinite(discountNumber) || discountNumber < 0) {
      setFormError('Enter a valid discount amount.');
      return;
    }

    if (discountNumber > subtotal + deliveryNumber) {
      setFormError('Discount cannot be greater than the order subtotal and delivery charges.');
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

    if (!Number.isFinite(refundedNumber) || refundedNumber < 0) {
      setFormError('Enter a valid refunded amount.');
      return;
    }

    if (refundedNumber > paidNumber) {
      setFormError('Refunded amount cannot be greater than the paid amount.');
      return;
    }

    if (refundedNumber > 0 && refundedNumber !== paidNumber) {
      setFormError('Only a full refund is currently supported.');
      return;
    }

    if (refundedNumber > 0 && status !== 'cancelled' && status !== 'returned') {
      setFormError('Only cancelled or returned orders can be refunded.');
      return;
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

      const { data, error } = await supabase
        .from('orders')
        .update({
          customer_name: cleanCustomerName,
          customer_phone: cleanCustomerPhone,
          customer_city: customerCity.trim() || null,
          customer_address: customerAddress.trim() || null,
          notes: notes.trim() || null,
          status,
          payment_method: paymentMethod,
          delivery_charges: deliveryNumber,
          discount_amount: discountNumber,
          paid_amount: paidNumber,
          refunded_amount: refundedNumber,
        })
        .eq('id', orderId)
        .select(
          `
            status,
            payment_status,
            subtotal,
            delivery_charges,
            discount_amount,
            total_amount,
            paid_amount,
            refunded_amount,
            balance_due,
            stock_deducted,
            updated_at
          `
        )
        .single();

      if (error || !data) {
        throw new Error(error?.message || 'Order could not be updated.');
      }

      const updatedOrder = data as {
        status: OrderStatus;
        payment_status: PaymentStatus;
        subtotal: number | string;
        delivery_charges: number | string;
        discount_amount: number | string;
        total_amount: number | string;
        paid_amount: number | string;
        refunded_amount: number | string;
        balance_due: number | string;
        stock_deducted: boolean;
        updated_at: string;
      };

      setStatus(updatedOrder.status);
      setPersistedStatus(updatedOrder.status);
      setPaymentStatus(updatedOrder.payment_status);
      setSubtotal(Number(updatedOrder.subtotal) || 0);
      setDeliveryCharges(String(updatedOrder.delivery_charges ?? 0));
      setDiscountAmount(String(updatedOrder.discount_amount ?? 0));
      setPaidAmount(String(updatedOrder.paid_amount ?? 0));
      setRefundedAmount(String(updatedOrder.refunded_amount ?? 0));
      setStockDeducted(updatedOrder.stock_deducted);
      setUpdatedAt(updatedOrder.updated_at);

      setSuccessMessage(
        updatedOrder.stock_deducted
          ? 'Order updated successfully. Product stock is reserved for this order.'
          : 'Order updated successfully.'
      );

      router.refresh();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Order could not be updated.');
    } finally {
      setIsSaving(false);
    }
  }

  const inputClass =
    'h-13 w-full rounded-xl border border-[#CFCBC2] bg-[#FAFAF8] px-4 text-sm text-[#17191C] outline-none transition placeholder:text-[#A2A49F] focus:border-[#2F6C5B] focus:ring-4 focus:ring-[#2F6C5B]/10';

  const labelClass = 'mb-2 block text-[11px] font-extrabold tracking-[0.07em] text-[#343732]';

  if (isLoading) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#F6F5F1]">
        <div className="text-center">
          <div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-[#D7E4DF] border-t-[#173F36]" />

          <p className="mt-4 text-sm font-bold text-[#666963]">Loading order...</p>
        </div>
      </main>
    );
  }

  if (loadError) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#F6F5F1] px-5">
        <section className="w-full max-w-lg rounded-2xl border border-[#D9D7D0] bg-white p-8 text-center">
          <p className="text-sm font-black text-red-700">Order could not be opened</p>

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
                MANAGE ORDER
              </span>
            </span>
          </Link>

          <Link
            href="/dashboard/orders"
            className="rounded-xl border border-[#D9D7D0] bg-white px-4 py-2.5 text-sm font-bold"
          >
            Back to orders
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-[1180px] px-5 py-10 sm:px-8 lg:px-10">
        <section className="mb-8">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-xs font-extrabold tracking-[0.14em] text-[#2F6C5B]">{orderNumber}</p>

            <span
              className={`rounded-full px-3 py-1 text-xs font-extrabold capitalize ${getStatusStyles(
                status
              )}`}
            >
              {status}
            </span>
          </div>

          <h1 className="mt-3 text-4xl font-black tracking-[-0.045em] sm:text-5xl">Manage order</h1>

          <p className="mt-3 text-sm leading-7 text-[#666963]">
            Update customer, payment and fulfilment information.
          </p>
        </section>

        <form onSubmit={handleUpdate} className="grid gap-6 lg:grid-cols-[1fr_340px]">
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
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>PHONE NUMBER</label>

                  <input
                    value={customerPhone}
                    onChange={(event) => setCustomerPhone(event.target.value)}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>CITY</label>

                  <input
                    value={customerCity}
                    onChange={(event) => setCustomerCity(event.target.value)}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>DELIVERY ADDRESS</label>

                  <input
                    value={customerAddress}
                    onChange={(event) => setCustomerAddress(event.target.value)}
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
                  className="w-full rounded-xl border border-[#CFCBC2] bg-[#FAFAF8] px-4 py-3 text-sm outline-none"
                />
              </div>
            </article>

            <article className="rounded-2xl border border-[#D9D7D0] bg-white p-6 sm:p-8">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E2E0DA] pb-5">
                <div>
                  <h2 className="text-xl font-black">Order products</h2>

                  <p className="mt-2 text-sm text-[#777A75]">
                    Products are locked after stock has been deducted.
                  </p>
                </div>

                <span
                  className={`rounded-full px-3 py-1.5 text-xs font-extrabold ${
                    stockDeducted
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {stockDeducted ? 'Stock deducted' : 'Stock not deducted'}
                </span>
              </div>

              <div className="mt-6 space-y-4">
                {canEditProducts ? (
                  <>
                    {editableItems.map((item) => (
                      <div
                        key={item.key}
                        className="rounded-2xl border border-[#E2E0DA] bg-[#FAFAF8] p-4"
                      >
                        <div className="grid gap-4 sm:grid-cols-[1fr_120px_auto] sm:items-end">
                          <div>
                            <label className={labelClass}>PRODUCT</label>

                            <select
                              value={item.productId}
                              onChange={(event) =>
                                handleProductChange(item.key, event.target.value)
                              }
                              className={inputClass}
                            >
                              {item.isUnavailable && (
                                <option value={item.productId}>
                                  {item.productName} (Unavailable)
                                </option>
                              )}

                              {products.map((product) => {
                                const selectedElsewhere = editableItems.some(
                                  (otherItem) =>
                                    otherItem.key !== item.key && otherItem.productId === product.id
                                );

                                return (
                                  <option
                                    key={product.id}
                                    value={product.id}
                                    disabled={selectedElsewhere || product.stock_quantity < 1}
                                  >
                                    {product.name}
                                    {product.sku ? ` (${product.sku})` : ''}
                                    {' - '}
                                    Stock {product.stock_quantity}
                                  </option>
                                );
                              })}
                            </select>
                          </div>

                          <div>
                            <label className={labelClass}>QUANTITY</label>

                            <input
                              type="number"
                              min="1"
                              max={Math.max(item.stockQuantity, 1)}
                              value={item.quantity}
                              onChange={(event) =>
                                handleQuantityChange(item.key, event.target.value)
                              }
                              disabled={item.isUnavailable}
                              className={inputClass}
                            />
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveProduct(item.key)}
                            disabled={editableItems.length === 1}
                            className="flex h-13 items-center justify-center rounded-xl border border-red-200 bg-red-50 px-4 text-sm font-extrabold text-red-700 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            Remove
                          </button>
                        </div>

                        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#E2E0DA] pt-4 text-sm text-[#777A75]">
                          <span>Available stock: {item.stockQuantity}</span>

                          <span>{formatCurrency(item.unitPrice)} each</span>

                          <strong className="text-[#17191C]">
                            {formatCurrency(item.quantity * item.unitPrice)}
                          </strong>
                        </div>

                        {item.isUnavailable && (
                          <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
                            This product is unavailable. Select another active product before
                            saving.
                          </p>
                        )}
                      </div>
                    ))}

                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <button
                        type="button"
                        onClick={handleAddProduct}
                        disabled={isSavingItems}
                        className="flex h-12 items-center justify-center rounded-xl border border-[#173F36] bg-white px-5 text-sm font-extrabold text-[#173F36] disabled:opacity-50"
                      >
                        + Add product
                      </button>

                      {itemsDirty && (
                        <button
                          type="button"
                          onClick={handleSaveItems}
                          disabled={isSavingItems}
                          className="flex h-12 items-center justify-center rounded-xl bg-[#173F36] px-5 text-sm font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isSavingItems ? 'Saving products...' : 'Save products'}
                        </button>
                      )}
                    </div>

                    {itemsDirty && (
                      <p className="text-xs font-bold text-amber-700">
                        Product changes are not saved yet.
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    {items.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-2xl border border-[#E2E0DA] bg-[#FAFAF8] p-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div>
                            <p className="font-black">{item.product_name}</p>

                            <p className="mt-1 text-xs text-[#777A75]">
                              {item.product_sku || 'No SKU'}
                            </p>
                          </div>

                          <strong>{formatCurrency(item.line_total)}</strong>
                        </div>

                        <div className="mt-4 flex flex-wrap justify-between gap-3 border-t border-[#E2E0DA] pt-4 text-sm text-[#777A75]">
                          <span>Quantity: {item.quantity}</span>

                          <span>{formatCurrency(item.unit_price)} each</span>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </article>

            <article className="rounded-2xl border border-[#D9D7D0] bg-white p-6 sm:p-8">
              <div className="border-b border-[#E2E0DA] pb-5">
                <h2 className="text-xl font-black">Payment details</h2>
              </div>

              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>PAYMENT METHOD</label>

                  <select
                    value={paymentMethod}
                    onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)}
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
                {(status === 'cancelled' || status === 'returned' || refundedNumber > 0) && (
                  <div className="sm:col-span-2">
                    <label className={labelClass}>REFUNDED AMOUNT</label>

                    <input
                      type="number"
                      value={refundedAmount}
                      readOnly
                      className={`${inputClass} cursor-not-allowed bg-slate-100`}
                    />

                    <div className="mt-3 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={handleMarkFullRefund}
                        disabled={paidNumber <= 0 || refundedNumber === paidNumber}
                        className="flex h-11 items-center justify-center rounded-xl bg-[#173F36] px-4 text-sm font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Mark full refund
                      </button>

                      {refundedNumber > 0 && (
                        <button
                          type="button"
                          onClick={handleClearRefund}
                          className="flex h-11 items-center justify-center rounded-xl border border-[#CFCBC2] bg-white px-4 text-sm font-extrabold"
                        >
                          Clear refund
                        </button>
                      )}
                    </div>

                    <p className="mt-3 text-xs leading-6 text-[#777A75]">
                      Only full refunds are currently supported.
                    </p>
                  </div>
                )}
              </div>
            </article>
          </section>

          <aside className="space-y-6">
            <article className="rounded-2xl border border-[#D9D7D0] bg-white p-6">
              <h2 className="text-lg font-black">Order status</h2>

              <div className="mt-5">
                <label className={labelClass}>STATUS</label>

                <select
                  value={status}
                  onChange={(event) => {
                    setStatus(event.target.value as OrderStatus);
                    setSuccessMessage('');
                  }}
                  className={inputClass}
                >
                  {availableStatusOptions.map((statusOption) => (
                    <option key={statusOption} value={statusOption}>
                      {formatStatusLabel(statusOption)}
                    </option>
                  ))}
                </select>
              </div>

              <p className="mt-4 text-xs leading-6 text-[#777A75]">
                Confirming the order deducts stock. Moving it back to Pending, Cancelled or Returned
                restores stock.
              </p>
            </article>

            <article className="rounded-2xl bg-[#173F36] p-6 text-white">
              <p className="text-[11px] font-extrabold tracking-[0.1em] text-white/60">
                ORDER SUMMARY
              </p>

              <div className="mt-5 space-y-4">
                <div className="flex justify-between">
                  <span className="text-white/65">Subtotal</span>
                  <strong>{formatCurrency(effectiveSubtotal)}</strong>
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
                  <strong>{formatCurrency(totalAmount)}</strong>
                </div>

                <div className="flex justify-between">
                  <span className="text-white/65">Paid</span>
                  <strong>{formatCurrency(paidNumber)}</strong>
                </div>
                {refundedNumber > 0 && (
                  <div className="flex justify-between">
                    <span className="text-white/65">Refunded</span>

                    <strong>-{formatCurrency(refundedNumber)}</strong>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-white/65">Balance due</span>

                  <strong>{formatCurrency(displayedBalanceDue)}</strong>
                </div>
              </div>

              <div className="mt-6 border-t border-white/15 pt-4">
                <span
                  className={`inline-flex rounded-full px-3 py-1.5 text-xs font-extrabold capitalize ${getPaymentStyles(
                    paymentStatus
                  )}`}
                >
                  {paymentStatus}
                </span>
              </div>
            </article>

            {stockDeducted && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold leading-6 text-emerald-800">
                Product stock has been deducted for this order.
              </div>
            )}

            {formError && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold leading-6 text-red-700">
                {formError}
              </div>
            )}

            {successMessage && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold leading-6 text-emerald-800">
                {successMessage}
              </div>
            )}

            <button
              type="submit"
              disabled={isSaving || isDeleting || isSavingItems}
              className="flex h-13 w-full items-center justify-center rounded-xl bg-[#173F36] px-5 text-sm font-extrabold text-white disabled:opacity-60"
            >
              {isSaving ? 'Saving order...' : 'Save changes →'}
            </button>
            <button
              type="button"
              onClick={handleDeleteOrder}
              disabled={isDeleting || isSaving || isSavingItems}
              className="flex h-13 w-full items-center justify-center rounded-xl border border-red-200 bg-red-50 px-5 text-sm font-extrabold text-red-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isDeleting ? 'Deleting order...' : 'Delete order'}
            </button>
            <article className="rounded-2xl border border-[#D9D7D0] bg-white p-5">
              <p className="text-xs leading-6 text-[#777A75]">
                Created:{' '}
                {new Intl.DateTimeFormat('en-PK', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                }).format(new Date(createdAt))}
              </p>

              <p className="mt-2 text-xs leading-6 text-[#777A75]">
                Last updated:{' '}
                {new Intl.DateTimeFormat('en-PK', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                }).format(new Date(updatedAt))}
              </p>
            </article>
          </aside>
        </form>
      </div>
    </main>
  );
}
