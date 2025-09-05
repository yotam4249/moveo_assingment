/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-useless-catch */
import apiClient from "./api";
import axios from "axios";

export interface User {
  username: string;
  email: string;
  password: string;
  _id?: string;
  refreshToken?: string;
  imgUrl?: string;
  accessToken?: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  _id: string;
  needsOnboarding: boolean;
  onboarding?: unknown | null;
}

export interface RegisterResponse {
  _id: string;
  username: string;
  email: string;
  needsOnboarding: boolean;
}

// Use Vite env for raw axios calls as well
const API_BASE = import.meta.env.VITE_API_BASE ?? "https://moveo-assignment.onrender.com/api";

// ---------- Reads ----------
export const getUserById = async (userId: string) => {
  try {
    const res = await apiClient.get(`/auth/users/${userId}`);
    return res.data;
  } catch (error) {
    console.error("Error fetching user data:", error);
    return null;
  }
};

export const getUserImgById = async (userId: string) => {
  try {
    const res = await apiClient.get(`/auth/users/${userId}`);
    return res.data?.imgUrl ?? null;
  } catch (error) {
    console.error("Error fetching user img:", error);
    return null;
  }
};

export const getUserNameById = async (userId: string) => {
  try {
    const res = await apiClient.get(`/auth/users/${userId}`);
    return res.data?.username ?? null;
  } catch (error) {
    console.error("Error fetching username:", error);
    return null;
  }
};

const getUserByUsername = async (username: string) => {
  try {
    const res = await apiClient.get("/auth/username", { params: { username } });
    return res.data as any[];
  } catch (error) {
    console.error("Error fetching user by username:", error);
    return null;
  }
};

// ---------- Auth ----------
const register = async (
  user: Pick<User, "username" | "email" | "password">
): Promise<RegisterResponse> => {
  try {
    const { data } = await apiClient.post<RegisterResponse>("/auth/register", user);
    return data;
  } catch (error: any) {
    if (axios.isAxiosError(error) && error.response) throw error.response.data;
    throw new Error(error?.message ?? "Unexpected error occurred");
  }
};

const logIn = async (
  user: Pick<User, "username" | "password">
): Promise<LoginResponse> => {
  try {
    const { data } = await apiClient.post<LoginResponse>("/auth/login", user);
    localStorage.setItem("token", data.accessToken);
    localStorage.setItem("refreshToken", data.refreshToken);
    localStorage.setItem("user", JSON.stringify(user));
    return data;
  } catch (error: any) {
    console.error("Login error:", error);
    throw new Error(error?.message ?? "Login failed");
  }
};

/** Uses raw axios to avoid interceptor recursion */
const refreshAccessToken = async (): Promise<string | null> => {
  try {
    const rt = localStorage.getItem("refreshToken");
    if (!rt) throw new Error("No refresh token found.");

    const { data } = await axios.post<{ accessToken: string; refreshToken: string }>(
      `${API_BASE}/auth/refresh`,
      { refreshToken: rt },
      { timeout: 20000 }
    );

    localStorage.setItem("token", data.accessToken);
    localStorage.setItem("refreshToken", data.refreshToken);
    return data.accessToken;
  } catch (error) {
    console.error("Failed to refresh token:", error);
    logout();
    return null;
  }
};

const logout = () => {
  const rt = localStorage.getItem("refreshToken");
  if (rt) {
    axios.post(`${API_BASE}/auth/logout`, { refreshToken: rt }).catch(() => {});
  }
  localStorage.removeItem("token");
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("user");
};

export default {
  // reads
  getUserById,
  getUserImgById,
  getUserNameById,
  getUserByUsername,

  // auth
  register,
  logIn,
  refreshAccessToken, // used by api.ts on 401
  logout,
};
