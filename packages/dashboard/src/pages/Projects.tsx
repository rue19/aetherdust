import { useEffect, useState } from 'react';
import { api } from '../api';

export default function ProjectsPage() {
  const [projects, setProjects] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const load = () => {
    api.listProjects().then(r => setProjects(r.projects)).catch(() => {});
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!name.trim()) return;
    try {
      setError('');
      await api.createProject(name.trim());
      setName('');
      load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Projects</h1>
      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}
      <div className="flex gap-2 mb-6">
        <input placeholder="Project name" value={name} onChange={e => setName(e.target.value)}
          className="border rounded px-3 py-2 text-sm flex-1" />
        <button onClick={handleCreate} className="bg-midnight-500 text-white px-4 py-2 rounded text-sm hover:bg-midnight-900">Create</button>
      </div>
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-100"><tr>
            <th className="text-left px-4 py-2">Name</th>
            <th className="text-left px-4 py-2">Project ID</th>
            <th className="text-left px-4 py-2">Created</th>
          </tr></thead>
          <tbody>
            {projects.map(p => (
              <tr key={p.id} className="border-t hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{p.name}</td>
                <td className="px-4 py-3 text-sm font-mono">{p.id}</td>
                <td className="px-4 py-3 text-sm">{new Date(p.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
            {projects.length === 0 && <tr><td colSpan={3} className="px-4 py-8 text-center text-gray-400">No projects found</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
