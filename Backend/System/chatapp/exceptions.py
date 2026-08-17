"""Uniform error envelope for the API.

Every failure reaches the client as ``{"detail": "...", "code": "..."}`` (plus
``errors`` for field-level validation), so the frontend has exactly one shape to
parse instead of guessing between ``detail``, ``error`` and ``message``.
"""

import logging

import cloudinary.exceptions
from django.core.exceptions import PermissionDenied as DjangoPermissionDenied
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError
from django.http import Http404
from rest_framework import status
from rest_framework.exceptions import APIException, PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.views import exception_handler

logger = logging.getLogger(__name__)


class MediaUploadError(APIException):
    """The media provider rejected an upload.

    502 rather than 500: the request was fine, an upstream dependency failed. The
    detail names the media service so a misconfigured account (a wrong cloud name,
    expired keys) is obvious from the client instead of surfacing as an opaque
    "something went wrong".
    """

    status_code = status.HTTP_502_BAD_GATEWAY
    default_detail = (
        "The media service rejected the upload. Check the media credentials and try again."
    )
    default_code = "media_upload_failed"


def api_exception_handler(exc, context):
    # Map non-DRF exceptions raised by the service layer onto DRF equivalents so
    # they surface as 400/403 instead of an opaque 500.
    if isinstance(exc, PermissionError):
        exc = PermissionDenied(str(exc) or "Permission denied.")
    elif isinstance(exc, DjangoPermissionDenied):
        exc = PermissionDenied(str(exc) or "Permission denied.")
    elif isinstance(exc, DjangoValidationError):
        exc = ValidationError(getattr(exc, "message_dict", None) or list(exc.messages))
    elif isinstance(exc, cloudinary.exceptions.Error):
        # Storing an image goes through Cloudinary inside model.save(), so a bad
        # cloud name or key surfaces here as an unhandled crash. Log the provider's
        # own reason for the operator; the client gets a 502 it can explain.
        logger.error("Media provider rejected the upload: %s", exc)
        exc = MediaUploadError()
    elif isinstance(exc, ValueError):
        exc = ValidationError(str(exc))
    elif isinstance(exc, IntegrityError):
        exc = ValidationError("That record already exists.")

    response = exception_handler(exc, context)

    if response is None:
        # Genuinely unexpected: log with a traceback, tell the client nothing.
        logger.exception(
            "Unhandled error in %s", context.get("view").__class__.__name__ if context.get("view") else "?"
        )
        return Response(
            {"detail": "Something went wrong on our side.", "code": "server_error"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    code = getattr(exc, "default_code", "error")
    data = response.data

    if isinstance(exc, Http404):
        response.data = {"detail": "Not found.", "code": "not_found"}
    elif isinstance(data, dict) and "detail" in data:
        response.data = {"detail": str(data["detail"]), "code": code}
    elif isinstance(data, dict):
        # Field errors: keep them under `errors` and surface the first one as the
        # human-readable summary.
        first_field, first_errors = next(iter(data.items()))
        first = first_errors[0] if isinstance(first_errors, (list, tuple)) and first_errors else first_errors
        response.data = {
            "detail": f"{first}" if first_field == "non_field_errors" else f"{first_field}: {first}",
            "code": code,
            "errors": data,
        }
    elif isinstance(data, list):
        response.data = {"detail": str(data[0]) if data else "Invalid request.", "code": code}

    return response


class ConflictError(APIException):
    status_code = status.HTTP_409_CONFLICT
    default_detail = "Conflicting request."
    default_code = "conflict"
