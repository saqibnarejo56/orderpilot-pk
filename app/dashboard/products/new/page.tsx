'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type ChangeEvent, type FormEvent } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function NewProductPage() {
  const router = useRouter();

  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');

  const [sellingPrice, setSellingPrice] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [stockQuantity, setStockQuantity] = useState('');
  const [lowStockThreshold, setLowStockThreshold] = useState('5');

  const [status, setStatus] = useState<'draft' | 'active'>('active');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;

    setErrorMessage('');

    if (!file) {
      setImageFile(null);
      setImagePreview('');
      return;
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];

    if (!allowedTypes.includes(file.type)) {
      event.target.value = '';
      setImageFile(null);
      setImagePreview('');
      setErrorMessage('Only JPG, PNG and WebP images are allowed.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      event.target.value = '';
      setImageFile(null);
      setImagePreview('');
      setErrorMessage('Product image must be smaller than 5 MB.');
      return;
    }

    setImageFile(file);

    const reader = new FileReader();

    reader.onload = () => {
      setImagePreview(typeof reader.result === 'string' ? reader.result : '');
    };

    reader.readAsDataURL(file);
  }
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setErrorMessage('');

    const cleanName = name.trim();
    const sellingPriceNumber = Number(sellingPrice);
    const costPriceNumber = Number(costPrice || 0);
    const stockNumber = Number(stockQuantity || 0);
    const lowStockNumber = Number(lowStockThreshold || 0);

    if (cleanName.length < 2) {
      setErrorMessage('Product name must contain at least 2 characters.');
      return;
    }

    if (!Number.isFinite(sellingPriceNumber) || sellingPriceNumber < 0) {
      setErrorMessage('Enter a valid selling price.');
      return;
    }

    if (!Number.isFinite(costPriceNumber) || costPriceNumber < 0) {
      setErrorMessage('Enter a valid cost price.');
      return;
    }

    if (!Number.isInteger(stockNumber) || stockNumber < 0) {
      setErrorMessage('Stock quantity must be 0 or greater.');
      return;
    }

    if (!Number.isInteger(lowStockNumber) || lowStockNumber < 0) {
      setErrorMessage('Low-stock alert must be 0 or greater.');
      return;
    }

    setIsLoading(true);
    const supabase = createClient();
    let uploadedImagePath: string | null = null;

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.replace('/login');
        return;
      }

      const { data: store, error: storeError } = await supabase
        .from('stores')
        .select('id')
        .eq('owner_id', user.id)
        .single();

      if (storeError || !store) {
        throw new Error('Your store could not be found. Please check your seller account.');
      }
      let imagePath: string | null = null;
      let imageUrl: string | null = null;

      if (imageFile) {
        const extension =
          imageFile.type === 'image/png' ? 'png' : imageFile.type === 'image/webp' ? 'webp' : 'jpg';

        imagePath = `${user.id}/${crypto.randomUUID()}.${extension}`;

        const { error: uploadError } = await supabase.storage
          .from('product-images')
          .upload(imagePath, imageFile, {
            cacheControl: '3600',
            contentType: imageFile.type,
            upsert: false,
          });

        if (uploadError) {
          throw new Error(`Image upload failed: ${uploadError.message}`);
        }

        uploadedImagePath = imagePath;

        const { data: publicUrlData } = supabase.storage
          .from('product-images')
          .getPublicUrl(imagePath);

        imageUrl = publicUrlData.publicUrl;
      }
      const { error: insertError } = await supabase.from('products').insert({
        store_id: store.id,
        name: cleanName,
        sku: sku.trim() || null,
        category: category.trim() || null,
        description: description.trim() || null,
        selling_price: sellingPriceNumber,
        cost_price: costPriceNumber,
        stock_quantity: stockNumber,
        low_stock_threshold: lowStockNumber,
        status,
        image_url: imageUrl,
        image_path: imagePath,
      });

      if (insertError) {
        if (insertError.code === '23505') {
          throw new Error('This SKU is already being used by another product in your store.');
        }

        throw new Error(insertError.message);
      }

      router.push('/dashboard/products');
      router.refresh();
    } catch (error) {
      if (uploadedImagePath) {
        await supabase.storage.from('product-images').remove([uploadedImagePath]);
      }
      setErrorMessage(
        error instanceof Error ? error.message : 'Product could not be created. Please try again.'
      );

      setIsLoading(false);
    }
  }

  const inputClass =
    'h-13 w-full rounded-xl border border-[#CFCBC2] bg-[#FAFAF8] px-4 text-sm text-[#17191C] outline-none transition placeholder:text-[#A2A49F] focus:border-[#2F6C5B] focus:ring-4 focus:ring-[#2F6C5B]/10';

  const labelClass = 'mb-2 block text-[11px] font-extrabold tracking-[0.07em] text-[#343732]';

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
                NEW PRODUCT
              </span>
            </span>
          </Link>

          <Link
            href="/dashboard/products"
            className="rounded-xl border border-[#D9D7D0] bg-white px-4 py-2.5 text-sm font-bold text-[#434640] transition hover:bg-[#F3F2EE]"
          >
            Cancel
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-[1180px] px-5 py-10 sm:px-8 lg:px-10">
        <section className="mb-8">
          <p className="text-xs font-extrabold tracking-[0.14em] text-[#2F6C5B]">
            PRODUCT CATALOGUE
          </p>

          <h1 className="mt-3 text-4xl font-black tracking-[-0.045em] sm:text-5xl">
            Add a new product
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-7 text-[#666963]">
            Add the product’s basic information, pricing and current stock. The product will
            automatically be connected to your store.
          </p>
        </section>

        <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <section className="space-y-6">
            <article className="rounded-2xl border border-[#D9D7D0] bg-white p-6 sm:p-8">
              <div className="border-b border-[#E2E0DA] pb-5">
                <h2 className="text-xl font-black">Product image</h2>

                <p className="mt-2 text-sm text-[#777A75]">
                  Upload a clear product photo. JPG, PNG and WebP formats are supported up to 5 MB.
                </p>
              </div>

              <div className="mt-6 grid gap-5 sm:grid-cols-[180px_1fr] sm:items-center">
                <div className="aspect-square overflow-hidden rounded-2xl border border-[#D9D7D0] bg-[#F3F2EE]">
                  {imagePreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={imagePreview}
                      alt="Selected product preview"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="grid h-full place-items-center px-5 text-center">
                      <div>
                        <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-[#E5EEE9] text-xl font-black text-[#173F36]">
                          +
                        </span>

                        <p className="mt-3 text-xs font-bold text-[#777A75]">No image selected</p>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <input
                    id="product-image"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleImageChange}
                    className="sr-only"
                  />

                  <label
                    htmlFor="product-image"
                    className="inline-flex h-12 cursor-pointer items-center justify-center rounded-xl border border-[#CFCBC2] bg-white px-5 text-sm font-extrabold text-[#173F36] transition hover:bg-[#F3F2EE]"
                  >
                    Choose product image
                  </label>

                  <p className="mt-3 text-xs leading-5 text-[#8A8D87]">
                    Recommended: square image with a clean background.
                  </p>

                  {imageFile && (
                    <p className="mt-3 break-all text-xs font-bold text-[#2F6C5B]">
                      Selected: {imageFile.name}
                    </p>
                  )}
                </div>
              </div>
            </article>
            <article className="rounded-2xl border border-[#D9D7D0] bg-white p-6 sm:p-8">
              <div className="border-b border-[#E2E0DA] pb-5">
                <h2 className="text-xl font-black">Product information</h2>

                <p className="mt-2 text-sm text-[#777A75]">
                  Enter the details sellers and customers will use to identify this product.
                </p>
              </div>

              <div className="mt-6">
                <label htmlFor="name" className={labelClass}>
                  PRODUCT NAME
                </label>

                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Example: Classic Black Abaya"
                  autoComplete="off"
                  required
                  className={inputClass}
                />
              </div>

              <div className="mt-5 grid gap-5 sm:grid-cols-2">
                <div>
                  <label htmlFor="sku" className={labelClass}>
                    SKU
                  </label>

                  <input
                    id="sku"
                    type="text"
                    value={sku}
                    onChange={(event) => setSku(event.target.value)}
                    placeholder="Example: ABA-BLK-001"
                    autoComplete="off"
                    className={inputClass}
                  />

                  <p className="mt-2 text-xs leading-5 text-[#8A8D87]">
                    Optional internal product code.
                  </p>
                </div>

                <div>
                  <label htmlFor="category" className={labelClass}>
                    CATEGORY
                  </label>

                  <input
                    id="category"
                    type="text"
                    value={category}
                    onChange={(event) => setCategory(event.target.value)}
                    placeholder="Example: Women’s Clothing"
                    autoComplete="off"
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="mt-5">
                <label htmlFor="description" className={labelClass}>
                  DESCRIPTION
                </label>

                <textarea
                  id="description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Write a short description, material, size information or other important details."
                  rows={6}
                  className="w-full resize-y rounded-xl border border-[#CFCBC2] bg-[#FAFAF8] px-4 py-3.5 text-sm leading-7 text-[#17191C] outline-none transition placeholder:text-[#A2A49F] focus:border-[#2F6C5B] focus:ring-4 focus:ring-[#2F6C5B]/10"
                />
              </div>
            </article>

            <article className="rounded-2xl border border-[#D9D7D0] bg-white p-6 sm:p-8">
              <div className="border-b border-[#E2E0DA] pb-5">
                <h2 className="text-xl font-black">Pricing</h2>

                <p className="mt-2 text-sm text-[#777A75]">
                  Selling price is shown to customers. Cost price helps calculate inventory value
                  and profit.
                </p>
              </div>

              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                <div>
                  <label htmlFor="selling-price" className={labelClass}>
                    SELLING PRICE
                  </label>

                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-[#777A75]">
                      PKR
                    </span>

                    <input
                      id="selling-price"
                      type="number"
                      min="0"
                      step="0.01"
                      value={sellingPrice}
                      onChange={(event) => setSellingPrice(event.target.value)}
                      placeholder="4500"
                      required
                      className={`${inputClass} pl-14`}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="cost-price" className={labelClass}>
                    COST PRICE
                  </label>

                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-[#777A75]">
                      PKR
                    </span>

                    <input
                      id="cost-price"
                      type="number"
                      min="0"
                      step="0.01"
                      value={costPrice}
                      onChange={(event) => setCostPrice(event.target.value)}
                      placeholder="2800"
                      className={`${inputClass} pl-14`}
                    />
                  </div>
                </div>
              </div>
            </article>

            <article className="rounded-2xl border border-[#D9D7D0] bg-white p-6 sm:p-8">
              <div className="border-b border-[#E2E0DA] pb-5">
                <h2 className="text-xl font-black">Inventory</h2>

                <p className="mt-2 text-sm text-[#777A75]">
                  Set current stock and choose when OrderPilot should flag the product as low stock.
                </p>
              </div>

              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                <div>
                  <label htmlFor="stock" className={labelClass}>
                    STOCK QUANTITY
                  </label>

                  <input
                    id="stock"
                    type="number"
                    min="0"
                    step="1"
                    value={stockQuantity}
                    onChange={(event) => setStockQuantity(event.target.value)}
                    placeholder="15"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label htmlFor="low-stock" className={labelClass}>
                    LOW-STOCK ALERT
                  </label>

                  <input
                    id="low-stock"
                    type="number"
                    min="0"
                    step="1"
                    value={lowStockThreshold}
                    onChange={(event) => setLowStockThreshold(event.target.value)}
                    placeholder="5"
                    className={inputClass}
                  />
                </div>
              </div>
            </article>
          </section>

          <aside className="space-y-6">
            <article className="rounded-2xl border border-[#D9D7D0] bg-white p-6">
              <h2 className="text-lg font-black">Product status</h2>

              <p className="mt-2 text-sm leading-6 text-[#777A75]">
                Active products are available for use in orders. Drafts remain hidden until you are
                ready.
              </p>

              <div className="mt-5">
                <label htmlFor="status" className={labelClass}>
                  STATUS
                </label>

                <select
                  id="status"
                  value={status}
                  onChange={(event) => setStatus(event.target.value as 'draft' | 'active')}
                  className={inputClass}
                >
                  <option value="active">Active</option>
                  <option value="draft">Draft</option>
                </select>
              </div>
            </article>

            <article className="rounded-2xl border border-[#D9D7D0] bg-[#173F36] p-6 text-white">
              <p className="text-[11px] font-extrabold tracking-[0.1em] text-white/60">
                SECURE STORE CONNECTION
              </p>

              <h2 className="mt-4 text-xl font-black">Seller-specific product</h2>

              <p className="mt-3 text-sm leading-7 text-white/75">
                The product will be saved using your authenticated account and connected only to
                your store.
              </p>
            </article>

            {errorMessage && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold leading-6 text-red-700">
                {errorMessage}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="flex h-13 w-full items-center justify-center rounded-xl bg-[#173F36] px-5 text-sm font-extrabold text-white transition hover:bg-[#0F3029] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? 'Saving product...' : 'Save product →'}
            </button>

            <Link
              href="/dashboard/products"
              className="flex h-12 w-full items-center justify-center rounded-xl border border-[#D9D7D0] bg-white px-5 text-sm font-bold text-[#434640] transition hover:bg-[#F3F2EE]"
            >
              Cancel
            </Link>
          </aside>
        </form>
      </div>
    </main>
  );
}
