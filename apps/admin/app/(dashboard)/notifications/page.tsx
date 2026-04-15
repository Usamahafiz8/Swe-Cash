'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  notificationsApi, recurringApi,
  type Notification, type RecurringNotification,
} from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { PageLoader } from '@/components/ui/Spinner';
import { formatDate } from '@/lib/utils';
import { Send, Bell, RefreshCw, Pause, Play, Trash2, PlusCircle } from 'lucide-react';

type TargetType = 'all' | 'country' | 'activity_level' | 'earnings_tier';
type FrequencyType = 'daily' | 'weekly' | 'monthly' | 'custom';

const TARGET_OPTIONS: { value: TargetType; label: string; hasValue: boolean }[] = [
  { value: 'all',            label: 'All Users',          hasValue: false },
  { value: 'country',        label: 'By Country',         hasValue: true  },
  { value: 'activity_level', label: 'By Activity Level',  hasValue: true  },
  { value: 'earnings_tier',  label: 'By Earnings Tier',   hasValue: true  },
];

const TARGET_VALUE_PLACEHOLDER: Record<TargetType, string> = {
  all: '', country: 'e.g. SE, NO', activity_level: 'high / medium / low', earnings_tier: 'gold / silver',
};

const FREQ_OPTIONS: { value: FrequencyType; label: string }[] = [
  { value: 'daily',   label: 'Daily'   },
  { value: 'weekly',  label: 'Weekly'  },
  { value: 'monthly', label: 'Monthly' },
  { value: 'custom',  label: 'Custom (cron expression)' },
];

