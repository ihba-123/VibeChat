import { create } from "zustand";
import { registerUser } from "../api/auth";
import Cookies from "js-cookie";


export const useAuthStore = create((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,

  
  register: async (userData) => {
    set({ isLoading: true, error: null });

    try {
      const response = await registerUser(userData);
      const user = response.user || null;
      const access = response.access || null;

      if (access) {
        Cookies.set("access_token", access, {
          expires: 1 / 24,
          secure: process.env.NODE_ENV === "production",
          sameSite: "Lax",
        });
      }

      set({
        user: user,
        isAuthenticated: !!access,
        isLoading: false,
        error: null,
      });

      return { success: true };
    } catch (err) {
  let errorMsg = {};

  if (err.response?.data) {
    errorMsg = err.response.data;
  } else {
    errorMsg.general = [err.message || "Registration failed"];
  }

  set({
    isLoading: false,
    error: errorMsg,
  });

  return { success: false, error: errorMsg };
}

  },

  clearError: () => set({ error: null }),
}));
