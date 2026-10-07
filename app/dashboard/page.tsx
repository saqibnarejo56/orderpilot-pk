import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import {
  buildReturnFinancialMap,
  calculateOrderFinancials,
  type CompletedReturnFinancialRow,
  type OrderFinancialSummary,
} from '@/lib/order-financials';
import LogoutButton from './logout-button';

type DashboardOrder = {
  id: string;
  order_number: string;
  customer_name: string;
  status: string;
  total_amount: number | string;
  paid_amount: number | string;
  refunded_amount: number | string;
  created_at: string;
};

type DashboardProduct = {
  id: string;
  status: string;
  stock_quantity: number;
};

function formatCurrency(value: number | string) {
  return new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

function getOrderStatusStyles(status: string) {
  if (status === 'delivered') {
    return 'bg-emerald-100 text-emerald-800';
  }

  if (status === 'cancelled' || status === 'returned') {
    return 'bg-red-100 text-red-800';
  }

  if (status === 'confirmed' || status === 'processing') {
    return 'bg-blue-100 text-blue-800';
  }

  if (status === 'shipped') {
    return 'bg-cyan-100 text-cyan-800';
  }

  return 'bg-amber-100 text-amber-800';
}

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const fullName =
    typeof user.user_metadata?.full_name === 'string' ? user.user_metadata.full_name : 'Seller';

  const { data: store, error: storeError } = await supabase
    .from('stores')
    .select('id, name')
    .eq('owner_id', user.id)
    .single();

  if (storeError || !store) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#F6F5F1] px-5">
        <section className="w-full max-w-lg rounded-2xl border border-[#D9D7D0] bg-white p-8 text-center">
          <h1 className="text-2xl font-black">Store could not be loaded</h1>

          <p className="mt-3 text-sm text-[#666963]">Your store record could not be found.</p>
        </section>
      </main>
    );
  }

  const [
    { data: orderRows, error: ordersError },
    { data: productRows, error: productsError },
    { data: completedReturnRows, error: returnsError },
  ] = await Promise.all([
    supabase
      .from('orders')
      .select(
        `
          id,
          order_number,
          customer_name,
          status,
          total_amount,
          paid_amount,
          refunded_amount,
          created_at
        `
      )
      .eq('store_id', store.id)
      .order('created_at', { ascending: false }),

    supabase.from('products').select('id, status, stock_quantity').eq('store_id', store.id),

    supabase
      .from('returns')
      .select(
        `
          order_id,
          return_value,
          refund_amount
        `
      )
      .eq('store_id', store.id)
      .eq('status', 'completed'),
  ]);

  const orders = (orderRows ?? []) as DashboardOrder[];
  const products = (productRows ?? []) as DashboardProduct[];

  const completedReturns = (completedReturnRows ?? []) as CompletedReturnFinancialRow[];

  const returnFinancialMap = buildReturnFinancialMap(completedReturns);

  const financialsByOrder = new Map<string, OrderFinancialSummary>();

  for (const order of orders) {
    financialsByOrder.set(
      order.id,
      calculateOrderFinancials(
        {
          status: order.status,
          total_amount: order.total_amount,
          paid_amount: order.paid_amount,
          refunded_amount: order.refunded_amount,
        },
        returnFinancialMap.get(order.id)
      )
    );
  }

  const totalOrders = orders.length;

  const pendingOrders = orders.filter((order) => order.status === 'pending').length;

  const revenue = orders.reduce((total, order) => {
    const financials = financialsByOrder.get(order.id);

    return total + (financials?.recognizedRevenue ?? 0);
  }, 0);

  const availableProducts = products.filter(
    (product) => product.status === 'active' && Number(product.stock_quantity) > 0
  ).length;

  const recentOrders = orders.slice(0, 5);

  const dashboardError =
    ordersError?.message || productsError?.message || returnsError?.message || '';

  const storeName = store.name;

  return (
    <main className="min-h-screen bg-[#F6F5F1] text-[#17191C]">
      <header className="border-b border-[#D9D7D0] bg-white">
        <div className="mx-auto flex h-20 max-w-[1320px] items-center justify-between px-5 sm:px-8 lg:px-10">
          <Link href="/" className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-[10px] bg-[#173F36] text-[11px] font-black tracking-[0.08em] text-white">
              OP
            </span>

            <span>
              <span className="block text-[15px] font-extrabold tracking-[-0.025em]">
                OrderPilot PK
              </span>

              <span className="block text-[10px] font-semibold tracking-[0.08em] text-[#777A75]">
                SELLER DASHBOARD
              </span>
            </span>
          </Link>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-bold">{fullName}</p>
              <p className="mt-1 text-xs text-[#777A75]">{user.email}</p>
            </div>

            <LogoutButton />
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1320px] gap-8 px-5 py-10 sm:px-8 lg:grid-cols-[230px_1fr] lg:px-10">
        <aside className="h-fit rounded-2xl border border-[#D9D7D0] bg-white p-4">
          <div className="border-b border-[#E2E0DA] px-3 pb-5 pt-2">
            <p className="text-[10px] font-extrabold tracking-[0.1em] text-[#8A8D87]">STORE</p>

            <p className="mt-2 text-base font-black">{storeName}</p>
          </div>

          <nav className="mt-4 space-y-1 text-sm font-semibold">
            <Link
              href="/dashboard"
              className="block rounded-xl bg-[#EAF1ED] px-4 py-3 text-[#173F36]"
            >
              Overview
            </Link>

            <Link
              href="/dashboard/orders"
              className="block rounded-xl px-4 py-3 text-[#666963] transition hover:bg-[#F3F2EE]"
            >
              Orders
            </Link>

            <Link
              href="/dashboard/products"
              className="block rounded-xl px-4 py-3 text-[#666963] transition hover:bg-[#F3F2EE]"
            >
              Products
            </Link>

            <Link
              href="/dashboard/customers"
              className="block rounded-xl px-4 py-3 text-[#434640] transition hover:bg-[#F3F2EE]"
            >
              Customers
            </Link>

            <Link
              href="/dashboard/inventory"
              className="block rounded-xl px-4 py-3 text-[#434640] transition hover:bg-[#F3F2EE]"
            >
              Inventory
            </Link>

            <Link
              href="/dashboard/returns"
              className="block rounded-xl px-4 py-3 text-[#434640] transition hover:bg-[#F3F2EE]"
            >
              Returns
            </Link>
          </nav>
        </aside>

        <section>
          <div>
            <p className="text-xs font-extrabold tracking-[0.14em] text-[#2F6C5B]">
              SELLER OVERVIEW
            </p>

            <h1 className="mt-3 text-4xl font-black tracking-[-0.045em]">Welcome, {fullName}.</h1>

            <p className="mt-3 text-sm leading-7 text-[#666963]">
              Your seller account is connected successfully. Review orders, products, customers,
              inventory and returns from one place.
            </p>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ['Total orders', totalOrders.toString()],
              ['Pending orders', pendingOrders.toString()],
              ['Revenue', formatCurrency(revenue)],
              ['Available products', availableProducts.toString()],
            ].map(([label, value]) => (
              <article key={label} className="rounded-2xl border border-[#D9D7D0] bg-white p-6">
                <p className="text-xs font-semibold text-[#777A75]">{label}</p>

                <p className="mt-4 text-3xl font-black tracking-[-0.04em]">{value}</p>
              </article>
            ))}
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-2xl border border-[#D9D7D0] bg-white p-6">
              <div className="flex items-center justify-between border-b border-[#E2E0DA] pb-5">
                <div>
                  <h2 className="text-lg font-black">Recent orders</h2>

                  <p className="mt-1 text-sm text-[#777A75]">
                    Recent orders with return-adjusted values.
                  </p>
                </div>
              </div>

              {dashboardError ? (
                <div className="flex min-h-56 items-center justify-center text-center">
                  <p className="text-sm font-bold text-red-700">
                    Dashboard data could not be loaded.
                  </p>
                </div>
              ) : recentOrders.length === 0 ? (
                <div className="flex min-h-56 items-center justify-center text-center">
                  <div>
                    <p className="text-sm font-black">No orders yet</p>

                    <p className="mt-2 max-w-sm text-sm leading-6 text-[#777A75]">
                      Add products and create your first customer order.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-[#E2E0DA]">
                  {recentOrders.map((order) => {
                    const financials = financialsByOrder.get(order.id);

                    if (!financials) {
                      return null;
                    }

                    return (
                      <div
                        key={order.id}
                        className="flex flex-col gap-4 py-4 first:pt-5 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div>
                          <p className="text-sm font-black">{order.order_number}</p>

                          <p className="mt-1 text-xs text-[#777A75]">{order.customer_name}</p>
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                          <div className="text-right">
                            <strong className="text-sm">
                              {formatCurrency(financials.effectiveTotal)}
                            </strong>

                            {financials.completedReturnValue > 0 && (
                              <p className="mt-1 text-[11px] font-semibold text-[#2F6C5B]">
                                Returned {formatCurrency(financials.completedReturnValue)}
                              </p>
                            )}
                          </div>

                          <span
                            className={`rounded-full px-3 py-1 text-xs font-extrabold capitalize ${getOrderStatusStyles(
                              order.status
                            )}`}
                          >
                            {order.status}
                          </span>

                          <Link
                            href={`/dashboard/orders/${order.id}`}
                            className="text-sm font-extrabold text-[#175B46] hover:underline"
                          >
                            Manage
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-[#D9D7D0] bg-[#173F36] p-6 text-white">
              <p className="text-xs font-extrabold tracking-[0.1em] text-white/55">
                ACCOUNT STATUS
              </p>

              <h2 className="mt-5 text-2xl font-black">Seller account connected</h2>

              <p className="mt-3 text-sm leading-7 text-white/70">
                Your Supabase authentication session is working and this dashboard is protected.
              </p>

              <div className="mt-7 rounded-xl bg-white/10 p-4">
                <p className="text-xs font-semibold text-white/60">Signed in as</p>

                <p className="mt-2 break-all text-sm font-bold">{user.email}</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
