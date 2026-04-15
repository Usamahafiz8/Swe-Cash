'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tasksApi, type Task, type TaskTriggerType } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { PageLoader } from '@/components/ui/Spinner';
import { PlusCircle, Pencil, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';

const TRIGGER_LABELS: Record<TaskTriggerType, string> = {
  ad_views: 'Ad Views',
  adjoe_earnings: 'Game Earnings ($)',
  login_streak: 'Login Streak (days)',
  referral_count: 'Referrals',
  earning_milestone: 'Lifetime Earnings ($)',
  profile_complete: 'Profile Complete',
  manual: 'Manual',
};

const REPEAT_LABELS: Record<string, string> = {
  none: 'One-time',
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
};

// ─── Task Modal ────────────────────────────────────────────────────────────────

function TaskModal({
  existing,
  onClose,
}: {
  existing?: Task;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const isEdit = !!existing;

  const [title, setTitle]         = useState(existing?.title ?? '');
  const [description, setDesc]    = useState(existing?.description ?? '');
  const [icon, setIcon]           = useState(existing?.icon ?? '⭐');
  const [triggerType, setTrigger] = useState<TaskTriggerType>(existing?.triggerType ?? 'ad_views');
  const [triggerValue, setTrigVal] = useState(String(existing?.triggerValue ?? '1'));
  const [rewardAmount, setReward] = useState(String(existing?.rewardAmount ?? '0.05'));
  const [repeatInterval, setRepeat] = useState(existing?.repeatInterval ?? 'none');
  const [sortOrder, setSortOrder] = useState(String(existing?.sortOrder ?? '0'));
  const [error, setError]         = useState('');

  const createMutation = useMutation({
    mutationFn: () =>
      tasksApi.create({
        title, description, icon, triggerType,
        triggerValue: parseFloat(triggerValue),
        rewardAmount: parseFloat(rewardAmount),
        repeatInterval,
        sortOrder: parseInt(sortOrder) || 0,
      }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tasks'] }); onClose(); },
    onError: (e: any) => setError(e?.response?.data?.message ?? 'Failed to create task'),
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      tasksApi.update(existing!.id, {
        title, description, icon,
        triggerValue: parseFloat(triggerValue),
        rewardAmount: parseFloat(rewardAmount),
        repeatInterval,
        sortOrder: parseInt(sortOrder) || 0,
      }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tasks'] }); onClose(); },
    onError: (e: any) => setError(e?.response?.data?.message ?? 'Failed to update task'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!title || !description) { setError('Title and description are required.'); return; }
    if (isNaN(parseFloat(triggerValue)) || parseFloat(triggerValue) <= 0) { setError('Trigger value must be > 0.'); return; }
    if (isNaN(parseFloat(rewardAmount)) || parseFloat(rewardAmount) <= 0) { setError('Reward must be > 0.'); return; }
    if (isEdit) updateMutation.mutate(); else createMutation.mutate();
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  const inputCls = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
        <h2 className="mb-5 text-lg font-semibold text-gray-900">
          {isEdit ? 'Edit Task' : 'Create Task'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-4 gap-3">
            <div className="col-span-1">
              <label className="mb-1 block text-xs font-medium text-gray-700">Icon</label>
              <input className={inputCls} value={icon} onChange={(e) => setIcon(e.target.value)} maxLength={4} />
            </div>
            <div className="col-span-3">
              <label className="mb-1 block text-xs font-medium text-gray-700">Title</label>
              <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Watch 5 Ads" />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Description</label>
            <textarea className={inputCls} rows={2} value={description} onChange={(e) => setDesc(e.target.value)} placeholder="Watch 5 rewarded ads to earn a bonus." />
          </div>

          {!isEdit && (
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Trigger Type</label>
              <select className={inputCls} value={triggerType} onChange={(e) => setTrigger(e.target.value as TaskTriggerType)}>
                {(Object.keys(TRIGGER_LABELS) as TaskTriggerType[]).map((t) => (
                  <option key={t} value={t}>{TRIGGER_LABELS[t]}</option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Target Value</label>
              <input className={inputCls} type="number" step="any" min="0.0001" value={triggerValue} onChange={(e) => setTrigVal(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Reward (USD)</label>
              <input className={inputCls} type="number" step="any" min="0.0001" value={rewardAmount} onChange={(e) => setReward(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Repeat</label>
              <select className={inputCls} value={repeatInterval} onChange={(e) => setRepeat(e.target.value)}>
                {Object.entries(REPEAT_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Sort Order</label>
            <input className={inputCls} type="number" min="0" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
          </div>

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
              Cancel
            </button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Task'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Task Row ──────────────────────────────────────────────────────────────────

function TaskRow({ task }: { task: Task }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);

  const toggleMutation = useMutation({
    mutationFn: () => tasksApi.update(task.id, { isActive: !task.isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => tasksApi.remove(task.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  });

  return (
    <>
      {editing && <TaskModal existing={task} onClose={() => setEditing(false)} />}
      <tr className="border-b border-gray-100 hover:bg-gray-50">
        <td className="px-4 py-3 text-xl">{task.icon}</td>
        <td className="px-4 py-3">
          <p className="text-sm font-medium text-gray-900">{task.title}</p>
          <p className="text-xs text-gray-500">{task.description}</p>
        </td>
        <td className="px-4 py-3 text-xs text-gray-600">
          <span className="rounded-full bg-blue-50 px-2 py-0.5 font-medium text-blue-700">
            {TRIGGER_LABELS[task.triggerType]}
          </span>
          <span className="ml-1 text-gray-400">≥ {task.triggerValue}</span>
        </td>
        <td className="px-4 py-3 text-sm font-medium text-green-700">${task.rewardAmount.toFixed(4)}</td>
        <td className="px-4 py-3 text-xs text-gray-600">{REPEAT_LABELS[task.repeatInterval]}</td>
        <td className="px-4 py-3">
          <div className="flex flex-col gap-0.5 text-xs text-gray-600">
            <span>{task.completionCount} completed</span>
            <span>{task.claimedCount} claimed</span>
          </div>
        </td>
        <td className="px-4 py-3">
          <button
            onClick={() => toggleMutation.mutate()}
            title={task.isActive ? 'Deactivate' : 'Activate'}
            className="text-gray-400 hover:text-blue-600"
          >
            {task.isActive
              ? <ToggleRight className="h-5 w-5 text-blue-600" />
              : <ToggleLeft className="h-5 w-5" />
            }
          </button>
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <button onClick={() => setEditing(true)} className="text-gray-400 hover:text-blue-600">
              <Pencil className="h-4 w-4" />
            </button>
            <button
              onClick={() => {
                if (confirm(`Delete task "${task.title}"? This will remove all user progress.`)) {
                  deleteMutation.mutate();
                }
              }}
              className="text-gray-400 hover:text-red-600"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </td>
      </tr>
    </>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function TasksPage() {
  const [creating, setCreating] = useState(false);
  const { data: tasks, isLoading } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => tasksApi.list().then((r) => r.data),
  });

  if (isLoading) return <PageLoader />;

  const active = tasks?.filter((t) => t.isActive).length ?? 0;
  const totalRewardsPaid = tasks?.reduce((s, t) => s + t.claimedCount * t.rewardAmount, 0) ?? 0;

  return (
    <div className="space-y-6">
      {creating && <TaskModal onClose={() => setCreating(false)} />}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tasks & Missions</h1>
          <p className="text-sm text-gray-500">
            {active} active • {tasks?.length ?? 0} total • ~${totalRewardsPaid.toFixed(2)} rewards distributed
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <PlusCircle className="mr-2 h-4 w-4" />
          New Task
        </Button>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-left">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-xs font-medium uppercase text-gray-500">Icon</th>
              <th className="px-4 py-3 text-xs font-medium uppercase text-gray-500">Task</th>
              <th className="px-4 py-3 text-xs font-medium uppercase text-gray-500">Trigger</th>
              <th className="px-4 py-3 text-xs font-medium uppercase text-gray-500">Reward</th>
              <th className="px-4 py-3 text-xs font-medium uppercase text-gray-500">Repeat</th>
              <th className="px-4 py-3 text-xs font-medium uppercase text-gray-500">Stats</th>
              <th className="px-4 py-3 text-xs font-medium uppercase text-gray-500">Active</th>
              <th className="px-4 py-3 text-xs font-medium uppercase text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody>
            {tasks?.length === 0 && (
              <tr>
                <td colSpan={8} className="py-12 text-center text-sm text-gray-400">
                  No tasks yet. Create your first task above.
                </td>
              </tr>
            )}
            {tasks?.map((task) => <TaskRow key={task.id} task={task} />)}
          </tbody>
        </table>
      </div>
    </div>
  );
}
