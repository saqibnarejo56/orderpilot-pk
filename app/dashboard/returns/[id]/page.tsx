'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type ReturnStatus = 'requested' | 'approved' | 'rejected' | 'completed';

type RefundStatus = 'none' | 'pending' | 'refunded';

type ReturnRow = {
  id: string;
  store_id: string;
  order_id: string;
  return_number: string;
  status: ReturnStatus;
  reason: string;
  notes: string | null;
  return_value: number | string;
  refund_amount: number | string;
  refund_status: RefundStatus;
  review_notes: string | null;
  created_at: string;
  updated_at: string;
  reviewed_at: string | null;
  completed_at: string | null;
};

type ReturnItemRow = {
  id: string;
  order_item_id: string;
  product_id: string | null;
  product_name: string;
  product_sku: string | null;
  quantity: number;
  unit_price: number | string;
  unit_cost: number | string;
  return_value: number | string;
  restock: boolean;
};

type OrderRow = {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  customer_city: string | null;
  status: string;
  payment_status: string;
  total_amount: number | string;
  paid_amount: number | string;
  refunded_amount: number | string;
};

type CompletedReturnRow = {
  id: string;
  refund_amount: number | string;
};

function formatCurrency(value: number | string) {
  return new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

function formatDateTime(value: string | null) {
  if (!value) {
    return 'Not available';
  }

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
  if (status === 'completed') {
    return 'bg-emerald-100 text-emerald-800';
  }

  if (status === 'approved') {
    return 'bg-blue-100 text-blue-800';
  }

  if (status === 'rejected') {
    return 'bg-red-100 text-red-800';
  }

  return 'bg-amber-100 text-amber-800';
}

function getRefundStatusStyles(status: RefundStatus) {
  if (status === 'refunded') {
    return 'bg-emerald-100 text-emerald-800';
  }

  if (status === 'pending') {
    return 'bg-amber-100 text-amber-800';
  }

  return 'bg-slate-100 text-slate-700';
}

export default function ReturnDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const returnId = params.id;

  const [returnRecord, setReturnRecord] = useState<ReturnRow | null>(null);

  const [returnItems, setReturnItems] = useState<ReturnItemRow[]>([]);

  const [order, setOrder] = useState<OrderRow | null>(null);

  const [previousReturnRefunds, setPreviousReturnRefunds] = useState(0);

  const [reviewNotes, setReviewNotes] = useState('');

  const [refundAmount, setRefundAmount] = useState('0');

  const [isLoading, setIsLoading] = useState(true);

  const [isReviewing, setIsReviewing] = useState(false);

  const [isCompleting, setIsCompleting] = useState(false);

  const [loadError, setLoadError] = useState('');

  const [formError, setFormError] = useState('');

  const [successMessage, setSuccessMessage] = useState('');

  const loadReturn = useCallback(async () => {
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

      const { data: returnData, error: returnError } = await supabase
        .from('returns')
        .select(
          `
            id,
            store_id,
            order_id,
            return_number,
            status,
            reason,
            notes,
            return_value,
            refund_amount,
            refund_status,
            review_notes,
            created_at,
            updated_at,
            reviewed_at,
            completed_at
          `
        )
        .eq('id', returnId)
        .single();

      if (returnError || !returnData) {
        throw new Error(
          returnError?.message ||
            'Return could not be found or you do not have permission to access it.'
        );
      }

      const loadedReturn = returnData as ReturnRow;

      const [
        { data: itemRows, error: itemsError },
        { data: orderData, error: orderError },
        { data: completedReturns, error: completedReturnsError },
      ] = await Promise.all([
        supabase
          .from('return_items')
          .select(
            `
              id,
              order_item_id,
              product_id,
              product_name,
              product_sku,
              quantity,
              unit_price,
              unit_cost,
              return_value,
              restock
            `
          )
          .eq('return_id', loadedReturn.id)
          .order('created_at', {
            ascending: true,
          }),

        supabase
          .from('orders')
          .select(
            `
              id,
              order_number,
              customer_name,
              customer_phone,
              customer_city,
              status,
              payment_status,
              total_amount,
              paid_amount,
              refunded_amount
            `
          )
          .eq('id', loadedReturn.order_id)
          .single(),

        supabase
          .from('returns')
          .select(
            `
              id,
              refund_amount
            `
          )
          .eq('order_id', loadedReturn.order_id)
          .eq('status', 'completed')
          .neq('id', loadedReturn.id),
      ]);

      if (itemsError) {
        throw new Error(itemsError.message);
      }

      if (orderError || !orderData) {
        throw new Error(orderError?.message || 'Original order could not be loaded.');
      }

      if (completedReturnsError) {
        throw new Error(completedReturnsError.message);
      }

      const otherCompletedReturns = (completedReturns ?? []) as CompletedReturnRow[];

      const previousRefunds = otherCompletedReturns.reduce(
        (total, item) => total + Number(item.refund_amount || 0),
        0
      );

      setReturnRecord(loadedReturn);

      setReturnItems((itemRows ?? []) as ReturnItemRow[]);

      setOrder(orderData as OrderRow);

      setPreviousReturnRefunds(previousRefunds);

      setReviewNotes(loadedReturn.review_notes ?? '');

      if (loadedReturn.status === 'completed') {
        setRefundAmount(String(loadedReturn.refund_amount ?? 0));
      } else {
        setRefundAmount('0');
      }

      setLoadError('');
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Return could not be loaded.');
    } finally {
      setIsLoading(false);
    }
  }, [returnId, router]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadReturn();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [loadReturn]);

  const paidAmount = Number(order?.paid_amount || 0);

  const legacyRefundedAmount = Number(order?.refunded_amount || 0);

  const returnValue = Number(returnRecord?.return_value || 0);

  const remainingCollectedAmount = useMemo(() => {
    return Math.max(paidAmount - legacyRefundedAmount - previousReturnRefunds, 0);
  }, [paidAmount, legacyRefundedAmount, previousReturnRefunds]);

  const maximumRefund = useMemo(() => {
    return Math.min(returnValue, remainingCollectedAmount);
  }, [returnValue, remainingCollectedAmount]);

  const restockUnits = useMemo(() => {
    return returnItems.reduce((total, item) => {
      if (!item.restock) {
        return total;
      }

      return total + Number(item.quantity || 0);
    }, 0);
  }, [returnItems]);

  const nonRestockUnits = useMemo(() => {
    return returnItems.reduce((total, item) => {
      if (item.restock) {
        return total;
      }

      return total + Number(item.quantity || 0);
    }, 0);
  }, [returnItems]);

  async function handleReview(decision: 'approved' | 'rejected') {
    if (!returnRecord || returnRecord.status !== 'requested') {
      return;
    }

    setFormError('');
    setSuccessMessage('');
    setIsReviewing(true);

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

      const { error } = await supabase.rpc('review_return', {
        p_return_id: returnRecord.id,
        p_decision: decision,
        p_review_notes: reviewNotes.trim() || null,
      });

      if (error) {
        throw new Error(error.message);
      }

      await loadReturn();

      setSuccessMessage(
        decision === 'approved' ? 'Return approved successfully.' : 'Return rejected successfully.'
      );

      router.refresh();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Return could not be reviewed.');
    } finally {
      setIsReviewing(false);
    }
  }

  async function handleComplete() {
    if (!returnRecord || returnRecord.status !== 'approved') {
      return;
    }

    setFormError('');
    setSuccessMessage('');

    const refundNumber = Number(refundAmount);

    if (!Number.isFinite(refundNumber) || refundNumber < 0) {
      setFormError('Enter a valid refund amount.');
      return;
    }

    if (refundNumber > returnValue) {
      setFormError(`Refund cannot exceed the return value of ${formatCurrency(returnValue)}.`);
      return;
    }

    if (refundNumber > remainingCollectedAmount) {
      setFormError(
        `Refund cannot exceed the remaining collected amount of ${formatCurrency(
          remainingCollectedAmount
        )}.`
      );
      return;
    }

    setIsCompleting(true);

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

      const { error } = await supabase.rpc('complete_return', {
        p_return_id: returnRecord.id,
        p_refund_amount: refundNumber,
      });

      if (error) {
        throw new Error(error.message);
      }

      await loadReturn();

      setSuccessMessage(
        'Return completed successfully. Eligible stock and refund records have been updated.'
      );

      router.refresh();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Return could not be completed.');
    } finally {
      setIsCompleting(false);
    }
  }

  const inputClass =
    'h-12 w-full rounded-xl border border-[#CFCBC2] bg-[#FAFAF8] px-4 text-sm text-[#17191C] outline-none transition focus:border-[#2F6C5B] focus:ring-4 focus:ring-[#2F6C5B]/10';

  const labelClass = 'mb-2 block text-[11px] font-extrabold tracking-[0.07em] text-[#343732]';

  if (isLoading) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#F6F5F1]">
        <div className="text-center">
          <div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-[#D7E4DF] border-t-[#173F36]" />

          <p className="mt-4 text-sm font-bold text-[#666963]">Loading return...</p>
        </div>
      </main>
    );
  }

  if (loadError || !returnRecord || !order) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#F6F5F1] px-5">
        <section className="w-full max-w-lg rounded-2xl border border-[#D9D7D0] bg-white p-8 text-center">
          <p className="text-sm font-black text-red-700">Return could not be loaded</p>

          <p className="mt-3 text-sm leading-7 text-[#777A75]">
            {loadError || 'Return record is unavailable.'}
          </p>

          <Link
            href="/dashboard/returns"
            className="mt-6 inline-flex h-12 items-center justify-center rounded-xl bg-[#173F36] px-5 text-sm font-extrabold text-white"
          >
            Back to returns
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
                RETURN DETAILS
              </span>
            </span>
          </Link>

          <Link
            href="/dashboard/returns"
            className="rounded-xl border border-[#D9D7D0] bg-white px-4 py-2.5 text-sm font-bold text-[#434640] transition hover:bg-[#F3F2EE]"
          >
            Back to returns
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-[1220px] px-5 py-10 sm:px-8 lg:px-10">
        <section className="flex flex-col gap-5 border-b border-[#D9D7D0] pb-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-extrabold tracking-[0.14em] text-[#2F6C5B]">
              RETURNS MANAGEMENT
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-3">
              <h1 className="text-4xl font-black tracking-[-0.045em] sm:text-5xl">
                {returnRecord.return_number}
              </h1>

              <span
                className={`rounded-full px-3 py-1.5 text-xs font-extrabold capitalize ${getReturnStatusStyles(
                  returnRecord.status
                )}`}
              >
                {returnRecord.status}
              </span>
            </div>

            <p className="mt-3 text-sm text-[#666963]">
              Created {formatDateTime(returnRecord.created_at)}
            </p>
          </div>

          <Link
            href={`/dashboard/orders/${order.id}`}
            className="inline-flex h-12 items-center justify-center rounded-xl border border-[#D9D7D0] bg-white px-5 text-sm font-extrabold text-[#434640] transition hover:bg-[#F3F2EE]"
          >
            View original order
          </Link>
        </section>

        <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-2xl border border-[#D9D7D0] bg-white p-6">
            <p className="text-xs font-semibold text-[#777A75]">Return value</p>

            <p className="mt-4 text-2xl font-black">{formatCurrency(returnRecord.return_value)}</p>
          </article>

          <article className="rounded-2xl border border-[#D9D7D0] bg-white p-6">
            <p className="text-xs font-semibold text-[#777A75]">Refund recorded</p>

            <p className="mt-4 text-2xl font-black">{formatCurrency(returnRecord.refund_amount)}</p>
          </article>

          <article className="rounded-2xl border border-[#D9D7D0] bg-white p-6">
            <p className="text-xs font-semibold text-[#777A75]">Restock units</p>

            <p className="mt-4 text-2xl font-black">{restockUnits}</p>
          </article>

          <article className="rounded-2xl border border-[#D9D7D0] bg-white p-6">
            <p className="text-xs font-semibold text-[#777A75]">Refund status</p>

            <span
              className={`mt-4 inline-flex rounded-full px-3 py-1.5 text-xs font-extrabold capitalize ${getRefundStatusStyles(
                returnRecord.refund_status
              )}`}
            >
              {returnRecord.refund_status}
            </span>
          </article>
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
          <section className="space-y-6">
            <article className="rounded-2xl border border-[#D9D7D0] bg-white p-6 sm:p-8">
              <div className="border-b border-[#E2E0DA] pb-5">
                <h2 className="text-xl font-black">Original order</h2>
              </div>

              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                <div>
                  <p className={labelClass}>ORDER NUMBER</p>

                  <Link
                    href={`/dashboard/orders/${order.id}`}
                    className="text-sm font-black text-[#175B46] hover:underline"
                  >
                    {order.order_number}
                  </Link>
                </div>

                <div>
                  <p className={labelClass}>ORDER STATUS</p>

                  <p className="text-sm font-black capitalize">{order.status}</p>
                </div>

                <div>
                  <p className={labelClass}>CUSTOMER</p>

                  <p className="text-sm font-black">{order.customer_name}</p>

                  <p className="mt-1 text-xs text-[#777A75]">{order.customer_phone}</p>
                </div>

                <div>
                  <p className={labelClass}>ORDER TOTAL</p>

                  <p className="text-sm font-black">{formatCurrency(order.total_amount)}</p>
                </div>
              </div>
            </article>

            <article className="overflow-hidden rounded-2xl border border-[#D9D7D0] bg-white">
              <div className="border-b border-[#E2E0DA] px-6 py-5 sm:px-8">
                <h2 className="text-xl font-black">Returned items</h2>

                <p className="mt-2 text-sm text-[#777A75]">
                  Item snapshots captured when this return was created.
                </p>
              </div>

              <div className="divide-y divide-[#ECEAE5]">
                {returnItems.map((item) => (
                  <div
                    key={item.id}
                    className="grid gap-5 px-6 py-5 sm:px-8 lg:grid-cols-[1fr_auto]"
                  >
                    <div>
                      <p className="font-black">{item.product_name}</p>

                      <p className="mt-1 text-xs text-[#777A75]">
                        SKU: {item.product_sku || 'Not available'}
                      </p>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className="rounded-full bg-[#F0F0EC] px-3 py-1 text-xs font-bold text-[#666963]">
                          Qty: {item.quantity}
                        </span>

                        <span className="rounded-full bg-[#F0F0EC] px-3 py-1 text-xs font-bold text-[#666963]">
                          {formatCurrency(item.unit_price)} each
                        </span>

                        <span
                          className={`rounded-full px-3 py-1 text-xs font-bold ${
                            item.restock
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {item.restock ? 'Return to stock' : 'Do not restock'}
                        </span>
                      </div>
                    </div>

                    <div className="lg:text-right">
                      <p className="text-xs font-semibold text-[#777A75]">Return value</p>

                      <p className="mt-1 text-lg font-black">{formatCurrency(item.return_value)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </article>

            <article className="rounded-2xl border border-[#D9D7D0] bg-white p-6 sm:p-8">
              <div className="border-b border-[#E2E0DA] pb-5">
                <h2 className="text-xl font-black">Return reason</h2>
              </div>

              <div className="mt-6">
                <p className={labelClass}>REASON</p>

                <p className="text-sm font-black">{formatReason(returnRecord.reason)}</p>
              </div>

              <div className="mt-5">
                <p className={labelClass}>CUSTOMER / RETURN NOTES</p>

                <p className="rounded-xl bg-[#F7F7F4] p-4 text-sm leading-7 text-[#666963]">
                  {returnRecord.notes || 'No notes were added.'}
                </p>
              </div>
            </article>
          </section>

          <aside className="h-fit space-y-5 lg:sticky lg:top-6">
            {returnRecord.status === 'requested' ? (
              <article className="rounded-2xl border border-[#D9D7D0] bg-white p-6">
                <p className="text-xs font-extrabold tracking-[0.1em] text-[#777A75]">
                  REVIEW RETURN
                </p>

                <h2 className="mt-4 text-xl font-black">Approve or reject</h2>

                <p className="mt-2 text-sm leading-6 text-[#777A75]">
                  Approval does not change stock yet. Stock is restored only when the approved
                  return is completed.
                </p>

                <div className="mt-5">
                  <label className={labelClass}>REVIEW NOTES</label>

                  <textarea
                    value={reviewNotes}
                    onChange={(event) => setReviewNotes(event.target.value)}
                    rows={4}
                    placeholder="Optional inspection or decision notes..."
                    className="w-full rounded-xl border border-[#CFCBC2] bg-[#FAFAF8] px-4 py-3 text-sm outline-none focus:border-[#2F6C5B]"
                  />
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    disabled={isReviewing}
                    onClick={() => handleReview('approved')}
                    className="h-12 rounded-xl bg-[#173F36] px-4 text-sm font-extrabold text-white disabled:opacity-50"
                  >
                    {isReviewing ? 'Saving...' : 'Approve'}
                  </button>

                  <button
                    type="button"
                    disabled={isReviewing}
                    onClick={() => handleReview('rejected')}
                    className="h-12 rounded-xl border border-red-200 bg-red-50 px-4 text-sm font-extrabold text-red-700 disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              </article>
            ) : null}

            {returnRecord.status === 'approved' ? (
              <article className="rounded-2xl border border-[#D9D7D0] bg-white p-6">
                <p className="text-xs font-extrabold tracking-[0.1em] text-[#777A75]">
                  COMPLETE RETURN
                </p>

                <h2 className="mt-4 text-xl font-black">Restock & refund</h2>

                <p className="mt-2 text-sm leading-6 text-[#777A75]">
                  Completing this return will immediately restore all items marked for restocking.
                </p>

                <div className="mt-5 space-y-3 rounded-xl bg-[#F7F7F4] p-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-[#666963]">Return value</span>

                    <strong>{formatCurrency(returnValue)}</strong>
                  </div>

                  <div className="flex justify-between text-sm">
                    <span className="text-[#666963]">Remaining collected</span>

                    <strong>{formatCurrency(remainingCollectedAmount)}</strong>
                  </div>

                  <div className="flex justify-between border-t border-[#E2E0DA] pt-3 text-sm">
                    <span className="font-bold text-[#666963]">Maximum refund</span>

                    <strong>{formatCurrency(maximumRefund)}</strong>
                  </div>

                  <div className="flex justify-between text-sm">
                    <span className="text-[#666963]">Restock units</span>

                    <strong>{restockUnits}</strong>
                  </div>

                  {nonRestockUnits > 0 ? (
                    <div className="flex justify-between text-sm">
                      <span className="text-[#666963]">Non-restock units</span>

                      <strong>{nonRestockUnits}</strong>
                    </div>
                  ) : null}
                </div>

                <div className="mt-5">
                  <label className={labelClass}>REFUND AMOUNT</label>

                  <input
                    type="number"
                    min={0}
                    max={maximumRefund}
                    step="0.01"
                    value={refundAmount}
                    onChange={(event) => setRefundAmount(event.target.value)}
                    className={inputClass}
                  />

                  <p className="mt-2 text-xs leading-5 text-[#777A75]">
                    Enter 0 when no cash refund is required.
                  </p>
                </div>

                <button
                  type="button"
                  disabled={isCompleting}
                  onClick={handleComplete}
                  className="mt-5 h-12 w-full rounded-xl bg-[#173F36] px-4 text-sm font-extrabold text-white disabled:opacity-50"
                >
                  {isCompleting ? 'Completing...' : 'Complete return'}
                </button>
              </article>
            ) : null}

            {returnRecord.status === 'rejected' ? (
              <article className="rounded-2xl border border-red-200 bg-red-50 p-6">
                <p className="text-xs font-extrabold tracking-[0.1em] text-red-700">
                  RETURN REJECTED
                </p>

                <p className="mt-4 text-sm leading-7 text-red-800">
                  {returnRecord.review_notes ||
                    'This return request was rejected without additional notes.'}
                </p>

                <p className="mt-4 text-xs font-bold text-red-700">
                  Reviewed {formatDateTime(returnRecord.reviewed_at)}
                </p>
              </article>
            ) : null}

            {returnRecord.status === 'completed' ? (
              <article className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
                <p className="text-xs font-extrabold tracking-[0.1em] text-emerald-800">
                  RETURN COMPLETED
                </p>

                <h2 className="mt-4 text-xl font-black text-emerald-950">Processing finished</h2>

                <p className="mt-3 text-sm leading-7 text-emerald-900">
                  Stock restoration and refund information for this return have been recorded.
                </p>

                <div className="mt-5 rounded-xl bg-white/70 p-4">
                  <p className="text-xs font-semibold text-emerald-800">Refund recorded</p>

                  <p className="mt-2 text-2xl font-black text-emerald-950">
                    {formatCurrency(returnRecord.refund_amount)}
                  </p>

                  <p className="mt-3 text-xs font-bold text-emerald-800">
                    Completed {formatDateTime(returnRecord.completed_at)}
                  </p>
                </div>
              </article>
            ) : null}

            {returnRecord.review_notes && returnRecord.status !== 'rejected' ? (
              <article className="rounded-2xl border border-[#D9D7D0] bg-white p-6">
                <p className="text-xs font-extrabold tracking-[0.1em] text-[#777A75]">
                  REVIEW NOTES
                </p>

                <p className="mt-4 text-sm leading-7 text-[#666963]">{returnRecord.review_notes}</p>
              </article>
            ) : null}

            {formError ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
                <p className="text-sm font-black text-red-700">Action could not be completed</p>

                <p className="mt-2 text-sm leading-6 text-red-700">{formError}</p>
              </div>
            ) : null}

            {successMessage ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                <p className="text-sm font-black text-emerald-800">{successMessage}</p>
              </div>
            ) : null}
          </aside>
        </div>
      </div>
    </main>
  );
}
