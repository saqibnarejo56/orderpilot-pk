"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";

const ease = [0.22, 1, 0.36, 1] as const;

const orders = [
  {
    id: "OP-1842",
    customer: "Ayesha Khan",
    city: "Karachi",
    amount: "PKR 4,850",
    item: "Linen co-ord set · Olive · M",
    status: "Confirmed",
  },
  {
    id: "OP-1841",
    customer: "Hira Ahmed",
    city: "Lahore",
    amount: "PKR 5,200",
    item: "Classic abaya · Black · L",
    status: "Packing",
  },
  {
    id: "OP-1840",
    customer: "Sara Ali",
    city: "Islamabad",
    amount: "PKR 2,750",
    item: "Summer kurti · Blue · S",
    status: "Dispatched",
  },
];

const features = [
  {
    title: "Orders stay complete",
    text: "Customer details, items, address, payment method and status stay attached to one order record.",
  },
  {
    title: "Stock stays reliable",
    text: "Reserve inventory when an order is confirmed and see low-stock products before they become a problem.",
  },
  {
    title: "COD stays visible",
    text: "Follow dispatches, returns and courier collections without maintaining a second spreadsheet.",
  },
];

const workflow = [
  ["01", "Receive", "Capture the order from your form, Instagram or WhatsApp."],
  ["02", "Confirm", "Check customer details and reserve the correct stock."],
  ["03", "Dispatch", "Prepare the parcel, invoice and courier information."],
  ["04", "Reconcile", "Mark delivered, returned or paid and see the real margin."],
];

