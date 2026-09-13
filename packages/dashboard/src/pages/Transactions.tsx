import { useEffect, useState } from 'react';
import { api } from '../api';

const STATUS_COLORS: Record<string, string> = {
  sponsored: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  pending: 'bg-yellow-100 text-yellow-800',
  failed: 'bg-gray-100 text-gray-800',
};

export default function TransactionsPage() {
  const [txs, setTxs] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    api.listTransactions({ status: statusFilter || undefined, limit: 100 }).then(r => setTxs(r.transactions)).catch(() => {});
  }, [statusFilter]);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Transactions</h1>
      <div className="mb-4 flex gap-2">
        {['', 'sponsored', 'rejected', 'pending', 'failed'].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-3 py-1 rounded text-sm border ${statusFilter === s ? 'bg-midnight-500 text-white' : 'hover:bg-gray-100'}`}>
            {s || 'All'}
          </button>
        ))}
      </div>
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-100"><tr>
            <th className="text-left px-4 py-2">Status</th>
            <th className="text-left px-4 py-2">Campaign</th>
            <th className="text-left px-4 py-2">Fee (SPECK)</th>
            <th className="text-left px-4 py-2">Contract</th>
            <th className="text-left px-4 py-2">Entry Point</th>
            <th className="text-left px-4 py-2">Requested</th>
          </tr></thead>
          <tbody>
            {txs.map(tx => (
              <tr key={tx.id} className="border-t hover:bg-gray-50">
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded text-xs ${STATUS_COLORS[tx.status] ?? ''}`}>{tx.status}</span>
                </td>
                <td className="px-4 py-3 text-sm font-mono">{tx.campaignId.slice(0, 8)}...</td>
                <td className="px-4 py-3 text-sm">{tx.dustFeeSpeck}</td>
                <td className="px-4 py-3 text-sm font-mono">{tx.contractAddress ?? '-'}</td>
                <td className="px-4 py-3 text-sm">{tx.entryPoint ?? '-'}</td>
                <td className="px-4 py-3 text-sm">{new Date(tx.requestedAt).toLocaleString()}</td>
              </tr>
            ))}
            {txs.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No transactions found</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
