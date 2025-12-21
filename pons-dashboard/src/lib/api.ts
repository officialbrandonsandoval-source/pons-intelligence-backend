import axios, { AxiosError } from 'axios';
import { loadSettings, saveSettings, StoredSettings } from './storage';

let settings: StoredSettings = loadSettings();

export const setSettings = (partial: Partial<StoredSettings>) => {
  settings = saveSettings(partial);
};

const client = axios.create({ timeout: 15000 });

client.interceptors.request.use((config) => {
  const baseURL = settings.baseUrl || 'http://localhost:3000';
  config.baseURL = baseURL;
  const headers = (config.headers || {}) as Record<string, any>;
  headers['x-api-key'] = settings.apiKey || '';
  headers['Content-Type'] = 'application/json';
  config.headers = headers as any;
  return config;
});

client.interceptors.response.use(
  (resp) => resp,
  (error: AxiosError) => {
    const status = error.response?.status;
    const message =
      status === 401
        ? 'Unauthorized: check API key'
        : status === 400
          ? (error.response?.data as any)?.error || 'Bad request'
          : 'Server error';
    return Promise.reject(new Error(message));
  }
);

export const api = {
  async connectGHL(payload: { apiKey: string; locationId: string; userId?: string }) {
    return client.post('/api/auth/ghl', payload);
  },
  async runCommand(body: any) {
    return client.post('/api/command', body).then((r) => r.data);
  },
};
