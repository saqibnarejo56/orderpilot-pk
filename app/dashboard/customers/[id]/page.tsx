import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'returned';

type PaymentStatus = 'unpaid' | 'partial' | 'paid' | 'refunded';

type CustomerRow = {
  id: string;
  store_id: string;
  name: string;
  phone: string;
  email: string | null;
  city: string | null;
  address: string | null;
  notes: string | null;
  first_order_at: string | null;
  last_order_at: string | null;
  created_at: string;
  updated_at: string;
};

type CustomerOrderRow = {
  id: string;
  order_number: string;
  status: OrderStatus;
  payment_status: PaymentStatus;
  payment_method: string;
  total_amount: number | string;
  paid_amount: number | string;
  refunded_amount: number | string;
  balance_due: number | string;
  created_at: string;
};

type CustomerDetailPageProps = {
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

function formatDate(value: string | null) {
  if (!value) {
    return 'Not available';
  }

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
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

function formatPaymentMethod(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
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

export default async function CustomerDetailPage({ params }: CustomerDetailPageProps) {
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
            className="mt-7 inline-flex h-12 items-center justify-center rounded-xl bg-[#173F36] px-5 text-sm font-extrabold text-white"
          >
            Return to dashboard
          </Link>
        </section>
      </main>
    );
  }

  const { data: customerRow, error: customerError } = await supabase
    .from('customers')
    .select(
      `
          id,
          store_id,
          name,
          phone,
          email,
          city,
          address,
          notes,
          first_order_at,
          last_order_at,
          created_at,
          updated_at
        `
    )
    .eq('id', id)
    .eq('store_id', store.id)
    .single();

  if (customerError || !customerRow) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#F6F5F1] px-5 text-[#17191C]">
        <section className="w-full max-w-lg rounded-2xl border border-[#D9D7D0] bg-white p-8 text-center">
          <p className="text-xs font-extrabold tracking-[0.14em] text-red-700">
            CUSTOMER NOT FOUND
          </p>

          <h1 className="mt-4 text-3xl font-black tracking-[-0.04em]">
            Customer could not be loaded
          </h1>

          <p className="mt-4 text-sm leading-7 text-[#666963]">
            This customer does not exist or does not belong to your store.
          </p>

          <Link
            href="/dashboard/customers"
            className="mt-7 inline-flex h-12 items-center justify-center rounded-xl bg-[#173F36] px-5 text-sm font-extrabold text-white"
          >
            Back to customers
          </Link>
        </section>
      </main>
    );
  }

  const customer = customerRow as CustomerRow;

  const { data: orderRows, error: ordersError } = await supabase
    .from('orders')
    .select(
      `
          id,
          order_number,
          status,
          payment_status,
          payment_method,
          total_amount,
          paid_amount,
          refunded_amount,
          balance_due,
          created_at
        `
    )
    .eq('store_id', store.id)
    .eq('customer_id', customer.id)
    .order('created_at', { ascending: false });

  const orders = (orderRows ?? []) as CustomerOrderRow[];

  const validOrders = orders.filter(
    (order) => order.status !== 'cancelled' && order.status !== 'returned'
  );

  const totalOrders = orders.length;

  const deliveredOrders = orders.filter((order) => order.status === 'delivered').length;

  const totalOrderValue = validOrders.reduce(
    (total, order) => total + Number(order.total_amount || 0),
    0
  );

  const totalCollected = validOrders.reduce(
    (total, order) =>
      total + Math.max(Number(order.paid_amount || 0) - Number(order.refunded_amount || 0), 0),
    0
  );

  const totalOutstanding = validOrders.reduce(
    (total, order) => total + Number(order.balance_due || 0),
    0
  );

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
                CUSTOMER DETAILS
              </span>
            </span>
          </Link>

          <Link
            href="/dashboard/customers"
            className="rounded-xl border border-[#D9D7D0] bg-white px-4 py-2.5 text-sm font-bold text-[#434640] transition hover:bg-[#F3F2EE]"
          >
            Back to customers
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-[1320px] px-5 py-10 sm:px-8 lg:px-10">
        <section className="flex flex-col gap-6 border-b border-[#D9D7D0] pb-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-extrabold tracking-[0.14em] text-[#2F6C5B]">
              {store.name.toUpperCase()}
            </p>

            <h1 className="mt-3 text-4xl font-black tracking-[-0.045em] sm:text-5xl">
              {customer.name}
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-7 text-[#666963]">
              Review this customer&apos;s contact details, payment activity, outstanding balance and
              complete order history.
            </p>
          </div>

          <Link
            href="/dashboard/orders/new"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#173F36] px-5 text-sm font-extrabold text-white transition hover:bg-[#0F3029]"
          >
            Create another order
            <span aria-hidden="true">+</span>
          </Link>
        </section>

        <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ['Total orders', totalOrders.toString()],
            ['Delivered orders', deliveredOrders.toString()],
            ['Collected', formatCurrency(totalCollected)],
            ['Outstanding', formatCurrency(totalOutstanding)],
          ].map(([label, value]) => (
            <article key={label} className="rounded-2xl border border-[#D9D7D0] bg-white p-6">
              <p className="text-xs font-semibold text-[#777A75]">{label}</p>

              <p className="mt-4 text-3xl font-black tracking-[-0.04em]">{value}</p>
            </article>
          ))}
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
          <article className="rounded-2xl border border-[#D9D7D0] bg-white p-6">
            <div className="border-b border-[#E2E0DA] pb-5">
              <h2 className="text-lg font-black">Customer profile</h2>

              <p className="mt-1 text-sm text-[#777A75]">
                Contact and delivery information saved for this customer.
              </p>
            </div>

            <dl className="mt-5 space-y-5">
              <div>
                <dt className="text-[11px] font-extrabold tracking-[0.08em] text-[#777A75]">
                  PHONE NUMBER
                </dt>

                <dd className="mt-2 text-sm font-black">{customer.phone}</dd>
              </div>

              <div>
                <dt className="text-[11px] font-extrabold tracking-[0.08em] text-[#777A75]">
                  EMAIL ADDRESS
                </dt>

                <dd className="mt-2 text-sm font-semibold text-[#555852]">
                  {customer.email || 'Not provided'}
                </dd>
              </div>

              <div>
                <dt className="text-[11px] font-extrabold tracking-[0.08em] text-[#777A75]">
                  CITY
                </dt>

                <dd className="mt-2 text-sm font-semibold capitalize text-[#555852]">
                  {customer.city || 'Not provided'}
                </dd>
              </div>

              <div>
                <dt className="text-[11px] font-extrabold tracking-[0.08em] text-[#777A75]">
                  DELIVERY ADDRESS
                </dt>

                <dd className="mt-2 text-sm leading-7 text-[#555852]">
                  {customer.address || 'Not provided'}
                </dd>
              </div>

              <div className="grid gap-5 border-t border-[#E2E0DA] pt-5 sm:grid-cols-2">
                <div>
                  <dt className="text-[11px] font-extrabold tracking-[0.08em] text-[#777A75]">
                    FIRST ORDER
                  </dt>

                  <dd className="mt-2 text-sm font-semibold">
                    {formatDate(customer.first_order_at)}
                  </dd>
                </div>

                <div>
                  <dt className="text-[11px] font-extrabold tracking-[0.08em] text-[#777A75]">
                    LAST ORDER
                  </dt>

                  <dd className="mt-2 text-sm font-semibold">
                    {formatDate(customer.last_order_at)}
                  </dd>
                </div>
              </div>
            </dl>

            {customer.notes ? (
              <div className="mt-6 rounded-xl bg-[#F6F5F1] p-4">
                <p className="text-[11px] font-extrabold tracking-[0.08em] text-[#777A75]">
                  INTERNAL NOTE
                </p>

                <p className="mt-2 text-sm leading-7 text-[#555852]">{customer.notes}</p>
              </div>
            ) : null}
          </article>

          <article className="rounded-2xl border border-[#D9D7D0] bg-[#173F36] p-6 text-white">
            <p className="text-xs font-extrabold tracking-[0.12em] text-[#B9D2C9]">
              CUSTOMER VALUE
            </p>

            <h2 className="mt-4 text-2xl font-black tracking-[-0.035em]">
              Payment and order summary
            </h2>

            <div className="mt-8 space-y-5">
              <div className="flex items-center justify-between gap-5">
                <span className="text-sm text-[#D3E1DC]">Total order value</span>

                <strong className="text-lg">{formatCurrency(totalOrderValue)}</strong>
              </div>

              <div className="flex items-center justify-between gap-5">
                <span className="text-sm text-[#D3E1DC]">Amount collected</span>

                <strong className="text-lg">{formatCurrency(totalCollected)}</strong>
              </div>

              <div className="flex items-center justify-between gap-5">
                <span className="text-sm text-[#D3E1DC]">Outstanding balance</span>

                <strong className="text-lg">{formatCurrency(totalOutstanding)}</strong>
              </div>

              <div className="border-t border-white/15 pt-5">
                <p className="text-xs leading-6 text-[#B9D2C9]">
                  Cancelled and returned orders are excluded from customer value and outstanding
                  totals.
                </p>
              </div>
            </div>
          </article>
        </section>

        <section className="mt-6 overflow-hidden rounded-2xl border border-[#D9D7D0] bg-white">
          <div className="flex flex-col gap-3 border-b border-[#E2E0DA] px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-black">Order history</h2>

              <p className="mt-1 text-sm text-[#777A75]">All orders linked to {customer.name}.</p>
            </div>

            <p className="text-xs font-bold text-[#777A75]">
              {totalOrders} {totalOrders === 1 ? 'order' : 'orders'}
            </p>
          </div>

          {ordersError ? (
            <div className="px-6 py-16 text-center">
              <p className="text-sm font-black text-red-700">Order history could not be loaded</p>

              <p className="mt-2 text-sm text-[#777A75]">
                Check the order and customer connection.
              </p>
            </div>
          ) : orders.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <p className="text-lg font-black">No linked orders</p>

              <p className="mt-2 text-sm text-[#777A75]">
                New orders for this customer will appear here automatically.
              </p>
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
                      DATE
                    </th>

                    <th className="px-4 py-4 text-[11px] font-extrabold tracking-[0.08em] text-[#777A75]">
                      TOTAL
                    </th>

                    <th className="px-4 py-4 text-[11px] font-extrabold tracking-[0.08em] text-[#777A75]">
                      PAID
                    </th>

                    <th className="px-4 py-4 text-[11px] font-extrabold tracking-[0.08em] text-[#777A75]">
                      DUE
                    </th>

                    <th className="px-4 py-4 text-[11px] font-extrabold tracking-[0.08em] text-[#777A75]">
                      PAYMENT
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
                  {orders.map((order) => {
                    const dueAmount =
                      order.status === 'cancelled' || order.status === 'returned'
                        ? 0
                        : Number(order.balance_due || 0);

                    return (
                      <tr key={order.id} className="border-b border-[#ECEAE5] last:border-b-0">
                        <td className="px-6 py-5">
                          <p className="font-black">{order.order_number}</p>

                          <p className="mt-1 text-xs text-[#777A75]">
                            {formatPaymentMethod(order.payment_method)}
                          </p>
                        </td>

                        <td className="px-4 py-5 text-sm font-semibold text-[#555852]">
                          {formatDateTime(order.created_at)}
                        </td>

                        <td className="px-4 py-5 text-sm font-black">
                          {formatCurrency(order.total_amount)}
                        </td>

                        <td className="px-4 py-5 text-sm font-black">
                          {formatCurrency(order.paid_amount)}
                        </td>

                        <td className="px-4 py-5 text-sm font-black">
                          {formatCurrency(dueAmount)}
                        </td>

                        <td className="px-4 py-5">
                          <span
                            className={`inline-flex rounded-full px-3 py-1.5 text-xs font-extrabold capitalize ${getPaymentStatusStyles(
                              order.payment_status
                            )}`}
                          >
                            {order.payment_status}
                          </span>
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
                            className="text-sm font-extrabold text-[#175B46] transition hover:underline"
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
