"use client";

import { useActionState } from "react";

interface LoginFormProps {
  action: (formData: FormData) => Promise<{ error: string } | never>;
}

const initialState: { error?: string } = {};

export function LoginForm({ action }: LoginFormProps) {
  const [state, formAction, isPending] = useActionState(
    async (_prev: { error?: string }, formData: FormData): Promise<{ error?: string }> => {
      try {
        const result = await action(formData);
        return result ?? {};
      } catch (err) {
        // redirect() throws internally — re-throw so Next.js can handle navigation
        throw err;
      }
    },
    initialState
  );

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <input
          name="code"
          type="password"
          placeholder="Access code"
          autoComplete="current-password"
          required
          className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg bg-white text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
          disabled={isPending}
        />
        {state?.error && (
          <p className="text-sm text-red-600">{state.error}</p>
        )}
      </div>
      <button
        type="submit"
        disabled={isPending}
        className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
      >
        {isPending ? "Checking..." : "Continue"}
      </button>
    </form>
  );
}
