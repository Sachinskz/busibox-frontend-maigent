'use client';

import { useEffect, useState } from 'react';
import { useCrossAppApiPath } from '../../contexts/ApiContext';

type Integration = {
  provider: 'google' | 'microsoft';
  connected: boolean;
  email?: string | null;
  scopes?: string[];
  connected_at?: string | null;
};

const PROVIDER_INFO: Record<string, { label: string; icon: string; description: string }> = {
  google: {
    label: 'Google',
    icon: '🟢',
    description: 'Access Google Calendar and Gmail (read-only) for meeting prep and email summaries.',
  },
  microsoft: {
    label: 'Microsoft 365',
    icon: '🔵',
    description:
      'Access Outlook Calendar and Mail (read-only) for meeting prep and email summaries.',
  },
};

export function IntegrationsSettings() {
  const resolve = useCrossAppApiPath();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get('integration_connected');
    const integrationError = params.get('integration_error');
    if (connected) setMessage(`Successfully connected ${connected}`);
    if (integrationError) setError(`Connection failed: ${integrationError}`);
  }, []);

  const loadIntegrations = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(resolve('account', '/api/account/integrations'), { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load integrations');
      setIntegrations(Array.isArray(data.integrations) ? data.integrations : []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load integrations';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadIntegrations();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleConnect = (provider: string) => {
    setWorking(provider);
    window.location.href = resolve('account', `/api/account/integrations/${provider}/connect`);
  };

  const handleDisconnect = async (provider: string) => {
    setWorking(provider);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(resolve('account', `/api/account/integrations/${provider}`), {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to disconnect');
      setMessage(`Disconnected ${provider}`);
      await loadIntegrations();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to disconnect';
      setError(msg);
    } finally {
      setWorking(null);
    }
  };

  if (loading) {
    return (
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Connected Integrations</h2>
        <div className="animate-pulse h-6 bg-gray-200 rounded w-1/3" />
      </div>
    );
  }

  // If no integrations are available (authz has none configured), show nothing
  if (!loading && integrations.length === 0) {
    return null;
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 mb-1">Connected Integrations</h2>
      <p className="text-sm text-gray-500 mb-4">
        Connect your calendar and email accounts so AI agents can assist with meeting prep,
        scheduling, and briefings.
      </p>

      {error && (
        <div className="mb-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
          {error}
        </div>
      )}
      {message && (
        <div className="mb-3 text-sm text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2">
          {message}
        </div>
      )}

      <div className="space-y-3">
        {integrations.map((integration) => {
          const info = PROVIDER_INFO[integration.provider];
          if (!info) return null;
          const isWorking = working === integration.provider;

          return (
            <div
              key={integration.provider}
              className="flex items-start justify-between gap-4 p-4 border border-gray-200 rounded-lg"
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl leading-none mt-0.5">{info.icon}</span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">{info.label}</span>
                    {integration.connected && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Connected
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{info.description}</p>
                  {integration.connected && integration.email && (
                    <p className="text-xs text-gray-600 mt-1">
                      Signed in as <span className="font-medium">{integration.email}</span>
                    </p>
                  )}
                </div>
              </div>
              <div className="shrink-0">
                {integration.connected ? (
                  <button
                    onClick={() => handleDisconnect(integration.provider)}
                    disabled={isWorking}
                    className="text-sm text-red-600 hover:text-red-700 disabled:opacity-50 font-medium"
                  >
                    {isWorking ? 'Disconnecting…' : 'Disconnect'}
                  </button>
                ) : (
                  <button
                    onClick={() => handleConnect(integration.provider)}
                    disabled={isWorking}
                    className="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                  >
                    {isWorking ? 'Redirecting…' : 'Connect'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
