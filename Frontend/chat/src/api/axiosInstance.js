import axios from "axios";
import Cookies from "js-cookie";
import dayjs from "dayjs";
import * as jwtDecode from "jwt-decode";


const api = axios.create({
  baseURL: "http://127.0.0.1:8000/api/",
  withCredentials: true, // Crucial for sending HttpOnly refresh token cookie
});

// Global variable to prevent multiple simultaneous refresh calls
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.request.use(async (config) => {
  let token = Cookies.get("access_token");

  if (token) {
    const decoded = jwtDecode(token);
    const isExpired = dayjs.unix(decoded.exp).diff(dayjs(), "minute") < 1; // expire soon

    // If token is expired or about to expire, refresh it
    if (isExpired) {
      if (isRefreshing) {
        // Wait for the ongoing refresh
        try {
          const newToken = await new Promise((resolve, reject) => {
            failedQueue.push({ resolve, reject });
          });
          config.headers["Authorization"] = `Bearer ${newToken}`;
          return config;
        } catch (err) {
          return Promise.reject(err);
        }
      }

      isRefreshing = true;

      try {
        const res = await axios.post(
          "http://127.0.0.1:8000/api/refresh-token/",
          {},
          { withCredentials: true } 
        );

        if (res.data.access) {
          const newAccessToken = res.data.access;
          Cookies.set("access_token", newAccessToken, {
            expires: 1 / 24, // 1 hour
            secure: process.env.NODE_ENV === "production",
            sameSite: "Lax",
          });

          config.headers["Authorization"] = `Bearer ${newAccessToken}`;
          processQueue(null, newAccessToken);
        }
      } catch (err) {
        processQueue(err, null);
        Cookies.remove("access_token");
        window.location.href = "/login";
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    } else {
      config.headers["Authorization"] = `Bearer ${token}`;
    }
  }

  return config;
});

// Optional: Handle 401 globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      Cookies.remove("access_token");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export default api;