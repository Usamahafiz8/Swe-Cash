'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, fraudApi } from '@/lib/api';
import type { FraudLog } from '@/lib/api';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Badge, FraudSeverityBadge } from '@/components/ui/Badge';
import { PageLoader } from '@/components/ui/Spinner';
import { formatDate } from '@/lib/utils';

const FRAUD_STATUSES = ['', 'pending', 'reviewed', 'dismissed', 'escalated'];

export default function FraudPage() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('pending');
  const [toast, setToast] = useState('');

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  // Fetch all fraud logs via users fraud-logs endpoint broadly
  // Since the API only exposes /admin/fraud-logs/:id/review, we need a list endpoint.
  // We'll use a generic GET to /admin/fraud-logs with status filter.
  const { data: logs, isLoading, isError } = useQuery({
    queryKey: ['fraud-logs', statusFilter],
    queryFn: () =>
      apiClient
        .get<FraudLog[]>('/admin/fraud-logs', {
          params: { status: statusFilter || undefined },
        })
        .then((r) => r.data),
  });

  const reviewMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      fraudApi.review(id, status),
    onSuccess: () => {
      showToast('Fraud log reviewed.');
      qc.invalidateQueries({ queryKey: ['fraud-logs'] });
    },
    onError: () => showToast('Failed to update fraud log.'),
  });

  const statusVariant = (s: string) => {
    const map: Record<string, 'warning' | 'success' | 'secondary' | 'destructive'> = {
      pending: 'warning',
      reviewed: 'success',
      dismissed: 'secondary',
      escalated: 'destructive',
    };
    return map[s] ?? 'secondary';
  };

  return (
    <div>
      {toast && (
        <div className="fixed right-6 top-6 z-50 rounded-lg bg-slate-800 px-4 py-3 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Fraud Management</h1>
        <p className="mt-1 text-sm text-gray-500">Review and manage fraud alerts</p>
      </div>

      {/* Status filter */}
      <div className="mb-4 flex gap-1 rounded-lg bg-gray-100 p-1">
        {FRAUD_STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-all ${
              statusFilter === s
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {s === '' ? 'All' : s}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {isLoading ? (
          <PageLoader />
        ) : isError ? (
          <div className="py-16 text-center text-red-500">Failed to load fraud logs.</div>
        ) : !logs || logs.length === 0 ? (
          <div className="py-16 text-center text-gray-500">No fraud logs found.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log: FraudLog) => (
                <TableRow key={log.id}>
                  <TableCell className="font-medium text-gray-900">{log.type}</TableCell>
                  <TableCell className="max-w-xs truncate text-gray-600">
                    {log.description}
                  </TableCell>
                  <TableCell>
                    <FraudSeverityBadge severity={log.severity} />
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(log.status)}>{log.status}</Badge>
                  </TableCell>
                  <TableCell className="text-gray-500">{formatDate(log.createdAt)}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1.5">
                      {log.status === 'pending' && (
                        <>
                          <Button
                            size="sm"
                            variant="success"
                            loading={reviewMutation.isPending}
                            onClick={() =>
                              reviewMutation.mutate({ id: log.id, status: 'reviewed' })
                            }
                          >
                            Review
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            loading={reviewMutation.isPending}
                            onClick={() =>
                              reviewMutation.mutate({ id: log.id, status: 'dismissed' })
                            }
                          >
                            Dismiss
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            loading={reviewMutation.isPending}
                            onClick={() =>
                              reviewMutation.mutate({ id: log.id, status: 'escalated' })
                            }
                          >
                            Escalate
                          </Button>
                        </>
                      )}
                      {log.status !== 'pending' && (
                        <span className="text-xs text-gray-400 italic">No actions</span>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
