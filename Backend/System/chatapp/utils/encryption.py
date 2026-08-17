"""Symmetric encryption helpers for message content at rest.

Keys come from the ``FERNET_KEYS`` env var (comma separated, newest first) so keys
can be rotated without a data migration: the first key encrypts, every key is
tried when decrypting. ``FERNET_KEY`` is still honoured for backwards
compatibility.
"""

from functools import lru_cache

from cryptography.fernet import Fernet, InvalidToken, MultiFernet
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured

# Every Fernet token is a base64url-encoded blob whose first byte is the version
# marker 0x80, which always renders as this prefix. Checking it lets us skip a
# decrypt attempt for plaintext, which is the common case on write.
FERNET_PREFIX = "gAAAAA"


@lru_cache(maxsize=1)
def _fernet() -> MultiFernet:
    keys = [k.strip() for k in getattr(settings, "FERNET_KEYS", []) if k and k.strip()]
    if not keys:
        raise ImproperlyConfigured(
            "No message encryption key configured. Set FERNET_KEYS (comma separated, "
            "newest first) in the environment. Generate one with: "
            "python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\""
        )
    try:
        return MultiFernet([Fernet(key.encode()) for key in keys])
    except (ValueError, TypeError) as exc:
        raise ImproperlyConfigured(f"FERNET_KEYS contains an invalid key: {exc}") from exc


def message_encrypt(message: str) -> str:
    """Encrypt plaintext with the primary key."""
    return _fernet().encrypt(message.encode()).decode()


def message_decode(message: str) -> str:
    """Decrypt a token using any configured key. Raises InvalidToken on failure."""
    return _fernet().decrypt(message.encode()).decode()


def is_encrypted(value) -> bool:
    """True when ``value`` is a token this installation can decrypt.

    Used to keep ``Message.save()`` idempotent — re-saving a row (to flip a flag,
    for example) must not encrypt the ciphertext a second time.
    """
    if not isinstance(value, str) or not value.startswith(FERNET_PREFIX):
        return False
    try:
        _fernet().decrypt(value.encode())
    except (InvalidToken, ValueError, TypeError):
        return False
    return True
