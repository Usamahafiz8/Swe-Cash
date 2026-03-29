'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { payoutsApi, type Payout } from '@/lib/api';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { PayoutStatusBadge } from '@/components/ui/Badge';
import { Modal, ModalFooter } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { PageLoader } from '@/components/ui/Spinner';
import { formatCurrency, formatDate } from '@/lib/utils';
import { CheckCircle, XCircle, Snowflake } from 'lucide-react';

type StatusFilter = '' | 'pending' | 'processing' | 'completed' | 'failed' | 'frozen';

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'processing', label: 'Processing' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
  { value: 'frozen', label: 'Frozen' },
];

type ActionType = 'approve' | 'reject' | 'freeze';

interface ActionState {
  payout: Payout;
  action: ActionType;
}

export default function PayoutsPage() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');
  const [page, setPage] = useState(1);
  const [actionState, setActionState] = useState<ActionState | null>(null);
  const [adminNote, setAdminNote] = useState('');
  const [toast, setToast] = useState('');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['payouts', { status: statusFilter, page }],
    queryFn: () =>
      payoutsApi
        .list({ status: statusFilter || undefined, page, limit: 20 })
        .then((r) => r.data),
  });

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3500);
  };

  const mutation = useMutation({
    mutationFn: () => {
      if (!actionState) return Promise.reject();
      const { payout, action } = actionState;
      const note = adminNote || undefined;
      if (action === 'approve') return payoutsApi.approve(payout.id, note);
      if (action === 'reject') return payoutsApi.reject(payout.id, note);
      return payoutsApi.freeze(payout.id, note);
    },
    onSuccess: () => {
      const msg = actionState
        ? `Payout ${actionState.action}d successfully.`
        : 'Done.';
      showToast(msg);
      qc.invalidateQueries({ queryKey: ['payouts'] });
      setActionState(null);
      setAdminNote('');
    },
    onError: () => showToast('Action failed. Please try again.'),
  });

  const handleAction = (payout: Payout, action: ActionType) => {
    setAdminNote('');
    setActionState({ payout, action });
  };

  const totalPages = data ? Math.ceil(data.total / 20) : 1;

  const actionLabels: Record<ActionType, string> = {
    approve: 'Approve',
    reject: 'Reject',
    freeze: 'Freeze',
  };

  const actionVariants: Record<ActionType, 'success' | 'destructive' | 'warning'> = {
    approve: 'success',
    reject: 'destructive',
    freeze: 'warning',
  };

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div className="fixed right-6 top-6 z-50 rounded-lg bg-slate-800 px-4 py-3 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Payouts</h1>
        <p className="mt-1 text-sm text-gray-500">
          {data ? `${data.total.toLocaleString()} total` : 'Loading...'}
        </p>
      </div>

      {/* Status Tabs */}
      <div className="mb-4 flex gap-1 rounded-lg bg-gray-100 p-1">
        {STATUS_TABS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => { setStatusFilter(value); setPage(1); }}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
              statusFilter === value
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {isLoading ? (
          <PageLoader />
        ) : isError ? (
          <div className="py-16 text-center text-red-500">Failed to load payouts.</div>
        ) : !data?.data.length ? (
          <div className="py-16 text-center text-gray-500">No payouts found.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User Email</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>PayPal Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.data.map((payout: Payout) => (
                <TableRow key={payout.id}>
                  <TableCell className="font-medium text-gray-900">
                    {payout.userEmail}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatCurrency(payout.amount)}
                  </TableCell>
                  <TableCell className="text-gray-600">{payout.paypalEmail}</TableCell>
                  <TableCell>
                    <PayoutStatusBadge status={payout.status} />
                  </TableCell>
                  <TableCell className="text-gray-500">
                    {formatDate(payout.createdAt)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1.5">
                      {(payout.status === 'pending' || payout.status === 'processing') && (
                        <>
                          <Button
                            variant="success"
                            size="sm"
                            onClick={() => handleAction(payout, 'approve')}
                            className="gap-1"
                          >
                            <CheckCircle className="h-3.5 w-3.5" />
                            Approve
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleAction(payout, 'reject')}
                            className="gap-1"
                          >
                            <XCircle className="h-3.5 w-3.5" />
                            Reject
                          </Button>
                        </>
                      )}
                      {payout.status !== 'completed' &&
                        payout.status !== 'failed' &&
                        payout.status !== 'frozen' && (
                          <Button
                            variant="warning"
                            size="sm"
                            onClick={() => handleAction(payout, 'freeze')}
                            className="gap-1"
                          >
                            <Snowflake className="h-3.5 w-3.5" />
                            Freeze
                          </Button>
                        )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Pagination */}
      {data && totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Action Confirmation Modal */}
      <Modal
        open={!!actionState}
        onClose={() => setActionState(null)}
        title={
          actionState
            ? `${actionLabels[actionState.action]} Payout`
            : ''
        }
        size="sm"
      >
        {actionState && (
          <>
            <div className="px-6 py-4 space-y-3">
              <p className="text-sm text-gray-600">
                Are you sure you want to{' '}
                <strong>{actionState.action}</strong> this payout of{' '}
                <strong>{formatCurrency(actionState.payout.amount)}</strong> to{' '}
                <strong>{actionState.payout.userEmail}</strong>?
              </p>
              <Input
                label="Admin Note (optional)"
                placeholder="Add a note..."
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
              />
            </div>
            <ModalFooter>
              <Button variant="outline" onClick={() => setActionState(null)}>
                Cancel
              </Button>
              <Button
                variant={actionVariants[actionState.action]}
                loading={mutation.isPending}
                onClick={() => mutation.mutate()}
              >
                {actionLabels[actionState.action]}
              </Button>
            </ModalFooter>
          </>
        )}
      </Modal>
    </div>
  );
}
