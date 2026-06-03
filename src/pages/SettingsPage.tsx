import { useState } from 'react';
import { Eye, EyeOff, CheckCircle2, XCircle, Loader2, Settings, Key } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card, CardHeader, CardContent } from '../components/ui/Card';
import { useStore } from '../store/useStore';
import { testConnection as testAmplemarket } from '../services/amplemarket';
import { testConnection as testDemandbase } from '../services/demandbase';
import { testConnection as testAppMagic } from '../services/appmagic';
import { testConnection as testHubSpot } from '../services/hubspot';

type ConnectionStatus = 'idle' | 'testing' | 'success' | 'error';

interface ApiKeyField {
  key: keyof import('../types').ApiKeys;
  label: string;
  placeholder: string;
  testFn: () => Promise<boolean>;
  description: string;
}

const apiKeyFields: ApiKeyField[] = [
  {
    key: 'amplemarket',
    label: 'Amplemarket',
    placeholder: 'amp_...',
    testFn: testAmplemarket,
    description: 'People data and sequences for outreach automation',
  },
  {
    key: 'demandbase',
    label: 'Demandbase',
    placeholder: 'db_...',
    testFn: testDemandbase,
    description: 'Intent data and account intelligence',
  },
  {
    key: 'appmagic',
    label: 'AppMagic',
    placeholder: 'am_...',
    testFn: testAppMagic,
    description: 'Mobile app revenue and download analytics',
  },
  {
    key: 'hubspot',
    label: 'HubSpot API Key',
    placeholder: 'pat-na1-...',
    testFn: testHubSpot,
    description: 'CRM sync and website visitor tracking',
  },
];

export function SettingsPage() {
  const { apiKeys, setApiKeys } = useStore();
  const [visible, setVisible] = useState<Record<string, boolean>>({});
  const [status, setStatus] = useState<Record<string, ConnectionStatus>>({});
  const [hubspotPortal, setHubspotPortal] = useState(apiKeys.hubspotPortalId);
  const [localKeys, setLocalKeys] = useState({ ...apiKeys });
  const [saved, setSaved] = useState(false);

  const toggleVisible = (key: string) => setVisible(v => ({ ...v, [key]: !v[key] }));

  const handleTest = async (field: ApiKeyField) => {
    setStatus(s => ({ ...s, [field.key]: 'testing' }));
    // Temporarily set in env for testing
    const ok = await field.testFn();
    setStatus(s => ({ ...s, [field.key]: ok ? 'success' : 'error' }));
  };

  const handleSave = () => {
    setApiKeys({ ...localKeys, hubspotPortalId: hubspotPortal });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const StatusIcon = ({ s }: { s: ConnectionStatus }) => {
    if (s === 'testing') return <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />;
    if (s === 'success') return <CheckCircle2 className="w-4 h-4 text-green-500" />;
    if (s === 'error') return <XCircle className="w-4 h-4 text-red-500" />;
    return null;
  };

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-slate-600" />
          <h1 className="text-xl font-semibold text-slate-900">Settings</h1>
        </div>
        <p className="text-sm text-slate-500 mt-0.5">Configure API integrations and application preferences.</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Key className="w-4 h-4 text-slate-500" />
            <h2 className="font-semibold text-slate-800">API Keys</h2>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">Connect your data sources to enable signal enrichment. Keys are stored locally and never sent to our servers.</p>
        </CardHeader>
        <CardContent className="space-y-5">
          {apiKeyFields.map(field => (
            <div key={field.key}>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-semibold text-slate-700">{field.label}</label>
                <StatusIcon s={status[field.key] || 'idle'} />
              </div>
              <p className="text-xs text-slate-400 mb-2">{field.description}</p>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type={visible[field.key] ? 'text' : 'password'}
                    placeholder={field.placeholder}
                    value={localKeys[field.key] || ''}
                    onChange={e => setLocalKeys(k => ({ ...k, [field.key]: e.target.value }))}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white placeholder:text-slate-400 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 pr-9 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => toggleVisible(field.key)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {visible[field.key] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleTest(field)}
                  disabled={!localKeys[field.key] || status[field.key] === 'testing'}
                >
                  {status[field.key] === 'testing' ? 'Testing...' : 'Test'}
                </Button>
              </div>
              {status[field.key] === 'success' && (
                <p className="text-xs text-green-600 mt-1">Connection successful</p>
              )}
              {status[field.key] === 'error' && (
                <p className="text-xs text-red-600 mt-1">Connection failed — check your API key</p>
              )}
            </div>
          ))}

          <div className="pt-2 border-t border-slate-100">
            <label className="text-sm font-semibold text-slate-700 mb-1.5 block">HubSpot Portal ID</label>
            <p className="text-xs text-slate-400 mb-2">Required for website visitor tracking and analytics</p>
            <Input
              placeholder="e.g. 12345678"
              value={hubspotPortal}
              onChange={e => setHubspotPortal(e.target.value)}
            />
          </div>

          <div className="pt-2 flex items-center gap-2">
            <Button variant="primary" onClick={handleSave}>
              {saved ? <><CheckCircle2 className="w-4 h-4" /> Saved!</> : 'Save API Keys'}
            </Button>
            <p className="text-xs text-slate-400">Settings are stored in your browser's local storage</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="font-semibold text-slate-800">Integration Status</h2>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            {apiKeyFields.map(field => {
              const hasKey = !!apiKeys[field.key];
              return (
                <div key={field.key} className="flex items-center gap-2.5 p-3 bg-slate-50 rounded-lg border border-slate-100">
                  {hasKey
                    ? <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                    : <XCircle className="w-4 h-4 text-slate-300 flex-shrink-0" />
                  }
                  <div>
                    <p className="text-sm font-medium text-slate-700">{field.label}</p>
                    <p className={`text-xs ${hasKey ? 'text-green-600' : 'text-slate-400'}`}>
                      {hasKey ? 'Connected' : 'Not configured'}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-slate-400 mt-3">
            When API keys are not configured, SignalIQ uses realistic mock data for demonstration purposes.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
