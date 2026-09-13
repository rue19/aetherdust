import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [campaign, setCampaign] = useState<any>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!id) return;
    api.getCampaign(id).then(r => setCampaign(r.campaign)).catch(() => {});
    api.campaignAnalytics(id, 30).then(r => setAnalytics(r)).catch(() => {});
  }, [id]);

  const toggle = async () => {
    if (!id) return;
    await api.toggleCampaign(id);
    setCampaign((c: any) => ({ ...c, enabled: !c.enabled }));
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
      </div>

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
