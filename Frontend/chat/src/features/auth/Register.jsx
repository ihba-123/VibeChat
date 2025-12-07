import React, { useState } from "react";
import {
  Box,
  Button,
  TextField,
  IconButton,
  Typography,
  InputAdornment,
  CircularProgress,
  Divider,
  Card,
  CardContent,
} from "@mui/material";
import { Visibility, VisibilityOff } from "@mui/icons-material";
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "../../store/useAuthStore";
import { toast } from "react-toastify";
import { Navigate } from "react-router-dom";
// Reusable TextField component
const InputField = ({ label, type, value, onChange, show, toggleShow }) => (
  <TextField
    fullWidth
    label={label}
    type={show ? "text" : type}
    value={value}
    onChange={onChange}
    required
    sx={{
      mb: 3,
      "& .MuiOutlinedInput-root": {
        color: "white",
        borderRadius: 1,
        "& fieldset": { borderColor: "gray" },
        "&:hover fieldset": { borderColor: "#3b82f6" },
        "&.Mui-focused fieldset": { borderColor: "#06b6d4", borderWidth: 2 },
      },
      "& .MuiInputLabel-root": { color: "gray" },
      "& .MuiInputLabel-root.Mui-focused": { color: "#06b6d4" },
    }}
    InputProps={
      toggleShow
        ? {
            endAdornment: (
              <InputAdornment position="end">
                <IconButton onClick={toggleShow}>
                  {show ? <VisibilityOff sx={{ color: "gray" }} /> : <Visibility sx={{ color: "gray" }} />}
                </IconButton>
              </InputAdornment>
            ),
          }
        : {}
    }
  />
);

export default function Signup() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const { register, clearError, isLoading } = useAuthStore();
  const navigation = useNavigate();

  const passwordRegex = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[@$!%*?&]).{8,}$/;

  const handleSubmit = async (e) => {
  e.preventDefault();
  clearError(); // Clear previous error

  if (password !== confirmPassword) {
    toast.error("Passwords do not match!");
    return;
  }
  
  if(password.length < 6 && confirmPassword.length <6){ 
    toast.error("Password must be at least 6 characters!");
    return;
  }
  
  if (!passwordRegex.test(password)) {
    toast.error(
      "Password must be at least 8 characters, include uppercase, lowercase, number, and special symbol"
    );
    return;
  }

  const userData = {
    name,
    email,
    password,
    password2: confirmPassword,
  };

  try {
    const result = await register(userData);
    console.log("Registration result:", result);
    if (result.success) {
      setTimeout(() => {
        navigation("/login");
        clearError();
      }, 1000);
      toast.success("Signup Successful!");
    } else {
      
      if (typeof result.error === "object") {
        for (const [field, messages] of Object.entries(result.error)) {
          messages.forEach((msg) => toast.error(`${field}: ${msg}`));
        }
      } else {
        toast.error(result.error || "Registration failed!");
      }
    }
  } catch (err) {
    toast.error("Something went wrong! Please try again.");
    console.error(err);
  }
};


  return (
    <Box className="flex items-center justify-center">
      <motion.div initial={{ opacity: 0, y: -50 }} animate={{ opacity: 1, y: 0 }}>
        <Card sx={{ maxWidth: 420, borderRadius: 4, backdropFilter: "blur(5px)", background: "transparent", p: 3 }}>
          <CardContent>
            <form onSubmit={handleSubmit}>
              <InputField label="Name" type="text" value={name} onChange={(e) => setName(e.target.value)} />
              <InputField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              <InputField
                label="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                show={showPassword}
                toggleShow={() => setShowPassword((prev) => !prev)}
              />
              <InputField
                label="Confirm Password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                show={showConfirmPassword}
                toggleShow={() => setShowConfirmPassword((prev) => !prev)}
              />

              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                <Button
                  type="submit"
                  fullWidth
                  disabled={isLoading}
                  variant="contained"
                  sx={{ py: 1.4, fontWeight: "bold", background: "linear-gradient(to right, #3b82f6, #06b6d4)" }}
                >
                  {isLoading ? <CircularProgress size={24} color="inherit" /> : "Sign Up"}
                </Button>
              </motion.div>
            </form>

            <Divider sx={{ my: 3, "&::before, &::after": { borderColor: "gray" } }} variant="middle">
              <Typography sx={{ color: "gray", fontSize: 14 }}>OR</Typography>
            </Divider>

            <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
              <Button
                fullWidth
                variant="outlined"
                onClick={() => toast.info("Google Sign-In coming soon!")}
                sx={{
                  py: 1.2,
                  borderColor: "rgba(255,255,255,0.2)",
                  color: "white",
                  "&:hover": { borderColor: "white", background: "rgba(255,255,255,0.05)" },
                }}
              >
                <Box display="flex" gap={1} alignItems="center">
                  <img src="https://www.svgrepo.com/show/475656/google-color.svg" width={22} height={22} alt="" />
                  Continue with Google
                </Box>
              </Button>
            </motion.div>

            <Typography sx={{ textAlign: "center", mt: 3, color: "gray" }}>
              Already have an account?{" "}
              <Link to="/login" style={{ color: "white", fontWeight: "bold" }}>
                Sign in
              </Link>
            </Typography>
          </CardContent>
        </Card>
      </motion.div>
    </Box>
  );
}
