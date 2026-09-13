import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [overview, setOverview] = useState<any>(null);

  useEffect(() => {
    api.overview().then(setOverview).catch(() => {});
    api.listCampaigns().then(r => setCampaigns(r.campaigns)).catch(() => {});
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Campaigns</h1>
      {overview && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card label="Total Campaigns" value={overview.totalCampaigns} />
          <Card label="Enabled" value={overview.enabledCampaigns} />
          <Card label="Daily Spend (SPECK)" value={overview.totalDailySpeck} />
        </div>
      )}
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
