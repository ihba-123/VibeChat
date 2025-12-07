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
import { Link } from "react-router-dom";

// Toastify
import { toast } from "react-toastify";

export default function Signup() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast.error("Passwords do not match!", {
        position: "top-right",
      });
      return;
    }

    setLoading(true);

    try {
      await new Promise((r) => setTimeout(r, 1000));

      // 🔥 Success toast
      toast.success("Signup Successful!", {
        position: "top-right",
      });

      console.log({ name, email, password });
    } catch (err) {
      toast.error("Something went wrong!", {
        position: "top-right",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = () => {
    toast.info("Google Sign-in coming soon!", {
      position: "top-right",
    });
  };

  return (
    <Box className="flex items-center justify-center">
      <motion.div initial={{ opacity: 0, y: -50 }} animate={{ opacity: 1, y: 0 }}>
        <Card
          sx={{
            maxWidth: 420,
            borderRadius: 4,
            backdropFilter: "blur(5px)",
            background: "transparent",
            p: 3,
          }}
        >
          <CardContent>
            <form onSubmit={handleSubmit}>
              {/* Name */}
              <TextField
                fullWidth
                label="Name"
                type="text"
                variant="outlined"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                sx={{
                  mb: 3,
                  "& .MuiOutlinedInput-root": {
                    color: "white",
                    borderRadius: 1,
                    "& fieldset": { borderColor: "gray", borderWidth: 1 },
                    "&:hover fieldset": { borderColor: "#3b82f6" },
                    "&.Mui-focused fieldset": {
                      borderColor: "#06b6d4",
                      borderWidth: 2,
                    },
                  },
                  "& .MuiInputLabel-root": { color: "gray" },
                  "& .MuiInputLabel-root.Mui-focused": { color: "#06b6d4" },
                }}
              />

              {/* Email */}
              <TextField
                fullWidth
                label="Email"
                type="email"
                variant="outlined"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                sx={{
                  mb: 3,
                  "& .MuiOutlinedInput-root": {
                    color: "white",
                    borderRadius: 1,
                    "& fieldset": { borderColor: "gray", borderWidth: 1 },
                    "&:hover fieldset": { borderColor: "#3b82f6" },
                    "&.Mui-focused fieldset": {
                      borderColor: "#06b6d4",
                      borderWidth: 2,
                    },
                  },
                  "& .MuiInputLabel-root": { color: "gray" },
                  "& .MuiInputLabel-root.Mui-focused": { color: "#06b6d4" },
                }}
              />

              {/* Password */}
              <TextField
                fullWidth
                label="Password"
                type={showPassword ? "text" : "password"}
                variant="outlined"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                sx={{
                  mb: 3,
                  "& .MuiOutlinedInput-root": {
                    color: "white",
                    borderRadius: 1,
                    "& fieldset": { borderColor: "gray", borderWidth: 1 },
                    "&:hover fieldset": { borderColor: "#3b82f6" },
                    "&.Mui-focused fieldset": {
                      borderColor: "#06b6d4",
                      borderWidth: 2,
                    },
                  },
                  "& .MuiInputLabel-root": { color: "gray" },
                  "& .MuiInputLabel-root.Mui-focused": { color: "#06b6d4" },
                }}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={() => setShowPassword(!showPassword)}>
                        {showPassword ? (
                          <VisibilityOff sx={{ color: "gray" }} />
                        ) : (
                          <Visibility sx={{ color: "gray" }} />
                        )}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />

              {/* Confirm Password */}
              <TextField
                fullWidth
                label="Confirm Password"
                type={showConfirmPassword ? "text" : "password"}
                variant="outlined"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                sx={{
                  mb: 3,
                  "& .MuiOutlinedInput-root": {
                    color: "white",
                    borderRadius: 1,
                    "& fieldset": { borderColor: "gray", borderWidth: 1 },
                    "&:hover fieldset": { borderColor: "#3b82f6" },
                    "&.Mui-focused fieldset": {
                      borderColor: "#06b6d4",
                      borderWidth: 2,
                    },
                  },
                  "& .MuiInputLabel-root": { color: "gray" },
                  "& .MuiInputLabel-root.Mui-focused": { color: "#06b6d4" },
                }}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() =>
                          setShowConfirmPassword(!showConfirmPassword)
                        }
                      >
                        {showConfirmPassword ? (
                          <VisibilityOff sx={{ color: "gray" }} />
                        ) : (
                          <Visibility sx={{ color: "gray" }} />
                        )}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />

              {/* Submit Button */}
              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                <Button
                  type="submit"
                  fullWidth
                  disabled={loading}
                  variant="contained"
                  sx={{
                    py: 1.4,
                    fontWeight: "bold",
                    background: "linear-gradient(to right, #3b82f6, #06b6d4)",
                  }}
                >
                  {loading ? (
                    <CircularProgress size={24} color="inherit" />
                  ) : (
                    "Sign Up"
                  )}
                </Button>
              </motion.div>
            </form>

            {/* OR Divider */}
            <Divider
              sx={{
                my: 3,
                "&::before, &::after": { borderColor: "gray" },
              }}
              variant="middle"
            >
              <Typography sx={{ color: "gray", fontSize: 14 }}>OR</Typography>
            </Divider>

            {/* Google Button */}
            <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
              <Button
                fullWidth
                variant="outlined"
                onClick={handleGoogleSignIn}
                sx={{
                  py: 1.2,
                  borderColor: "rgba(255,255,255,0.2)",
                  color: "white",
                  "&:hover": {
                    borderColor: "white",
                    background: "rgba(255,255,255,0.05)",
                  },
                }}
              >
                <Box display="flex" gap={1} alignItems="center">
                  <img
                    src="https://www.svgrepo.com/show/475656/google-color.svg"
                    width={22}
                    height={22}
                    alt=""
                  />
                  Continue with Google
                </Box>
              </Button>
            </motion.div>

            <Typography sx={{ textAlign: "center", mt: 3, color: "gray" }}>
              Already have an account?{" "}
              <Link
                to={"/login"}
                style={{ color: "white", fontWeight: "bold", cursor: "pointer" }}
              >
                Sign in
              </Link>
            </Typography>
          </CardContent>
        </Card>
      </motion.div>
    </Box>
  );
}
