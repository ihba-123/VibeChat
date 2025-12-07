import React, { useState } from "react";
import { Button, TextField, IconButton, InputAdornment } from "@mui/material";
import { Eye, EyeOff, MessageCircleDashed } from "lucide-react";
import { toast } from "react-toastify";

export default function ChangePasswordForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [formData, setFormData] = useState({
    newPassword: "",
    confirmPassword: "",
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // ---- VALIDATIONS ----
    if (!formData.newPassword || !formData.confirmPassword) {
      toast.error("Both fields are required ❗");
      return;
    }

    if (formData.newPassword.length < 8) {
      toast.error("Password must be at least 8 characters ❗");
      return;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      toast.error("Passwords do not match ❗");
      return;
    }

    // ---- SIMULATED API ----
    setIsLoading(true);
    setTimeout(() => {
      toast.success("Password changed successfully ");
      setFormData({ newPassword: "", confirmPassword: "" });
      setIsLoading(false);
    }, 1500);
  };

  return (
    <div className="w-full max-w-md px-3 ">
      <div className="backdrop-blur-md bg-white/10 border border-white/20 rounded-2xl p-8 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-xl text-blue-300 flex items-center justify-center shadow-lg">
            <MessageCircleDashed size={37} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-blue-400">
              Change Password
            </h1>
            <p className="text-sm text-white/70">
              Update your password securely
            </p>
          </div>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="space-y-5  flex flex-col gap-3.5"
        >
          {/* New Password */}
          <TextField
            fullWidth
            id="newPassword"
            name="newPassword"
            label="New Password"
            type={showPassword ? "text" : "password"}
            value={formData.newPassword}
            onChange={handleInputChange}
            variant="outlined"
            InputProps={{
              style: { color: "white" },
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? (
                      <EyeOff size={20} color="white" />
                    ) : (
                      <Eye size={20} color="white" />
                    )}
                  </IconButton>
                </InputAdornment>
              ),
            }}
            InputLabelProps={{ style: { color: "white" } }}
            sx={{
              "& .MuiOutlinedInput-root": {
                "& fieldset": { borderColor: "white" },
                "&:hover fieldset": { borderColor: "white" },
              },
            }}
          />

          {/* Confirm Password */}
          <TextField
            fullWidth
            id="confirmPassword"
            name="confirmPassword"
            label="Confirm Password"
            type={showConfirmPassword ? "text" : "password"}
            value={formData.confirmPassword}
            onChange={handleInputChange}
            variant="outlined"
            InputProps={{
              style: { color: "white" },
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? (
                      <EyeOff size={20} color="white" />
                    ) : (
                      <Eye size={20} color="white" />
                    )}
                  </IconButton>
                </InputAdornment>
              ),
            }}
            InputLabelProps={{ style: { color: "white" } }}
            sx={{
              "& .MuiOutlinedInput-root": {
                "& fieldset": { borderColor: "white" },
                "&:hover fieldset": { borderColor: "#ddd" },
              },
            }}
          />

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={isLoading}
            fullWidth
            variant="contained"
            sx={{
              mt: 2,
              py: 1.5,
              fontWeight: "600",
              borderRadius: "10px",
            }}
          >
            {isLoading ? "Updating..." : "Update Password"}
          </Button>

          <p className="text-xs text-white/60 text-center mt-4">
            Password must be at least 8 characters long
          </p>
        </form>
      </div>

      <div className="mt-6 p-4 backdrop-blur-md bg-white/5 border border-white/10 rounded-xl text-white/70 text-sm text-center">
        💡 Your password will be securely encrypted and stored
      </div>
    </div>
  );
}
