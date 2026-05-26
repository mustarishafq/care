import { clearToken, getToken, http, setToken } from './http';

const ENTITY_MAP = {
  Complaint: 'complaints',
  TicketActivity: 'ticket-activities',
  InternalNote: 'internal-notes',
  Notification: 'notifications',
  Product: 'products',
  Role: 'roles',
  SystemConfig: 'system-configs',
  Department: 'departments',
  ComplaintType: 'complaint-types',
  ComplaintStatus: 'complaint-statuses',
  Courier: 'couriers',
  Priority: 'priorities',
  User: 'users',
};

function parseSortAndLimit(sort, limit) {
  const params = {};
  if (sort) params.sort = sort;
  if (limit) params.limit = limit;
  return params;
}

function createEntityApi(entityName) {
  const resource = ENTITY_MAP[entityName];

  return {
    async list(sort, limit) {
      const data = await http.get(`/${resource}`, parseSortAndLimit(sort, limit));
      return data.data ?? data;
    },

    async filter(criteria = {}, sort, limit) {
      const params = { ...criteria, ...parseSortAndLimit(sort, limit) };
      const data = await http.get(`/${resource}`, params);
      return data.data ?? data;
    },

    async create(payload) {
      const data = await http.post(`/${resource}`, payload);
      return data.data ?? data;
    },

    async update(id, payload) {
      const data = await http.patch(`/${resource}/${id}`, payload);
      return data.data ?? data;
    },

    async delete(id) {
      await http.delete(`/${resource}/${id}`);
      return { success: true };
    },
  };
}

export const db = {
  auth: {
    async me() {
      if (!getToken()) return null;
      const data = await http.get('/auth/me');
      return data.data ?? data;
    },

    async updateMe(updates) {
      const data = await http.patch('/auth/me', updates);
      return data.data ?? data;
    },

    async logout({ redirect = true } = {}) {
      try {
        if (getToken()) {
          await http.post('/auth/logout');
        }
      } finally {
        clearToken();
        if (redirect) {
          const nexusReturn = sessionStorage.getItem('nexus_return_to');
          if (nexusReturn) {
            sessionStorage.removeItem('nexus_return_to');
            window.location.href = nexusReturn;
          } else {
            window.location.href = '/login';
          }
        }
      }
    },

    redirectToLogin(returnUrl) {
      const params = returnUrl ? `?return=${encodeURIComponent(returnUrl)}` : '';
      window.location.href = `/login${params}`;
    },

    async login(email, password) {
      const data = await http.post('/auth/login', { email, password });
      setToken(data.token);
      return data.user;
    },

    async register(payload) {
      const data = await http.post('/auth/register', payload);
      return data;
    },

    async forgotPassword(email) {
      return http.post('/auth/forgot-password', { email });
    },

    async resetPassword(payload) {
      return http.post('/auth/reset-password', payload);
    },
  },

  users: {
    async inviteUser(email, role) {
      const data = await http.post('/users/invite', { email, role });
      return data;
    },

    async approve(id) {
      const data = await http.post(`/users/${id}/approve`);
      return data.data ?? data;
    },

    async reject(id) {
      const data = await http.post(`/users/${id}/reject`);
      return data.data ?? data;
    },

    async disable(id) {
      const data = await http.post(`/users/${id}/disable`);
      return data.data ?? data;
    },
  },

  entities: new Proxy(
    {},
    {
      get(_, entityName) {
        return createEntityApi(entityName);
      },
    },
  ),

  integrations: {
    Core: {
      async UploadFile({ file }) {
        const formData = new FormData();
        formData.append('file', file);
        return http.upload('/files/upload', formData);
      },

      async SendEmail({ to, subject, body }) {
        return http.post('/notifications/send-email', { to, subject, body });
      },
    },
  },
};

export default db;
