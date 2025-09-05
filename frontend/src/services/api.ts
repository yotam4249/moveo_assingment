
/* eslint-disable @typescript-eslint/no-explicit-any */
// src/services/api.ts
import axios, { CanceledError } from "axios";
import type { AxiosError, AxiosInstance, AxiosRequestConfig } from "axios";
import userService from "./user_service";
export { CanceledError };

const API_BASE = "https://moveo-assignment.onrender.com/api "
const REFRESH_PATH = "/auth/refresh";

const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
});

// Always attach the latest token from localStorage
apiClient.interceptors.request.use(
  async (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers = config.headers ?? {};
      (config.headers as any).Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ----- 401 handling with de-duped refresh + single retry -----
let isRefreshing = false;
let waiters: Array<() => void> = [];
const enqueue = (r: () => void) => waiters.push(r);
const release = () => { waiters.forEach((r) => r()); waiters = []; };

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as (AxiosRequestConfig & { _retry?: boolean }) | undefined;
    const status = error.response?.status;

    if (!original || status !== 401) return Promise.reject(error);

    // don't loop on the refresh call itself, and retry only once
    const url = (original.url || "").toString();
    if (original._retry || url.endsWith(REFRESH_PATH)) {
      return Promise.reject(error);
    }
    original._retry = true;

    try {
      if (isRefreshing) {
        await new Promise<void>((resolve) => enqueue(resolve));
      } else {
        isRefreshing = true;
        const newToken = await userService.refreshAccessToken(); // uses raw axios inside
        isRefreshing = false;
        release();
        if (!newToken) return Promise.reject(error);
      }

      // retry with fresh token from storage
      const fresh = localStorage.getItem("token");
      original.headers = {
        ...(original.headers ?? {}),
        ...(fresh ? { Authorization: `Bearer ${fresh}` } : {}),
      };

      return apiClient(original);
    } catch (e) {
      isRefreshing = false;
      release();
      return Promise.reject(e);
    }
  }
);

export default apiClient;
