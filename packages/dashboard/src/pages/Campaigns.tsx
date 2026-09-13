import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [overview, setOverview] = useState<any>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', dailyBudgetSpeck: '0', perTxLimitSpeck: '0', perUserTxLimit: 0, epochDurationSeconds: 86400, allowedContracts: '', allowedEntryPoints: '' });
  const [error, setError] = useState('');

  const load = () => {
    api.overview().then(setOverview).catch(() => {});
    api.listCampaigns().then(r => setCampaigns(r.campaigns)).catch(() => {});
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    try {
      setError('');
      await api.createCampaign({
        name: form.name,
        dailyBudgetSpeck: form.dailyBudgetSpeck,
        perTxLimitSpeck: form.perTxLimitSpeck,
        perUserTxLimit: form.perUserTxLimit,
        epochDurationSeconds: form.epochDurationSeconds,
        allowedContracts: form.allowedContracts ? form.allowedContracts.split(',').map(s => s.trim()) : [],
        allowedEntryPoints: form.allowedEntryPoints ? form.allowedEntryPoints.split(',').map(s => s.trim()) : [],
      });
      setShowCreate(false);
      setForm({ name: '', dailyBudgetSpeck: '0', perTxLimitSpeck: '0', perUserTxLimit: 0, epochDurationSeconds: 86400, allowedContracts: '', allowedEntryPoints: '' });
      load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Campaigns</h1>
        <button onClick={() => setShowCreate(true)} className="bg-midnight-500 text-white px-4 py-2 rounded text-sm hover:bg-midnight-900">Create Campaign</button>
      </div>
      {overview && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card label="Total Campaigns" value={overview.totalCampaigns} />
          <Card label="Enabled" value={overview.enabledCampaigns} />
          <Card label="Daily Spend (SPECK)" value={overview.totalDailySpeck} />
        </div>
      )}
      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-100"><tr>
            <th className="text-left px-4 py-2">Name</th>
            <th className="text-left px-4 py-2">Status</th>
            <th className="text-left px-4 py-2">Budget / Day</th>
            <th className="text-left px-4 py-2">Per-Tx Limit</th>
            <th className="px-4 py-2"></th>
          </tr></thead>
          <tbody>
            {campaigns.map(c => (
              <tr key={c.id} className="border-t hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{c.name}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded text-xs ${c.enabled ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {c.enabled ? 'Enabled' : 'Disabled'}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm">{c.dailyBudgetSpeck}</td>
                <td className="px-4 py-3 text-sm">{c.perTransactionLimitSpeck}</td>
                <td className="px-4 py-3">
                  <Link to={`/campaigns/${c.id}`} className="text-midnight-500 hover:underline text-sm">Details</Link>
                </td>
              </tr>
            ))}
            {campaigns.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No campaigns found</td></tr>}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg">
            <h2 className="text-lg font-bold mb-4">Create Campaign</h2>
            {error && <p className="text-red-600 text-sm mb-4">{error}</p>}
            <div className="space-y-3">
              <Input label="Name" value={form.name} onChange={v => setForm({ ...form, name: v })} />
              <Input label="Daily Budget (SPECK)" value={form.dailyBudgetSpeck} onChange={v => setForm({ ...form, dailyBudgetSpeck: v })} />
              <Input label="Per-Tx Limit (SPECK)" value={form.perTxLimitSpeck} onChange={v => setForm({ ...form, perTxLimitSpeck: v })} />
              <Input label="Per-User Tx Limit" value={String(form.perUserTxLimit)} onChange={v => setForm({ ...form, perUserTxLimit: parseInt(v) || 0 })} />
              <Input label="Epoch Duration (seconds)" value={String(form.epochDurationSeconds)} onChange={v => setForm({ ...form, epochDurationSeconds: parseInt(v) || 86400 })} />
              <Input label="Allowed Contracts (comma-sep)" value={form.allowedContracts} onChange={v => setForm({ ...form, allowedContracts: v })} />
              <Input label="Allowed Entry Points (comma-sep)" value={form.allowedEntryPoints} onChange={v => setForm({ ...form, allowedEntryPoints: v })} />
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setShowCreate(false)} className="border px-4 py-2 rounded text-sm hover:bg-gray-100">Cancel</button>
              <button onClick={handleCreate} className="bg-midnight-500 text-white px-4 py-2 rounded text-sm hover:bg-midnight-900">Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Card({ label, value }: { label: string; value: any }) {
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="text-sm text-gray-500">{label}</div>
      <div className="text-xl font-bold">{value}</div>
    </div>
  );
}

function Input({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-sm text-gray-500 block mb-1">{label}</label>
      <input className="w-full border rounded px-3 py-2 text-sm" value={value} onChange={e => onChange(e.target.value)} />
    </div>
  );
}
