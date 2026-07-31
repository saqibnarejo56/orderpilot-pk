import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import InventoryAdjustmentForm from './inventory-adjustment-form';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type ProductRow = {
  id: string;
  name: string;
  sku: string | null;
  category: string | null;
  stock_quantity: number;
  low_stock_threshold: number;
  cost_price: number | string;
  status: 'draft' | 'active' | 'archived';
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
  product_id: string | null;
  product_name: string;
  product_sku: string | null;
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

function formatCurrency(value: number | string) {
  return new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
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

export default async function InventoryPage() {
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
            Your account is authenticated, but its store record could not be found.
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

  const [
    { data: productRows, error: productsError },
    { data: movementRows, error: movementsError },
  ] = await Promise.all([
    supabase
      .from('products')
      .select(
        `
          id,
          name,
          sku,
          category,
          stock_quantity,
          low_stock_threshold,
          cost_price,
          status
        `
      )
      .eq('store_id', store.id)
      .order('name', { ascending: true }),

    supabase
      .from('inventory_movements')
      .select(
        `
          id,
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
          created_at
        `
      )
      .eq('store_id', store.id)
      .order('created_at', { ascending: false })
      .limit(50),
  ]);

  const products = (productRows ?? []) as ProductRow[];
  const movements = (movementRows ?? []) as InventoryMovementRow[];

  const totalStockUnits = products.reduce(
    (total, product) => total + Number(product.stock_quantity || 0),
    0
  );

  const totalInventoryValue = products.reduce(
    (total, product) =>
      total + Number(product.stock_quantity || 0) * Number(product.cost_price || 0),
    0
  );

  const lowStockProducts = products.filter(
    (product) => product.stock_quantity > 0 && product.stock_quantity <= product.low_stock_threshold
  );

  const outOfStockProducts = products.filter((product) => product.stock_quantity === 0);

  const pageError = productsError?.message || movementsError?.message || '';

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
                INVENTORY MANAGEMENT
              </span>
            </span>
          </Link>

          <Link
            href="/dashboard"
            className="rounded-xl border border-[#D9D7D0] bg-white px-4 py-2.5 text-sm font-bold text-[#434640] transition hover:bg-[#F3F2EE]"
          >
            Back to dashboard
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-[1320px] px-5 py-10 sm:px-8 lg:px-10">
        <section className="flex flex-col gap-6 border-b border-[#D9D7D0] pb-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-extrabold tracking-[0.14em] text-[#2F6C5B]">
              {store.name.toUpperCase()}
            </p>

            <h1 className="mt-3 text-4xl font-black tracking-[-0.045em] sm:text-5xl">Inventory</h1>

            <p className="mt-3 max-w-2xl text-sm leading-7 text-[#666963]">
              Monitor current stock, inventory value, low-stock products and every recorded stock
              movement.
            </p>
          </div>

          <Link
            href="/dashboard/products/new"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#173F36] px-5 text-sm font-extrabold text-white transition hover:bg-[#0F3029]"
          >
            Add product
            <span aria-hidden="true">+</span>
          </Link>
        </section>

        <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ['Stock units', totalStockUnits.toString()],
            ['Inventory value', formatCurrency(totalInventoryValue)],
            ['Low stock', lowStockProducts.length.toString()],
            ['Out of stock', outOfStockProducts.length.toString()],
          ].map(([label, value]) => (
            <article key={label} className="rounded-2xl border border-[#D9D7D0] bg-white p-6">
              <p className="text-xs font-semibold text-[#777A75]">{label}</p>

              <p className="mt-4 text-3xl font-black tracking-[-0.04em]">{value}</p>
            </article>
          ))}
        </section>

        {pageError ? (
          <section className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-6 py-8">
            <p className="text-sm font-black text-red-700">Inventory data could not be loaded</p>

            <p className="mt-2 text-sm leading-7 text-red-700/80">
              Check the inventory migration, database permissions and Row Level Security policies.
            </p>
          </section>
        ) : null}
        {pageError ? (
          <section className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-6 py-8">
            <p className="text-sm font-black text-red-700">Inventory data could not be loaded</p>

            <p className="mt-2 text-sm leading-7 text-red-700/80">
              Check the inventory migration, database permissions and Row Level Security policies.
            </p>
          </section>
        ) : null}

        <InventoryAdjustmentForm
          products={products.map((product) => ({
            id: product.id,
            name: product.name,
            sku: product.sku,
            stockQuantity: product.stock_quantity,
          }))}
        />

        <section className="mt-6 overflow-hidden rounded-2xl border border-[#D9D7D0] bg-white"></section>
        <section className="mt-6 overflow-hidden rounded-2xl border border-[#D9D7D0] bg-white">
          <div className="flex flex-col gap-3 border-b border-[#E2E0DA] px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-black">Product inventory</h2>

              <p className="mt-1 text-sm text-[#777A75]">
                Current stock levels and low-stock thresholds for every product.
              </p>
            </div>

            <p className="text-xs font-bold text-[#777A75]">
              {products.length} {products.length === 1 ? 'product' : 'products'}
            </p>
          </div>

          {products.length === 0 ? (
            <div className="flex min-h-72 items-center justify-center px-6 py-16 text-center">
              <div className="max-w-md">
                <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#EAF1ED] text-2xl font-black text-[#173F36]">
                  +
                </span>

                <h3 className="mt-5 text-xl font-black">No inventory yet</h3>

                <p className="mt-3 text-sm leading-7 text-[#777A75]">
                  Create your first product and its opening stock will automatically appear here.
                </p>

                <Link
                  href="/dashboard/products/new"
                  className="mt-6 inline-flex h-12 items-center justify-center rounded-xl bg-[#173F36] px-5 text-sm font-extrabold text-white transition hover:bg-[#0F3029]"
                >
                  Add first product
                </Link>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] border-collapse">
                <thead>
                  <tr className="border-b border-[#E2E0DA] bg-[#FAFAF8] text-left">
                    <th className="px-6 py-4 text-[11px] font-extrabold tracking-[0.08em] text-[#777A75]">
                      PRODUCT
                    </th>

                    <th className="px-4 py-4 text-[11px] font-extrabold tracking-[0.08em] text-[#777A75]">
                      CATEGORY
                    </th>

                    <th className="px-4 py-4 text-[11px] font-extrabold tracking-[0.08em] text-[#777A75]">
                      CURRENT STOCK
                    </th>

                    <th className="px-4 py-4 text-[11px] font-extrabold tracking-[0.08em] text-[#777A75]">
                      LOW-STOCK ALERT
                    </th>

                    <th className="px-4 py-4 text-[11px] font-extrabold tracking-[0.08em] text-[#777A75]">
                      STOCK VALUE
                    </th>

                    <th className="px-6 py-4 text-right text-[11px] font-extrabold tracking-[0.08em] text-[#777A75]">
                      ACTION
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {products.map((product) => {
                    const isOutOfStock = product.stock_quantity === 0;

                    const isLowStock =
                      product.stock_quantity > 0 &&
                      product.stock_quantity <= product.low_stock_threshold;

                    const stockValue =
                      Number(product.stock_quantity || 0) * Number(product.cost_price || 0);

                    return (
                      <tr key={product.id} className="border-b border-[#ECEAE5] last:border-b-0">
                        <td className="px-6 py-5">
                          <p className="font-black">{product.name}</p>

                          <p className="mt-1 text-xs font-semibold text-[#777A75]">
                            {product.sku || 'No SKU'}
                          </p>
                        </td>

                        <td className="px-4 py-5 text-sm font-semibold capitalize text-[#555852]">
                          {product.category || 'Uncategorized'}
                        </td>

                        <td className="px-4 py-5">
                          <span
                            className={`inline-flex rounded-full px-3 py-1.5 text-xs font-extrabold ${
                              isOutOfStock
                                ? 'bg-red-100 text-red-800'
                                : isLowStock
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {product.stock_quantity}{' '}
                            {product.stock_quantity === 1 ? 'unit' : 'units'}
                          </span>
                        </td>

                        <td className="px-4 py-5 text-sm font-black">
                          {product.low_stock_threshold}
                        </td>

                        <td className="px-4 py-5 text-sm font-black">
                          {formatCurrency(stockValue)}
                        </td>

                        <td className="px-6 py-5 text-right">
                          <Link
                            href={`/dashboard/inventory/${product.id}`}
                            className="text-sm font-extrabold text-[#175B46] transition hover:underline"
                          >
                            View history
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="mt-6 overflow-hidden rounded-2xl border border-[#D9D7D0] bg-white">
          <div className="flex flex-col gap-3 border-b border-[#E2E0DA] px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-black">Recent stock movements</h2>

              <p className="mt-1 text-sm text-[#777A75]">
                Automatic and manual inventory changes are recorded permanently.
              </p>
            </div>

            <p className="text-xs font-bold text-[#777A75]">Latest {movements.length} movements</p>
          </div>

          {movements.length === 0 ? (
            <div className="flex min-h-64 items-center justify-center px-6 py-16 text-center">
              <div className="max-w-md">
                <h3 className="text-xl font-black">No stock movements yet</h3>

                <p className="mt-3 text-sm leading-7 text-[#777A75]">
                  Stock movements will appear here when products or orders change inventory.
                </p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1150px] border-collapse">
                <thead>
                  <tr className="border-b border-[#E2E0DA] bg-[#FAFAF8] text-left">
                    <th className="px-6 py-4 text-[11px] font-extrabold tracking-[0.08em] text-[#777A75]">
                      PRODUCT
                    </th>

                    <th className="px-4 py-4 text-[11px] font-extrabold tracking-[0.08em] text-[#777A75]">
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
                        <p className="font-black">{movement.product_name}</p>

                        <p className="mt-1 text-xs font-semibold text-[#777A75]">
                          {movement.product_sku || 'No SKU'}
                        </p>
                      </td>

                      <td className="px-4 py-5">
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
                        <p className="max-w-[300px] text-sm font-semibold leading-6 text-[#555852]">
                          {movement.reason}
                        </p>

                        {movement.notes ? (
                          <p className="mt-1 max-w-[300px] text-xs leading-5 text-[#8A8D87]">
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
