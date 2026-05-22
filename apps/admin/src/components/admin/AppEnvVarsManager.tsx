'use client';

import { useEffect, useState, useCallback } from 'react';
import { Eye, EyeOff, Plus, Trash2, Save, RefreshCw, AlertTriangle, CheckCircle } from 'lucide-react';

interface EnvVar {
  key: string;
  value: string;
  isSet: boolean;
  isRequired: boolean;
  isOptional: boolean;
  isCustom: boolean;
  showValue: boolean;
}

interface AppEnvVarsManagerProps {
  appId: string;
}

export function AppEnvVarsManager({ appId }: AppEnvVarsManagerProps) {
  const [envVars, setEnvVars] = useState<EnvVar[]>([]);
  const [newVarKey, setNewVarKey] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isDirty, setIsDirty] = useState(false);

  const fetchEnvVars = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/apps/${appId}/env-vars`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to load env vars');

      const { vars, manifest } = data.data as {
        vars: Record<string, string>;
        manifest: { requiredEnvVars: string[]; optionalEnvVars: string[] };
      };

      const required = new Set(manifest.requiredEnvVars);
      const optional = new Set(manifest.optionalEnvVars);

      // Build ordered list: required first, then optional, then custom
      const allDeclared = [...manifest.requiredEnvVars, ...manifest.optionalEnvVars];
      const customKeys = Object.keys(vars).filter((k) => !required.has(k) && !optional.has(k));

      const rows: EnvVar[] = [
        ...allDeclared.map((key) => ({
          key,
          value: vars[key] ?? '',
          isSet: key in vars,
          isRequired: required.has(key),
          isOptional: optional.has(key),
          isCustom: false,
          showValue: false,
        })),
        ...customKeys.map((key) => ({
          key,
          value: vars[key] ?? '',
          isSet: true,
          isRequired: false,
          isOptional: false,
          isCustom: true,
          showValue: false,
        })),
      ];

      setEnvVars(rows);
      setIsDirty(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load env vars');
    } finally {
      setLoading(false);
    }
  }, [appId]);

  useEffect(() => {
    fetchEnvVars();
  }, [fetchEnvVars]);

  const updateVar = (key: string, value: string) => {
    setEnvVars((prev) =>
      prev.map((v) => (v.key === key ? { ...v, value, isSet: value.trim() !== '' } : v)),
    );
    setIsDirty(true);
    setSuccessMsg('');
  };

  const toggleShow = (key: string) => {
    setEnvVars((prev) => prev.map((v) => (v.key === key ? { ...v, showValue: !v.showValue } : v)));
  };

  const removeVar = (key: string) => {
    setEnvVars((prev) =>
      prev.map((v) =>
        v.key === key
          ? v.isCustom
            ? null // remove custom vars entirely
            : { ...v, value: '', isSet: false } // just clear declared vars
          : v,
      ).filter(Boolean) as EnvVar[],
    );
    setIsDirty(true);
    setSuccessMsg('');
  };

  const addCustomVar = () => {
    const key = newVarKey.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_');
    if (!key) return;
    if (envVars.some((v) => v.key === key)) {
      setError(`Variable ${key} already exists`);
      return;
    }
    setEnvVars((prev) => [
      ...prev,
      { key, value: '', isSet: false, isRequired: false, isOptional: false, isCustom: true, showValue: true },
    ]);
    setNewVarKey('');
    setIsDirty(true);
    setSuccessMsg('');
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccessMsg('');
    try {
      const vars: Record<string, string> = {};
      for (const v of envVars) {
        if (v.value.trim()) {
          vars[v.key] = v.value;
        }
      }

      const res = await fetch(`/api/apps/${appId}/env-vars`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vars }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to save env vars');

      setSuccessMsg(`Saved ${data.data.saved} variable${data.data.saved !== 1 ? 's' : ''}. Redeploy the app to apply changes.`);
      setIsDirty(false);
      // Re-fetch to confirm persisted state
      await fetchEnvVars();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save env vars');
    } finally {
      setSaving(false);
    }
  };

  const unsetCount = envVars.filter((v) => v.isRequired && !v.isSet).length;

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-gray-500 py-4">
        <RefreshCw className="w-4 h-4 animate-spin" />
        <span className="text-sm">Loading env vars...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Environment Variables</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Secrets and config injected at deploy time. Values are encrypted at rest.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchEnvVars}
            disabled={loading || saving}
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !isDirty}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save
          </button>
        </div>
      </div>

      {/* Alerts */}
      {unsetCount > 0 && (
        <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>
            {unsetCount} required variable{unsetCount !== 1 ? 's are' : ' is'} not set. The app may fail to start without them.
          </span>
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {successMsg && (
        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
          <CheckCircle className="w-4 h-4 shrink-0" />
          {successMsg}
        </div>
      )}

      {/* Variable rows */}
      {envVars.length === 0 && !loading && (
        <p className="text-sm text-gray-500 py-2">
          No environment variables declared in the manifest. Add custom variables below.
        </p>
      )}

      {envVars.length > 0 && (
        <div className="border border-gray-200 rounded-lg divide-y divide-gray-100">
          {/* Section: Required */}
          {envVars.some((v) => v.isRequired) && (
            <SectionHeader label="Required" />
          )}
          {envVars.filter((v) => v.isRequired).map((v) => (
            <EnvVarRow key={v.key} v={v} onUpdate={updateVar} onToggle={toggleShow} onRemove={removeVar} />
          ))}

          {/* Section: Optional */}
          {envVars.some((v) => v.isOptional) && (
            <SectionHeader label="Optional" />
          )}
          {envVars.filter((v) => v.isOptional).map((v) => (
            <EnvVarRow key={v.key} v={v} onUpdate={updateVar} onToggle={toggleShow} onRemove={removeVar} />
          ))}

          {/* Section: Custom */}
          {envVars.some((v) => v.isCustom) && (
            <SectionHeader label="Custom" />
          )}
          {envVars.filter((v) => v.isCustom).map((v) => (
            <EnvVarRow key={v.key} v={v} onUpdate={updateVar} onToggle={toggleShow} onRemove={removeVar} />
          ))}
        </div>
      )}

      {/* Add custom var */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={newVarKey}
          onChange={(e) => setNewVarKey(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '_'))}
          onKeyDown={(e) => e.key === 'Enter' && addCustomVar()}
          placeholder="NEW_VARIABLE_NAME"
          className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-md font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={addCustomVar}
          disabled={!newVarKey.trim()}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Variable
        </button>
      </div>
    </div>
  );
}

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="px-4 py-2 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide">
      {label}
    </div>
  );
}

function EnvVarRow({
  v,
  onUpdate,
  onToggle,
  onRemove,
}: {
  v: EnvVar;
  onUpdate: (key: string, value: string) => void;
  onToggle: (key: string) => void;
  onRemove: (key: string) => void;
}) {
  const notSetAndRequired = v.isRequired && !v.isSet;

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      {/* Status dot */}
      <div
        className={`w-2 h-2 rounded-full shrink-0 ${
          v.isSet ? 'bg-green-400' : notSetAndRequired ? 'bg-red-400' : 'bg-gray-300'
        }`}
        title={v.isSet ? 'Set' : 'Not set'}
      />

      {/* Key */}
      <span className="w-52 shrink-0 text-sm font-mono text-gray-800 truncate" title={v.key}>
        {v.key}
      </span>

      {/* Type badge */}
      {v.isRequired && (
        <span className="shrink-0 px-1.5 py-0.5 text-xs rounded bg-red-100 text-red-700 font-medium">
          required
        </span>
      )}
      {v.isOptional && (
        <span className="shrink-0 px-1.5 py-0.5 text-xs rounded bg-blue-100 text-blue-700 font-medium">
          optional
        </span>
      )}
      {v.isCustom && (
        <span className="shrink-0 px-1.5 py-0.5 text-xs rounded bg-gray-100 text-gray-600 font-medium">
          custom
        </span>
      )}

      {/* Value input */}
      <div className="flex-1 flex items-center gap-1">
        <input
          type={v.showValue ? 'text' : 'password'}
          value={v.value}
          onChange={(e) => onUpdate(v.key, e.target.value)}
          placeholder={v.isSet ? '(saved — enter new value to update)' : 'Enter value…'}
          className="w-full px-2 py-1 text-sm font-mono border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <button
          onClick={() => onToggle(v.key)}
          className="p-1 text-gray-400 hover:text-gray-600"
          title={v.showValue ? 'Hide value' : 'Show value'}
        >
          {v.showValue ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Remove */}
      <button
        onClick={() => onRemove(v.key)}
        className="p-1 text-gray-300 hover:text-red-500"
        title={v.isCustom ? 'Remove variable' : 'Clear value'}
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
