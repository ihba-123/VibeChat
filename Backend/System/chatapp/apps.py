from django.apps import AppConfig


class ChatappConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'chatapp'

    def ready(self):
        # Importing the module registers the post_save / auth signal receivers.
        # This used to sit at module level, outside the class, so it never ran and
        # new users were created without a Profile.
        from . import signals  # noqa: F401

        # Registers the configuration checks (see chatapp/checks.py).
        from . import checks  # noqa: F401
