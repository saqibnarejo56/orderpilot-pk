import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type ProductStatus = 'draft' | 'active' | 'archived';

type ProductRow = {
  id: string;
  store_id: string;
  name: string;
  sku: string | null;
  category: string | null;
  selling_price: number | string;
  cost_price: number | string;
  stock_quantity: number;
  low_stock_threshold: number;
  status: ProductStatus;
  created_at: string;
};

type InventoryMovementType =
  | 'opening_balance'
  | 'order_reserved'
  | 'order_released'
  | 'manual_increase'
  | 'manual_decrease'
  | 'product_edit';

type InventoryMovementRow = {
  id: string;
  order_id: string | null;
  order_number: string | null;
  movement_type: InventoryMovementType;
  quantity_change: number;
  quantity_before: number;
  quantity_after: number;
  reason: string;
  notes: string | null;
  created_at: string;
};

type ProductInventoryPageProps = {
  params: Promise<{
    id: string;
  }>;
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

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('en-PK', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function getMovementLabel(type: InventoryMovementType) {
  const labels: Record<InventoryMovementType, string> = {
    opening_balance: 'Opening balance',
    order_reserved: 'Order reserved',
    order_released: 'Order released',
    manual_increase: 'Manual increase',
    manual_decrease: 'Manual decrease',
    product_edit: 'Product edit',
  };

  return labels[type];
}

function getMovementStyles(type: InventoryMovementType) {
  if (type === 'order_reserved' || type === 'manual_decrease') {
    return 'bg-red-100 text-red-800';
  }

  if (type === 'order_released' || type === 'manual_increase' || type === 'opening_balance') {
    return 'bg-emerald-100 text-emerald-800';
  }

  return 'bg-slate-100 text-slate-700';
}

function getProductStatusStyles(status: ProductStatus) {
  if (status === 'active') {
    return 'bg-emerald-100 text-emerald-800';
  }

  if (status === 'archived') {
    return 'bg-slate-200 text-slate-700';
  }

  return 'bg-amber-100 text-amber-800';
}

export default async function ProductInventoryPage({ params }: ProductInventoryPageProps) {
  const { id } = await params;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: store, error: storeError } = await supabase
    .from('stores')
    .select('id, name')
    .eq('owner_id', user.id)
    .single();

  if (storeError || !store) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#F6F5F1] px-5 text-[#17191C]">
        <section className="w-full max-w-lg rounded-2xl border border-[#D9D7D0] bg-white p-8 text-center">
          <p className="text-xs font-extrabold tracking-[0.14em] text-red-700">STORE UNAVAILABLE</p>

          <h1 className="mt-4 text-3xl font-black tracking-[-0.04em]">Store could not be loaded</h1>

          <p className="mt-4 text-sm leading-7 text-[#666963]">
            Your authenticated account is not connected to a valid store record.
          </p>

          <Link
            href="/dashboard"
            className="mt-7 inline-flex h-12 items-center justify-center rounded-xl bg-[#173F36] px-5 text-sm font-extrabold text-white transition hover:bg-[#0F3029]"
          >
            Return to dashboard
          </Link>
        </section>
      </main>
    );
  }

  const { data: productRow, error: productError } = await supabase
    .from('products')
    .select(
      `
          id,
          store_id,
          name,
          sku,
          category,
          selling_price,
          cost_price,
          stock_quantity,
          low_stock_threshold,
          status,
          created_at
        `
    )
    .eq('id', id)
    .eq('store_id', store.id)
    .maybeSingle();

  if (productError || !productRow) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#F6F5F1] px-5 text-[#17191C]">
        <section className="w-full max-w-lg rounded-2xl border border-[#D9D7D0] bg-white p-8 text-center">
          <p className="text-xs font-extrabold tracking-[0.14em] text-red-700">PRODUCT NOT FOUND</p>

          <h1 className="mt-4 text-3xl font-black tracking-[-0.04em]">
            Inventory record unavailable
          </h1>

          <p className="mt-4 text-sm leading-7 text-[#666963]">
            This product does not exist or does not belong to your store.
          </p>

          <Link
            href="/dashboard/inventory"
            className="mt-7 inline-flex h-12 items-center justify-center rounded-xl bg-[#173F36] px-5 text-sm font-extrabold text-white transition hover:bg-[#0F3029]"
          >
            Back to inventory
          </Link>
        </section>
      </main>
    );
  }

  const product = productRow as ProductRow;

  const { data: movementRows, error: movementsError } = await supabase
    .from('inventory_movements')
    .select(
      `
          id,
          order_id,
          order_number,
          movement_type,
          quantity_change,
          quantity_before,
          quantity_after,
          reason,
          notes,
          created_at
        `
    )
    .eq('store_id', store.id)
    .eq('product_id', product.id)
    .order('created_at', { ascending: false });

  const movements = (movementRows ?? []) as InventoryMovementRow[];

  const totalStockIn = movements.reduce(
    (total, movement) => (movement.quantity_change > 0 ? total + movement.quantity_change : total),
    0
  );

  const totalStockOut = movements.reduce(
    (total, movement) =>
      movement.quantity_change < 0 ? total + Math.abs(movement.quantity_change) : total,
    0
  );

  const manualAdjustments = movements.filter(
    (movement) =>
      movement.movement_type === 'manual_increase' || movement.movement_type === 'manual_decrease'
  ).length;

  const stockValue = Number(product.stock_quantity || 0) * Number(product.cost_price || 0);

  const isOutOfStock = product.stock_quantity === 0;

  const isLowStock =
    product.stock_quantity > 0 && product.stock_quantity <= product.low_stock_threshold;

  const inventoryStatus = isOutOfStock ? 'Out of stock' : isLowStock ? 'Low stock' : 'In stock';

  const inventoryStatusStyles = isOutOfStock
    ? 'bg-red-100 text-red-800'
    : isLowStock
      ? 'bg-amber-100 text-amber-800'
      : 'bg-emerald-100 text-emerald-800';

  return (
    <main className="min-h-screen bg-[#F6F5F1] text-[#17191C]">
      <header className="border-b border-[#D9D7D0] bg-white">
        <div className="mx-auto flex h-20 max-w-[1320px] items-center justify-between px-5 sm:px-8 lg:px-10">
          <Link href="/dashboard" className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-[10px] bg-[#173F36] text-[11px] font-black tracking-[0.08em] text-white">
              OP
            </span>

            <span>
              <span className="block text-[15px] font-extrabold tracking-[-0.025em]">
                OrderPilot PK
              </span>

              <span className="block text-[10px] font-semibold tracking-[0.08em] text-[#777A75]">
                PRODUCT INVENTORY
              </span>
            </span>
          </Link>

          <Link
            href="/dashboard/inventory"
            className="rounded-xl border border-[#D9D7D0] bg-white px-4 py-2.5 text-sm font-bold text-[#434640] transition hover:bg-[#F3F2EE]"
          >
            Back to inventory
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-[1320px] px-5 py-10 sm:px-8 lg:px-10">
        <section className="flex flex-col gap-6 border-b border-[#D9D7D0] pb-8 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-extrabold tracking-[0.14em] text-[#2F6C5B]">
              {store.name.toUpperCase()}
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-3">
              <h1 className="text-4xl font-black tracking-[-0.045em] sm:text-5xl">
                {product.name}
              </h1>

              <span
                className={`inline-flex rounded-full px-3 py-1.5 text-xs font-extrabold ${getProductStatusStyles(
                  product.status
                )}`}
              >
                {product.status}
              </span>
            </div>

            <p className="mt-3 text-sm font-semibold text-[#666963]">
              {product.sku || 'No SKU'} ·{' '}
              <span className="capitalize">{product.category || 'Uncategorized'}</span>
            </p>

            <p className="mt-2 max-w-2xl text-sm leading-7 text-[#777A75]">
              Review this product&apos;s current stock, inventory value and complete stock-movement
              history.
            </p>
          </div>

          <Link
            href={`/dashboard/products/${product.id}`}
            className="inline-flex h-12 items-center justify-center rounded-xl bg-[#173F36] px-5 text-sm font-extrabold text-white transition hover:bg-[#0F3029]"
          >
            Manage product
          </Link>
        </section>

        <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-2xl border border-[#D9D7D0] bg-white p-6">
            <p className="text-xs font-semibold text-[#777A75]">Current stock</p>

            <p className="mt-4 text-3xl font-black tracking-[-0.04em]">{product.stock_quantity}</p>

            <span
              className={`mt-4 inline-flex rounded-full px-3 py-1.5 text-xs font-extrabold ${inventoryStatusStyles}`}
            >
              {inventoryStatus}
            </span>
          </article>

          <article className="rounded-2xl border border-[#D9D7D0] bg-white p-6">
            <p className="text-xs font-semibold text-[#777A75]">Inventory value</p>

            <p className="mt-4 text-3xl font-black tracking-[-0.04em]">
              {formatCurrency(stockValue)}
            </p>

            <p className="mt-3 text-xs font-semibold text-[#777A75]">
              Cost per unit: {formatCurrency(product.cost_price)}
            </p>
          </article>

          <article className="rounded-2xl border border-[#D9D7D0] bg-white p-6">
            <p className="text-xs font-semibold text-[#777A75]">Total stock in</p>

            <p className="mt-4 text-3xl font-black tracking-[-0.04em] text-emerald-700">
              +{totalStockIn}
            </p>

            <p className="mt-3 text-xs font-semibold text-[#777A75]">
              Across all recorded increases
            </p>
          </article>

          <article className="rounded-2xl border border-[#D9D7D0] bg-white p-6">
            <p className="text-xs font-semibold text-[#777A75]">Total stock out</p>

            <p className="mt-4 text-3xl font-black tracking-[-0.04em] text-red-700">
              -{totalStockOut}
            </p>

            <p className="mt-3 text-xs font-semibold text-[#777A75]">
              Across orders and adjustments
            </p>
          </article>
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-3">
          <article className="rounded-2xl border border-[#D9D7D0] bg-white p-6">
            <p className="text-xs font-semibold text-[#777A75]">Low-stock threshold</p>

            <p className="mt-3 text-2xl font-black">{product.low_stock_threshold} units</p>
          </article>

          <article className="rounded-2xl border border-[#D9D7D0] bg-white p-6">
            <p className="text-xs font-semibold text-[#777A75]">Manual adjustments</p>

            <p className="mt-3 text-2xl font-black">{manualAdjustments}</p>
          </article>

          <article className="rounded-2xl border border-[#D9D7D0] bg-white p-6">
            <p className="text-xs font-semibold text-[#777A75]">Product created</p>

            <p className="mt-3 text-2xl font-black">{formatDate(product.created_at)}</p>
          </article>
        </section>

        <section className="mt-6 overflow-hidden rounded-2xl border border-[#D9D7D0] bg-white">
          <div className="flex flex-col gap-3 border-b border-[#E2E0DA] px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-black">Complete stock history</h2>

              <p className="mt-1 text-sm text-[#777A75]">
                Every automatic and manual stock change recorded for this product.
              </p>
            </div>

            <p className="text-xs font-bold text-[#777A75]">
              {movements.length} {movements.length === 1 ? 'movement' : 'movements'}
            </p>
          </div>

          {movementsError ? (
            <div className="px-6 py-16 text-center">
              <p className="text-sm font-black text-red-700">Stock history could not be loaded</p>

              <p className="mt-2 text-sm text-[#777A75]">
                Check the inventory migration and Row Level Security policies.
              </p>
            </div>
          ) : movements.length === 0 ? (
            <div className="flex min-h-72 items-center justify-center px-6 py-16 text-center">
              <div className="max-w-md">
                <h3 className="text-xl font-black">No stock movements yet</h3>

                <p className="mt-3 text-sm leading-7 text-[#777A75]">
                  Inventory changes will appear here when this product&apos;s stock is updated.
                </p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1050px] border-collapse">
                <thead>
                  <tr className="border-b border-[#E2E0DA] bg-[#FAFAF8] text-left">
                    <th className="px-6 py-4 text-[11px] font-extrabold tracking-[0.08em] text-[#777A75]">
                      MOVEMENT
                    </th>

                    <th className="px-4 py-4 text-[11px] font-extrabold tracking-[0.08em] text-[#777A75]">
                      CHANGE
                    </th>

                    <th className="px-4 py-4 text-[11px] font-extrabold tracking-[0.08em] text-[#777A75]">
                      STOCK
                    </th>

                    <th className="px-4 py-4 text-[11px] font-extrabold tracking-[0.08em] text-[#777A75]">
                      REFERENCE
                    </th>

                    <th className="px-4 py-4 text-[11px] font-extrabold tracking-[0.08em] text-[#777A75]">
                      REASON
                    </th>

                    <th className="px-6 py-4 text-right text-[11px] font-extrabold tracking-[0.08em] text-[#777A75]">
                      DATE
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {movements.map((movement) => (
                    <tr key={movement.id} className="border-b border-[#ECEAE5] last:border-b-0">
                      <td className="px-6 py-5">
                        <span
                          className={`inline-flex rounded-full px-3 py-1.5 text-xs font-extrabold ${getMovementStyles(
                            movement.movement_type
                          )}`}
                        >
                          {getMovementLabel(movement.movement_type)}
                        </span>
                      </td>

                      <td
                        className={`px-4 py-5 text-sm font-black ${
                          movement.quantity_change > 0 ? 'text-emerald-700' : 'text-red-700'
                        }`}
                      >
                        {movement.quantity_change > 0 ? '+' : ''}
                        {movement.quantity_change}
                      </td>

                      <td className="px-4 py-5 text-sm font-black">
                        {movement.quantity_before} → {movement.quantity_after}
                      </td>

                      <td className="px-4 py-5">
                        {movement.order_id && movement.order_number ? (
                          <Link
                            href={`/dashboard/orders/${movement.order_id}`}
                            className="text-sm font-extrabold text-[#175B46] transition hover:underline"
                          >
                            {movement.order_number}
                          </Link>
                        ) : (
                          <span className="text-sm font-semibold text-[#777A75]">—</span>
                        )}
                      </td>

                      <td className="px-4 py-5">
                        <p className="max-w-[340px] text-sm font-semibold leading-6 text-[#555852]">
                          {movement.reason}
                        </p>

                        {movement.notes ? (
                          <p className="mt-1 max-w-[340px] text-xs leading-5 text-[#8A8D87]">
                            {movement.notes}
                          </p>
                        ) : null}
                      </td>

                      <td className="px-6 py-5 text-right text-sm font-semibold text-[#555852]">
                        {formatDateTime(movement.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
