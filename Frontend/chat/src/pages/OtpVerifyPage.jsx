import { ForgotPasswordForm } from "../features/auth/ForgotPassword"
import { MessageCircleDashed } from "lucide-react";
import OTPVerification from "../features/auth/OtpVerify";

export default function OTPVerifications() {
  return (
    <div className="min-h-screen  bg-gradient-to-br from-slate-950 via-gray-950 to-slate-950  w-full flex pt-32 justify-center p-2 bg-transparent">
      
      {/* Glass effect container */}
      <div className="relative mb-24 z-10 w-full max-w-md">
        <div className="  mb-3 flex flex-col justify-center items-center  md:bottom-0">
                <h1 className="text-4xl   md:text-3xl flex items-center justify-center gap-2 font-bold text-blue-400 drop-shadow-lg ">
                  <MessageCircleDashed size={42} /> 
                </h1>
              </div>
        
          <OTPVerification />
        
      </div>
    </div>
  )
}
