from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from ..services.otp_password_services import check_rate_limit, generate_and_send_otp, verify_otp, reset_password    

class ForgotPasswordView(APIView):
    def post(self, request):
        email = request.data.get("email", "").strip().lower()
        if not email:
            return Response({"detail": "Email is required"}, status=status.HTTP_400_BAD_REQUEST)

        if check_rate_limit(email, "forgot"):
            return Response({"detail": "Too many requests. Try again later."}, status=429)

        # Generate OTP & send async
        generate_and_send_otp(email)

        return Response({"detail": "If the email exists, an OTP has been sent."}, status=200)


class VerifyOTPView(APIView):
    def post(self, request):
        email = request.data.get("email", "").strip().lower()
        otp = request.data.get("otp", "").strip()

        if not email or not otp or len(otp) != 6 or not otp.isdigit():
            return Response({"detail": "Valid email and 6-digit OTP required"}, status=400)

        if not verify_otp(email, otp):
            return Response({"detail": "Invalid or expired OTP"}, status=400)

        return Response({"detail": "OTP verified successfully"}, status=200)


class ResetPasswordView(APIView):
    def post(self, request):
        email = request.data.get("email", "").strip().lower()
        otp = request.data.get("otp", "").strip()
        new_password = request.data.get("password", "")

        if not all([email, otp, new_password]):
            return Response({"detail": "All fields are required"}, status=400)
        if len(new_password) < 8:
            return Response({"detail": "Password must be at least 8 characters"}, status=400)

        if not reset_password(email, otp, new_password):
            return Response({"detail": "Invalid or expired OTP"}, status=400)

        return Response({"detail": "Password reset successful"}, status=200)


class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        old_password = request.data.get("old_password")
        new_password = request.data.get("new_password")

        if not request.user.check_password(old_password):
            return Response({"detail": "Old password is incorrect"}, status=400)
        if len(new_password) < 8:
            return Response({"detail": "New password too short"}, status=400)

        request.user.set_password(new_password)
        request.user.save()
        return Response({"detail": "Password changed successfully"}, status=200)
