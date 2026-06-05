'use client';

import { useState, useEffect } from 'react';
import { Check, RefreshCw, ExternalLink } from 'lucide-react';

interface OAuthConfig {
  googleClientId: string | null;
  googleClientSecret: string | null;
  microsoftClientId: string | null;
  microsoftClientSecret: string | null;
  microsoftTenantId: string | null;
}

const MASKED = '********';

const EMPTY: OAuthConfig = {
  googleClientId: null,
  googleClientSecret: null,
  microsoftClientId: null,
  microsoftClientSecret: null,
  microsoftTenantId: null,
};

export function OAuthSettingsForm() {
  const [data, setData] = useState<OAuthConfig>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch('/api/oauth-settings')
      .then((r) => r.json())
      .then((j) => {
        const d = j.data ?? j;
        setData({
          googleClientId: d.googleClientId ?? null,
          googleClientSecret: d.googleClientSecret ?? null,
          microsoftClientId: d.microsoftClientId ?? null,
          microsoftClientSecret: d.microsoftClientSecret ?? null,
          microsoftTenantId: d.microsoftTenantId ?? null,
        });
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setResult(null);
    try {
      const res = await fetch('/api/oauth-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (res.ok) {
        const d = json.data ?? json;
        setResult({
          ok: true,
          message: `Saved. Google: ${d.google_enabled ? '✓ enabled' : '✗ not configured'} · Microsoft: ${d.microsoft_enabled ? '✓ enabled' : '✗ not configured'}`,
        });
      } else {
        setResult({ ok: false, message: json.error ?? 'Failed to save' });
      }
    } catch (e: unknown) {
      setResult({ ok: false, message: String(e) });
    } finally {
      setSaving(false);
    }
  };

  const field = (
    label: string,
    key: keyof OAuthConfig,
    placeholder?: string,
    isSecret = false,
    hint?: string,
  ) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type={isSecret ? 'password' : 'text'}
        autoComplete="off"
        data-1p-ignore
        value={data[key] ?? ''}
        placeholder={placeholder}
        onChange={(e) => setData((prev) => ({ ...prev, [key]: e.target.value || null }))}
        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-mono"
      />
      {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-gray-500 py-8">
        <RefreshCw className="w-4 h-4 animate-spin" />
        Loading OAuth settings…
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Google */}
      <section className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Google</h3>
          <p className="text-sm text-gray-500 mt-1">
            Allows users to connect their Google account for Calendar and Gmail read access (used by AI agents).{' '}
            <a
              href="https://console.cloud.google.com/apis/credentials"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-blue-600 hover:underline"
            >
              Google Cloud Console <ExternalLink className="w-3 h-3" />
            </a>
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Redirect URI to register:{' '}
            <code className="bg-gray-100 px-1 rounded">{'{AUTHZ_URL}'}/integrations/google/callback</code>
            {' '}· Scopes: <code className="bg-gray-100 px-1 rounded">calendar.readonly gmail.readonly</code>
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {field('Client ID', 'googleClientId', 'xxxxxxxxxx.apps.googleusercontent.com')}
          {field('Client Secret', 'googleClientSecret', MASKED, true, 'Stored encrypted.')}
        </div>
      </section>

      <hr className="border-gray-200" />

      {/* Microsoft */}
      <section className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Microsoft 365</h3>
          <p className="text-sm text-gray-500 mt-1">
            Allows users to connect their Microsoft account for Outlook Calendar and Mail read access.{' '}
            <a
              href="https://entra.microsoft.com/#view/Microsoft_AAD_RegisteredApps"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-blue-600 hover:underline"
            >
              Entra App Registrations <ExternalLink className="w-3 h-3" />
            </a>
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Redirect URI:{' '}
            <code className="bg-gray-100 px-1 rounded">{'{AUTHZ_URL}'}/integrations/microsoft/callback</code>
            {' '}· Scopes: <code className="bg-gray-100 px-1 rounded">Calendars.Read Mail.Read offline_access</code>
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {field('Client ID (Application ID)', 'microsoftClientId', 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx')}
          {field('Client Secret', 'microsoftClientSecret', MASKED, true, 'Stored encrypted.')}
        </div>
        <div className="max-w-sm">
          {field(
            'Tenant ID',
            'microsoftTenantId',
            'common',
            false,
            'Use "common" for multi-tenant apps, or your specific tenant ID for single-tenant.',
          )}
        </div>
      </section>

      <div className="pt-2 flex flex-col gap-3">
        <div>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {saving ? 'Saving…' : 'Save OAuth Settings'}
          </button>
        </div>
        {result && (
          <div
            className={`rounded px-3 py-2 text-xs ${
              result.ok
                ? 'bg-green-50 text-green-800 border border-green-200'
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}
          >
            {result.message}
          </div>
        )}
      </div>
    </div>
  );
}
