import { FormEvent, useEffect, useState } from 'react';
import { api, setSettings } from '../lib/api';
import { loadSettings, saveSettings, SourceType, StoredSettings } from '../lib/storage';

const SourceOptions: { value: SourceType; label: string }[] = [
  { value: 'manual', label: 'Manual' },
  { value: 'hubspot', label: 'HubSpot' },
  { value: 'ghl', label: 'GoHighLevel' },
];

interface Props {
  onSaved(settings: StoredSettings): void;
}

export default function Connect({ onSaved }: Props) {
  const [settings, setLocalSettings] = useState<StoredSettings>(loadSettings());
  const [ghlStatus, setGhlStatus] = useState<string>('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setSettings(settings);
  }, []);

  const update = (patch: Partial<StoredSettings>) => {
    const merged = { ...settings, ...patch } as StoredSettings;
    setLocalSettings(merged);
  };

  const save = (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const merged = saveSettings(settings);
    setSettings(merged);
    onSaved(merged);
    setSaving(false);
  };

  const connectHubSpot = () => {
    const url = `${settings.baseUrl.replace(/\/$/, '')}/api/auth/hubspot`;
    window.open(url, '_blank');
  };

  const connectGHL = async () => {
    try {
      setGhlStatus('Connecting...');
      await api.connectGHL({
        apiKey: settings.ghlApiKey || '',
        locationId: settings.ghlLocationId || '',
        userId: settings.userId || 'dev',
      });
      setGhlStatus('GHL connected');
    } catch (err: any) {
      setGhlStatus(err?.message || 'Failed to connect GHL');
    }
  };

  return (
    <div className="card">
      <h2>Connect</h2>
      <form className="form" onSubmit={save}>
        <label>
          Backend Base URL
          <input
            type="url"
            value={settings.baseUrl}
            onChange={(e) => update({ baseUrl: e.target.value })}
            placeholder="http://localhost:3000"
            required
          />
        </label>
        <label>
          PONS API Key
          <input
            type="password"
            value={settings.apiKey}
            onChange={(e) => update({ apiKey: e.target.value })}
            placeholder="x-api-key"
            required
          />
        </label>
        <label>
          Source
          <select value={settings.source} onChange={(e) => update({ source: e.target.value as SourceType })}>
            {SourceOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        {settings.source === 'ghl' && (
          <div className="grid">
            <label>
              GHL API Key
              <input
                type="password"
                value={settings.ghlApiKey || ''}
                onChange={(e) => update({ ghlApiKey: e.target.value })}
                placeholder="GHL API Key"
                required
              />
            </label>
            <label>
              Location ID
              <input
                value={settings.ghlLocationId || ''}
                onChange={(e) => update({ ghlLocationId: e.target.value })}
                placeholder="Location ID"
                required
              />
            </label>
            <label>
              User ID
              <input value={settings.userId || ''} onChange={(e) => update({ userId: e.target.value })} placeholder="user id" />
            </label>
            <button type="button" className="secondary" onClick={connectGHL}>
              Connect GoHighLevel
            </button>
            {ghlStatus && <p className="muted">{ghlStatus}</p>}
          </div>
        )}

        <div className="actions">
          <button type="submit" disabled={saving}>
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
          <button type="button" onClick={connectHubSpot} className="secondary">
            Connect HubSpot
          </button>
        </div>
      </form>
    </div>
  );
}
