'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi, type User, type FraudLog } from '@/lib/api';
import { Modal, ModalFooter } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge, UserStatusBadge, FraudSeverityBadge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { formatCurrency, formatDate } from '@/lib/utils';
import {
  User as UserIcon,
  Wallet,
  AlertTriangle,
  ChevronRight,
} from 'lucide-react';

interface UserDetailModalProps {
  userId: string | null;
  onClose: () => void;
}

type Tab = 'info' | 'balance' | 'fraud';

export function UserDetailModal({ userId, onClose }: UserDetailModalProps) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('info');
  const [statusVal, setStatusVal] = useState('');
  const [statusReason, setStatusReason] = useState('');
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [actionMsg, setActionMsg] = useState('');

  const { data: user, isLoading } = useQuery({
    queryKey: ['user', userId],
    queryFn: () => usersApi.getById(userId!).then((r) => r.data),
    enabled: !!userId,
  });

  const { data: fraudLogs, isLoading: fraudLoading } = useQuery({
    queryKey: ['user-fraud', userId],
    queryFn: () => usersApi.getFraudLogs(userId!).then((r) => r.data),
    enabled: !!userId && tab === 'fraud',
  });

  const statusMutation = useMutation({
    mutationFn: () => usersApi.updateStatus(userId!, statusVal, statusReason),
    onSuccess: () => {
      setActionMsg('Status updated successfully.');
      qc.invalidateQueries({ queryKey: ['user', userId] });
      qc.invalidateQueries({ queryKey: ['users'] });
      setStatusVal('');
      setStatusReason('');
    },
    onError: () => setActionMsg('Failed to update status.'),
  });

  const balanceMutation = useMutation({
    mutationFn: () =>
      usersApi.adjustBalance(userId!, parseFloat(adjustAmount), adjustReason),
    onSuccess: () => {
      setActionMsg('Balance adjusted successfully.');
      qc.invalidateQueries({ queryKey: ['user', userId] });
      qc.invalidateQueries({ queryKey: ['users'] });
      setAdjustAmount('');
      setAdjustReason('');
    },
    onError: () => setActionMsg('Failed to adjust balance.'),
  });

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'info', label: 'User Info', icon: <UserIcon className="h-4 w-4" /> },
    { key: 'balance', label: 'Balance', icon: <Wallet className="h-4 w-4" /> },
    { key: 'fraud', label: 'Fraud Logs', icon: <AlertTriangle className="h-4 w-4" /> },
  ];

  return (
    <Modal open={!!userId} onClose={onClose} title="User Details" size="xl">
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : !user ? (
        <div className="py-16 text-center text-gray-500">User not found.</div>
      ) : (
        <>
          {/* Tab Bar */}
          <div className="flex border-b border-gray-200 px-6">
            {tabs.map(({ key, label, icon }) => (
              <button
                key={key}
                onClick={() => { setTab(key); setActionMsg(''); }}
                className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                  tab === key
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {icon}
                {label}
              </button>
            ))}
          </div>

          <div className="px-6 py-5">
            {actionMsg && (
              <div className="mb-4 rounded-md bg-blue-50 px-4 py-2.5 text-sm text-blue-700">
                {actionMsg}
              </div>
            )}

            {/* Info Tab */}
            {tab === 'info' && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <InfoRow label="Name" value={user.name} />
                  <InfoRow label="Email" value={user.email} />
                  <InfoRow label="Country" value={user.country} />
                  <InfoRow
                    label="Status"
                    value={<UserStatusBadge status={user.status} />}
                  />
                  <InfoRow
                    label="Wallet Balance"
                    value={formatCurrency(user.walletBalance)}
                  />
                  <InfoRow
                    label="Lifetime Earnings"
                    value={formatCurrency(user.lifetimeEarnings)}
                  />
                  {user.paypalEmail && (
                    <InfoRow label="PayPal Email" value={user.paypalEmail} />
                  )}
                  {user.referralCode && (
                    <InfoRow label="Referral Code" value={user.referralCode} />
                  )}
                  {user.fraudScore !== undefined && (
                    <InfoRow label="Fraud Score" value={String(user.fraudScore)} />
                  )}
                  <InfoRow
                    label="Joined"
                    value={formatDate(user.createdAt)}
                  />
                </div>

                {/* Update Status */}
                <div className="rounded-lg border border-gray-200 p-4">
                  <h3 className="mb-3 text-sm font-semibold text-gray-900">
                    Update Status
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-gray-700">
                        New Status
                      </label>
                      <select
                        value={statusVal}
                        onChange={(e) => setStatusVal(e.target.value)}
                        className="h-9 w-full rounded-md border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select status...</option>
                        <option value="active">Active</option>
                        <option value="suspended">Suspended</option>
                        <option value="banned">Banned</option>
                      </select>
                    </div>
                    <Input
                      label="Reason"
                      placeholder="Reason for status change..."
                      value={statusReason}
                      onChange={(e) => setStatusReason(e.target.value)}
                    />
                    <Button
                      size="sm"
                      onClick={() => statusMutation.mutate()}
                      disabled={!statusVal || !statusReason}
                      loading={statusMutation.isPending}
                    >
                      Update Status
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Balance Tab */}
            {tab === 'balance' && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-lg border border-gray-200 p-4 text-center">
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                      Current Balance
                    </p>
                    <p className="mt-1 text-2xl font-bold text-gray-900">
                      {formatCurrency(user.walletBalance)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-gray-200 p-4 text-center">
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                      Lifetime Earnings
                    </p>
                    <p className="mt-1 text-2xl font-bold text-emerald-600">
                      {formatCurrency(user.lifetimeEarnings)}
                    </p>
                  </div>
                </div>

                <div className="rounded-lg border border-gray-200 p-4">
                  <h3 className="mb-3 text-sm font-semibold text-gray-900">
                    Adjust Balance
                  </h3>
                  <div className="space-y-3">
                    <Input
                      label="Amount (use negative to deduct)"
                      type="number"
                      step="0.01"
                      placeholder="e.g. 5.00 or -2.50"
                      value={adjustAmount}
                      onChange={(e) => setAdjustAmount(e.target.value)}
                    />
                    <Input
                      label="Reason"
                      placeholder="Reason for balance adjustment..."
                      value={adjustReason}
                      onChange={(e) => setAdjustReason(e.target.value)}
                    />
                    <Button
                      size="sm"
                      onClick={() => balanceMutation.mutate()}
                      disabled={!adjustAmount || !adjustReason}
                      loading={balanceMutation.isPending}
                    >
                      Apply Adjustment
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Fraud Logs Tab */}
            {tab === 'fraud' && (
              <div>
                {fraudLoading ? (
                  <div className="flex justify-center py-8">
                    <Spinner />
                  </div>
                ) : !fraudLogs || fraudLogs.length === 0 ? (
                  <div className="py-12 text-center text-gray-500">
                    No fraud logs for this user.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {fraudLogs.map((log: FraudLog) => (
                      <FraudLogCard key={log.id} log={log} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
      <ModalFooter>
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
      </ModalFooter>
    </Modal>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
        {label}
      </p>
      <div className="mt-0.5 text-sm font-medium text-gray-900">{value}</div>
    </div>
  );
}

function FraudLogCard({ log }: { log: FraudLog }) {
  return (
    <div className="rounded-lg border border-gray-200 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-900">{log.type}</span>
            <FraudSeverityBadge severity={log.severity} />
            <Badge variant="secondary">{log.status}</Badge>
          </div>
          <p className="mt-1 text-sm text-gray-600">{log.description}</p>
          <p className="mt-1 text-xs text-gray-400">{formatDate(log.createdAt)}</p>
        </div>
        <ChevronRight className="h-4 w-4 flex-shrink-0 text-gray-400" />
      </div>
    </div>
  );
}
