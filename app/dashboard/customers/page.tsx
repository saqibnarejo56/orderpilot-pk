import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type CustomerRow = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  city: string | null;
  address: string | null;
  first_order_at: string | null;
  last_order_at: string | null;
  created_at: string;
};

type CustomerOrderRow = {
  id: string;
  customer_id: string | null;
  status: string;
  total_amount: number | string;
  paid_amount: number | string;
  balance_due: number | string;
  refunded_amount: number | string;
  created_at: string;
};

type CustomerSummary = CustomerRow & {
  orderCount: number;
  totalOrderValue: number;
  collectedAmount: number;
  outstandingBalance: number;
  lastOrderAt: string | null;
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
    return 'No orders yet';
  }

  return new Intl.DateTimeFormat('en-PK', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

export default async function CustomersPage() {
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

  const [{ data: customerRows, error: customersError }, { data: orderRows, error: ordersError }] =
    await Promise.all([
      supabase
        .from('customers')
        .select(
          `
          id,
          name,
          phone,
          email,
          city,
          address,
          first_order_at,
          last_order_at,
          created_at
        `
        )
        .eq('store_id', store.id)
        .order('created_at', { ascending: false }),

      supabase
        .from('orders')
        .select(
          `
          id,
          customer_id,
          status,
          total_amount,
          paid_amount,
          balance_due,
          refunded_amount,
          created_at
        `
        )
        .eq('store_id', store.id)
        .order('created_at', { ascending: false }),
    ]);

  const customers = (customerRows ?? []) as CustomerRow[];
  const orders = (orderRows ?? []) as CustomerOrderRow[];

  const ordersByCustomer = new Map<string, CustomerOrderRow[]>();

  for (const order of orders) {
    if (!order.customer_id) {
      continue;
    }

    const existingOrders = ordersByCustomer.get(order.customer_id) ?? [];
    existingOrders.push(order);
    ordersByCustomer.set(order.customer_id, existingOrders);
  }

  const customerSummaries: CustomerSummary[] = customers
    .map((customer) => {
      const customerOrders = ordersByCustomer.get(customer.id) ?? [];

      const validOrders = customerOrders.filter(
        (order) => order.status !== 'cancelled' && order.status !== 'returned'
      );

      const totalOrderValue = validOrders.reduce(
        (total, order) => total + Number(order.total_amount || 0),
        0
      );

      const collectedAmount = validOrders.reduce(
        (total, order) =>
          total + Math.max(Number(order.paid_amount || 0) - Number(order.refunded_amount || 0), 0),
        0
      );

      const outstandingBalance = validOrders.reduce(
        (total, order) => total + Number(order.balance_due || 0),
        0
      );

      const latestOrder = customerOrders[0];

      return {
        ...customer,
        orderCount: customerOrders.length,
        totalOrderValue,
        collectedAmount,
        outstandingBalance,
        lastOrderAt: latestOrder?.created_at ?? customer.last_order_at,
      };
    })
    .sort((firstCustomer, secondCustomer) => {
      const firstTime = firstCustomer.lastOrderAt
        ? new Date(firstCustomer.lastOrderAt).getTime()
        : 0;

      const secondTime = secondCustomer.lastOrderAt
        ? new Date(secondCustomer.lastOrderAt).getTime()
        : 0;

      return secondTime - firstTime;
    });

  const totalCustomers = customerSummaries.length;

  const repeatCustomers = customerSummaries.filter((customer) => customer.orderCount > 1).length;

  const totalCollected = customerSummaries.reduce(
    (total, customer) => total + customer.collectedAmount,
    0
  );

  const totalOutstanding = customerSummaries.reduce(
    (total, customer) => total + customer.outstandingBalance,
    0
  );

  const pageError = customersError?.message || ordersError?.message || '';

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
                CUSTOMER MANAGEMENT
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

            <h1 className="mt-3 text-4xl font-black tracking-[-0.045em] sm:text-5xl">Customers</h1>

            <p className="mt-3 max-w-2xl text-sm leading-7 text-[#666963]">
              View customer activity, order history, collected payments and outstanding balances
              from one place.
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
            ['Total customers', totalCustomers.toString()],
            ['Repeat customers', repeatCustomers.toString()],
            ['Collected', formatCurrency(totalCollected)],
            ['Outstanding', formatCurrency(totalOutstanding)],
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
              <h2 className="text-lg font-black">Customer directory</h2>

              <p className="mt-1 text-sm text-[#777A75]">
                Customers are created automatically from orders placed with {store.name}.
              </p>
            </div>

            <p className="text-xs font-bold text-[#777A75]">
              {totalCustomers} {totalCustomers === 1 ? 'customer' : 'customers'}
            </p>
          </div>

          {pageError ? (
            <div className="px-6 py-16 text-center">
              <p className="text-sm font-black text-red-700">Customers could not be loaded</p>

              <p className="mt-2 text-sm text-[#777A75]">
                Check the customers table, order connection and Row Level Security policies.
              </p>
            </div>
          ) : customerSummaries.length === 0 ? (
            <div className="flex min-h-80 items-center justify-center px-6 py-16 text-center">
              <div className="max-w-md">
                <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#EAF1ED] text-2xl text-[#173F36]">
                  +
                </span>

                <h3 className="mt-5 text-xl font-black">No customers yet</h3>

                <p className="mt-3 text-sm leading-7 text-[#777A75]">
                  Create an order and the customer will automatically appear in this directory.
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
              <table className="w-full min-w-[1050px] border-collapse">
                <thead>
                  <tr className="border-b border-[#E2E0DA] bg-[#FAFAF8] text-left">
                    <th className="px-6 py-4 text-[11px] font-extrabold tracking-[0.08em] text-[#777A75]">
                      CUSTOMER
                    </th>

                    <th className="px-4 py-4 text-[11px] font-extrabold tracking-[0.08em] text-[#777A75]">
                      LOCATION
                    </th>

                    <th className="px-4 py-4 text-[11px] font-extrabold tracking-[0.08em] text-[#777A75]">
                      ORDERS
                    </th>

                    <th className="px-4 py-4 text-[11px] font-extrabold tracking-[0.08em] text-[#777A75]">
                      ORDER VALUE
                    </th>

                    <th className="px-4 py-4 text-[11px] font-extrabold tracking-[0.08em] text-[#777A75]">
                      OUTSTANDING
                    </th>

                    <th className="px-4 py-4 text-[11px] font-extrabold tracking-[0.08em] text-[#777A75]">
                      LAST ORDER
                    </th>

                    <th className="px-6 py-4 text-right text-[11px] font-extrabold tracking-[0.08em] text-[#777A75]">
                      ACTION
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {customerSummaries.map((customer) => (
                    <tr key={customer.id} className="border-b border-[#ECEAE5] last:border-b-0">
                      <td className="px-6 py-5">
                        <div>
                          <p className="font-black">{customer.name}</p>

                          <p className="mt-1 text-xs font-semibold text-[#777A75]">
                            {customer.phone}
                          </p>

                          {customer.email ? (
                            <p className="mt-1 text-xs text-[#8A8D87]">{customer.email}</p>
                          ) : null}
                        </div>
                      </td>

                      <td className="px-4 py-5">
                        <p className="text-sm font-semibold capitalize text-[#555852]">
                          {customer.city || 'Not provided'}
                        </p>

                        <p className="mt-1 max-w-[220px] truncate text-xs text-[#777A75]">
                          {customer.address || 'No address saved'}
                        </p>
                      </td>

                      <td className="px-4 py-5 text-sm font-black">{customer.orderCount}</td>

                      <td className="px-4 py-5 text-sm font-black">
                        {formatCurrency(customer.totalOrderValue)}
                      </td>

                      <td className="px-4 py-5">
                        <span
                          className={`inline-flex rounded-full px-3 py-1.5 text-xs font-extrabold ${
                            customer.outstandingBalance > 0
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {formatCurrency(customer.outstandingBalance)}
                        </span>
                      </td>

                      <td className="px-4 py-5 text-sm font-semibold text-[#555852]">
                        {formatDate(customer.lastOrderAt)}
                      </td>

                      <td className="px-6 py-5 text-right">
                        <Link
                          href={`/dashboard/customers/${customer.id}`}
                          className="text-sm font-extrabold text-[#175B46] transition hover:underline"
                        >
                          View
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
