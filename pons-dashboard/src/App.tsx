import { useState } from 'react';
import Connect from './pages/Connect';
import Audit from './pages/Audit';
import { loadSettings, StoredSettings } from './lib/storage';

const tabs = ['connect', 'audit'] as const;
type Tab = (typeof tabs)[number];

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button className={active ? 'tab active' : 'tab'} onClick={onClick} type="button">
      {children}
    </button>
  );
}

export default function App() {
  const [tab, setTab] = useState<Tab>('connect');
  const [settings, setSettings] = useState<StoredSettings>(loadSettings());

  return (
    <div className="layout">
      <header className="topbar">
        <div>
          <h1>PONS Dashboard</h1>
          <p className="muted">Mobile-first, zero-clutter revenue intelligence</p>
        </div>
        <div className="tabs">
          <TabButton active={tab === 'connect'} onClick={() => setTab('connect')}>
            Connect
          </TabButton>
          <TabButton active={tab === 'audit'} onClick={() => setTab('audit')}>
            Revenue Leak Detector
          </TabButton>
        </div>
      </header>

      <main>
        {tab === 'connect' && <Connect onSaved={(s) => setSettings(s)} />}
        {tab === 'audit' && <Audit settings={settings} onSettingsChange={(s) => setSettings(s)} />}
      </main>
    </div>
  );
}
