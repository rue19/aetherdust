import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [campaign, setCampaign] = useState<any>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<any>(null);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const load = () => {
    if (!id) return;
    api.getCampaign(id).then(r => setCampaign(r.campaign)).catch(() => {});
    api.campaignAnalytics(id, 30).then(r => setAnalytics(r)).catch(() => {});
  };

  useEffect(() => { load(); }, [id]);

  const toggle = async () => {
    if (!id) return;
    await api.toggleCampaign(id);
    setCampaign((c: any) => ({ ...c, enabled: !c.enabled }));
  };

  const startEdit = () => {
    setForm({
      name: campaign.name,
      dailyBudgetSpeck: String(campaign.dailyBudgetSpeck),
      perTxLimitSpeck: String(campaign.perTransactionLimitSpeck),
      perUserTxLimit: campaign.perUserTransactionLimit,
      epochDurationSeconds: campaign.epochDurationSeconds,
      allowedContracts: campaign.allowedContracts?.join(', ') ?? '',
      allowedEntryPoints: campaign.allowedEntryPoints?.join(', ') ?? '',
    });
    setEditing(true);
  };

  const saveEdit = async () => {
    if (!id) return;
    try {
      setError('');
      await api.updateCampaign(id, {
        name: form.name,
        dailyBudgetSpeck: form.dailyBudgetSpeck,
        perTxLimitSpeck: form.perTxLimitSpeck,
        perUserTxLimit: form.perUserTxLimit,
        epochDurationSeconds: form.epochDurationSeconds,
        allowedContracts: form.allowedContracts ? form.allowedContracts.split(',').map((s: string) => s.trim()) : [],
        allowedEntryPoints: form.allowedEntryPoints ? form.allowedEntryPoints.split(',').map((s: string) => s.trim()) : [],
      });
      setEditing(false);
      load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDelete = async () => {
    if (!id || !confirm('Are you sure you want to delete this campaign?')) return;
    try {
      await api.deleteCampaign(id);
      navigate('/campaigns');
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (!campaign) return <div className="text-gray-400">Loading...</div>;

  return (
    <div>
      <button onClick={() => navigate('/campaigns')} className="text-sm text-midnight-500 hover:underline mb-4">&larr; Back</button>
      <div className="flex items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold">{campaign.name}</h1>
        <span className={`px-2 py-1 rounded text-xs ${campaign.enabled ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {campaign.enabled ? 'Enabled' : 'Disabled'}
        </span>
        <button onClick={toggle} className="text-sm border px-3 py-1 rounded hover:bg-gray-100">
          {campaign.enabled ? 'Disable' : 'Enable'}
        </button>
        <button onClick={startEdit} className="text-sm border px-3 py-1 rounded hover:bg-gray-100">Edit</button>
        <button onClick={handleDelete} className="text-sm text-red-600 hover:underline">Delete</button>
      </div>
      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

      {editing && form && (
        <div className="bg-white rounded-lg shadow p-4 mb-6 space-y-3">
          <h2 className="font-semibold">Edit Campaign</h2>
          <ModalInput label="Name" value={form.name} onChange={(v: string) => setForm({ ...form, name: v })} />
          <ModalInput label="Daily Budget (SPECK)" value={form.dailyBudgetSpeck} onChange={(v: string) => setForm({ ...form, dailyBudgetSpeck: v })} />
          <ModalInput label="Per-Tx Limit (SPECK)" value={form.perTxLimitSpeck} onChange={(v: string) => setForm({ ...form, perTxLimitSpeck: v })} />
          <ModalInput label="Per-User Tx Limit" value={String(form.perUserTxLimit)} onChange={(v: string) => setForm({ ...form, perUserTxLimit: parseInt(v) || 0 })} />
          <ModalInput label="Epoch Duration (seconds)" value={String(form.epochDurationSeconds)} onChange={(v: string) => setForm({ ...form, epochDurationSeconds: parseInt(v) || 86400 })} />
          <ModalInput label="Allowed Contracts (comma-sep)" value={form.allowedContracts} onChange={(v: string) => setForm({ ...form, allowedContracts: v })} />
          <ModalInput label="Allowed Entry Points (comma-sep)" value={form.allowedEntryPoints} onChange={(v: string) => setForm({ ...form, allowedEntryPoints: v })} />
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => setEditing(false)} className="border px-3 py-1 rounded text-sm hover:bg-gray-100">Cancel</button>
            <button onClick={saveEdit} className="bg-midnight-500 text-white px-4 py-2 rounded text-sm hover:bg-midnight-900">Save</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-4 space-y-2">
          <h2 className="font-semibold">Configuration</h2>
          <Row label="Daily Budget" value={`${campaign.dailyBudgetSpeck} SPECK`} />
          <Row label="Per-Tx Limit" value={`${campaign.perTransactionLimitSpeck} SPECK`} />
          <Row label="Per-User Limit" value={campaign.perUserTransactionLimit} />
          <Row label="Epoch Duration" value={`${campaign.epochDurationSeconds}s`} />
          <Row label="Allowed Contracts" value={campaign.allowedContracts?.join(', ') ?? 'None'} />
          <Row label="Allowed Entry Points" value={campaign.allowedEntryPoints?.join(', ') ?? 'None'} />
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="font-semibold mb-2">Daily Spend (30 days)</h2>
          {analytics?.dailySpend?.length > 0 ? (
            <div className="space-y-1">
              {analytics.dailySpend.slice(0, 10).map((d: any) => (
                <div key={d.day} className="flex justify-between text-sm">
                  <span>{new Date(d.day).toLocaleDateString()}</span>
                  <span>{d.total} SPECK ({d.count} txs)</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400 text-sm">No spend data yet</p>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: any }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="font-mono">{String(value)}</span>
    </div>
  );
}

function ModalInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-sm text-gray-500 block mb-1">{label}</label>
      <input className="w-full border rounded px-3 py-2 text-sm" value={value} onChange={e => onChange(e.target.value)} />
    </div>
  );
}
