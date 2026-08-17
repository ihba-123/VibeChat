"""Storage resolution for uploaded media.

The model fields are plain ``ImageField``/``FileField`` and take their storage from
these callables. That combination is deliberate:

* Using ``CloudinaryField`` hard-wires every upload to Cloudinary, so a project
  without a working Cloudinary account cannot store an avatar at all — the upload
  raises inside ``model.save()``.
* Passing the storage as a *callable* means Django records the reference in the
  migration rather than the resolved backend, so switching ``MEDIA_BACKEND`` never
  produces a spurious migration and the same migration works in every environment.

``settings.STORAGES`` decides which backend the aliases point at; see
``MEDIA_BACKEND`` in settings.
"""

from django.core.files.storage import storages


def image_storage():
    """Backend for images (avatars, photo messages)."""
    return storages["default"]


def raw_storage():
    """Backend for arbitrary files.

    Cloudinary needs non-images uploaded as *raw* resources or it tries to process
    them as media and rejects the upload; local storage treats everything alike, so
    the alias simply points at the same place there.
    """
    try:
        return storages["raw"]
    except Exception:
        return storages["default"]
