import { Router, Routes, Route, Navigate } from "react-router-dom";
import AppLanding from "./routes/AppLanding";
import LoginPages from "./pages/LoginPages";
import ErrorPage from "./pages/ErrorPage.jsx";
import RegisterPage from "./pages/RegisterPage.jsx";
import { ToastContainer } from "react-toastify";
import ForgotPasswordPage from "./pages/ForgotPasswordPage.jsx";
import OTPVerifications from "./pages/OtpVerifyPage.jsx";
import PasswordChangePage from "./pages/PasswordChangePage.jsx";

const App = () => {
  return (
    <>
      <ToastContainer />
      <Routes>
        {/* landing page route * */}
        <Route path="/" element={<AppLanding />} />

        {/* login and register routes */}
        <Route path="/login" element={<LoginPages />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/otp-verify" element={<OTPVerifications />} />
        <Route path="/change-password" element={<PasswordChangePage />} />

        {/* Error page route */}
        <Route path="*" element={<ErrorPage />} />
      </Routes>
    </>
  );
};

export default App;
