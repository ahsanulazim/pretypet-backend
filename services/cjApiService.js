import axios from "axios";
import dotenv from "dotenv";
import {
  getCachedTokens,
  getCjAccessToken,
  refreshAccessToken,
} from "./cjAuthService.js";

dotenv.config();

const cjApi = axios.create({
  baseURL: process.env.CJ_API_BASE,
  headers: {
    "Content-Type": "application/json",
  },
});

cjApi.interceptors.request.use(async (config) => {
  // Prevent infinite loop by skipping auth endpoints
  if (config.url.includes("/authentication/")) {
    return config;
  }

  let { accessToken } = getCachedTokens();

  if (!accessToken) {
    const tokens = await getCjAccessToken();
    accessToken = tokens.accessToken;
  }

  config.headers["CJ-Access-Token"] = accessToken;
  return config;
});

cjApi.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry && !originalRequest.url.includes("/authentication/")) {
      originalRequest._retry = true;
      try {
        const tokens = await refreshAccessToken();
        originalRequest.headers["CJ-Access-Token"] = tokens.accessToken;
        return cjApi.request(originalRequest);
      } catch (refreshError) {
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  },
);

export default cjApi;
