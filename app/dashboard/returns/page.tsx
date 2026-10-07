import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type ReturnStatus = 'requested' | 'approved' | 'rejected' | 'completed';
type RefundStatus = 'none' | 'pending' | 'refunded';

type ReturnRow = {
  id: string;
  order_id: string;
  return_number: string;
  status: ReturnStatus;
  reason: string;
  return_value: number | string;
  refund_amount: number | string;
  refund_status: RefundStatus;
  created_at: string;
};

type OrderRow = {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
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

function formatReason(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getReturnStatusStyles(status: ReturnStatus) {
  switch (status) {
    case 'completed':
      return 'bg-emerald-100 text-emerald-800';

    case 'approved':
      return 'bg-blue-100 text-blue-800';

    case 'rejected':
      return 'bg-red-100 text-red-800';

    default:
      return 'bg-amber-100 text-amber-800';
  }
}

function getRefundStatusStyles(status: RefundStatus) {
  switch (status) {
    case 'refunded':
      return 'bg-emerald-100 text-emerald-800';

    case 'pending':
      return 'bg-amber-100 text-amber-800';

    default:
      return 'bg-slate-100 text-slate-700';
  }
}

export default async function ReturnsPage() {
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

  const { data: returnData, error: returnsError } = await supabase
    .from('returns')
    .select(
      `
        id,
        order_id,
        return_number,
        status,
        reason,
        return_value,
        refund_amount,
        refund_status,
        created_at
      `
    )
    .eq('store_id', store.id)
    .order('created_at', { ascending: false });

  const returnRows = (returnData ?? []) as ReturnRow[];

  const orderIds = Array.from(new Set(returnRows.map((item) => item.order_id)));

  let orderRows: OrderRow[] = [];
  let orderLoadError = '';

  if (orderIds.length > 0) {
    const { data: ordersData, error: ordersError } = await supabase
      .from('orders')
      .select(
        `
          id,
          order_number,
          customer_name,
          customer_phone
        `
      )
      .in('id', orderIds);

    orderRows = (ordersData ?? []) as OrderRow[];
    orderLoadError = ordersError?.message ?? '';
  }

  const ordersById = new Map<string, OrderRow>();

  for (const order of orderRows) {
    ordersById.set(order.id, order);
  }

  const totalReturns = returnRows.length;

  const requestedReturns = returnRows.filter((item) => item.status === 'requested').length;

  const approvedReturns = returnRows.filter((item) => item.status === 'approved').length;

  const completedReturns = returnRows.filter((item) => item.status === 'completed').length;

  const totalRefunded = returnRows.reduce((total, item) => {
    if (item.status !== 'completed') {
      return total;
    }

    return total + Number(item.refund_amount || 0);
  }, 0);

  const pageError = returnsError?.message || orderLoadError;

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
                RETURNS MANAGEMENT
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

            <h1 className="mt-3 text-4xl font-black tracking-[-0.045em] sm:text-5xl">Returns</h1>

            <p className="mt-3 max-w-2xl text-sm leading-7 text-[#666963]">
              Manage customer return requests, approvals, stock restoration and refunds.
            </p>
          </div>

          <Link
            href="/dashboard/returns/new"
            className="inline-flex h-12 items-center justify-center rounded-xl bg-[#173F36] px-5 text-sm font-extrabold text-white transition hover:bg-[#0F3029]"
          >
            Create return +
          </Link>
        </section>

        <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <article className="rounded-2xl border border-[#D9D7D0] bg-white p-6">
            <p className="text-xs font-semibold text-[#777A75]">Total returns</p>
            <p className="mt-4 text-3xl font-black">{totalReturns}</p>
          </article>

          <article className="rounded-2xl border border-[#D9D7D0] bg-white p-6">
            <p className="text-xs font-semibold text-[#777A75]">Requested</p>
            <p className="mt-4 text-3xl font-black">{requestedReturns}</p>
          </article>

          <article className="rounded-2xl border border-[#D9D7D0] bg-white p-6">
            <p className="text-xs font-semibold text-[#777A75]">Approved</p>
            <p className="mt-4 text-3xl font-black">{approvedReturns}</p>
          </article>

          <article className="rounded-2xl border border-[#D9D7D0] bg-white p-6">
            <p className="text-xs font-semibold text-[#777A75]">Completed</p>
            <p className="mt-4 text-3xl font-black">{completedReturns}</p>
          </article>

          <article className="rounded-2xl border border-[#D9D7D0] bg-white p-6">
            <p className="text-xs font-semibold text-[#777A75]">Refunded</p>
            <p className="mt-4 text-3xl font-black">{formatCurrency(totalRefunded)}</p>
          </article>
        </section>

        <section className="mt-6 overflow-hidden rounded-2xl border border-[#D9D7D0] bg-white">
          <div className="flex items-center justify-between border-b border-[#E2E0DA] px-6 py-5">
            <div>
              <h2 className="text-lg font-black">Return history</h2>

              <p className="mt-1 text-sm text-[#777A75]">
                Return requests recorded for {store.name}.
              </p>
            </div>

            <p className="text-xs font-bold text-[#777A75]">
              {totalReturns} {totalReturns === 1 ? 'return' : 'returns'}
            </p>
          </div>

          {pageError ? (
            <div className="px-6 py-16 text-center">
              <p className="text-sm font-black text-red-700">Returns could not be loaded</p>

              <p className="mt-2 text-sm text-[#777A75]">{pageError}</p>
            </div>
          ) : returnRows.length === 0 ? (
            <div className="flex min-h-80 items-center justify-center px-6 py-16 text-center">
              <div className="max-w-md">
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#EAF1ED] text-xl font-black text-[#173F36]">
                  R
                </div>

                <h3 className="mt-5 text-xl font-black">No returns yet</h3>

                <p className="mt-3 text-sm leading-7 text-[#777A75]">
                  Returns created for shipped or delivered orders will appear here.
                </p>

                <Link
                  href="/dashboard/returns/new"
                  className="mt-6 inline-flex h-12 items-center justify-center rounded-xl bg-[#173F36] px-5 text-sm font-extrabold text-white"
                >
                  Create first return
                </Link>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1150px] border-collapse">
                <thead>
                  <tr className="border-b border-[#E2E0DA] bg-[#FAFAF8] text-left">
                    <th className="px-6 py-4 text-xs font-extrabold text-[#777A75]">RETURN</th>

                    <th className="px-4 py-4 text-xs font-extrabold text-[#777A75]">ORDER</th>

                    <th className="px-4 py-4 text-xs font-extrabold text-[#777A75]">CUSTOMER</th>

                    <th className="px-4 py-4 text-xs font-extrabold text-[#777A75]">REASON</th>

                    <th className="px-4 py-4 text-xs font-extrabold text-[#777A75]">VALUE</th>

                    <th className="px-4 py-4 text-xs font-extrabold text-[#777A75]">REFUND</th>

                    <th className="px-4 py-4 text-xs font-extrabold text-[#777A75]">STATUS</th>

                    <th className="px-6 py-4 text-right text-xs font-extrabold text-[#777A75]">
                      ACTION
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {returnRows.map((item) => {
                    const order = ordersById.get(item.order_id);

                    return (
                      <tr key={item.id} className="border-b border-[#ECEAE5] last:border-b-0">
                        <td className="px-6 py-5">
                          <p className="font-black">{item.return_number}</p>

                          <p className="mt-1 text-xs text-[#777A75]">
                            {formatDateTime(item.created_at)}
                          </p>
                        </td>

                        <td className="px-4 py-5">
                          {order ? (
                            <Link
                              href={`/dashboard/orders/${order.id}`}
                              className="text-sm font-black text-[#175B46] hover:underline"
                            >
                              {order.order_number}
                            </Link>
                          ) : (
                            <span className="text-sm text-[#777A75]">Unavailable</span>
                          )}
                        </td>

                        <td className="px-4 py-5">
                          <p className="text-sm font-black">
                            {order?.customer_name ?? 'Unavailable'}
                          </p>

                          {order?.customer_phone ? (
                            <p className="mt-1 text-xs text-[#777A75]">{order.customer_phone}</p>
                          ) : null}
                        </td>

                        <td className="px-4 py-5">
                          <p className="text-sm font-bold">{formatReason(item.reason)}</p>
                        </td>

                        <td className="px-4 py-5">
                          <p className="text-sm font-black">{formatCurrency(item.return_value)}</p>
                        </td>

                        <td className="px-4 py-5">
                          <p className="text-sm font-black">{formatCurrency(item.refund_amount)}</p>

                          <span
                            className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-extrabold capitalize ${getRefundStatusStyles(
                              item.refund_status
                            )}`}
                          >
                            {item.refund_status}
                          </span>
                        </td>

                        <td className="px-4 py-5">
                          <span
                            className={`inline-flex rounded-full px-3 py-1.5 text-xs font-extrabold capitalize ${getReturnStatusStyles(
                              item.status
                            )}`}
                          >
                            {item.status}
                          </span>
                        </td>

                        <td className="px-6 py-5 text-right">
                          <Link
                            href={`/dashboard/returns/${item.id}`}
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