export default function Home() {
  const reduceMotion = useReducedMotion();
  const [activeOrder, setActiveOrder] = useState(0);

  useEffect(() => {
    if (reduceMotion) return;
    const interval = window.setInterval(() => {
      setActiveOrder((current) => (current + 1) % orders.length);
    }, 3200);
    return () => window.clearInterval(interval);
  }, [reduceMotion]);

  return (
    <main className="min-h-screen bg-[#F6F5F1] text-[#17191C]">
      <header className="sticky top-0 z-50 border-b border-[#D9D7D0] bg-[#F6F5F1]/95 backdrop-blur-md">
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
                ORDER MANAGEMENT
              </span>
            </span>
          </Link>

          <nav className="hidden items-center gap-8 text-sm font-semibold text-[#666963] md:flex">
            <a href="#product" className="transition hover:text-[#17191C]">
              Product
            </a>
            <a href="#features" className="transition hover:text-[#17191C]">
              Features
            </a>
            <a href="#workflow" className="transition hover:text-[#17191C]">
              Workflow
            </a>
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="hidden rounded-xl px-4 py-2.5 text-sm font-bold text-[#434640] transition hover:bg-[#ECEAE4] sm:inline-flex"
            >
              Sign in
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-xl bg-[#173F36] px-5 py-3 text-sm font-bold text-white transition duration-200 hover:bg-[#0F3029]"
            >
              Start free
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </header>

      <section id="product" className="mx-auto max-w-[1320px] px-5 pb-20 pt-20 sm:px-8 lg:px-10 lg:pb-28 lg:pt-24">
        <div className="grid items-center gap-14 lg:grid-cols-[0.82fr_1.18fr]">
          <div className="max-w-xl">
            <motion.p
              initial={reduceMotion ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, ease }}
              className="text-xs font-extrabold tracking-[0.16em] text-[#2F6C5B]"
            >
              FOR INSTAGRAM AND WHATSAPP SELLERS
            </motion.p>

            <motion.h1
              initial={reduceMotion ? false : { opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.72, delay: 0.06, ease }}
              className="mt-6 max-w-[620px] text-[54px] font-black leading-[0.98] tracking-[-0.065em] sm:text-[68px] lg:text-[76px]"
            >
              One place to run every order.
            </motion.h1>

            <motion.p
              initial={reduceMotion ? false : { opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65, delay: 0.14, ease }}
              className="mt-7 max-w-[570px] text-base leading-8 text-[#62655F] sm:text-lg"
            >
              Confirm COD orders, reserve stock, print invoices, follow
              dispatches and reconcile payments without jumping between chats
              and spreadsheets.
            </motion.p>

            <motion.div
              initial={reduceMotion ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65, delay: 0.22, ease }}
              className="mt-9 flex flex-col gap-3 sm:flex-row"
            >
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#173F36] px-6 py-3.5 text-sm font-extrabold text-white transition duration-200 hover:-translate-y-0.5 hover:bg-[#0F3029]"
              >
                Open seller workspace
                <span aria-hidden="true">→</span>
              </Link>
              <a
                href="#workflow"
                className="inline-flex items-center justify-center rounded-xl border border-[#CFCBC2] bg-white px-6 py-3.5 text-sm font-extrabold transition duration-200 hover:border-[#AAA69D] hover:bg-[#FAFAF8]"
              >
                See the workflow
              </a>
            </motion.div>

            <motion.div
              initial={reduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.34 }}
              className="mt-12 grid max-w-lg grid-cols-3 border-t border-[#D9D7D0] pt-6"
            >
              <div>
                <p className="text-lg font-black">1 view</p>
                <p className="mt-1 text-xs leading-5 text-[#777A75]">for every order</p>
              </div>
              <div className="border-l border-[#D9D7D0] pl-5">
                <p className="text-lg font-black">Live stock</p>
                <p className="mt-1 text-xs leading-5 text-[#777A75]">across products</p>
              </div>
              <div className="border-l border-[#D9D7D0] pl-5">
                <p className="text-lg font-black">Clear COD</p>
                <p className="mt-1 text-xs leading-5 text-[#777A75]">settlement status</p>
              </div>
            </motion.div>
          </div>

          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 26 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.12, ease }}
            className="relative"
          >
            <div className="overflow-hidden rounded-[22px] border border-[#C9C6BE] bg-white shadow-[0_24px_70px_rgba(23,25,28,0.13)]">
              <div className="flex h-12 items-center justify-between border-b border-[#E2E0DA] bg-[#FAFAF8] px-5">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#D9D7D0]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[#D9D7D0]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[#D9D7D0]" />
                </div>
                <span className="text-[10px] font-extrabold tracking-[0.11em] text-[#777A75]">
                  SELLER WORKSPACE
                </span>
              </div>

              <div className="grid min-h-[560px] md:grid-cols-[210px_1fr]">
                <aside className="hidden border-r border-[#E2E0DA] bg-[#F4F3EF] p-5 md:block">
                  <div className="mb-8">
                    <p className="text-[10px] font-extrabold tracking-[0.12em] text-[#92958F]">
                      STORE
                    </p>
                    <p className="mt-2 text-sm font-black">Noor Studio</p>
                  </div>

                  <div className="space-y-1 text-sm font-semibold">
                    {["Overview", "Orders", "Products", "Customers", "Returns"].map(
                      (item) => (
                        <div
                          key={item}
                          className={`rounded-lg px-3 py-2.5 ${
                            item === "Orders"
                              ? "bg-white text-[#173F36] shadow-[0_1px_0_rgba(23,25,28,0.04)]"
                              : "text-[#6B6E68]"
                          }`}
                        >
                          {item}
                        </div>
                      ),
                    )}
                  </div>

                  <div className="mt-10 rounded-xl border border-[#D9D7D0] bg-white p-4">
                    <p className="text-[10px] font-extrabold tracking-[0.1em] text-[#8A8D87]">
                      TODAY
                    </p>
                    <p className="mt-3 text-2xl font-black tracking-[-0.04em]">
                      PKR 18,450
                    </p>
                    <p className="mt-1 text-xs leading-5 text-[#777A75]">
                      9 confirmed orders
                    </p>
                  </div>
                </aside>

                <div className="bg-white">
                  <div className="border-b border-[#E2E0DA] px-5 py-5 sm:px-6">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h2 className="text-lg font-black tracking-[-0.025em]">Orders</h2>
                        <p className="mt-1 text-xs text-[#7A7D77]">
                          18 orders need attention today
                        </p>
                      </div>
                      <button
                        type="button"
                        className="rounded-lg bg-[#173F36] px-4 py-2.5 text-xs font-extrabold text-white"
                      >
                        Add order
                      </button>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-[0.95fr_1.05fr]">
                    <div className="border-b border-[#E2E0DA] p-4 md:border-b-0 md:border-r">
                      <div className="mb-3 flex items-center justify-between px-1">
                        <span className="text-[10px] font-extrabold tracking-[0.1em] text-[#888B85]">
                          RECENT
                        </span>
                        <span className="text-[10px] font-bold text-[#888B85]">3 orders</span>
                      </div>

                      <div className="space-y-2">
                        {orders.map((order, index) => {
                          const active = activeOrder === index;
                          return (
                            <button
                              key={order.id}
                              type="button"
                              onClick={() => setActiveOrder(index)}
                              className={`w-full rounded-xl border p-4 text-left transition duration-300 ${
                                active
                                  ? "border-[#8FB6AA] bg-[#EEF5F1]"
                                  : "border-[#E2E0DA] bg-white hover:border-[#C8C5BD]"
                              }`}
                            >
                              <div className="flex items-start justify-between gap-4">
                                <div>
                                  <p className="text-[10px] font-extrabold tracking-[0.08em] text-[#8A8D87]">
                                    {order.id}
                                  </p>
                                  <p className="mt-2 text-sm font-black">{order.customer}</p>
                                  <p className="mt-1 text-xs text-[#7A7D77]">{order.city}</p>
                                </div>
                                <p className="text-sm font-black">{order.amount}</p>
                              </div>
                              <div className="mt-4 h-1 overflow-hidden rounded-full bg-[#E3E5E0]">
                                <motion.div
                                  key={`${order.id}-${active}`}
                                  initial={{ width: active ? "8%" : "0%" }}
                                  animate={{ width: active ? "100%" : "0%" }}
                                  transition={{ duration: active ? 3.2 : 0.2, ease: "linear" }}
                                  className="h-full rounded-full bg-[#2F6C5B]"
                                />
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <motion.div
                      key={orders[activeOrder].id}
                      initial={reduceMotion ? false : { opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.35, ease }}
                      className="p-5 sm:p-6"
                    >
                      <div className="flex items-start justify-between border-b border-[#E2E0DA] pb-5">
                        <div>
                          <p className="text-[10px] font-extrabold tracking-[0.1em] text-[#8A8D87]">
                            ORDER DETAILS
                          </p>
                          <p className="mt-2 text-xl font-black">{orders[activeOrder].id}</p>
                        </div>
                        <span className="rounded-full bg-[#E7F2ED] px-3 py-1.5 text-[10px] font-extrabold text-[#245D4F]">
                          {orders[activeOrder].status}
                        </span>
                      </div>

                      <dl className="mt-5 space-y-4">
                        <div>
                          <dt className="text-[10px] font-extrabold tracking-[0.1em] text-[#8A8D87]">
                            CUSTOMER
                          </dt>
                          <dd className="mt-1.5 text-sm font-black">
                            {orders[activeOrder].customer}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[10px] font-extrabold tracking-[0.1em] text-[#8A8D87]">
                            ITEM
                          </dt>
                          <dd className="mt-1.5 text-sm font-semibold">
                            {orders[activeOrder].item}
                          </dd>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <dt className="text-[10px] font-extrabold tracking-[0.1em] text-[#8A8D87]">
                              PAYMENT
                            </dt>
                            <dd className="mt-1.5 text-sm font-semibold">Cash on delivery</dd>
                          </div>
                          <div>
                            <dt className="text-[10px] font-extrabold tracking-[0.1em] text-[#8A8D87]">
                              TOTAL
                            </dt>
                            <dd className="mt-1.5 text-sm font-black">
                              {orders[activeOrder].amount}
                            </dd>
                          </div>
                        </div>
                      </dl>

                      <div className="mt-6 rounded-xl border border-[#D9D7D0] bg-[#F7F6F2] p-4">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-extrabold">Next action</p>
                          <span className="text-[10px] font-extrabold text-[#2F6C5B]">READY</span>
                        </div>
                        <p className="mt-2 text-sm leading-6 text-[#666963]">
                          Confirm customer details and reserve one item from stock.
                        </p>
                      </div>
                    </motion.div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="border-y border-[#D9D7D0] bg-white">
        <div className="mx-auto grid max-w-[1320px] divide-y divide-[#E2E0DA] px-5 sm:px-8 md:grid-cols-4 md:divide-x md:divide-y-0 lg:px-10">
          {["Apparel", "Beauty", "Gifts", "Home businesses"].map((label) => (
            <div key={label} className="px-4 py-5 text-center text-xs font-extrabold tracking-[0.09em] text-[#777A75]">
              {label.toUpperCase()}
            </div>
          ))}
        </div>
      </section>

      <section id="features" className="mx-auto max-w-[1320px] px-5 py-24 sm:px-8 lg:px-10">
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.65, ease }}
          className="grid gap-12 lg:grid-cols-[0.7fr_1.3fr]"
        >
          <div>
            <p className="text-xs font-extrabold tracking-[0.15em] text-[#2F6C5B]">
              THE BASICS, DONE WELL
            </p>
            <h2 className="mt-5 max-w-md text-4xl font-black leading-[1.03] tracking-[-0.05em] sm:text-5xl">
              A proper order process, without the clutter.
            </h2>
          </div>

          <div className="divide-y divide-[#D9D7D0] border-y border-[#D9D7D0]">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={reduceMotion ? false : { opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.5 }}
                transition={{ duration: 0.5, delay: index * 0.07, ease }}
                className="grid gap-3 py-7 sm:grid-cols-[180px_1fr]"
              >
                <h3 className="text-base font-black">{feature.title}</h3>
                <p className="max-w-2xl text-sm leading-7 text-[#666963]">{feature.text}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      <section id="workflow" className="border-y border-[#D9D7D0] bg-[#ECEFEA]">
        <div className="mx-auto max-w-[1320px] px-5 py-24 sm:px-8 lg:px-10">
          <div className="mb-12 flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div>
              <p className="text-xs font-extrabold tracking-[0.15em] text-[#2F6C5B]">
                WORKFLOW
              </p>
              <h2 className="mt-5 max-w-2xl text-4xl font-black leading-[1.03] tracking-[-0.05em] sm:text-5xl">
                Four clear stages from order to settlement.
              </h2>
            </div>
            <p className="max-w-md text-sm leading-7 text-[#666963]">
              The product follows the way a small seller already works, then removes
              the repetitive parts.
            </p>
          </div>

          <div className="grid border border-[#CFCBC2] bg-[#F8F8F5] md:grid-cols-4">
            {workflow.map(([number, title, text], index) => (
              <motion.article
                key={number}
                initial={reduceMotion ? false : { opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.35 }}
                transition={{ duration: 0.5, delay: index * 0.07, ease }}
                className="min-h-[230px] border-b border-[#CFCBC2] p-6 last:border-b-0 md:border-b-0 md:border-r md:last:border-r-0"
              >
                <p className="text-xs font-black text-[#2F6C5B]">{number}</p>
                <h3 className="mt-12 text-xl font-black tracking-[-0.03em]">{title}</h3>
                <p className="mt-4 text-sm leading-7 text-[#666963]">{text}</p>
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1320px] px-5 py-24 sm:px-8 lg:px-10">
        <div className="grid overflow-hidden rounded-[24px] bg-[#173F36] text-white lg:grid-cols-[1fr_auto]">
          <div className="p-8 sm:p-12">
            <p className="text-xs font-extrabold tracking-[0.15em] text-white/55">
              START WITH YOUR REAL ORDERS
            </p>
            <h2 className="mt-5 max-w-3xl text-4xl font-black leading-[1.03] tracking-[-0.05em] sm:text-5xl">
              Replace the spreadsheet before the next busy week.
            </h2>
          </div>
          <div className="flex items-center border-t border-white/15 p-8 lg:border-l lg:border-t-0 sm:p-12">
            <Link
              href="/login"
              className="inline-flex items-center gap-3 rounded-xl bg-white px-6 py-3.5 text-sm font-extrabold text-[#173F36] transition hover:bg-[#F1F0EC]"
            >
              Create seller account
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-[#D9D7D0]">
        <div className="mx-auto flex max-w-[1320px] flex-col gap-4 px-5 py-8 text-sm text-[#777A75] sm:px-8 md:flex-row md:items-center md:justify-between lg:px-10">
          <p>© 2026 OrderPilot PK</p>
          <p>Order management for independent sellers in Pakistan.</p>
        </div>
      </footer>
    </main>
  );
}
