'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { settingsApi, type Setting } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { PageLoader } from '@/components/ui/Spinner';
import { Save, RotateCcw } from 'lucide-react';

function SettingRow({ setting }: { setting: Setting }) {
  const qc = useQueryClient();
  const [editValue, setEditValue] = useState(setting.value);
  const [saved, setSaved] = useState(false);

  const isDirty = editValue !== setting.value;

  const mutation = useMutation({
    mutationFn: () => settingsApi.update(setting.key, editValue),
    onSuccess: () => {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      qc.invalidateQueries({ queryKey: ['settings'] });
    },
  });

  const handleReset = () => {
    setEditValue(setting.value);
  };

  return (
    <div className="flex items-start gap-4 rounded-lg border border-gray-200 bg-white px-5 py-4 shadow-sm">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <code className="rounded bg-slate-100 px-2 py-0.5 text-xs font-mono font-medium text-slate-700">
            {setting.key}
          </code>
          {saved && (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
              Saved
            </span>
          )}
        </div>
        {setting.description && (
          <p className="mt-1 text-sm text-gray-500">{setting.description}</p>
        )}
      </div>

      <div className="flex items-center gap-2 flex-shrink-0 w-72">
        <input
          type="text"
          value={editValue}
          onChange={(e) => {
            setEditValue(e.target.value);
            setSaved(false);
          }}
          className="flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        {isDirty && (
          <button
            onClick={handleReset}
            className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
            title="Reset"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        )}
        <Button
          size="sm"
          onClick={() => mutation.mutate()}
          loading={mutation.isPending}
          disabled={!isDirty}
          className="gap-1.5"
        >
          <Save className="h-3.5 w-3.5" />
          Save
        </Button>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { data: settings, isLoading, isError } = useQuery({
    queryKey: ['settings'],
    queryFn: () => settingsApi.list().then((r) => r.data),
  });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage application configuration. Changes take effect immediately.
        </p>
      </div>

      {isLoading ? (
        <PageLoader />
      ) : isError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 py-12 text-center text-red-600">
          Failed to load settings. Please refresh the page.
        </div>
      ) : !settings || settings.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white py-12 text-center text-gray-500">
          No settings found.
        </div>
      ) : (
        <div className="space-y-3">
          {settings.map((setting: Setting) => (
            <SettingRow key={setting.key} setting={setting} />
          ))}
        </div>
      )}
    </div>
  );
}
