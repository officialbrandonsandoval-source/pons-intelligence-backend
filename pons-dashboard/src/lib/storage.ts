const STORAGE_KEY = 'pons-dashboard-settings';

export type SourceType = 'manual' | 'hubspot' | 'ghl';

export interface StoredSettings {
  baseUrl: string;
  apiKey: string;
  source: SourceType;
  manualPayload: string;
  ghlApiKey?: string;
  ghlLocationId?: string;
  userId?: string;
}

const defaultSettings: StoredSettings = {
  baseUrl: 'http://localhost:3000',
  apiKey: '',
  source: 'manual',
  manualPayload: '{"leads":[{"name":"Test Lead","amount":100000,"stage":"proposal","lastContact":""}]}',
  ghlApiKey: '',
  ghlLocationId: '',
  userId: 'dev',
};

export const loadSettings = (): StoredSettings => {
  if (typeof localStorage === 'undefined') return defaultSettings;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return defaultSettings;
  try {
    return { ...defaultSettings, ...JSON.parse(raw) } as StoredSettings;
  } catch (_) {
    return defaultSettings;
  }
};

export const saveSettings = (settings: Partial<StoredSettings>) => {
  const merged = { ...defaultSettings, ...loadSettings(), ...settings };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  return merged;
};
