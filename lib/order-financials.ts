export type OrderFinancialInput = {
  status: string;
  total_amount: number | string;
  paid_amount: number | string;
  refunded_amount: number | string;
};

export type CompletedReturnFinancialRow = {
  order_id: string;
  return_value: number | string;
  refund_amount: number | string;
};

export type ReturnFinancialSummary = {
  completedReturnValue: number;
  dedicatedReturnRefund: number;
};

export type OrderFinancialSummary = {
  originalTotal: number;
  completedReturnValue: number;
  effectiveTotal: number;
  paidAmount: number;
  legacyRefundedAmount: number;
  dedicatedReturnRefund: number;
  netCollected: number;
  outstandingBalance: number;
  customerCredit: number;
  recognizedRevenue: number;
  displayPaymentStatus: 'unpaid' | 'partial' | 'paid' | 'refunded';
};

export function buildReturnFinancialMap(
  rows: CompletedReturnFinancialRow[]
) {
  const map = new Map<string, ReturnFinancialSummary>();

  for (const row of rows) {
    const existing = map.get(row.order_id) ?? {
      completedReturnValue: 0,
      dedicatedReturnRefund: 0,
    };

    existing.completedReturnValue += Number(row.return_value || 0);
    existing.dedicatedReturnRefund += Number(row.refund_amount || 0);

    map.set(row.order_id, existing);
  }

  return map;
}

export function calculateOrderFinancials(
  order: OrderFinancialInput,
  returnSummary?: ReturnFinancialSummary
): OrderFinancialSummary {
  const originalTotal = Math.max(Number(order.total_amount || 0), 0);
  const paidAmount = Math.max(Number(order.paid_amount || 0), 0);

  const legacyRefundedAmount = Math.max(
    Number(order.refunded_amount || 0),
    0
  );

  const completedReturnValue = Math.max(
    Number(returnSummary?.completedReturnValue || 0),
    0
  );

  const dedicatedReturnRefund = Math.max(
    Number(returnSummary?.dedicatedReturnRefund || 0),
    0
  );

  if (order.status === 'cancelled' || order.status === 'returned') {
    return {
      originalTotal,
      completedReturnValue,
      effectiveTotal: 0,
      paidAmount,
      legacyRefundedAmount,
      dedicatedReturnRefund,
      netCollected: 0,
      outstandingBalance: 0,
      customerCredit: 0,
      recognizedRevenue: 0,
      displayPaymentStatus:
        legacyRefundedAmount > 0 || dedicatedReturnRefund > 0
          ? 'refunded'
          : 'unpaid',
    };
  }

  const effectiveTotal = Math.max(
    originalTotal - completedReturnValue,
    0
  );

  const netCollected = Math.max(
    paidAmount -
      legacyRefundedAmount -
      dedicatedReturnRefund,
    0
  );

  const outstandingBalance = Math.max(
    effectiveTotal - netCollected,
    0
  );

  const customerCredit = Math.max(
    netCollected - effectiveTotal,
    0
  );

  const recognizedRevenue = Math.min(
    netCollected,
    effectiveTotal
  );

  let displayPaymentStatus:
    | 'unpaid'
    | 'partial'
    | 'paid'
    | 'refunded';

  if (
    effectiveTotal === 0 &&
    netCollected === 0 &&
    (legacyRefundedAmount > 0 || dedicatedReturnRefund > 0)
  ) {
    displayPaymentStatus = 'refunded';
  } else if (netCollected <= 0) {
    displayPaymentStatus = 'unpaid';
  } else if (outstandingBalance > 0) {
    displayPaymentStatus = 'partial';
  } else {
    displayPaymentStatus = 'paid';
  }

  return {
    originalTotal,
    completedReturnValue,
    effectiveTotal,
    paidAmount,
    legacyRefundedAmount,
    dedicatedReturnRefund,
    netCollected,
    outstandingBalance,
    customerCredit,
    recognizedRevenue,
    displayPaymentStatus,
  };
}
