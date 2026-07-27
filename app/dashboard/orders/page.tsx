import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'returned';

type PaymentStatus = 'unpaid' | 'partial' | 'paid' | 'refunded';

type OrderRow = {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  status: OrderStatus;
  payment_status: PaymentStatus;
  payment_method: string;
  total_amount: number | string;
  paid_amount: number | string;
  balance_due: number | string;
  created_at: string;
};

function formatCurrency(value: number | string) {
  return new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

function getOrderStatusStyles(status: OrderStatus) {
  if (status === 'delivered') {
    return 'bg-emerald-100 text-emerald-800';
  }

  if (status === 'confirmed') {
    return 'bg-blue-100 text-blue-800';
  }

  if (status === 'processing') {
    return 'bg-violet-100 text-violet-800';
  }

  if (status === 'shipped') {
    return 'bg-cyan-100 text-cyan-800';
  }

  if (status === 'cancelled' || status === 'returned') {
    return 'bg-red-100 text-red-800';
  }

  return 'bg-amber-100 text-amber-800';
}

function getPaymentStatusStyles(status: PaymentStatus) {
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

export default async function OrdersPage() {
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
            className="mt-7 inline-flex h-12 items-center justify-center rounded-xl bg-[#173F36] px-5 text-sm font-extrabold text-white"
          >
            Return to dashboard
          </Link>
        </section>
      </main>
    );
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
        payment_status,
        payment_method,
        total_amount,
        paid_amount,
        balance_due,
        created_at
      `
    )
    .eq('store_id', store.id)
    .order('created_at', { ascending: false });

  const orders = (orderRows ?? []) as OrderRow[];

  const totalOrders = orders.length;

  const activeOrders = orders.filter((order) =>
    ['pending', 'confirmed', 'processing', 'shipped'].includes(order.status)
  ).length;

  const deliveredOrders = orders.filter((order) => order.status === 'delivered').length;

  const outstandingBalance = orders.reduce((total, order) => {
    if (order.status === 'cancelled' || order.status === 'returned') {
      return total;
    }

    return total + Number(order.balance_due || 0);
  }, 0);

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
                ORDER MANAGEMENT
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

            <h1 className="mt-3 text-4xl font-black tracking-[-0.045em] sm:text-5xl">Orders</h1>

            <p className="mt-3 max-w-2xl text-sm leading-7 text-[#666963]">
              Manage customer orders, payments, fulfilment status and outstanding balances.
            </p>
          </div>

          <Link
            href="/dashboard/orders/new"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#173F36] px-5 text-sm font-extrabold text-white transition hover:bg-[#0F3029]"
          >
            Create order
            <span aria-hidden="true">+</span>
          </Link>
        </section>

        <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ['Total orders', totalOrders.toString()],
            ['Active orders', activeOrders.toString()],
            ['Delivered', deliveredOrders.toString()],
            ['Outstanding', formatCurrency(outstandingBalance)],
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
              <h2 className="text-lg font-black">Order catalogue</h2>

              <p className="mt-1 text-sm text-[#777A75]">
                Orders currently saved inside {store.name}.
              </p>
            </div>

            <p className="text-xs font-bold text-[#777A75]">
              {totalOrders} {totalOrders === 1 ? 'order' : 'orders'}
            </p>
          </div>

          {ordersError ? (
            <div className="px-6 py-16 text-center">
              <p className="text-sm font-black text-red-700">Orders could not be loaded</p>

              <p className="mt-2 text-sm text-[#777A75]">
                Check your orders table and Row Level Security policies.
              </p>
            </div>
          ) : orders.length === 0 ? (
            <div className="flex min-h-80 items-center justify-center px-6 py-16 text-center">
              <div className="max-w-md">
                <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#EAF1ED] text-2xl text-[#173F36]">
                  +
                </span>

                <h3 className="mt-5 text-xl font-black">Create your first order</h3>

                <p className="mt-3 text-sm leading-7 text-[#777A75]">
                  Add customer information, choose products and manage payment and delivery status.
                </p>

                <Link
                  href="/dashboard/orders/new"
                  className="mt-6 inline-flex h-12 items-center justify-center rounded-xl bg-[#173F36] px-5 text-sm font-extrabold text-white transition hover:bg-[#0F3029]"
                >
                  Create first order
                </Link>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] border-collapse">
                <thead>
                  <tr className="border-b border-[#E2E0DA] bg-[#FAFAF8] text-left">
                    <th className="px-6 py-4 text-[11px] font-extrabold tracking-[0.08em] text-[#777A75]">
                      ORDER
                    </th>

                    <th className="px-4 py-4 text-[11px] font-extrabold tracking-[0.08em] text-[#777A75]">
                      CUSTOMER
                    </th>

                    <th className="px-4 py-4 text-[11px] font-extrabold tracking-[0.08em] text-[#777A75]">
                      TOTAL
                    </th>

                    <th className="px-4 py-4 text-[11px] font-extrabold tracking-[0.08em] text-[#777A75]">
                      PAYMENT
                    </th>

                    <th className="px-4 py-4 text-[11px] font-extrabold tracking-[0.08em] text-[#777A75]">
                      ORDER STATUS
                    </th>

                    <th className="px-6 py-4 text-right text-[11px] font-extrabold tracking-[0.08em] text-[#777A75]">
                      ACTION
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id} className="border-b border-[#ECEAE5] last:border-b-0">
                      <td className="px-6 py-5">
                        <p className="font-black">{order.order_number}</p>

                        <p className="mt-1 text-xs text-[#777A75]">
                          {new Intl.DateTimeFormat('en-PK', {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          }).format(new Date(order.created_at))}
                        </p>
                      </td>

                      <td className="px-4 py-5">
                        <p className="text-sm font-black">{order.customer_name}</p>

                        <p className="mt-1 text-xs text-[#777A75]">{order.customer_phone}</p>
                      </td>

                      <td className="px-4 py-5">
                        <p className="text-sm font-black">{formatCurrency(order.total_amount)}</p>

                        <p className="mt-1 text-xs text-[#777A75]">
                          Due:{' '}
                          {formatCurrency(
                            order.status === 'cancelled' || order.status === 'returned'
                              ? 0
                              : order.balance_due
                          )}
                        </p>
                      </td>

                      <td className="px-4 py-5">
                        <span
                          className={`inline-flex rounded-full px-3 py-1.5 text-xs font-extrabold capitalize ${getPaymentStatusStyles(
                            order.payment_status
                          )}`}
                        >
                          {order.payment_status}
                        </span>

                        <p className="mt-2 text-xs capitalize text-[#777A75]">
                          {order.payment_method.replaceAll('_', ' ')}
                        </p>
                      </td>

                      <td className="px-4 py-5">
                        <span
                          className={`inline-flex rounded-full px-3 py-1.5 text-xs font-extrabold capitalize ${getOrderStatusStyles(
                            order.status
                          )}`}
                        >
                          {order.status}
                        </span>
                      </td>

                      <td className="px-6 py-5 text-right">
                        <Link
                          href={`/dashboard/orders/${order.id}`}
                          className="text-sm font-extrabold text-[#175B46] hover:underline"
                        >
                          Manage
                        </Link>
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
