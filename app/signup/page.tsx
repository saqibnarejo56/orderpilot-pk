'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function SignupPage() {
  const [fullName, setFullName] = useState('');
  const [storeName, setStoreName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  async function handleSignup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setErrorMessage('');
    setSuccessMessage('');

    if (!fullName.trim() || !storeName.trim() || !email.trim()) {
      setErrorMessage('Please complete all required fields.');
      return;
    }

    if (password.length < 8) {
      setErrorMessage('Password must contain at least 8 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setIsLoading(true);

    try {
      const supabase = createClient();

      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: {
            full_name: fullName.trim(),
            store_name: storeName.trim(),
          },
        },
      });

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      setSuccessMessage('Account created. Please check your email to confirm your account.');

      setFullName('');
      setStoreName('');
      setEmail('');
      setPassword('');
      setConfirmPassword('');
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
                SELLER REGISTRATION
              </span>
            </span>
          </Link>

          <Link
            href="/login"
            className="text-sm font-bold text-[#666963] transition hover:text-[#17191C]"
          >
            Already registered? Sign in
          </Link>
        </div>
      </header>

      <section className="mx-auto grid min-h-[calc(100vh-80px)] max-w-[1180px] items-center gap-14 px-5 py-14 sm:px-8 lg:grid-cols-[0.82fr_1.18fr]">
        <div className="max-w-md">
          <p className="text-xs font-extrabold tracking-[0.15em] text-[#2F6C5B]">
            CREATE YOUR SELLER ACCOUNT
          </p>

          <h1 className="mt-5 text-5xl font-black leading-[0.98] tracking-[-0.06em] sm:text-6xl">
            Start managing orders properly.
          </h1>

          <p className="mt-6 text-base leading-8 text-[#666963]">
            Create your workspace to manage customer orders, products, stock, dispatches and COD
            payments.
          </p>

          <div className="mt-10 space-y-5 border-t border-[#D9D7D0] pt-7">
            <div>
              <p className="text-sm font-black">One seller workspace</p>
              <p className="mt-1 text-sm leading-6 text-[#777A75]">
                Keep orders, customers and products inside one store account.
              </p>
            </div>

            <div>
              <p className="text-sm font-black">Secure account access</p>
              <p className="mt-1 text-sm leading-6 text-[#777A75]">
                Sign in securely using your registered email and password.
              </p>
            </div>

            <div>
              <p className="text-sm font-black">Free to get started</p>
              <p className="mt-1 text-sm leading-6 text-[#777A75]">
                Create your account and set up your first store.
              </p>
            </div>
          </div>
        </div>

        <div className="w-full max-w-[540px] justify-self-end">
          <div className="border border-[#CFCBC2] bg-white p-6 shadow-[0_24px_70px_rgba(23,25,28,0.08)] sm:p-9">
            <div className="border-b border-[#E2E0DA] pb-6">
              <h2 className="text-2xl font-black tracking-[-0.035em]">Create seller account</h2>

              <p className="mt-2 text-sm leading-6 text-[#777A75]">
                Enter your personal and store information.
              </p>
            </div>

            <form onSubmit={handleSignup} className="mt-7 space-y-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="fullName"
                    className="mb-2 block text-xs font-extrabold tracking-[0.06em]"
                  >
                    FULL NAME
                  </label>

                  <input
                    id="fullName"
                    type="text"
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    placeholder="Saqib Narejo"
                    autoComplete="name"
                    className="h-14 w-full rounded-xl border border-[#CFCBC2] bg-[#FAFAF8] px-4 text-sm outline-none transition placeholder:text-[#A2A49F] focus:border-[#2F6C5B] focus:bg-white focus:ring-4 focus:ring-[#2F6C5B]/10"
                  />
                </div>

                <div>
                  <label
                    htmlFor="storeName"
                    className="mb-2 block text-xs font-extrabold tracking-[0.06em]"
                  >
                    STORE NAME
                  </label>

                  <input
                    id="storeName"
                    type="text"
                    value={storeName}
                    onChange={(event) => setStoreName(event.target.value)}
                    placeholder="Noor Studio"
                    className="h-14 w-full rounded-xl border border-[#CFCBC2] bg-[#FAFAF8] px-4 text-sm outline-none transition placeholder:text-[#A2A49F] focus:border-[#2F6C5B] focus:bg-white focus:ring-4 focus:ring-[#2F6C5B]/10"
                  />
                </div>
              </div>

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
                  className="h-14 w-full rounded-xl border border-[#CFCBC2] bg-[#FAFAF8] px-4 text-sm outline-none transition placeholder:text-[#A2A49F] focus:border-[#2F6C5B] focus:bg-white focus:ring-4 focus:ring-[#2F6C5B]/10"
                />
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="password"
                    className="mb-2 block text-xs font-extrabold tracking-[0.06em]"
                  >
                    PASSWORD
                  </label>

                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Minimum 8 characters"
                    autoComplete="new-password"
                    className="h-14 w-full rounded-xl border border-[#CFCBC2] bg-[#FAFAF8] px-4 text-sm outline-none transition placeholder:text-[#A2A49F] focus:border-[#2F6C5B] focus:bg-white focus:ring-4 focus:ring-[#2F6C5B]/10"
                  />
                </div>

                <div>
                  <label
                    htmlFor="confirmPassword"
                    className="mb-2 block text-xs font-extrabold tracking-[0.06em]"
                  >
                    CONFIRM PASSWORD
                  </label>

                  <input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder="Repeat password"
                    autoComplete="new-password"
                    className="h-14 w-full rounded-xl border border-[#CFCBC2] bg-[#FAFAF8] px-4 text-sm outline-none transition placeholder:text-[#A2A49F] focus:border-[#2F6C5B] focus:bg-white focus:ring-4 focus:ring-[#2F6C5B]/10"
                  />
                </div>
              </div>

              {errorMessage && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                  {errorMessage}
                </div>
              )}

              {successMessage && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
                  {successMessage}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-[#173F36] text-sm font-extrabold text-white transition hover:bg-[#0F3029] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoading ? 'Creating account...' : 'Create seller account'}

                {!isLoading && <span aria-hidden="true">→</span>}
              </button>
            </form>

            <p className="mt-6 text-center text-xs leading-5 text-[#8A8D87]">
              By creating an account, you agree to the terms of service and privacy policy.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
