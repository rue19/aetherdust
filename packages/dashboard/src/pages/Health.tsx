import { useEffect, useState } from 'react';

export default function HealthPage() {
  const [health, setHealth] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/health').then(r => r.json()).then(setHealth).catch(e => setError(e.message));
  }, []);

  if (error) return <div className="text-red-600">Error: {error}</div>;
  if (!health) return <div className="text-gray-400">Loading...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">System Health</h1>
      <div className="bg-white rounded-lg shadow p-6 space-y-4">
        <Row label="Status" value={health.status} color={health.status === 'ok' ? 'text-green-600' : 'text-red-600'} />
        <Row label="Uptime" value={`${Math.round(health.uptime)}s`} />
        <Row label="Timestamp" value={health.timestamp} />
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
