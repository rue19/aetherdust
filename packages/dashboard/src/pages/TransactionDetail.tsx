import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';

const STATUS_COLORS: Record<string, string> = {
  sponsored: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  pending: 'bg-yellow-100 text-yellow-800',
  failed: 'bg-gray-100 text-gray-800',
};

export default function TransactionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [tx, setTx] = useState<any>(null);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    if (!id) return;
    api.getTransaction(id).then(r => setTx(r.transaction)).catch(e => setError(e.message));
  }, [id]);

  if (error) return <div className="text-red-600">Error: {error}</div>;
  if (!tx) return <div className="text-gray-400">Loading...</div>;

  return (
    <div>
      <button onClick={() => navigate('/transactions')} className="text-sm text-midnight-500 hover:underline mb-4">&larr; Back</button>
      <h1 className="text-2xl font-bold mb-6">Transaction Detail</h1>
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-4 space-y-3">
          <h2 className="font-semibold">Status</h2>
          <div className="flex items-center gap-3">
            <span className={`px-2 py-1 rounded text-xs ${STATUS_COLORS[tx.status] ?? ''}`}>{tx.status}</span>
            {tx.rejectionReason && <span className="text-sm text-red-600">{tx.rejectionReason}</span>}
          </div>
          <Row label="Transaction ID" value={tx.id} />
          <Row label="TX Hash" value={tx.txHash ?? 'Pending'} />
          <Row label="Fee (SPECK)" value={tx.dustFeeSpeck} />
          <Row label="Campaign ID" value={tx.campaignId} />
        </div>
        <div className="bg-white rounded-lg shadow p-4 space-y-3">
          <h2 className="font-semibold">Details</h2>
          <Row label="Contract" value={tx.contractAddress ?? '-'} />
          <Row label="Entry Point" value={tx.entryPoint ?? '-'} />
          <Row label="Usage ID" value={tx.usageId} />
          <Row label="IP Address" value={tx.ipAddress ?? '-'} />
          <Row label="User Agent" value={tx.userAgent ?? '-'} />
          <Row label="Requested At" value={new Date(tx.requestedAt).toLocaleString()} />
          <Row label="Processed At" value={tx.processedAt ? new Date(tx.processedAt).toLocaleString() : '-'} />
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: any }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="font-mono text-right max-w-[60%] break-all">{String(value)}</span>
    </div>
  );
}
