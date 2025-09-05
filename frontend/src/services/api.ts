// /* eslint-disable @typescript-eslint/no-explicit-any */
// import axios, { CanceledError } from "axios";
// import type { AxiosError, AxiosInstance, AxiosRequestConfig } from "axios";
// import userService from "./user_service";
// export { CanceledError };

// // Read base URL from Vite env
// const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:3000/api";

// const apiClient: AxiosInstance = axios.create({
//   baseURL: API_BASE,
//   timeout: 30000,
//   // withCredentials: false, // not using cookies
// });

// // in-memory mirror so we don't read localStorage on every request
// let accessToken: string | null = localStorage.getItem("token");
// window.addEventListener("storage", (e) => {
//   if (e.key === "token") accessToken = localStorage.getItem("token");
// });

// // Attach Authorization header
// apiClient.interceptors.request.use(
//   async (config) => {
//     if (accessToken) {
//       config.headers = config.headers ?? {};
//       (config.headers as any).Authorization = `Bearer ${accessToken}`;
//     }
//     return config;
//   },
//   (error) => Promise.reject(error)
// );

// // De-dupe refresh
// let isRefreshing = false;
// let waiters: Array<() => void> = [];
// const enqueue = (r: () => void) => waiters.push(r);
// const release = () => { waiters.forEach((r) => r()); waiters = []; };

// // 401 -> refresh -> retry once
// apiClient.interceptors.response.use(
//   (response) => response,
//   async (error: AxiosError) => {
//     const original = error.config as (AxiosRequestConfig & { _retry?: boolean }) | undefined;

//     if (error.response?.status !== 401 || !original || original._retry) {
//       return Promise.reject(error);
//     }
//     original._retry = true;

//     try {
//       if (isRefreshing) {
//         await new Promise<void>((resolve) => enqueue(resolve));
//       } else {
//         isRefreshing = true;

//         // Calls userService.refreshAccessToken() (raw axios inside)
//         const newToken = await userService.refreshAccessToken();
//         if (!newToken) {
//           isRefreshing = false;
//           release();
//           return Promise.reject(error);
//         }

//         accessToken = newToken; // update mirror
//         isRefreshing = false;
//         release();
//       }

//       // retry with fresh token
//       original.headers = {
//         ...(original.headers ?? {}),
//         ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
//       };

//       return apiClient(original);
//     } catch {
//       isRefreshing = false;
//       release();
//       return Promise.reject(error);
//     }
//   }
// );

// export default apiClient;

/* eslint-disable @typescript-eslint/no-explicit-any */
// src/services/api.ts
import axios, { CanceledError } from "axios";
import type { AxiosError, AxiosInstance, AxiosRequestConfig } from "axios";
import userService from "./user_service";
export { CanceledError };

const API_BASE =  "https://moveo-assignment.onrender.com/api";
const REFRESH_PATH = "/auth/refresh";
console.log("VITE_API_URL =   " + import.meta.env.VITE_API_BASE)
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
});
console.log("API_BASE is:", API_BASE);

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
