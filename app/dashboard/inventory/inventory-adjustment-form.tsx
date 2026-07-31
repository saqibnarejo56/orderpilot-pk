'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

type InventoryProductOption = {
  id: string;
  name: string;
  sku: string | null;
  stockQuantity: number;
};

type AdjustmentType = 'increase' | 'decrease';

type InventoryAdjustmentFormProps = {
  products: InventoryProductOption[];
};

const increaseReasons = [
  'New stock received',
  'Customer return restocked',
  'Physical count correction',
  'Other',
];

const decreaseReasons = [
  'Damaged item',
  'Lost item',
  'Supplier return',
  'Physical count correction',
  'Other',
];

export default function InventoryAdjustmentForm({ products }: InventoryAdjustmentFormProps) {
  const router = useRouter();

  const [selectedProductId, setSelectedProductId] = useState(products[0]?.id ?? '');

  const [adjustmentType, setAdjustmentType] = useState<AdjustmentType>('increase');

  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState(increaseReasons[0]);
  const [customReason, setCustomReason] = useState('');
  const [notes, setNotes] = useState('');

  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === selectedProductId) ?? null,
    [products, selectedProductId]
  );

  const reasonOptions = adjustmentType === 'increase' ? increaseReasons : decreaseReasons;

  const enteredQuantity = Number(quantity);

  const signedQuantity = adjustmentType === 'increase' ? enteredQuantity : -enteredQuantity;

  const projectedStock =
    selectedProduct && Number.isInteger(enteredQuantity) && enteredQuantity > 0
      ? selectedProduct.stockQuantity + signedQuantity
      : (selectedProduct?.stockQuantity ?? 0);

  function changeAdjustmentType(nextType: AdjustmentType) {
    setAdjustmentType(nextType);

    setReason(nextType === 'increase' ? increaseReasons[0] : decreaseReasons[0]);

    setCustomReason('');
    setFormError('');
    setSuccessMessage('');
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setFormError('');
    setSuccessMessage('');

    if (!selectedProduct) {
      setFormError('Select a product before adjusting stock.');
      return;
    }

    if (!Number.isInteger(enteredQuantity) || enteredQuantity <= 0) {
      setFormError('Adjustment quantity must be a whole number greater than zero.');
      return;
    }

    if (adjustmentType === 'decrease' && enteredQuantity > selectedProduct.stockQuantity) {
      setFormError(`Only ${selectedProduct.stockQuantity} unit(s) are currently available.`);
      return;
    }

    const finalReason = reason === 'Other' ? customReason.trim() : reason.trim();

    if (finalReason.length < 3) {
      setFormError('Enter a valid reason for this stock adjustment.');
      return;
    }

    setIsSaving(true);

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

      const { error: adjustmentError } = await supabase.rpc('adjust_inventory_stock', {
        p_product_id: selectedProduct.id,
        p_quantity_change: signedQuantity,
        p_reason: finalReason,
        p_notes: notes.trim() || null,
      });

      if (adjustmentError) {
        throw new Error(adjustmentError.message);
      }

      setQuantity('');
      setCustomReason('');
      setNotes('');

      setSuccessMessage(
        `${selectedProduct.name} inventory updated by ${
          signedQuantity > 0 ? '+' : ''
        }${signedQuantity} unit(s).`
      );

      router.refresh();
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : 'Inventory adjustment could not be saved.'
      );
    } finally {
      setIsSaving(false);
    }
  }

  const inputClass =
    'h-12 w-full rounded-xl border border-[#CFCBC2] bg-[#FAFAF8] px-4 text-sm font-semibold text-[#17191C] outline-none transition placeholder:text-[#A2A49F] focus:border-[#2F6C5B] focus:ring-4 focus:ring-[#2F6C5B]/10';

  const labelClass = 'mb-2 block text-[11px] font-extrabold tracking-[0.08em] text-[#555852]';

  return (
    <section className="mt-6 overflow-hidden rounded-2xl border border-[#D9D7D0] bg-white">
      <div className="border-b border-[#E2E0DA] px-6 py-5">
        <h2 className="text-lg font-black">Manual stock adjustment</h2>

        <p className="mt-1 text-sm leading-6 text-[#777A75]">
          Add or remove stock while keeping a permanent reason and audit record.
        </p>
      </div>

      {products.length === 0 ? (
        <div className="px-6 py-14 text-center">
          <p className="font-black">No products available</p>

          <p className="mt-2 text-sm text-[#777A75]">
            Create a product before recording a stock adjustment.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="grid gap-6 p-6 lg:grid-cols-[1fr_340px]">
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="inventory-product" className={labelClass}>
                PRODUCT
              </label>

              <select
                id="inventory-product"
                value={selectedProductId}
                onChange={(event) => {
                  setSelectedProductId(event.target.value);
                  setFormError('');
                  setSuccessMessage('');
                }}
                className={inputClass}
                disabled={isSaving}
              >
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                    {product.sku ? ` (${product.sku})` : ''} — {product.stockQuantity} unit(s)
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <span className={labelClass}>ADJUSTMENT TYPE</span>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  aria-pressed={adjustmentType === 'increase'}
                  onClick={() => changeAdjustmentType('increase')}
                  disabled={isSaving}
                  className={`h-12 rounded-xl border text-sm font-extrabold transition ${
                    adjustmentType === 'increase'
                      ? 'border-[#173F36] bg-[#173F36] text-white'
                      : 'border-[#CFCBC2] bg-[#FAFAF8] text-[#555852] hover:bg-[#F3F2EE]'
                  }`}
                >
                  Add stock
                </button>

                <button
                  type="button"
                  aria-pressed={adjustmentType === 'decrease'}
                  onClick={() => changeAdjustmentType('decrease')}
                  disabled={isSaving}
                  className={`h-12 rounded-xl border text-sm font-extrabold transition ${
                    adjustmentType === 'decrease'
                      ? 'border-red-700 bg-red-700 text-white'
                      : 'border-[#CFCBC2] bg-[#FAFAF8] text-[#555852] hover:bg-[#F3F2EE]'
                  }`}
                >
                  Remove stock
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="inventory-quantity" className={labelClass}>
                QUANTITY
              </label>

              <input
                id="inventory-quantity"
                type="number"
                min="1"
                step="1"
                value={quantity}
                onChange={(event) => {
                  setQuantity(event.target.value);
                  setFormError('');
                  setSuccessMessage('');
                }}
                placeholder="Enter units"
                className={inputClass}
                disabled={isSaving}
              />
            </div>

            <div>
              <label htmlFor="inventory-reason" className={labelClass}>
                REASON
              </label>

              <select
                id="inventory-reason"
                value={reason}
                onChange={(event) => {
                  setReason(event.target.value);
                  setCustomReason('');
                  setFormError('');
                  setSuccessMessage('');
                }}
                className={inputClass}
                disabled={isSaving}
              >
                {reasonOptions.map((reasonOption) => (
                  <option key={reasonOption} value={reasonOption}>
                    {reasonOption}
                  </option>
                ))}
              </select>
            </div>

            {reason === 'Other' ? (
              <div className="sm:col-span-2">
                <label htmlFor="inventory-custom-reason" className={labelClass}>
                  CUSTOM REASON
                </label>

                <input
                  id="inventory-custom-reason"
                  type="text"
                  value={customReason}
                  onChange={(event) => {
                    setCustomReason(event.target.value);
                    setFormError('');
                    setSuccessMessage('');
                  }}
                  placeholder="Explain why stock is changing"
                  className={inputClass}
                  disabled={isSaving}
                  maxLength={120}
                />
              </div>
            ) : null}

            <div className="sm:col-span-2">
              <label htmlFor="inventory-notes" className={labelClass}>
                NOTES — OPTIONAL
              </label>

              <textarea
                id="inventory-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Supplier, batch or adjustment details"
                className="min-h-28 w-full resize-y rounded-xl border border-[#CFCBC2] bg-[#FAFAF8] px-4 py-3 text-sm font-semibold text-[#17191C] outline-none transition placeholder:text-[#A2A49F] focus:border-[#2F6C5B] focus:ring-4 focus:ring-[#2F6C5B]/10"
                disabled={isSaving}
                maxLength={500}
              />
            </div>

            {formError ? (
              <div className="sm:col-span-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
                {formError}
              </div>
            ) : null}

            {successMessage ? (
              <div className="sm:col-span-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">
                {successMessage}
              </div>
            ) : null}

            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-[#173F36] px-5 text-sm font-extrabold text-white transition hover:bg-[#0F3029] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? 'Saving adjustment...' : 'Save stock adjustment'}
              </button>
            </div>
          </div>

          <aside className="rounded-2xl bg-[#173F36] p-6 text-white">
            <p className="text-[11px] font-extrabold tracking-[0.1em] text-white/65">
              STOCK PREVIEW
            </p>

            <p className="mt-4 text-xl font-black">{selectedProduct?.name ?? 'Select a product'}</p>

            <p className="mt-1 text-xs font-semibold text-white/60">
              {selectedProduct?.sku || 'No SKU'}
            </p>

            <div className="mt-7 space-y-4">
              <div className="flex items-center justify-between border-b border-white/15 pb-4">
                <span className="text-sm text-white/70">Current stock</span>

                <span className="text-xl font-black">{selectedProduct?.stockQuantity ?? 0}</span>
              </div>

              <div className="flex items-center justify-between border-b border-white/15 pb-4">
                <span className="text-sm text-white/70">Adjustment</span>

                <span
                  className={`text-xl font-black ${
                    signedQuantity > 0
                      ? 'text-emerald-300'
                      : signedQuantity < 0
                        ? 'text-red-300'
                        : ''
                  }`}
                >
                  {Number.isInteger(enteredQuantity) && enteredQuantity > 0
                    ? `${signedQuantity > 0 ? '+' : ''}${signedQuantity}`
                    : '—'}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-white/70">New stock</span>

                <span className={`text-3xl font-black ${projectedStock < 0 ? 'text-red-300' : ''}`}>
                  {projectedStock}
                </span>
              </div>
            </div>

            <p className="mt-7 text-xs leading-6 text-white/55">
              Every saved adjustment creates an immutable inventory movement with its reason, notes
              and timestamp.
            </p>
          </aside>
        </form>
      )}
    </section>
  );
}
