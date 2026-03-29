'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationsApi, type Notification } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { PageLoader } from '@/components/ui/Spinner';
import { formatDate } from '@/lib/utils';
import { Send, Bell } from 'lucide-react';

type TargetType = 'all' | 'country' | 'activity_level' | 'earnings_tier';

const TARGET_OPTIONS: { value: TargetType; label: string; hasValue: boolean }[] = [
  { value: 'all', label: 'All Users', hasValue: false },
  { value: 'country', label: 'By Country', hasValue: true },
  { value: 'activity_level', label: 'By Activity Level', hasValue: true },
  { value: 'earnings_tier', label: 'By Earnings Tier', hasValue: true },
];

const TARGET_VALUE_PLACEHOLDER: Record<TargetType, string> = {
  all: '',
  country: 'e.g. SE, NO, DK',
  activity_level: 'e.g. high, medium, low',
  earnings_tier: 'e.g. gold, silver, bronze',
};

export default function NotificationsPage() {
  const qc = useQueryClient();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [target, setTarget] = useState<TargetType>('all');
  const [targetValue, setTargetValue] = useState('');
  const [scheduledFor, setScheduledFor] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [successMsg, setSuccessMsg] = useState('');

  const { data: notifications, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationsApi.list().then((r) => r.data),
  });

  const targetOption = TARGET_OPTIONS.find((t) => t.value === target)!;

  const sendMutation = useMutation({
    mutationFn: () => {
      const payload: {
        title: string;
        body: string;
        target: string;
        targetValue?: string;
        scheduledFor?: string;
      } = { title, body, target };
      if (targetOption.hasValue && targetValue) payload.targetValue = targetValue;
      if (scheduledFor) payload.scheduledFor = new Date(scheduledFor).toISOString();
      return notificationsApi.send(payload);
    },
    onSuccess: () => {
      setSuccessMsg('Notification sent successfully!');
      setTimeout(() => setSuccessMsg(''), 3500);
      setTitle('');
      setBody('');
      setTarget('all');
      setTargetValue('');
      setScheduledFor('');
      setErrors({});
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: () => {
      setErrors({ form: 'Failed to send notification. Please try again.' });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!title.trim()) errs.title = 'Title is required.';
    if (!body.trim()) errs.body = 'Body is required.';
    if (targetOption.hasValue && !targetValue.trim())
      errs.targetValue = 'Target value is required for this target type.';
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }
    setErrors({});
    sendMutation.mutate();
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
        <p className="mt-1 text-sm text-gray-500">
          Send push notifications to your user segments.
        </p>
      </div>

      {/* Send Form */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-5 text-base font-semibold text-gray-900">
          Send Notification
        </h2>

        {successMsg && (
          <div className="mb-4 rounded-md bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {successMsg}
          </div>
        )}
        {errors.form && (
          <div className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
            {errors.form}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Input
                label="Title"
                placeholder="e.g. New reward available!"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                error={errors.title}
              />
            </div>

            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Body
              </label>
              <textarea
                rows={3}
                placeholder="Notification message..."
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className={`w-full rounded-md border ${
                  errors.body ? 'border-red-500' : 'border-gray-300'
                } bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
              />
              {errors.body && (
                <p className="mt-1 text-xs text-red-600">{errors.body}</p>
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Target Audience
              </label>
              <select
                value={target}
                onChange={(e) => {
                  setTarget(e.target.value as TargetType);
                  setTargetValue('');
                }}
                className="h-9 w-full rounded-md border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {TARGET_OPTIONS.map(({ value, label }) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            {targetOption.hasValue && (
              <div>
                <Input
                  label="Target Value"
                  placeholder={TARGET_VALUE_PLACEHOLDER[target]}
                  value={targetValue}
                  onChange={(e) => setTargetValue(e.target.value)}
                  error={errors.targetValue}
                />
              </div>
            )}

            <div>
              <Input
                label="Schedule For (optional)"
                type="datetime-local"
                value={scheduledFor}
                onChange={(e) => setScheduledFor(e.target.value)}
                helperText="Leave blank to send immediately"
              />
            </div>
          </div>

          <div className="mt-5 flex justify-end">
            <Button
              type="submit"
              loading={sendMutation.isPending}
              className="gap-2"
            >
              <Send className="h-4 w-4" />
              {scheduledFor ? 'Schedule Notification' : 'Send Now'}
            </Button>
          </div>
        </form>
      </div>

      {/* Notification History */}
      <div>
        <h2 className="mb-4 text-base font-semibold text-gray-900">
          Sent Notifications
        </h2>

        {isLoading ? (
          <PageLoader />
        ) : !notifications || notifications.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white py-12 text-center">
            <Bell className="mx-auto h-10 w-10 text-gray-300" />
            <p className="mt-3 text-sm text-gray-500">No notifications sent yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map((n: Notification) => (
              <NotificationCard key={n.id} notification={n} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function NotificationCard({ notification: n }: { notification: Notification }) {
  const targetLabel: Record<string, string> = {
    all: 'All Users',
    country: 'Country',
    activity_level: 'Activity Level',
    earnings_tier: 'Earnings Tier',
  };

  return (
    <div className="flex items-start gap-4 rounded-xl border border-gray-200 bg-white px-5 py-4 shadow-sm">
      <div className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-blue-100">
        <Bell className="h-4 w-4 text-blue-600" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium text-gray-900">{n.title}</p>
          <Badge variant="default">{targetLabel[n.target] ?? n.target}</Badge>
          {n.targetValue && (
            <Badge variant="secondary">{n.targetValue}</Badge>
          )}
          {n.status && (
            <Badge
              variant={n.status === 'sent' ? 'success' : n.status === 'scheduled' ? 'warning' : 'secondary'}
            >
              {n.status}
            </Badge>
          )}
        </div>
        <p className="mt-1 text-sm text-gray-600">{n.body}</p>
        <div className="mt-1.5 flex flex-wrap gap-3 text-xs text-gray-400">
          <span>Created {formatDate(n.createdAt)}</span>
          {n.scheduledFor && (
            <span>Scheduled for {formatDate(n.scheduledFor)}</span>
          )}
          {n.sentAt && <span>Sent at {formatDate(n.sentAt)}</span>}
        </div>
      </div>
    </div>
  );
}
