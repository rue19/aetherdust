import { useEffect, useState } from 'react';
import { api } from '../api';

export default function AuditLogPage() {
  const [entries, setEntries] = useState<any[]>([]);

  useEffect(() => {
    api.auditLog(100).then(r => setEntries(r.entries)).catch(() => {});
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Audit Log</h1>
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-100"><tr>
            <th className="text-left px-4 py-2">Time</th>
            <th className="text-left px-4 py-2">Actor</th>
            <th className="text-left px-4 py-2">Action</th>
            <th className="text-left px-4 py-2">Target</th>
            <th className="text-left px-4 py-2">Metadata</th>
          </tr></thead>
          <tbody>
            {entries.map(e => (
              <tr key={e.id} className="border-t hover:bg-gray-50">
                <td className="px-4 py-3 text-sm">{new Date(e.createdAt).toLocaleString()}</td>
                <td className="px-4 py-3 text-sm">{e.actorType}{e.actorId ? ` (${e.actorId.slice(0, 8)}...)` : ''}</td>
                <td className="px-4 py-3 text-sm font-mono">{e.action}</td>
                <td className="px-4 py-3 text-sm">{e.targetType ? `${e.targetType}/${e.targetId?.slice(0, 8)}...` : '-'}</td>
                <td className="px-4 py-3 text-sm max-w-xs truncate">{e.metadata ? JSON.stringify(e.metadata) : '-'}</td>
              </tr>
            ))}
            {entries.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No audit entries</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
