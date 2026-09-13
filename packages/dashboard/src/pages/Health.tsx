import { useEffect, useState } from 'react';
import { api } from '../api';

export default function HealthPage() {
  const [health, setHealth] = useState<any>(null);
  const [wallet, setWallet] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/health').then(r => r.json()).then(setHealth).catch(e => setError(e.message));
    api.walletBalance().then(setWallet).catch(() => {});
  }, []);

  if (error) return <div className="text-red-600">Error: {error}</div>;
  if (!health) return <div className="text-gray-400">Loading...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">System Health</h1>
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-4 space-y-4">
          <h2 className="font-semibold">Server</h2>
          <Row label="Status" value={health.status} color={health.status === 'ok' ? 'text-green-600' : 'text-red-600'} />
          <Row label="Uptime" value={`${Math.round(health.uptime)}s`} />
          <Row label="Timestamp" value={health.timestamp} />
        </div>
        <div className="bg-white rounded-lg shadow p-4 space-y-4">
          <h2 className="font-semibold">Sponsor Wallet</h2>
          {wallet ? (
            <>
              <Row label="Connected" value={wallet.connected ? 'Yes' : 'No'} color={wallet.connected ? 'text-green-600' : 'text-red-600'} />
              <Row label="DUST Balance" value={wallet.balance} />
              <Row label="Address" value={wallet.address ? `${wallet.address.slice(0, 16)}...` : '-'} />
            </>
          ) : (
            <p className="text-gray-400 text-sm">Wallet info unavailable</p>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, color }: { label: string; value: any; color?: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-gray-500">{label}</span>
      <span className={`font-mono ${color ?? ''}`}>{String(value)}</span>
    </div>
  );
}
