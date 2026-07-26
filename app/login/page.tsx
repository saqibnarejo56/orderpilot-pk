'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { createClient } from '@/lib/supabase/client';

const ease = [0.22, 1, 0.36, 1] as const;

export default function LoginPage() {
  const reduceMotion = useReducedMotion();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setErrorMessage('');
    setIsLoading(true);

    try {
      const supabase = createClient();

      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      router.push('/dashboard');
      router.refresh();
    } catch {
      setErrorMessage('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }
  return (
    <main className="min-h-screen bg-[#F6F5F1] text-[#17191C]">
      <header className="border-b border-[#D9D7D0]">
        <div className="mx-auto flex h-20 max-w-[1180px] items-center justify-between px-5 sm:px-8">
          <Link href="/" className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-[10px] bg-[#173F36] text-[11px] font-black tracking-[0.08em] text-white">
              OP
            </span>
            <span>
              <span className="block text-[15px] font-extrabold tracking-[-0.025em]">
                OrderPilot PK
              </span>
              <span className="block text-[10px] font-semibold tracking-[0.08em] text-[#777A75]">
                SELLER WORKSPACE
              </span>
            </span>
          </Link>

          <Link
            href="/"
            className="text-sm font-bold text-[#666963] transition hover:text-[#17191C]"
          >
            Back to website
          </Link>
        </div>
      </header>

      <section className="mx-auto grid min-h-[calc(100vh-80px)] max-w-[1180px] items-center gap-16 px-5 py-14 sm:px-8 lg:grid-cols-[0.88fr_1.12fr]">
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, ease }}
          className="max-w-md"
        >
          <p className="text-xs font-extrabold tracking-[0.15em] text-[#2F6C5B]">SELLER SIGN IN</p>
          <h1 className="mt-5 text-5xl font-black leading-[0.98] tracking-[-0.06em] sm:text-6xl">
            Welcome back.
          </h1>
          <p className="mt-6 text-base leading-8 text-[#666963]">
            Continue managing orders, stock, dispatches and COD settlements from your workspace.
          </p>

          <div className="mt-10 border-t border-[#D9D7D0] pt-6">
            <p className="text-xs font-extrabold tracking-[0.1em] text-[#888B85]">SECURE ACCESS</p>
            <p className="mt-3 text-sm leading-7 text-[#666963]">
              Seller data remains separated by store and protected through authenticated sessions.
            </p>
          </div>
        </motion.div>

        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.08, ease }}
          className="w-full max-w-[500px] justify-self-end"
        >
          <div className="border border-[#CFCBC2] bg-white p-6 sm:p-9">
            <div className="border-b border-[#E2E0DA] pb-6">
              <h2 className="text-2xl font-black tracking-[-0.035em]">Sign in to your store</h2>
              <p className="mt-2 text-sm leading-6 text-[#777A75]">
                Use the email address linked to your seller account.
              </p>
            </div>

            <form onSubmit={handleLogin} className="mt-9 space-y-5">
              <div>
                <label
                  htmlFor="email"
                  className="mb-2 block text-xs font-extrabold tracking-[0.06em]"
                >
                  EMAIL ADDRESS
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="seller@example.com"
                  autoComplete="email"
                  required
                  className="h-14 w-full rounded-xl border border-[#CFCBC2] bg-[#FAFAF8] px-4 text-sm outline-none transition placeholder:text-[#A2A49F] focus:border-[#2F6C5B] focus:bg-white focus:ring-4 focus:ring-[#2F6C5B]/10"
                />
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label htmlFor="password" className="text-xs font-extrabold tracking-[0.06em]">
                    PASSWORD
                  </label>
                  <button
                    type="button"
                    className="text-xs font-bold text-[#2F6C5B] hover:text-[#173F36]"
                  >
                    Forgot password?
                  </button>
                </div>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  required
                  className="h-14 w-full rounded-xl border border-[#CFCBC2] bg-[#FAFAF8] px-4 text-sm outline-none transition placeholder:text-[#A2A49F] focus:border-[#2F6C5B] focus:bg-white focus:ring-4 focus:ring-[#2F6C5B]/10"
                />
              </div>

              {errorMessage && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                  {errorMessage}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-[#173F36] text-sm font-extrabold text-white transition hover:bg-[#0F3029] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoading ? 'Signing in...' : 'Sign in'}

                {!isLoading && <span aria-hidden="true">→</span>}
              </button>
            </form>

            <div className="my-7 flex items-center gap-4">
              <span className="h-px flex-1 bg-[#E2E0DA]" />
              <span className="text-[10px] font-extrabold tracking-[0.09em] text-[#8A8D87]">
                NEW SELLER
              </span>
              <span className="h-px flex-1 bg-[#E2E0DA]" />
            </div>

            <Link
              href="/signup"
              className="flex h-14 w-full items-center justify-center rounded-xl border border-[#CFCBC2] bg-white text-sm font-extrabold transition hover:border-[#AAA69D] hover:bg-[#FAFAF8]"
            >
              Create seller account
            </Link>
          </div>

          <p className="mt-5 text-center text-xs leading-5 text-[#8A8D87]">
            By signing in, you agree to the terms of service and privacy policy.
          </p>
        </motion.div>
      </section>
    </main>
  );
}
