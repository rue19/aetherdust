const BASE = '';

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = localStorage.getItem('token');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message ?? `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
}

function getProjectId(): string {
  const userStr = localStorage.getItem('user');
  if (!userStr) return '';
  const user = JSON.parse(userStr) as AdminUser;
  return user.id;
}

export const api = {
  login: (email: string, password: string) =>
    request<{ token: string; user: AdminUser }>('POST', '/v1/admin/login', { email, password })
      .then(r => { localStorage.setItem('user', JSON.stringify(r.user)); return r; }),

  overview: () => request<{ totalCampaigns: number; enabledCampaigns: number; totalDailySpeck: string }>('GET', `/v1/admin/overview?projectId=${getProjectId()}`),

  // ── Projects ──
  listProjects: () => request<{ projects: any[] }>('GET', `/v1/admin/projects`),
  createProject: (name: string) => request<{ project: any }>('POST', '/v1/admin/projects', { name }),

  // ── Campaigns ──
  listCampaigns: () =>
    request<{ campaigns: any[] }>('GET', `/v1/admin/campaigns?projectId=${getProjectId()}`),

  getCampaign: (id: string) => request<{ campaign: any }>('GET', `/v1/admin/campaigns/${id}`),

  createCampaign: (data: Record<string, unknown>) =>
    request<{ campaign: any }>('POST', '/v1/admin/campaigns', { ...data, projectId: getProjectId() }),

  updateCampaign: (id: string, data: Record<string, unknown>) =>
    request<{ campaign: any }>('PUT', `/v1/admin/campaigns/${id}`, data),

  toggleCampaign: (id: string) => request<{ campaign: any }>('PATCH', `/v1/admin/campaigns/${id}/toggle`),

  deleteCampaign: (id: string) => request<void>('DELETE', `/v1/admin/campaigns/${id}`),

  campaignAnalytics: (id: string, days?: number) =>
    request<{ campaign: any; dailySpend: any[] }>('GET', `/v1/admin/campaigns/${id}/analytics?days=${days ?? 30}`),

  // ── Transactions ──
  listTransactions: (params?: { campaignId?: string; status?: string; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.campaignId) q.set('campaignId', params.campaignId);
    if (params?.status) q.set('status', params.status);
    if (params?.limit) q.set('limit', String(params.limit));
    return request<{ transactions: any[] }>('GET', `/v1/admin/transactions?${q}`);
  },

  getTransaction: (id: string) => request<{ transaction: any }>('GET', `/v1/admin/transactions/${id}`),

  // ── API Keys ──
  listApiKeys: () =>
    request<{ apiKeys: any[] }>('GET', `/v1/admin/api-keys?projectId=${getProjectId()}`),

  createApiKey: (data: { name: string; scopes?: string[] }) =>
    request<{ apiKey: any }>('POST', '/v1/admin/api-keys', { ...data, projectId: getProjectId() }),

  revokeApiKey: (id: string) => request<void>('DELETE', `/v1/admin/api-keys/${id}`),

  // ── Admin Users ──
  listAdminUsers: () => request<{ users: any[] }>('GET', '/v1/admin/users'),

  createAdminUser: (data: { email: string; password: string; name?: string; role?: string }) =>
    request<{ user: any }>('POST', '/v1/admin/users', data),

  deleteAdminUser: (id: string) => request<void>('DELETE', `/v1/admin/users/${id}`),

  // ── Audit Log ──
  auditLog: (limit?: number) =>
    request<{ entries: any[] }>('GET', `/v1/admin/audit-log?limit=${limit ?? 50}`),

  // ── Wallet ──
  walletBalance: () => request<{ balance: string; address: string | null; connected: boolean }>('GET', '/v1/admin/wallet/balance'),
};
