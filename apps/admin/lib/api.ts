import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

const API_BASE = '/api/v1';

export const apiClient = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('admin_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('admin_token');
      localStorage.removeItem('admin_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ─── Auth ──────────────────────────────────────────────────────────────────

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface LoginResponse {
  token: string;
  admin: AdminUser;
}

export const authApi = {
  login: (email: string, password: string) =>
    apiClient.post<LoginResponse>('/admin/auth/login', { email, password }),
};

// ─── Users ─────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  name: string;
  email: string;
  country: string;
  status: 'active' | 'suspended' | 'banned';
  walletBalance: number;
  lifetimeEarnings: number;
  createdAt: string;
  paypalEmail?: string;
  phoneNumber?: string;
  referralCode?: string;
  referredBy?: string;
  fraudScore?: number;
}

export interface FraudLog {
  id: string;
  userId: string;
  type: string;
  description: string;
  severity: string;
  status: string;
  createdAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
}

export interface UsersResponse {
  data: User[];
  total: number;
  page: number;
  limit: number;
}

export const usersApi = {
  list: (params: {
    page?: number;
    limit?: number;
    search?: string;
    country?: string;
    status?: string;
  }) => apiClient.get<UsersResponse>('/admin/users', { params }),

  getById: (id: string) => apiClient.get<User>(`/admin/users/${id}`),

  updateStatus: (id: string, status: string, reason: string) =>
    apiClient.patch(`/admin/users/${id}/status`, { status, reason }),

  adjustBalance: (id: string, amount: number, reason: string) =>
    apiClient.post(`/admin/users/${id}/balance-adjust`, { amount, reason }),

  getFraudLogs: (id: string) =>
    apiClient.get<FraudLog[]>(`/admin/users/${id}/fraud-logs`),

  escalateFraud: (id: string, status: string) =>
    apiClient.patch(`/admin/users/${id}/fraud-escalate`, { status }),
};

// ─── Payouts ───────────────────────────────────────────────────────────────

export interface Payout {
  id: string;
  userId: string;
  userEmail: string;
  amount: number;
  paypalEmail: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'frozen';
  adminNote?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface PayoutsResponse {
  data: Payout[];
  total: number;
}

export const payoutsApi = {
  list: (params: { status?: string; page?: number; limit?: number }) =>
    apiClient.get<PayoutsResponse>('/admin/payouts', { params }),

  approve: (id: string, adminNote?: string) =>
    apiClient.patch(`/admin/payouts/${id}/approve`, { adminNote }),

  reject: (id: string, adminNote?: string) =>
    apiClient.patch(`/admin/payouts/${id}/reject`, { adminNote }),

  freeze: (id: string, adminNote?: string) =>
    apiClient.patch(`/admin/payouts/${id}/freeze`, { adminNote }),
};

// ─── Fraud ─────────────────────────────────────────────────────────────────

export const fraudApi = {
  review: (id: string, status: string) =>
    apiClient.patch(`/admin/fraud-logs/${id}/review`, { status }),
};

// ─── Settings ──────────────────────────────────────────────────────────────

export interface Setting {
  key: string;
  value: string;
  description: string;
}

export const settingsApi = {
  list: () => apiClient.get<Setting[]>('/admin/settings'),
  update: (key: string, value: string) =>
    apiClient.patch(`/admin/settings/${key}`, { value }),
};

// ─── Notifications ─────────────────────────────────────────────────────────

export interface Notification {
  id: string;
  title: string;
  body: string;
  target: 'all' | 'country' | 'activity_level' | 'earnings_tier';
  targetValue?: string;
  scheduledFor?: string;
  sentAt?: string;
  status?: string;
  createdAt: string;
}

// ─── Recurring Notifications ──────────────────────────────────────────────

export interface RecurringNotification {
  id: string;
  title: string;
  body: string;
  target: string;
  targetValue?: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'custom';
  cronExpr: string;
  isActive: boolean;
  lastSentAt?: string;
  nextSendAt?: string;
  createdBy: string;
  createdAt: string;
}

export const recurringApi = {
  list: () => apiClient.get<RecurringNotification[]>('/admin/notifications/recurring'),
  create: (payload: {
    title: string; body: string; target: string; targetValue?: string;
    frequency: string; hour?: number; dayOfWeek?: number; dayOfMonth?: number; cronExpr?: string;
  }) => apiClient.post<RecurringNotification>('/admin/notifications/recurring', payload),
  toggle: (id: string) => apiClient.patch(`/admin/notifications/recurring/${id}/toggle`),
  remove: (id: string) => apiClient.delete(`/admin/notifications/recurring/${id}`),
};

export const notificationsApi = {
  list: () => apiClient.get<Notification[]>('/admin/notifications'),
  send: (payload: {
    title: string;
    body: string;
    target: string;
    targetValue?: string;
    scheduledFor?: string;
  }) => apiClient.post<Notification>('/admin/notifications', payload),
};

// ─── Currencies ────────────────────────────────────────────────────────────

export interface Currency {
  id: string;
  code: string;
  name: string;
  symbol: string;
  rateToUsd: number;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export const currenciesApi = {
  list: () => apiClient.get<Currency[]>('/admin/currencies'),
  create: (payload: { code: string; name: string; symbol: string; rateToUsd: number }) =>
    apiClient.post<Currency>('/admin/currencies', payload),
  update: (code: string, payload: Partial<{ name: string; symbol: string; rateToUsd: number; isEnabled: boolean }>) =>
    apiClient.patch<Currency>(`/admin/currencies/${code}`, payload),
  remove: (code: string) => apiClient.delete(`/admin/currencies/${code}`),
};

// ─── Tasks ─────────────────────────────────────────────────────────────────

export type TaskTriggerType =
  | 'ad_views'
  | 'adjoe_earnings'
  | 'login_streak'
  | 'referral_count'
  | 'earning_milestone'
  | 'profile_complete'
  | 'manual';

export interface Task {
  id: string;
  title: string;
  description: string;
  icon: string;
  triggerType: TaskTriggerType;
  triggerValue: number;
  rewardAmount: number;
  repeatInterval: 'none' | 'daily' | 'weekly' | 'monthly';
  isActive: boolean;
  sortOrder: number;
  completionCount: number;
  claimedCount: number;
  createdAt: string;
}

export const tasksApi = {
  list: () => apiClient.get<Task[]>('/admin/tasks'),
  create: (payload: {
    title: string; description: string; icon?: string;
    triggerType: TaskTriggerType; triggerValue: number; rewardAmount: number;
    repeatInterval: string; sortOrder?: number;
  }) => apiClient.post<Task>('/admin/tasks', payload),
  update: (id: string, payload: Partial<{
    title: string; description: string; icon: string;
    triggerValue: number; rewardAmount: number; repeatInterval: string;
    isActive: boolean; sortOrder: number;
  }>) => apiClient.patch<Task>(`/admin/tasks/${id}`, payload),
  remove: (id: string) => apiClient.delete(`/admin/tasks/${id}`),
};
