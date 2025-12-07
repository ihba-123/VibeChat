import React from "react";
import Signup from "../features/auth/Register.jsx";
import { MessageCircleDashed } from "lucide-react";
const RegisterPage = () => {
  return (
    <div className="min-h-screen flex flex-col  pt-10 md:pt-10 justify-start items-center bg-gradient-to-br from-slate-950 via-gray-950 to-slate-950 px-4 ">
      {/* Login Form */}
      <div className="  mb-5 flex flex-col justify-center items-center   md:bottom-0">
        <h1 className="text-4xl   md:text-3xl flex items-left justify-left gap-2 font-bold text-blue-400 drop-shadow-lg ">
          <MessageCircleDashed size={42} />
        </h1>
      </div>

      <div className="flex flex-wrap justify-center items-center md:w-[500px] pt-4 rounded-4xl bg-gradient-to-br from-slate-900 via-gray-950 to-slate-900">
        <div className="flex flex-wrap justify-center items-center  w-full max-w-md">
          <p className="mt-6 font-bold  text-gray-600 text-center text-lg md:text-xl font-sans tracking-wide leading-relaxed relative">
            <span className="font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400 text-2xl px-2 md:text-3xl relative">
              Sign up
              <span className="absolute left-0 -bottom-1 w-24 md:w-24 h-1 bg-gradient-to-r from-blue-400 to-cyan-400 rounded-full animate-slideIn"></span>
            </span>
            to your account
          </p>
          <Signup />
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
