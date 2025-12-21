import { FormEvent, useMemo, useState } from 'react';
import { api, setSettings } from '../lib/api';
import { loadSettings, saveSettings, SourceType, StoredSettings } from '../lib/storage';

type Result = {
  revenueLeaks: { leadId: string; description: string; riskAmount?: number | string }[];
  priorities: { id: string; name: string; score: number; amount?: number; stage?: string; lastContact?: string; daysSinceLastContact?: number | null }[];
  topAction: string;
  revenueImpact: string;
  priority: string;
  supportingActions?: string[];
};

interface Props {
  settings: StoredSettings;
  onSettingsChange(s: StoredSettings): void;
}

export default function Audit({ settings, onSettingsChange }: Props) {
  const [manualJson, setManualJson] = useState(settings.manualPayload);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [result, setResult] = useState<Result | null>(null);

  const requestBody = useMemo(() => {
    if (settings.source === 'manual') {
      try {
        const parsed = JSON.parse(manualJson);
        return { data: parsed };
      } catch (_) {
        return null;
      }
    }
    if (settings.source === 'hubspot') {
      return { source: 'hubspot', userId: settings.userId || 'dev' };
    }
    if (settings.source === 'ghl') {
      return { source: 'ghl', userId: settings.userId || 'dev' };
    }
    return null;
  }, [settings.source, manualJson, settings.userId]);

  const runAudit = async (e: FormEvent) => {
    e.preventDefault();
    if (!requestBody) {
      setError('Invalid manual JSON');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const saved = saveSettings({ manualPayload: manualJson, ...settings });
      setSettings(saved);
      onSettingsChange(saved);
      const data = await api.runCommand(requestBody);
      setResult(data.insight || data);
    } catch (err: any) {
      setResult(null);
      setError(err?.message || 'Failed to run audit');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <div className="card-header">
        <h2>Revenue Leak Detector</h2>
        <span className={`badge ${settings.source}`}>{settings.source}</span>
      </div>
      <form className="form" onSubmit={runAudit}>
        {settings.source === 'manual' && (
          <label>
            Manual JSON (leads)
            <textarea
              value={manualJson}
              onChange={(e) => setManualJson(e.target.value)}
              rows={8}
              spellCheck={false}
              className="mono"
            />
          </label>
        )}

        {settings.source === 'ghl' && (
          <p className="muted">Ensure GHL credentials are saved on Connect tab.</p>
        )}

        {settings.source === 'hubspot' && <p className="muted">Make sure HubSpot is connected.</p>}

        <button type="submit" disabled={loading}>
          {loading ? 'Running...' : 'Run Revenue Audit'}
        </button>
      </form>

      {error && <div className="error">{error}</div>}

      {result && (
        <div className="results">
          <div className="top-action">
            <div>
              <p className="label">Top Action</p>
              <h3>{result.topAction}</h3>
            </div>
            <div className="impact">
              <span className="badge">{result.priority}</span>
              <span>{result.revenueImpact}</span>
            </div>
          </div>

          <section>
            <h4>Revenue Leaks</h4>
            {result.revenueLeaks?.length ? (
              <ul>
                {result.revenueLeaks.map((l, idx) => (
                  <li key={`${l.leadId}-${idx}`}>
                    <div className="row">
                      <strong>{l.leadId}</strong>
                      <span className="muted">{typeof l.riskAmount === 'number' ? `$${l.riskAmount.toLocaleString()}` : l.riskAmount}</span>
                    </div>
                    <p>{l.description}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">No leaks detected.</p>
            )}
          </section>

          <section>
            <h4>Priorities</h4>
            {result.priorities?.length ? (
              <ol>
                {result.priorities.slice(0, 5).map((p, idx) => (
                  <li key={`${p.id}-${idx}`}>
                    <div className="row">
                      <div>
                        <strong>{p.name || p.id}</strong>
                        <span className="muted"> stage: {p.stage || 'n/a'}</span>
                      </div>
                      <div className="row gap">
                        <span className="pill">Score {p.score}</span>
                        {p.amount !== undefined && <span className="pill">${p.amount?.toLocaleString()}</span>}
                      </div>
                    </div>
                    {p.lastContact && <p className="muted">Last contact: {p.lastContact}</p>}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="muted">No priorities.</p>
            )}
          </section>

          {result.supportingActions?.length ? (
            <section>
              <h4>Supporting Actions</h4>
              <ul>
                {result.supportingActions.map((a, idx) => (
                  <li key={idx}>{a}</li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}
