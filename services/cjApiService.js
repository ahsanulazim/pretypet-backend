import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const cjApi = axios.create({
  baseURL: process.env.CJ_API_BASE,
  headers: {
    "Content-Type": "application/json",
  },
});

cjApi.interceptors.request.use(async (config) => {
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
    if (error.response?.status === 401) {
      const tokens = await refreshAccessToken();
      error.config.headers["CJ-Access-Token"] = tokens.accessToken;
      return cjApi.request(error.config);
    }
    return Promise.reject(error);
  },
);

export default cjApi;
