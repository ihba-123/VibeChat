import React, { useState, useRef } from "react";
import Button from "@mui/material/Button"; 

export default function OTPVerification() {
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [isLoading, setIsLoading] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState("idle");
  const inputRefs = useRef([]);

  const handleChange = (index, value) => {
    if (value.length > 1) return;

    const newOtp = [...otp];
    newOtp[index] = value.replace(/[^0-9]/g, "");
    setOtp(newOtp);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").slice(0, 6);
    const newOtp = pastedData.split("").concat(Array(6).fill("")).slice(0, 6);
    setOtp(newOtp);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    const code = otp.join("");

    if (code.length === 6) {
      await new Promise((resolve) => setTimeout(resolve, 1500));

      const isCorrect = code === "123456";

      if (isCorrect) {
        setVerificationStatus("success");
        setTimeout(() => {
          setOtp(["", "", "", "", "", ""]);
          setVerificationStatus("idle");
        }, 2000);
      } else {
        setVerificationStatus("error");
        setTimeout(() => {
          setOtp(["", "", "", "", "", ""]);
          setVerificationStatus("idle");
        }, 1000);
      }
    }

    setIsLoading(false);
  };

  const isFilled = otp.every((digit) => digit !== "");

  return (
    <div className="w-full max-w-md">
      <div
        className={`relative rounded-2xl p-8 backdrop-blur-xl border shadow-2xl overflow-hidden transition-all duration-500 ${
          verificationStatus === "success"
            ? "border-green-500/50 bg-green-500/10"
            : verificationStatus === "error"
            ? "border-red-500/50 bg-red-500/10 animate-shake"
            : "border-white/10 bg-white/5"
        }`}
      >
        <div
          className={`absolute inset-0 opacity-40 ${
            verificationStatus === "success" ? "hidden" : ""
          }`}
          style={{
            background:
              verificationStatus === "error"
                ? "radial-gradient(circle at top right, rgba(239, 68, 68, 0.1), transparent)"
                : "radial-gradient(circle at top right, rgba(59, 130, 246, 0.1), transparent)",
          }}
        />

        <div className="relative z-10">
          <div className="text-center mb-8">
            <h1
              className={`text-3xl font-light tracking-tight mb-2 transition-colors duration-500 ${
                verificationStatus === "success"
                  ? "text-green-400"
                  : verificationStatus === "error"
                  ? "text-red-400"
                  : "text-white"
              }`}
            >
              {verificationStatus === "success"
                ? "Verified!"
                : verificationStatus === "error"
                ? "Incorrect"
                : "Verify Code"}
            </h1>

            <p
              className={`text-sm transition-colors duration-500 ${
                verificationStatus === "success"
                  ? "text-green-300/70"
                  : verificationStatus === "error"
                  ? "text-red-300/70"
                  : "text-slate-400"
              }`}
            >
              {verificationStatus === "success"
                ? "Your code has been verified"
                : verificationStatus === "error"
                ? "The code is incorrect. Please try again"
                : "Enter the 6-digit code sent to your email"}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            <div
              className={`flex gap-3 justify-center transition-all duration-300 ${
                verificationStatus === "error" ? "animate-clear-trash" : ""
              }`}
            >
              {otp.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => (inputRefs.current[index] = el)}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  onPaste={handlePaste}
                  disabled={verificationStatus !== "idle"}
                  className={`w-12 h-14 text-center text-2xl font-semibold rounded-lg text-white placeholder-slate-600 focus:outline-none transition-all duration-200 ${
                    verificationStatus === "success"
                      ? "bg-green-500/20 border border-green-500/30 focus:ring-2 focus:ring-green-500/50 focus:border-green-500/30"
                      : verificationStatus === "error"
                      ? "bg-red-500/20 border border-red-500/30 focus:ring-2 focus:ring-red-500/50 focus:border-red-500/30 animate-trash-fall"
                      : "bg-white/5 border border-white/10 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/30"
                  }`}
                />
              ))}
            </div>

            {/* MUI BUTTON BELOW */}
            <Button
              type="submit"
              fullWidth
              disabled={!isFilled || isLoading || verificationStatus !== "idle"}
              sx={{
                height: "44px",
                fontSize: "0.9rem",
                borderRadius: "8px",
                textTransform: "none",
                backdropFilter: "blur(6px)",
                color: "white",
                border: "1px solid rgba(255,255,255,0.2)",
                background:
                  verificationStatus === "success"
                    ? "rgba(34,197,94,0.3)"
                    : verificationStatus === "error"
                    ? "rgba(239,68,68,0.3)"
                    : "rgba(255,255,255,0.1)",
                "&:hover": {
                  background:
                    verificationStatus === "success"
                      ? "rgba(34,197,94,0.4)"
                      : verificationStatus === "error"
                      ? "rgba(239,68,68,0.4)"
                      : "rgba(255,255,255,0.18)",
                },
              }}
            >
              {isLoading
                ? "Verifying..."
                : verificationStatus === "success"
                ? "Code Verified"
                : verificationStatus === "error"
                ? "Try Again"
                : "Verify Code"}
            </Button>

            <div className="text-center pt-3">
              <p className="text-sm text-slate-400">
                Didn’t receive the code?{" "}
                <button
                  type="button"
                  className="text-blue-400 hover:text-blue-300 font-medium transition-colors duration-200"
                >
                  Resend
                </button>
              </p>
            </div>
          </form>
        </div>
      </div>

      <p className="text-center text-xs text-slate-500 mt-6">
        Your code will expire in 10 minutes
      </p>
    </div>
  );
}
