const DEFAULT_API_BASE_URL = 'http://localhost:3000';

const normalizeApiBaseUrl = (value: string | undefined | null) => {
  const trimmedValue = value?.trim();

  if (!trimmedValue) {
    return '';
  }

  return trimmedValue.replace(/\/+$/, '');
};

const getElectronApiBaseUrl = () => {
  if (typeof window === 'undefined') {
    return '';
  }

  return normalizeApiBaseUrl(window.conmedRfidRuntimeConfig?.apiBaseUrl);
};

export const API_BASE_URL =
  getElectronApiBaseUrl() ||
  normalizeApiBaseUrl(import.meta.env.VITE_API_URL) ||
  DEFAULT_API_BASE_URL;