const DAY_OPTIONS = [
  { value: 0, label: 'Sunday' }, { value: 1, label: 'Monday' }, { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' }, { value: 4, label: 'Thursday' }, { value: 5, label: 'Friday' }, { value: 6, label: 'Saturday' },
];

// ─── Shared field styles ─────────────────────────────────────────────────────

const SELECT_CLS = 'h-9 w-full rounded-md border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';
const INPUT_CLS  = 'flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent';

// ─── Send Once Tab ───────────────────────────────────────────────────────────

function SendOnceTab() {
  const qc = useQueryClient();
  const [title, setTitle]           = useState('');
  const [body, setBody]             = useState('');
  const [target, setTarget]         = useState<TargetType>('all');
  const [targetValue, setTargetValue] = useState('');
  const [scheduledFor, setScheduledFor] = useState('');
  const [errors, setErrors]         = useState<Record<string, string>>({});
  const [success, setSuccess]       = useState('');

  const targetOption = TARGET_OPTIONS.find((t) => t.value === target)!;

  const { data: notifications, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationsApi.list().then((r) => r.data),
  });

  const sendMutation = useMutation({
    mutationFn: () => {
      const payload: any = { title, body, target };
      if (targetOption.hasValue && targetValue) payload.targetValue = targetValue;
      if (scheduledFor) payload.scheduledFor = new Date(scheduledFor).toISOString();
      return notificationsApi.send(payload);
    },
    onSuccess: () => {
      setSuccess('Notification sent!');
      setTimeout(() => setSuccess(''), 3000);
      setTitle(''); setBody(''); setTarget('all'); setTargetValue(''); setScheduledFor('');
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: () => setErrors({ form: 'Failed to send. Please try again.' }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!title.trim()) errs.title = 'Title is required.';
    if (!body.trim())  errs.body  = 'Body is required.';
    if (targetOption.hasValue && !targetValue.trim()) errs.targetValue = 'Target value required.';
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    sendMutation.mutate();
  };

  return (
    <div className="space-y-8">
      {/* Form */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-5 text-base font-semibold text-gray-900">Send Notification</h2>
        {success && <div className="mb-4 rounded-md bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div>}
        {errors.form && <div className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{errors.form}</div>}
        <form onSubmit={handleSubmit} noValidate>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Input label="Title" placeholder="e.g. New reward available!" value={title}
                onChange={(e) => setTitle(e.target.value)} error={errors.title} />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Body</label>
              <textarea rows={3} placeholder="Notification message..." value={body}
                onChange={(e) => setBody(e.target.value)}
                className={`w-full rounded-md border ${errors.body ? 'border-red-500' : 'border-gray-300'} bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent`} />
              {errors.body && <p className="mt-1 text-xs text-red-600">{errors.body}</p>}
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Target Audience</label>
              <select value={target} onChange={(e) => { setTarget(e.target.value as TargetType); setTargetValue(''); }} className={SELECT_CLS}>
                {TARGET_OPTIONS.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
            {targetOption.hasValue && (
              <div>
                <Input label="Target Value" placeholder={TARGET_VALUE_PLACEHOLDER[target]}
                  value={targetValue} onChange={(e) => setTargetValue(e.target.value)} error={errors.targetValue} />
              </div>
            )}
            <div>
              <Input label="Schedule For (optional)" type="datetime-local" value={scheduledFor}
                onChange={(e) => setScheduledFor(e.target.value)} helperText="Leave blank to send immediately" />
            </div>
          </div>
          <div className="mt-5 flex justify-end">
            <Button type="submit" loading={sendMutation.isPending} className="gap-2">
              <Send className="h-4 w-4" />
              {scheduledFor ? 'Schedule' : 'Send Now'}
            </Button>
          </div>
        </form>
      </div>

      {/* History */}
      <div>
        <h2 className="mb-4 text-base font-semibold text-gray-900">Sent History</h2>
        {isLoading ? <PageLoader /> : !notifications?.length ? (
          <div className="rounded-xl border border-gray-200 bg-white py-12 text-center">
            <Bell className="mx-auto h-10 w-10 text-gray-300" />
            <p className="mt-3 text-sm text-gray-500">No notifications sent yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map((n: Notification) => <NotificationCard key={n.id} n={n} />)}
          </div>
        )}
      </div>
    </div>
  );
}

function NotificationCard({ n }: { n: Notification }) {
  const targetLabel: Record<string, string> = {
    all: 'All Users', country: 'Country', activity_level: 'Activity Level', earnings_tier: 'Earnings Tier',
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
          {n.targetValue && <Badge variant="secondary">{n.targetValue}</Badge>}
          {n.status && (
            <Badge variant={n.status === 'sent' ? 'success' : n.status === 'scheduled' ? 'warning' : 'secondary'}>
              {n.status}
            </Badge>
          )}
        </div>
        <p className="mt-1 text-sm text-gray-600">{n.body}</p>
        <div className="mt-1.5 flex flex-wrap gap-3 text-xs text-gray-400">
          <span>Created {formatDate(n.createdAt)}</span>
          {n.scheduledFor && <span>Scheduled {formatDate(n.scheduledFor)}</span>}
          {n.sentAt && <span>Sent {formatDate(n.sentAt)}</span>}
        </div>
      </div>
    </div>
  );
}

// ─── Recurring Tab ────────────────────────────────────────────────────────────

function CreateRecurringModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [title, setTitle]           = useState('');
  const [body, setBody]             = useState('');
  const [target, setTarget]         = useState<TargetType>('all');
  const [targetValue, setTargetValue] = useState('');
  const [frequency, setFrequency]   = useState<FrequencyType>('daily');
  const [hour, setHour]             = useState('9');
  const [dayOfWeek, setDayOfWeek]   = useState('1');
  const [dayOfMonth, setDayOfMonth] = useState('1');
  const [cronExpr, setCronExpr]     = useState('');
  const [error, setError]           = useState('');

  const targetOption = TARGET_OPTIONS.find((t) => t.value === target)!;

  const mutation = useMutation({
    mutationFn: () => {
      const payload: any = { title, body, target, frequency };
      if (targetOption.hasValue && targetValue) payload.targetValue = targetValue;
      if (frequency !== 'custom') payload.hour = parseInt(hour);
      if (frequency === 'weekly')  payload.dayOfWeek  = parseInt(dayOfWeek);
      if (frequency === 'monthly') payload.dayOfMonth = parseInt(dayOfMonth);
      if (frequency === 'custom')  payload.cronExpr   = cronExpr;
      return recurringApi.create(payload);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['recurring-notifications'] }); onClose(); },
    onError: (e: any) => setError(e?.response?.data?.message ?? 'Failed to create.'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) { setError('Title and body are required.'); return; }
    if (frequency === 'custom' && !cronExpr.trim()) { setError('Cron expression is required.'); return; }
    setError('');
    mutation.mutate();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl overflow-y-auto max-h-[90vh]">
        <h2 className="mb-5 text-lg font-semibold text-gray-900">Create Recurring Notification</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Title</label>
            <input className={INPUT_CLS} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Daily reward reminder" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Body</label>
            <textarea rows={2} className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={body} onChange={(e) => setBody(e.target.value)} placeholder="Don't forget to play today!" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Target Audience</label>
              <select className={SELECT_CLS} value={target} onChange={(e) => { setTarget(e.target.value as TargetType); setTargetValue(''); }}>
                {TARGET_OPTIONS.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
            {targetOption.hasValue && (
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Target Value</label>
                <input className={INPUT_CLS} value={targetValue} onChange={(e) => setTargetValue(e.target.value)}
                  placeholder={TARGET_VALUE_PLACEHOLDER[target]} />
              </div>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Frequency</label>
            <select className={SELECT_CLS} value={frequency} onChange={(e) => setFrequency(e.target.value as FrequencyType)}>
              {FREQ_OPTIONS.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>

          {frequency !== 'custom' && (
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Hour (UTC)</label>
                <select className={SELECT_CLS} value={hour} onChange={(e) => setHour(e.target.value)}>
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={i} value={i}>{String(i).padStart(2, '0')}:00</option>
                  ))}
                </select>
              </div>
              {frequency === 'weekly' && (
                <div className="col-span-2">
                  <label className="mb-1 block text-sm font-medium text-gray-700">Day of Week</label>
                  <select className={SELECT_CLS} value={dayOfWeek} onChange={(e) => setDayOfWeek(e.target.value)}>
                    {DAY_OPTIONS.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </div>
              )}
              {frequency === 'monthly' && (
                <div className="col-span-2">
                  <label className="mb-1 block text-sm font-medium text-gray-700">Day of Month</label>
                  <select className={SELECT_CLS} value={dayOfMonth} onChange={(e) => setDayOfMonth(e.target.value)}>
                    {Array.from({ length: 28 }, (_, i) => (
                      <option key={i + 1} value={i + 1}>{i + 1}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {frequency === 'custom' && (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Cron Expression <span className="text-gray-400 text-xs">(e.g. 0 9 * * 1,5 = Mon & Fri at 9am)</span>
              </label>
              <input className={INPUT_CLS} value={cronExpr} onChange={(e) => setCronExpr(e.target.value)} placeholder="0 9 * * 1" />
            </div>
          )}

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" loading={mutation.isPending} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Create Schedule
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function RecurringRow({ r }: { r: RecurringNotification }) {
  const qc = useQueryClient();

  const toggleMutation = useMutation({
    mutationFn: () => recurringApi.toggle(r.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recurring-notifications'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => recurringApi.remove(r.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recurring-notifications'] }),
  });

  const freqLabel: Record<string, string> = {
    daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly', custom: 'Custom',
  };

  return (
    <div className="flex items-start gap-4 rounded-xl border border-gray-200 bg-white px-5 py-4 shadow-sm">
      <div className={`mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full ${r.isActive ? 'bg-emerald-100' : 'bg-gray-100'}`}>
        <RefreshCw className={`h-4 w-4 ${r.isActive ? 'text-emerald-600' : 'text-gray-400'}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium text-gray-900">{r.title}</p>
          <Badge variant={r.isActive ? 'success' : 'secondary'}>{r.isActive ? 'Active' : 'Paused'}</Badge>
          <Badge variant="default">{freqLabel[r.frequency] ?? r.frequency}</Badge>
          {r.targetValue && <Badge variant="secondary">{r.target}: {r.targetValue}</Badge>}
        </div>
        <p className="mt-1 text-sm text-gray-600">{r.body}</p>
        <div className="mt-1.5 flex flex-wrap gap-3 text-xs text-gray-400">
          <span className="font-mono bg-slate-100 px-1.5 rounded">{r.cronExpr}</span>
          {r.lastSentAt && <span>Last sent {formatDate(r.lastSentAt)}</span>}
          <span>By {r.createdBy}</span>
        </div>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <button onClick={() => toggleMutation.mutate()} disabled={toggleMutation.isPending}
          className="rounded p-1.5 text-gray-400 hover:bg-gray-100 transition-colors" title={r.isActive ? 'Pause' : 'Resume'}>
          {r.isActive ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </button>
        <button onClick={() => { if (confirm(`Delete "${r.title}"?`)) deleteMutation.mutate(); }}
          disabled={deleteMutation.isPending}
          className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors" title="Delete">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function RecurringTab() {
  const [showCreate, setShowCreate] = useState(false);

  const { data: items, isLoading } = useQuery({
    queryKey: ['recurring-notifications'],
    queryFn: () => recurringApi.list().then((r) => r.data),
  });

  return (
    <div>
      {showCreate && <CreateRecurringModal onClose={() => setShowCreate(false)} />}

      <div className="mb-6 flex items-center justify-between">
        <p className="text-sm text-gray-500">Notifications that fire automatically on a schedule.</p>
        <Button onClick={() => setShowCreate(true)} className="gap-2">
          <PlusCircle className="h-4 w-4" /> New Schedule
        </Button>
      </div>

      {isLoading ? <PageLoader /> : !items?.length ? (
        <div className="rounded-xl border border-gray-200 bg-white py-14 text-center">
          <RefreshCw className="mx-auto h-10 w-10 text-gray-300" />
          <p className="mt-3 text-sm text-gray-500">No recurring notifications yet.</p>
          <Button variant="outline" className="mt-4 gap-2" onClick={() => setShowCreate(true)}>
            <PlusCircle className="h-4 w-4" /> Create one
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((r: RecurringNotification) => <RecurringRow key={r.id} r={r} />)}
        </div>
      )}
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

type Tab = 'send' | 'recurring';

export default function NotificationsPage() {
  const [tab, setTab] = useState<Tab>('send');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
        <p className="mt-1 text-sm text-gray-500">Send push notifications or set up recurring schedules.</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 rounded-xl border border-gray-200 bg-gray-50 p-1 w-fit">
        {([
          { key: 'send',      label: 'Send / History', icon: Send      },
          { key: 'recurring', label: 'Recurring',       icon: RefreshCw },
        ] as { key: Tab; label: string; icon: any }[]).map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
              tab === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}>
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {tab === 'send'      && <SendOnceTab />}
      {tab === 'recurring' && <RecurringTab />}
    </div>
  );
}
