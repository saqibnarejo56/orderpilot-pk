'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { createClient } from '@/lib/supabase/client';

type ProductStatus = 'draft' | 'active' | 'archived';

type ProductRow = {
  id: string;
  name: string;
  sku: string | null;
  category: string | null;
  description: string | null;
  selling_price: number | string;
  cost_price: number | string;
  stock_quantity: number;
  low_stock_threshold: number;
  status: ProductStatus;
  image_url: string | null;
  image_path: string | null;
  created_at: string;
};

function formatCurrency(value: number) {
  return `PKR ${new Intl.NumberFormat('en-PK', {
    maximumFractionDigits: 0,
  }).format(value)}`;
}

export default function ManageProductPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const productId = params.id;

  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');

  const [sellingPrice, setSellingPrice] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [stockQuantity, setStockQuantity] = useState('');
  const [lowStockThreshold, setLowStockThreshold] = useState('5');
  const [status, setStatus] = useState<ProductStatus>('draft');

  const [createdAt, setCreatedAt] = useState('');
  const [currentImageUrl, setCurrentImageUrl] = useState('');
  const [currentImagePath, setCurrentImagePath] = useState('');

  const [newImageFile, setNewImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState('');
  const [removeCurrentImage, setRemoveCurrentImage] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [loadError, setLoadError] = useState('');
  const [formMessage, setFormMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;

    setFormMessage('');
    setSuccessMessage('');

    if (!file) {
      return;
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];

    if (!allowedTypes.includes(file.type)) {
      event.target.value = '';
      setNewImageFile(null);
      setImagePreview(currentImageUrl);
      setFormMessage('Only JPG, PNG and WebP images are allowed.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      event.target.value = '';
      setNewImageFile(null);
      setImagePreview(currentImageUrl);
      setFormMessage('Product image must be smaller than 5 MB.');
      return;
    }

    setNewImageFile(file);
    setRemoveCurrentImage(false);

    const reader = new FileReader();

    reader.onload = () => {
      setImagePreview(typeof reader.result === 'string' ? reader.result : currentImageUrl);
    };

    reader.onerror = () => {
      setNewImageFile(null);
      setImagePreview(currentImageUrl);
      setFormMessage('Image preview could not be generated. Please choose another image.');
    };

    reader.readAsDataURL(file);
  }
  function handleRemoveImage() {
    setNewImageFile(null);
    setImagePreview('');
    setRemoveCurrentImage(true);
    setFormMessage('');
    setSuccessMessage('');
  }

  useEffect(() => {
    let cancelled = false;

    async function loadProduct() {
      setIsLoading(true);
      setLoadError('');

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

        const { data, error } = await supabase
          .from('products')
          .select(
            `
              id,
              name,
              sku,
              category,
              description,
              selling_price,
              cost_price,
              stock_quantity,
              low_stock_threshold,
              status,
              image_url,
image_path,
              created_at
            `
          )
          .eq('id', productId)
          .single();

        if (error || !data) {
          throw new Error('Product could not be found or you do not have permission to access it.');
        }

        if (cancelled) return;

        const product = data as ProductRow;

        setName(product.name);
        setSku(product.sku ?? '');
        setCategory(product.category ?? '');
        setDescription(product.description ?? '');

        setSellingPrice(String(product.selling_price ?? 0));
        setCostPrice(String(product.cost_price ?? 0));
        setStockQuantity(String(product.stock_quantity ?? 0));
        setLowStockThreshold(String(product.low_stock_threshold ?? 5));

        setStatus(product.status);
        setCurrentImageUrl(product.image_url ?? '');
        setCurrentImagePath(product.image_path ?? '');
        setImagePreview(product.image_url ?? '');
        setCreatedAt(product.created_at);
      } catch (error) {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : 'Product could not be loaded.');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadProduct();

    return () => {
      cancelled = true;
    };
  }, [productId, router]);

  const sellingPriceNumber = Number(sellingPrice) || 0;
  const costPriceNumber = Number(costPrice) || 0;
  const stockNumber = Number(stockQuantity) || 0;

  const unitProfit = useMemo(
    () => sellingPriceNumber - costPriceNumber,
    [sellingPriceNumber, costPriceNumber]
  );

  const inventoryValue = useMemo(
    () => costPriceNumber * stockNumber,
    [costPriceNumber, stockNumber]
  );

  async function handleUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setFormMessage('');
    setSuccessMessage('');

    const cleanName = name.trim();
    const cleanSku = sku.trim();

    const selling = Number(sellingPrice);
    const cost = Number(costPrice || 0);
    const stock = Number(stockQuantity || 0);
    const threshold = Number(lowStockThreshold || 0);

    if (cleanName.length < 2) {
      setFormMessage('Product name must contain at least 2 characters.');
      return;
    }

    if (!Number.isFinite(selling) || selling < 0) {
      setFormMessage('Enter a valid selling price.');
      return;
    }

    if (!Number.isFinite(cost) || cost < 0) {
      setFormMessage('Enter a valid cost price.');
      return;
    }

    if (!Number.isInteger(stock) || stock < 0) {
      setFormMessage('Stock quantity must be a whole number of 0 or greater.');
      return;
    }

    if (!Number.isInteger(threshold) || threshold < 0) {
      setFormMessage('Low-stock alert must be a whole number of 0 or greater.');
      return;
    }

    setIsSaving(true);
    const supabase = createClient();
    let uploadedReplacementPath: string | null = null;

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.replace('/login');
        return;
      }

      let nextImageUrl: string | null = removeCurrentImage ? null : currentImageUrl || null;

      let nextImagePath: string | null = removeCurrentImage ? null : currentImagePath || null;

      if (newImageFile) {
        const extension =
          newImageFile.type === 'image/png'
            ? 'png'
            : newImageFile.type === 'image/webp'
              ? 'webp'
              : 'jpg';

        const replacementPath = `${user.id}/${crypto.randomUUID()}.${extension}`;

        const { error: uploadError } = await supabase.storage
          .from('product-images')
          .upload(replacementPath, newImageFile, {
            cacheControl: '3600',
            contentType: newImageFile.type,
            upsert: false,
          });

        if (uploadError) {
          throw new Error(`Image upload failed: ${uploadError.message}`);
        }

        uploadedReplacementPath = replacementPath;

        const { data: publicUrlData } = supabase.storage
          .from('product-images')
          .getPublicUrl(replacementPath);

        nextImagePath = replacementPath;
        nextImageUrl = publicUrlData.publicUrl;
      }

      const { error: updateError } = await supabase
        .from('products')
        .update({
          name: cleanName,
          sku: cleanSku || null,
          category: category.trim() || null,
          description: description.trim() || null,
          selling_price: selling,
          cost_price: cost,
          stock_quantity: stock,
          low_stock_threshold: threshold,
          status,
          image_url: nextImageUrl,
          image_path: nextImagePath,
        })
        .eq('id', productId);
      if (updateError) {
        if (updateError.code === '23505') {
          throw new Error('This SKU is already being used by another product in your store.');
        }

        throw new Error(updateError.message);
      }
      if (
        currentImagePath &&
        (newImageFile || removeCurrentImage) &&
        currentImagePath !== nextImagePath
      ) {
        await supabase.storage.from('product-images').remove([currentImagePath]);
      }
      setCurrentImageUrl(nextImageUrl ?? '');
      setCurrentImagePath(nextImagePath ?? '');
      setImagePreview(nextImageUrl ?? '');

      setNewImageFile(null);
      setRemoveCurrentImage(false);

      setSuccessMessage('Product updated successfully.');
      router.refresh();
    } catch (error) {
      if (uploadedReplacementPath) {
        await supabase.storage.from('product-images').remove([uploadedReplacementPath]);
      }
      setFormMessage(error instanceof Error ? error.message : 'Product could not be updated.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    const confirmed = window.confirm(`Delete "${name}" permanently? This action cannot be undone.`);

    if (!confirmed) return;

    setIsDeleting(true);
    setFormMessage('');
    setSuccessMessage('');

    try {
      const supabase = createClient();

      const { error: deleteError } = await supabase.from('products').delete().eq('id', productId);

      if (deleteError) {
        throw new Error(deleteError.message);
      }

      if (currentImagePath) {
        const { error: imageDeleteError } = await supabase.storage
          .from('product-images')
          .remove([currentImagePath]);

        if (imageDeleteError) {
          console.error(
            'Product deleted, but its image could not be removed:',
            imageDeleteError.message
          );
        }
      }

      router.push('/dashboard/products');
      router.refresh();
    } catch (error) {
      setFormMessage(error instanceof Error ? error.message : 'Product could not be deleted.');

      setIsDeleting(false);
    }
  }

  const inputClass =
    'h-13 w-full rounded-xl border border-[#CFCBC2] bg-[#FAFAF8] px-4 text-sm text-[#17191C] outline-none transition placeholder:text-[#A2A49F] focus:border-[#2F6C5B] focus:ring-4 focus:ring-[#2F6C5B]/10';

  const labelClass = 'mb-2 block text-[11px] font-extrabold tracking-[0.07em] text-[#343732]';

  if (isLoading) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#F6F5F1] px-5">
        <div className="text-center">
          <div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-[#D7E4DF] border-t-[#173F36]" />

          <p className="mt-4 text-sm font-bold text-[#666963]">Loading product...</p>
        </div>
      </main>
    );
  }

  if (loadError) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#F6F5F1] px-5 text-[#17191C]">
        <section className="w-full max-w-lg rounded-2xl border border-[#D9D7D0] bg-white p-8 text-center">
          <p className="text-xs font-extrabold tracking-[0.14em] text-red-700">
            PRODUCT UNAVAILABLE
          </p>

          <h1 className="mt-4 text-3xl font-black tracking-[-0.04em]">
            Product could not be opened
          </h1>

          <p className="mt-4 text-sm leading-7 text-[#666963]">{loadError}</p>

          <Link
            href="/dashboard/products"
            className="mt-7 inline-flex h-12 items-center justify-center rounded-xl bg-[#173F36] px-5 text-sm font-extrabold text-white"
          >
            Return to products
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
            <span className="grid h-9 w-9 place-items-center rounded-[10px] bg-[#173F36] text-[11px] font-black tracking-[0.08em] text-white">
              OP
            </span>

            <span>
              <span className="block text-[15px] font-extrabold tracking-[-0.025em]">
                OrderPilot PK
              </span>

              <span className="block text-[10px] font-semibold tracking-[0.08em] text-[#777A75]">
                MANAGE PRODUCT
              </span>
            </span>
          </Link>

          <Link
            href="/dashboard/products"
            className="rounded-xl border border-[#D9D7D0] bg-white px-4 py-2.5 text-sm font-bold text-[#434640] transition hover:bg-[#F3F2EE]"
          >
            Back to products
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-[1180px] px-5 py-10 sm:px-8 lg:px-10">
        <section className="mb-8">
          <p className="text-xs font-extrabold tracking-[0.14em] text-[#2F6C5B]">
            PRODUCT MANAGEMENT
          </p>

          <h1 className="mt-3 text-4xl font-black tracking-[-0.045em] sm:text-5xl">Edit product</h1>

          <p className="mt-3 max-w-2xl text-sm leading-7 text-[#666963]">
            Update product information, pricing, availability and inventory.
          </p>
        </section>

        <form onSubmit={handleUpdate} className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <section className="space-y-6">
            <article className="rounded-2xl border border-[#D9D7D0] bg-white p-6 sm:p-8">
              <div className="border-b border-[#E2E0DA] pb-5">
                <h2 className="text-xl font-black">Product image</h2>

                <p className="mt-2 text-sm text-[#777A75]">
                  Replace the current product image or remove it from the catalogue. JPG, PNG and
                  WebP formats are supported up to 5 MB.
                </p>
              </div>

              <div className="mt-6 grid gap-5 sm:grid-cols-[180px_1fr] sm:items-center">
                <div className="aspect-square overflow-hidden rounded-2xl border border-[#D9D7D0] bg-[#F3F2EE]">
                  {imagePreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={imagePreview}
                      alt={`${name || 'Product'} preview`}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="grid h-full place-items-center px-5 text-center">
                      <div>
                        <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-[#E5EEE9] text-xl font-black text-[#173F36]">
                          +
                        </span>

                        <p className="mt-3 text-xs font-bold text-[#777A75]">
                          {removeCurrentImage ? 'Image will be removed' : 'No product image'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <input
                    id="replacement-image"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleImageChange}
                    className="sr-only"
                  />

                  <div className="flex flex-wrap gap-3">
                    <label
                      htmlFor="replacement-image"
                      className="inline-flex h-12 cursor-pointer items-center justify-center rounded-xl border border-[#CFCBC2] bg-white px-5 text-sm font-extrabold text-[#173F36] transition hover:bg-[#F3F2EE]"
                    >
                      {currentImageUrl || newImageFile
                        ? 'Choose new image'
                        : 'Choose product image'}
                    </label>

                    {!removeCurrentImage && (currentImageUrl || newImageFile || imagePreview) && (
                      <button
                        type="button"
                        onClick={handleRemoveImage}
                        className="inline-flex h-12 items-center justify-center rounded-xl border border-red-200 bg-red-50 px-5 text-sm font-extrabold text-red-700 transition hover:bg-red-100"
                      >
                        Remove image
                      </button>
                    )}
                  </div>

                  <p className="mt-3 text-xs leading-5 text-[#8A8D87]">
                    Recommended: square image with a clean background.
                  </p>

                  {newImageFile && (
                    <p className="mt-3 break-all text-xs font-bold text-[#2F6C5B]">
                      New image selected: {newImageFile.name}
                    </p>
                  )}

                  {removeCurrentImage && (
                    <p className="mt-3 text-xs font-bold text-red-700">
                      The current image will be permanently removed when you save.
                    </p>
                  )}
                </div>
              </div>
            </article>
            <article className="rounded-2xl border border-[#D9D7D0] bg-white p-6 sm:p-8">
              <div className="border-b border-[#E2E0DA] pb-5">
                <h2 className="text-xl font-black">Product information</h2>

                <p className="mt-2 text-sm text-[#777A75]">
                  Change the product name, SKU, category or description.
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
                    className={inputClass}
                  />
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
                    placeholder="Example: Women's Clothing"
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
                  rows={6}
                  className="w-full resize-y rounded-xl border border-[#CFCBC2] bg-[#FAFAF8] px-4 py-3.5 text-sm leading-7 outline-none transition focus:border-[#2F6C5B] focus:ring-4 focus:ring-[#2F6C5B]/10"
                />
              </div>
            </article>
            <article className="rounded-2xl border border-[#D9D7D0] bg-white p-6 sm:p-8">
              <div className="border-b border-[#E2E0DA] pb-5">
                <h2 className="text-xl font-black">Pricing and inventory</h2>

                <p className="mt-2 text-sm text-[#777A75]">
                  Keep selling price, cost and available stock accurate.
                </p>
              </div>

              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                <div>
                  <label htmlFor="selling-price" className={labelClass}>
                    SELLING PRICE
                  </label>

                  <input
                    id="selling-price"
                    type="number"
                    min="0"
                    step="0.01"
                    value={sellingPrice}
                    onChange={(event) => setSellingPrice(event.target.value)}
                    required
                    className={inputClass}
                  />
                </div>

                <div>
                  <label htmlFor="cost-price" className={labelClass}>
                    COST PRICE
                  </label>

                  <input
                    id="cost-price"
                    type="number"
                    min="0"
                    step="0.01"
                    value={costPrice}
                    onChange={(event) => setCostPrice(event.target.value)}
                    className={inputClass}
                  />
                </div>

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
                    className={inputClass}
                  />
                </div>

                <div>
                  <label htmlFor="threshold" className={labelClass}>
                    LOW-STOCK ALERT
                  </label>

                  <input
                    id="threshold"
                    type="number"
                    min="0"
                    step="1"
                    value={lowStockThreshold}
                    onChange={(event) => setLowStockThreshold(event.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>
            </article>
          </section>

          <aside className="space-y-6">
            <article className="rounded-2xl border border-[#D9D7D0] bg-white p-6">
              <h2 className="text-lg font-black">Product status</h2>

              <div className="mt-5">
                <label htmlFor="status" className={labelClass}>
                  STATUS
                </label>

                <select
                  id="status"
                  value={status}
                  onChange={(event) => setStatus(event.target.value as ProductStatus)}
                  className={inputClass}
                >
                  <option value="active">Active</option>
                  <option value="draft">Draft</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
            </article>

            <article className="rounded-2xl bg-[#173F36] p-6 text-white">
              <p className="text-[11px] font-extrabold tracking-[0.1em] text-white/60">
                PRODUCT SUMMARY
              </p>

              <div className="mt-5 space-y-4">
                <div className="flex justify-between gap-4">
                  <span className="text-sm text-white/65">Selling price</span>
                  <strong>{formatCurrency(sellingPriceNumber)}</strong>
                </div>

                <div className="flex justify-between gap-4">
                  <span className="text-sm text-white/65">Unit profit</span>
                  <strong>{formatCurrency(unitProfit)}</strong>
                </div>

                <div className="flex justify-between gap-4">
                  <span className="text-sm text-white/65">Stock units</span>
                  <strong>{stockNumber}</strong>
                </div>

                <div className="flex justify-between gap-4 border-t border-white/15 pt-4">
                  <span className="text-sm text-white/65">Inventory value</span>
                  <strong>{formatCurrency(inventoryValue)}</strong>
                </div>
              </div>

              {createdAt && (
                <p className="mt-6 border-t border-white/15 pt-4 text-xs text-white/55">
                  Created{' '}
                  {new Intl.DateTimeFormat('en-PK', {
                    dateStyle: 'medium',
                  }).format(new Date(createdAt))}
                </p>
              )}
            </article>

            {formMessage && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                {formMessage}
              </div>
            )}

            {successMessage && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
                {successMessage}
              </div>
            )}

            <button
              type="submit"
              disabled={isSaving || isDeleting}
              className="flex h-13 w-full items-center justify-center rounded-xl bg-[#173F36] px-5 text-sm font-extrabold text-white transition hover:bg-[#0F3029] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? 'Saving changes...' : 'Save changes →'}
            </button>

            <article className="rounded-2xl border border-red-200 bg-white p-5">
              <h2 className="font-black text-red-800">Danger zone</h2>

              <p className="mt-2 text-xs leading-6 text-[#777A75]">
                Deleting this product permanently removes it from your catalogue.
              </p>

              <button
                type="button"
                onClick={handleDelete}
                disabled={isSaving || isDeleting}
                className="mt-4 flex h-11 w-full items-center justify-center rounded-xl border border-red-300 bg-red-50 px-4 text-sm font-extrabold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isDeleting ? 'Deleting product...' : 'Delete product'}
              </button>
            </article>
          </aside>
        </form>
      </div>
    </main>
  );
}
