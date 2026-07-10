import { clearToken, getToken, http, setToken } from './http';
import {
  clearStoredSsoRedirects,
  getNexusLogoutReturn,
  sanitizeRedirect,
} from '@/lib/ssoRedirect';

const ENTITY_MAP = {
  Complaint: 'complaints',
  TicketActivity: 'ticket-activities',
  InternalNote: 'internal-notes',
  Notification: 'notifications',
  Product: 'products',
  ProductCategory: 'product-categories',
  Role: 'roles',
  SystemConfig: 'system-configs',
  Department: 'departments',
  ComplaintType: 'complaint-types',
  ComplaintStatus: 'complaint-statuses',
  Courier: 'couriers',
  Priority: 'priorities',
  UnitOfMeasurement: 'units-of-measurement',
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
          const nexusLogoutReturn = getNexusLogoutReturn();
          const returnPath = sanitizeRedirect(sessionStorage.getItem('nexus_redirect_to'));
          clearStoredSsoRedirects();

          if (nexusLogoutReturn) {
            window.location.href = nexusLogoutReturn;
          } else {
            const params = returnPath ? `?return=${encodeURIComponent(returnPath)}` : '';
            window.location.href = `/login${params}`;
          }
        }
      }
    },

    redirectToLogin(returnUrl) {
      const path = sanitizeRedirect(returnUrl);
      const params = path ? `?return=${encodeURIComponent(path)}` : '';
      window.location.href = `/login${params}`;
    },

    async login(email, password) {
      const data = await http.post('/auth/login', { email, password });
      setToken(data.token);
      return data.user?.data ?? data.user;
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
    async createUser(payload) {
      const data = await http.post('/users', payload);
      return data;
    },

    async inviteUser(email, roleId) {
      const data = await http.post('/users/invite', { email, role_id: roleId });
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

  complaints: {
    async assignAgent(complaintId, userId) {
      const data = await http.post(`/complaints/${complaintId}/agents`, { user_id: userId });
      return data.data ?? data;
    },

    async removeAgent(complaintId, userId) {
      const data = await http.delete(`/complaints/${complaintId}/agents/${userId}`);
      return data.data ?? data;
    },

    async createFormOptions() {
      return http.get('/complaints/create-form-options');
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

    Webhook: {
      async getSettings() {
        return http.get('/webhook/settings');
      },

      async updateSettings(payload) {
        return http.patch('/webhook/settings', payload);
      },

      async regenerateIncomingSecret() {
        return http.post('/webhook/regenerate-secret');
      },

      async regenerateOutgoingSecret(id) {
        return http.post('/webhook/regenerate-outgoing-secret', { id });
      },

      async testOutgoing(webhook) {
        return http.post('/webhook/test-outgoing', webhook);
      },
    },

    TikTokShop: {
      async getStatus() {
        return http.get('/tiktok-shop/status');
      },

      async listConnections() {
        const data = await http.get('/tiktok-shop');
        return data.data ?? data;
      },

      async getAuthUrl() {
        return http.get('/tiktok-shop/auth-url');
      },

      async disconnect(id) {
        return http.delete(`/tiktok-shop/${id}`);
      },

      async refreshToken(id) {
        return http.post(`/tiktok-shop/${id}/refresh`);
      },

      async listProducts(connectionId, params = {}) {
        return http.get(`/tiktok-shop/${connectionId}/products`, params);
      },

      async getPlatformConfig(platform = 'tiktok_shop') {
        return http.get(`/marketplace/platforms/${platform}`);
      },

      async updatePlatformConfig(platform, payload) {
        return http.patch(`/marketplace/platforms/${platform}`, payload);
      },
    },

    Shopee: {
      async getStatus() {
        return http.get('/shopee/status');
      },

      async listConnections() {
        const data = await http.get('/shopee');
        return data.data ?? data;
      },

      async getAuthUrl() {
        return http.get('/shopee/auth-url');
      },

      async disconnect(id) {
        return http.delete(`/shopee/${id}`);
      },

      async refreshToken(id) {
        return http.post(`/shopee/${id}/refresh`);
      },

      async listProducts(connectionId, params = {}) {
        return http.get(`/shopee/${connectionId}/products`, params);
      },

      async getPlatformConfig(platform = 'shopee') {
        return http.get(`/marketplace/platforms/${platform}`);
      },

      async updatePlatformConfig(platform, payload) {
        return http.patch(`/marketplace/platforms/${platform}`, payload);
      },
    },

    Marketplace: {
      async listShops(params = {}) {
        const data = await http.get('/marketplace/shops', params);
        return data.data ?? data;
      },

      async listReviews(params = {}) {
        const data = await http.get('/marketplace/reviews', params);
        return data.data ?? data;
      },

      async syncReviews(payload) {
        return http.post('/marketplace/reviews/sync', payload);
      },

      async replyToReview(reviewId, content) {
        return http.post(`/marketplace/reviews/${reviewId}/reply`, { content });
      },
    },
  },
};

export default db;
