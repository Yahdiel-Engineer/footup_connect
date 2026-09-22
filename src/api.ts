import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';


const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

const api = axios.create({
  baseURL: `${BACKEND_URL}/api`,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

// Add token to requests
api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export function formatApiError(detail: any, fallback?: string): string {
  if (detail == null) return fallback || 'Une erreur est survenue.';
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail))
    return detail.map((e: any) => e?.msg || JSON.stringify(e)).filter(Boolean).join(' ');
  if (detail?.msg) return detail.msg;
  return String(detail);
}

export function getFullError(e: any): string {
  if (e.response?.data?.detail) {
    return formatApiError(e.response.data.detail);
  }
  if (e.message) return e.message;
  return 'Une erreur est survenue.';
}

export default api;