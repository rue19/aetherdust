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

  listCampaigns: () =>
    request<{ campaigns: any[] }>('GET', `/v1/admin/campaigns?projectId=${getProjectId()}`),

  getCampaign: (id: string) => request<{ campaign: any }>('GET', `/v1/admin/campaigns/${id}`),

  toggleCampaign: (id: string) => request<{ campaign: any }>('PATCH', `/v1/admin/campaigns/${id}/toggle`),

  campaignAnalytics: (id: string, days?: number) =>
    request<{ campaign: any; dailySpend: any[] }>('GET', `/v1/admin/campaigns/${id}/analytics?days=${days ?? 30}`),

  listTransactions: (params?: { campaignId?: string; status?: string; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.campaignId) q.set('campaignId', params.campaignId);
    if (params?.status) q.set('status', params.status);
    if (params?.limit) q.set('limit', String(params.limit));
    return request<{ transactions: any[] }>('GET', `/v1/admin/transactions?${q}`);
  },

  listApiKeys: () =>
    request<{ apiKeys: any[] }>('GET', `/v1/admin/api-keys?projectId=${getProjectId()}`),

  createApiKey: (data: { name: string; scopes?: string[] }) =>
    request<{ apiKey: any }>('POST', '/v1/admin/api-keys', { ...data, projectId: getProjectId() }),

  revokeApiKey: (id: string) => request<void>('DELETE', `/v1/admin/api-keys/${id}`),

  auditLog: (limit?: number) =>
    request<{ entries: any[] }>('GET', `/v1/admin/audit-log?limit=${limit ?? 50}`),
};
