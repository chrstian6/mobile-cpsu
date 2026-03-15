// lib/api.ts
import axios from "axios";
import * as SecureStore from "expo-secure-store";

// ── Change this to your machine's local IP when testing on a device ──
export const BASE_URL = "http://192.168.254.101:3000/api"; // <-- update this

export const JWT_ACCESS_TOKEN_KEY = "pdao_access_token";
export const JWT_REFRESH_TOKEN_KEY = "pdao_refresh_token";

// Create axios instance
const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10_000,
  headers: { "Content-Type": "application/json" },
});

// Track if we're refreshing to prevent multiple refresh requests
let isRefreshing = false;
let failedQueue: any[] = [];

const processQueue = (error: any, token: string | null = null) => {
  console.log("Processing queue:", { error: !!error, hasToken: !!token });
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Request interceptor to add token
api.interceptors.request.use(
  async (config) => {
    try {
      const token = await SecureStore.getItemAsync(JWT_ACCESS_TOKEN_KEY);
      if (token) {
        console.log("Adding token to request:", config.url);
        config.headers.Authorization = `Bearer ${token}`;
      } else {
        console.log("No token for request:", config.url);
      }
    } catch (error) {
      console.error("Error getting token:", error);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

// Response interceptor to handle token refresh
api.interceptors.response.use(
  (response) => {
    console.log("Response success:", response.config.url, response.status);
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    console.log("Response error:", {
      url: originalRequest?.url,
      status: error.response?.status,
      message: error.message,
    });

    // If error is not 401 or request already retried, reject
    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    // If already refreshing, queue this request
    if (isRefreshing) {
      console.log("Already refreshing, queueing request");
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      })
        .then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        })
        .catch((err) => Promise.reject(err));
    }

    originalRequest._retry = true;
    isRefreshing = true;
    console.log("Starting token refresh");

    try {
      const refreshToken = await SecureStore.getItemAsync(
        JWT_REFRESH_TOKEN_KEY,
      );
      if (!refreshToken) {
        console.log("No refresh token available");
        throw new Error("No refresh token");
      }

      console.log("Attempting to refresh token");
      const { data } = await axios.post(`${BASE_URL}/auth/refresh`, {
        refresh_token: refreshToken,
      });

      if (data.access_token) {
        console.log("Token refreshed successfully");
        await SecureStore.setItemAsync(JWT_ACCESS_TOKEN_KEY, data.access_token);
        if (data.refresh_token) {
          await SecureStore.setItemAsync(
            JWT_REFRESH_TOKEN_KEY,
            data.refresh_token,
          );
        }

        api.defaults.headers.common.Authorization = `Bearer ${data.access_token}`;
        originalRequest.headers.Authorization = `Bearer ${data.access_token}`;

        processQueue(null, data.access_token);
        return api(originalRequest);
      }
    } catch (refreshError) {
      console.error("Token refresh failed:", refreshError);
      processQueue(refreshError, null);

      // Clear tokens on refresh failure
      console.log("Clearing tokens due to refresh failure");
      await SecureStore.deleteItemAsync(JWT_ACCESS_TOKEN_KEY);
      await SecureStore.deleteItemAsync(JWT_REFRESH_TOKEN_KEY);
      delete api.defaults.headers.common.Authorization;

      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }

    return Promise.reject(error);
  },
);

export default api;
