import dotenv from "dotenv";
import cjApi from "./cjApiService.js";
dotenv.config();

let tokenCache = {
  accessToken: null,
  refreshToken: null,
  expiry: null,
  refreshExpiry: null,
};

export const getCjAccessToken = async () => {
  const response = await cjApi.post("/authentication/getAccessToken", {
    apiKey: process.env.CJ_API_TOKEN,
  });

  if (response.data.code !== 200) {
    throw new Error(response.data.message);
  }

  const {
    accessToken,
    refreshToken,
    accessTokenExpiryDate,
    refreshTokenExpiryDate,
  } = response.data.data;

  tokenCache = {
    accessToken,
    refreshToken,
    expiry: accessTokenExpiryDate,
    refreshExpiry: refreshTokenExpiryDate,
  };

  return tokenCache;
};

// 🔄 Refresh Access Token
export const refreshAccessToken = async () => {
  if (!tokenCache.refreshToken) throw new Error("No refresh token available");
  const response = await cjApi.post("/authentication/refreshAccessToken", {
    refreshToken: tokenCache.refreshToken,
  });

  if (response.data.code !== 200) {
    throw new Error(response.data.message);
  }

  const {
    accessToken,
    refreshToken,
    accessTokenExpiryDate,
    refreshTokenExpiryDate,
  } = response.data.data;

  tokenCache = {
    accessToken,
    refreshToken,
    expiry: accessTokenExpiryDate,
    refreshExpiry: refreshTokenExpiryDate,
  };

  return tokenCache;
};

// 🚪 Logout Token
export const logoutToken = async () => {
  if (!tokenCache.accessToken) return;

  await cjApi.post(
    "/authentication/logout",
    {},
    {
      headers: { "CJ-Access-Token": tokenCache.accessToken },
    },
  );

  tokenCache = {
    accessToken: null,
    refreshToken: null,
    expiry: null,
    refreshExpiry: null,
  };

  return true;
};

// 📦 Utility to get current cached tokens
export const getCachedTokens = () => tokenCache;
