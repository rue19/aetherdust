import { useEffect, useState } from 'react';
import { api } from '../api';

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [newKey, setNewKey] = useState('');
  const [error, setError] = useState('');

  const load = () => api.listApiKeys().then(r => setKeys(r.apiKeys)).catch(() => {});
  useEffect(() => { load(); }, []);

  const create = async () => {
    try {
      const { apiKey } = await api.createApiKey({ name, scopes: ['sponsor'] });
      setNewKey(apiKey.plaintextKey);
      setName('');
      load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const revoke = async (id: string) => {
    await api.revokeApiKey(id);
    load();
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">API Keys</h1>
      {newKey && (
        <div className="bg-green-50 border border-green-200 rounded p-4 mb-4">
          <p className="text-sm font-semibold mb-1">New API Key (copy now, it won't be shown again):</p>
          <code className="text-sm break-all">{newKey}</code>
        </div>
      )}
      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}
      <div className="flex gap-2 mb-6">
        <input placeholder="Key name" value={name} onChange={e => setName(e.target.value)}
          className="border rounded px-3 py-2 text-sm flex-1" />
        <button onClick={create} className="bg-midnight-500 text-white px-4 py-2 rounded text-sm hover:bg-midnight-900">Create Key</button>
      </div>
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-100"><tr>
            <th className="text-left px-4 py-2">Name</th>
            <th className="text-left px-4 py-2">Prefix</th>
            <th className="text-left px-4 py-2">Scopes</th>
            <th className="text-left px-4 py-2">Status</th>
            <th className="text-left px-4 py-2">Last Used</th>
            <th className="px-4 py-2"></th>
          </tr></thead>
          <tbody>
            {keys.map(k => (
              <tr key={k.id} className="border-t hover:bg-gray-50">
                <td className="px-4 py-3">{k.name}</td>
                <td className="px-4 py-3 font-mono text-sm">{k.keyPrefix}...</td>
                <td className="px-4 py-3 text-sm">{k.scopes?.join(', ')}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded text-xs ${k.enabled ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {k.enabled ? 'Active' : 'Revoked'}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm">{k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString() : 'Never'}</td>
                <td className="px-4 py-3">
                  {k.enabled && <button onClick={() => revoke(k.id)} className="text-red-600 text-sm hover:underline">Revoke</button>}
                </td>
              </tr>
            ))}
            {keys.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No API keys</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
