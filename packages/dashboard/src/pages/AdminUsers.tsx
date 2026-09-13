import { useEffect, useState } from 'react';
import { api } from '../api';

export default function AdminUsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ email: '', password: '', name: '', role: 'viewer' });
  const [error, setError] = useState('');

  const load = () => {
    api.listAdminUsers().then(r => setUsers(r.users)).catch(() => {});
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    try {
      setError('');
      await api.createAdminUser(form);
      setShowCreate(false);
      setForm({ email: '', password: '', name: '', role: 'viewer' });
      load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this user?')) return;
    try {
      await api.deleteAdminUser(id);
      load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Admin Users</h1>
        <button onClick={() => setShowCreate(true)} className="bg-midnight-500 text-white px-4 py-2 rounded text-sm hover:bg-midnight-900">Add User</button>
      </div>
      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-100"><tr>
            <th className="text-left px-4 py-2">Email</th>
            <th className="text-left px-4 py-2">Name</th>
            <th className="text-left px-4 py-2">Role</th>
            <th className="text-left px-4 py-2">Last Login</th>
            <th className="px-4 py-2"></th>
          </tr></thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} className="border-t hover:bg-gray-50">
                <td className="px-4 py-3 text-sm">{u.email}</td>
                <td className="px-4 py-3 text-sm">{u.name ?? '-'}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded text-xs ${u.role === 'admin' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}>{u.role}</span>
                </td>
                <td className="px-4 py-3 text-sm">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : 'Never'}</td>
                <td className="px-4 py-3">
                  <button onClick={() => handleDelete(u.id)} className="text-red-600 text-sm hover:underline">Delete</button>
                </td>
              </tr>
            ))}
            {users.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No users found</td></tr>}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-bold mb-4">Add Admin User</h2>
            {error && <p className="text-red-600 text-sm mb-4">{error}</p>}
            <div className="space-y-3">
              <ModalInput label="Email" value={form.email} onChange={v => setForm({ ...form, email: v })} />
              <ModalInput label="Password" value={form.password} onChange={v => setForm({ ...form, password: v })} type="password" />
              <ModalInput label="Name" value={form.name} onChange={v => setForm({ ...form, name: v })} />
              <div>
                <label className="text-sm text-gray-500 block mb-1">Role</label>
                <select className="w-full border rounded px-3 py-2 text-sm" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                  <option value="viewer">Viewer</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
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

function ModalInput({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label className="text-sm text-gray-500 block mb-1">{label}</label>
      <input type={type} className="w-full border rounded px-3 py-2 text-sm" value={value} onChange={e => onChange(e.target.value)} />
    </div>
  );
}
