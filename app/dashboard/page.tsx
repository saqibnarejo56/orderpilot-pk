import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import LogoutButton from './logout-button';
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

  const storeName =
    typeof user.user_metadata?.store_name === 'string'
      ? user.user_metadata.store_name
      : 'Your Store';

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
            <div className="rounded-xl bg-[#EAF1ED] px-4 py-3 text-[#173F36]">Overview</div>

            {['Orders', 'Products', 'Customers', 'Inventory', 'Returns'].map((item) => (
              <div
                key={item}
                className="rounded-xl px-4 py-3 text-[#666963] transition hover:bg-[#F3F2EE]"
              >
                {item}
              </div>
            ))}
          </nav>
        </aside>

        <section>
          <div>
            <p className="text-xs font-extrabold tracking-[0.14em] text-[#2F6C5B]">
              SELLER OVERVIEW
            </p>

            <h1 className="mt-3 text-4xl font-black tracking-[-0.045em]">Welcome, {fullName}.</h1>

            <p className="mt-3 text-sm leading-7 text-[#666963]">
              Your seller account is connected successfully. We will now add products, orders and
              real business data.
            </p>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ['Total orders', '0'],
              ['Pending orders', '0'],
              ['Revenue', 'PKR 0'],
              ['Available products', '0'],
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
                    New customer orders will appear here.
                  </p>
                </div>
              </div>

              <div className="flex min-h-56 items-center justify-center text-center">
                <div>
                  <p className="text-sm font-black">No orders yet</p>
                  <p className="mt-2 max-w-sm text-sm leading-6 text-[#777A75]">
                    Add products and share your order form to receive your first customer order.
                  </p>
                </div>
              </div>
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
