'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { currenciesApi, type Currency } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { PageLoader } from '@/components/ui/Spinner';
import { PlusCircle, Pencil, Trash2, Check, X } from 'lucide-react';

// ─── Add / Edit Modal ──────────────────────────────────────────────────────────

function CurrencyModal({
  existing,
  onClose,
}: {
  existing?: Currency;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const isEdit = !!existing;

  const [code, setCode]         = useState(existing?.code ?? '');
  const [name, setName]         = useState(existing?.name ?? '');
  const [symbol, setSymbol]     = useState(existing?.symbol ?? '');
  const [rate, setRate]         = useState(String(existing?.rateToUsd ?? ''));
  const [error, setError]       = useState('');

  const createMutation = useMutation({
    mutationFn: () => currenciesApi.create({ code: code.toUpperCase(), name, symbol, rateToUsd: parseFloat(rate) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['currencies'] }); onClose(); },
    onError: (e: any) => setError(e?.response?.data?.message ?? 'Failed to create currency'),
  });

  const updateMutation = useMutation({
    mutationFn: () => currenciesApi.update(existing!.code, { name, symbol, rateToUsd: parseFloat(rate) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['currencies'] }); onClose(); },
    onError: (e: any) => setError(e?.response?.data?.message ?? 'Failed to update currency'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!name || !symbol || !rate || isNaN(parseFloat(rate)) || parseFloat(rate) <= 0) {
      setError('All fields are required. Rate must be a positive number.');
      return;
    }
    if (isEdit) updateMutation.mutate();
    else createMutation.mutate();
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <h2 className="mb-5 text-lg font-semibold text-gray-900">
          {isEdit ? `Edit ${existing!.code}` : 'Add Currency'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isEdit && (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                ISO 4217 Code <span className="text-gray-400 text-xs">(e.g. JPY, GBP)</span>
              </label>
              <input
                className="flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                maxLength={3}
                placeholder="USD"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
              />
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Name</label>
            <input
              className="flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="US Dollar"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Symbol</label>
            <input
              className="flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="$"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Rate to USD <span className="text-gray-400 text-xs">(1 USD = X of this currency)</span>
            </label>
            <input
              className="flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              type="number"
              step="any"
              placeholder="0.92"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
            />
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" loading={isPending}>
              {isEdit ? 'Save Changes' : 'Add Currency'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Currency Row ──────────────────────────────────────────────────────────────

function CurrencyRow({ currency }: { currency: Currency }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);

  const toggleMutation = useMutation({
    mutationFn: () => currenciesApi.update(currency.code, { isEnabled: !currency.isEnabled }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['currencies'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => currenciesApi.remove(currency.code),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['currencies'] }),
  });

  const isUSD = currency.code === 'USD';

  return (
    <>
      {editing && <CurrencyModal existing={currency} onClose={() => setEditing(false)} />}
      <tr className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
        <td className="px-4 py-3">
          <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-sm font-semibold text-slate-700">
            {currency.code}
          </span>
        </td>
        <td className="px-4 py-3 text-sm text-gray-700">{currency.name}</td>
        <td className="px-4 py-3 text-center text-lg font-medium text-gray-600">{currency.symbol}</td>
        <td className="px-4 py-3 text-sm text-gray-700 font-mono">
          {isUSD ? '1.00000000' : Number(currency.rateToUsd).toFixed(8)}
        </td>
        <td className="px-4 py-3 text-center">
          <button
            onClick={() => !isUSD && toggleMutation.mutate()}
            disabled={isUSD || toggleMutation.isPending}
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
              currency.isEnabled
                ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            } ${isUSD ? 'cursor-default' : 'cursor-pointer'}`}
          >
            {currency.isEnabled ? <><Check className="h-3 w-3" />Enabled</> : <><X className="h-3 w-3" />Disabled</>}
          </button>
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => setEditing(true)}
              className="rounded p-1.5 text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"
              title="Edit"
            >
              <Pencil className="h-4 w-4" />
            </button>
            {!isUSD && (
              <button
                onClick={() => {
                  if (confirm(`Delete ${currency.code}? This cannot be undone.`)) {
                    deleteMutation.mutate();
                  }
                }}
                disabled={deleteMutation.isPending}
                className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                title="Delete"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        </td>
      </tr>
    </>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function CurrenciesPage() {
  const [showAdd, setShowAdd] = useState(false);

  const { data: currencies, isLoading, isError } = useQuery({
    queryKey: ['currencies'],
    queryFn: () => currenciesApi.list().then((r) => r.data),
  });

  return (
    <div>
      {showAdd && <CurrencyModal onClose={() => setShowAdd(false)} />}

      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Currencies</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage supported currencies and exchange rates. All internal amounts are stored in USD.
          </p>
        </div>
        <Button onClick={() => setShowAdd(true)} className="gap-2">
          <PlusCircle className="h-4 w-4" />
          Add Currency
        </Button>
      </div>

      {isLoading ? (
        <PageLoader />
      ) : isError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 py-12 text-center text-red-600">
          Failed to load currencies.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-left">
            <thead className="border-b border-gray-100 bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3 text-center">Symbol</th>
                <th className="px-4 py-3">Rate (1 USD =)</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {currencies?.map((c) => <CurrencyRow key={c.code} currency={c} />)}
            </tbody>
          </table>

          {currencies?.length === 0 && (
            <div className="py-12 text-center text-sm text-gray-500">No currencies found.</div>
          )}
        </div>
      )}

      <p className="mt-4 text-xs text-gray-400">
        Exchange rates are used for display only. Payouts are always processed in USD via PayPal.
      </p>
    </div>
  );
}
