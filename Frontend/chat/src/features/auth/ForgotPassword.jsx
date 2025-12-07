import React, { useState } from "react"
import { Mail, ArrowLeft } from "lucide-react"
import { Link } from "react-router-dom"
import { Button } from "@mui/material"

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("")
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsLoading(true)

    // Simulated API call
    await new Promise((resolve) => setTimeout(resolve, 1000))

    setIsSubmitted(true)
    setIsLoading(false)
  }

  if (isSubmitted) {
    return (
      <div className="text-center space-y-4">
        <div className="mx-auto w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center">
          <Mail className="w-6 h-6 text-green-400" />
        </div>

        <h1 className="text-2xl font-bold text-white">Check your email</h1>

        <p className="text-white/70">
          We&apos;ve sent a password reset link to{" "}
          <span className="font-semibold text-white">{email}</span>
        </p>

        <p className="text-sm text-white/50 pt-2">
          Didn&apos;t receive the email? Check spam or try another email address.
        </p>

        <Button
          onClick={() => {
            setIsSubmitted(false)
            setEmail("")
          }}
          variant="outlined"
          fullWidth
          sx={{
            mt: 2,
            borderColor: "rgba(255,255,255,0.3)",
            color: "white",
            "&:hover": { background: "rgba(255,255,255,0.1)" },
          }}
        >
          Try another email
        </Button>

        <Link to="/login" style={{ textDecoration: "none" }}>
          <Button
            variant="text"
            fullWidth
            sx={{
              color: "rgba(255,255,255,0.7)",
              "&:hover": { color: "white", background: "rgba(255,255,255,0.05)" },
              mt: 1,
            }}
          >
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to login
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4 text-center">
        <h1 className="text-3xl font-bold text-blue-400">Forgot Password?</h1>
        <p className="text-blue-200">No worries, we’ll send you reset instructions.</p>
      </div>

      <div className="space-y-3">
       

        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />

          <input
            id="email"
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/40 focus:border-transparent transition"
          />
        </div>
      </div>
<div className="flex justify-center items-center">
      <Button
        type="submit"
        disabled={isLoading}
        variant="contained"
        fullWidth
        sx={{
          py: 1.3,
          background: "blue.300",
          color: "grey.400",
          fontWeight: "bold",
          
        }}
      >
        {isLoading ? "Sending..." : "Send Reset Link"}
      </Button>
          </div>

      <div className="flex items-center text-center justify-center pt-2">
        <Link to="/login" style={{ width: "100%", textDecoration: "none" }}>
          <Button
            variant="text"
            className="text-center"
            sx={{
              color: "rgba(255,255,255,0.7)",
              "&:hover": { color: "white" },
            }}
          >
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to login
          </Button>
        </Link>
      </div>
    </form>
  )
}
