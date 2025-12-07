import api from "./axiosInstance"

export const registerUser = async (userData) => {

    try {
        const res =  await api.post('register/', userData)
        return {
            status:"success",
            data: res.data
        }
    } catch (error) {
        const errorMessage =
      error.response?.data || 
      error.response?.data?.detail ||
      error.response?.data?.email?.[0] ||
      error.response?.data?.password?.[0] ||
      "Registration failed. Please try again.";

    console.error("Registration error:", error.response || error);

    return {
      success: false,
      error: errorMessage,
    };
        
    }
}