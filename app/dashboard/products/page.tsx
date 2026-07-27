import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import ProductsRealtimeRefresh from './products-realtime-refresh';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function formatCurrency(value: number | string) {
  return new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

function getStatusStyles(status: string) {
  if (status === 'active') {
    return 'bg-[#E8F3ED] text-[#175B46]';
  }

  if (status === 'archived') {
    return 'bg-[#EEEEEC] text-[#666963]';
  }

  return 'bg-[#FFF3DE] text-[#8A5415]';
}

export default async function ProductsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: store, error: storeError } = await supabase
    .from('stores')
    .select('id, name, slug')
    .eq('owner_id', user.id)
    .single();

  if (storeError || !store) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#F6F5F1] px-5 text-[#17191C]">
        <section className="w-full max-w-lg rounded-2xl border border-[#D9D7D0] bg-white p-8 text-center">
          <p className="text-xs font-extrabold tracking-[0.14em] text-[#2F6C5B]">
            STORE SETUP REQUIRED
          </p>

          <h1 className="mt-4 text-3xl font-black tracking-[-0.04em]">Store record not found</h1>

          <p className="mt-4 text-sm leading-7 text-[#666963]">
            Your account is authenticated, but its store record could not be loaded. Check the
            stores table and your seller account connection.
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

  const { data: productRows, error: productsError } = await supabase
    .from('products')
    .select(
      `
        id,
        name,
        sku,
        category,
        selling_price,
        cost_price,
        stock_quantity,
        low_stock_threshold,
        status,
        image_url,
        created_at
      `
    )
    .eq('store_id', store.id)
    .order('created_at', { ascending: false });

  const products = productRows ?? [];

  const totalProducts = products.length;

  const activeProducts = products.filter((product) => product.status === 'active').length;

  const lowStockProducts = products.filter(
    (product) => product.stock_quantity <= product.low_stock_threshold && product.stock_quantity > 0
  ).length;

  const inventoryValue = products.reduce(
    (total, product) =>
      total + Number(product.cost_price || 0) * Number(product.stock_quantity || 0),
    0
  );

  return (
    <main className="min-h-screen bg-[#F6F5F1] text-[#17191C]">
      <ProductsRealtimeRefresh />

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
                PRODUCT MANAGEMENT
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

            <h1 className="mt-3 text-4xl font-black tracking-[-0.045em] sm:text-5xl">Products</h1>

            <p className="mt-3 max-w-2xl text-sm leading-7 text-[#666963]">
              Add products, manage prices and monitor stock from one place. Every product on this
              page belongs only to your store.
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
            ['Total products', totalProducts.toString()],
            ['Active products', activeProducts.toString()],
            ['Low stock', lowStockProducts.toString()],
            ['Inventory value', formatCurrency(inventoryValue)],
          ].map(([label, value]) => (
            <article key={label} className="rounded-2xl border border-[#D9D7D0] bg-white p-6">
              <p className="text-xs font-semibold text-[#777A75]">{label}</p>

              <p className="mt-4 text-3xl font-black tracking-[-0.04em]">{value}</p>
            </article>
          ))}
        </section>

        <section className="mt-6 overflow-hidden rounded-2xl border border-[#D9D7D0] bg-white">
          <div className="flex flex-col gap-3 border-b border-[#E2E0DA] px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-black">Product catalogue</h2>

              <p className="mt-1 text-sm text-[#777A75]">
                Products currently saved inside {store.name}.
              </p>
            </div>

            <p className="text-xs font-bold text-[#777A75]">
              {totalProducts} {totalProducts === 1 ? 'product' : 'products'}
            </p>
          </div>

          {productsError ? (
            <div className="px-6 py-16 text-center">
              <p className="text-sm font-black text-red-700">Products could not be loaded</p>

              <p className="mt-2 text-sm text-[#777A75]">
                Check your products table and RLS policies.
              </p>
            </div>
          ) : products.length === 0 ? (
            <div className="flex min-h-80 items-center justify-center px-6 py-16 text-center">
              <div className="max-w-md">
                <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#EAF1ED] text-2xl text-[#173F36]">
                  +
                </span>

                <h3 className="mt-5 text-xl font-black">Add your first product</h3>

                <p className="mt-3 text-sm leading-7 text-[#777A75]">
                  Create a product with its price, cost, stock and SKU. It will remain securely
                  connected to {store.name}.
                </p>

                <Link
                  href="/dashboard/products/new"
                  className="mt-6 inline-flex h-12 items-center justify-center rounded-xl bg-[#173F36] px-5 text-sm font-extrabold text-white transition hover:bg-[#0F3029]"
                >
                  Create first product
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
                      SKU
                    </th>

                    <th className="px-4 py-4 text-[11px] font-extrabold tracking-[0.08em] text-[#777A75]">
                      PRICE
                    </th>

                    <th className="px-4 py-4 text-[11px] font-extrabold tracking-[0.08em] text-[#777A75]">
                      STOCK
                    </th>

                    <th className="px-4 py-4 text-[11px] font-extrabold tracking-[0.08em] text-[#777A75]">
                      STATUS
                    </th>

                    <th className="px-6 py-4 text-right text-[11px] font-extrabold tracking-[0.08em] text-[#777A75]">
                      ACTION
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {products.map((product) => {
                    const isLowStock =
                      product.stock_quantity <= product.low_stock_threshold &&
                      product.stock_quantity > 0;

                    return (
                      <tr key={product.id} className="border-b border-[#ECEAE5] last:border-b-0">
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-4">
                            <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl border border-[#E2E0DA] bg-[#F3F2EE]">
                              {product.image_url ? (
                                // Standard img is temporary until image domains
                                // and Supabase Storage are configured.
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={product.image_url}
                                  alt={product.name}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <span className="text-sm font-black text-[#777A75]">
                                  {product.name.slice(0, 2).toUpperCase()}
                                </span>
                              )}
                            </div>

                            <div>
                              <p className="font-black">{product.name}</p>

                              <p className="mt-1 text-xs text-[#777A75]">
                                {product.category || 'Uncategorized'}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-5 text-sm font-semibold text-[#555852]">
                          {product.sku || 'No SKU'}
                        </td>

                        <td className="px-4 py-5 text-sm font-black">
                          {formatCurrency(product.selling_price)}
                        </td>

                        <td className="px-4 py-5">
                          <p className="text-sm font-black">{product.stock_quantity}</p>

                          <p
                            className={`mt-1 text-xs font-semibold ${
                              isLowStock
                                ? 'text-[#B36516]'
                                : product.stock_quantity === 0
                                  ? 'text-red-700'
                                  : 'text-[#777A75]'
                            }`}
                          >
                            {product.stock_quantity === 0
                              ? 'Out of stock'
                              : isLowStock
                                ? 'Low stock'
                                : 'In stock'}
                          </p>
                        </td>

                        <td className="px-4 py-5">
                          <span
                            className={`inline-flex rounded-full px-3 py-1.5 text-xs font-extrabold capitalize ${getStatusStyles(
                              product.status
                            )}`}
                          >
                            {product.status}
                          </span>
                        </td>

                        <td className="px-6 py-5 text-right">
                          <Link
                            href={`/dashboard/products/${product.id}`}
                            className="text-sm font-extrabold text-[#175B46] hover:underline"
                          >
                            Manage
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
      </div>
    </main>
  );
}
