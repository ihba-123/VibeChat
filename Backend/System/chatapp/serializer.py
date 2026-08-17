import logging

from django.conf import settings
from rest_framework import serializers

from .models import BlockedUser, ChatRoom, FriendRequest, Message, Profile

logger = logging.getLogger(__name__)


def media_url(value):
    """Absolute URL for a stored file, or None.

    Never raises: a misconfigured or unreachable media backend must not turn every
    profile, message and conversation response into a 500 — the clients already fall
    back to an initials badge when a URL is null.

    Local storage returns a root-relative path like ``/media/avatars/x.png``, which
    is useless to a SPA served from a different origin, so relative URLs are made
    absolute against BACKEND_URL. Cloudinary already returns an absolute URL and is
    passed through untouched.
    """
    if not value:
        return None
    try:
        url = value.url
    except Exception:
        logger.warning("Could not build a URL for stored asset %r", value)
        return None
    if url.startswith(("http://", "https://", "//")):
        return url
    return f"{settings.BACKEND_URL}{url}"


def default_avatar_url():
    """Placeholder avatar URL, or None to let the client render initials.

    Only an explicitly configured absolute URL is returned. Building one from a
    Cloudinary public id is deliberately not the default: unless that exact asset
    has been uploaded to the configured account, every avatar-less user yields a URL
    that 404s — one broken image request per row in every list. The clients already
    draw a coloured initials badge when this is null, which is both faster and never
    broken.
    """
    return getattr(settings, "DEFAULT_AVATAR_URL", "") or None


def avatar_url(profile):
    """Uploaded avatar, falling back to the configured placeholder."""
    if profile is None:
        return default_avatar_url()
    return media_url(profile.photo) or default_avatar_url()


class UserSummarySerializer(serializers.ModelSerializer):
    """The shape every list in the UI renders a person with.

    ``user_id`` is the important field: this serializer is built on Profile, so
    ``id`` is the *profile* id. Callers that only had ``id`` were sending profile
    ids to endpoints expecting user ids (friend requests, blocking, opening a
    conversation), which silently addressed the wrong person.
    """

    user_id = serializers.IntegerField(source="user.id", read_only=True)
    name = serializers.CharField(source="user.name", read_only=True)
    email = serializers.EmailField(source="user.email", read_only=True)
    photo = serializers.SerializerMethodField()
    is_online = serializers.SerializerMethodField()

    class Meta:
        model = Profile
        fields = ["id", "user_id", "name", "email", "bio", "photo", "is_online"]
        read_only_fields = fields

    def get_photo(self, obj):
        return avatar_url(obj)

    def get_is_online(self, obj):
        # Live connection state wins over the persisted column, which is only a
        # fallback for when the process that owned the socket died.
        live = self.context.get("online_ids")
        if live is not None:
            return obj.user_id in live
        return obj.is_online


# Kept under the original (misspelled) name so existing imports keep working.
PersonlDetailsSerializer = UserSummarySerializer


class MeSerializer(UserSummarySerializer):
    """Current user's own profile, including counts the shell header shows."""

    friend_count = serializers.SerializerMethodField()

    class Meta(UserSummarySerializer.Meta):
        fields = UserSummarySerializer.Meta.fields + ["friend_count"]
        read_only_fields = fields

    def get_friend_count(self, obj):
        return obj.friends.count()


class ProfileSerializer(UserSummarySerializer):
    """A profile plus its friend list."""

    friends = serializers.SerializerMethodField()
    is_friend = serializers.SerializerMethodField()
    is_blocked = serializers.SerializerMethodField()

    class Meta(UserSummarySerializer.Meta):
        fields = UserSummarySerializer.Meta.fields + ["friends", "is_friend", "is_blocked"]
        read_only_fields = fields

    def get_friends(self, obj):
        # StringRelatedField used to emit bare email strings here, which gave the
        # client no id to act on.
        return [
            {"user_id": u.id, "name": u.name, "email": u.email}
            for u in obj.friends.all()
        ]

    def get_is_friend(self, obj):
        viewer = self.context.get("viewer")
        if viewer is None:
            return False
        friend_ids = self.context.get("viewer_friend_ids")
        if friend_ids is not None:
            return obj.user_id in friend_ids
        return obj.friends.filter(pk=viewer.pk).exists()

    def get_is_blocked(self, obj):
        blocked = self.context.get("blocked_ids")
        return obj.user_id in blocked if blocked is not None else False


class ProfileUpdateSerializer(serializers.ModelSerializer):
    """Writable profile fields.

    ``photo`` was declared as a SerializerMethodField, which is read-only — so the
    update endpoint accepted an upload and silently discarded it. It is now a real
    writable field with a separate read-only URL for the response.
    """

    photo = serializers.ImageField(write_only=True, required=False, allow_null=True)
    photo_url = serializers.SerializerMethodField()
    name = serializers.CharField(source="user.name", required=False)

    class Meta:
        model = Profile
        fields = ["id", "name", "bio", "photo", "photo_url"]
        read_only_fields = ["id", "photo_url"]

    def get_photo_url(self, obj):
        return avatar_url(obj)

    def validate_photo(self, value):
        if value is None:
            return value
        limit = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
        if value.size > limit:
            raise serializers.ValidationError(
                f"Image is larger than the {settings.MAX_UPLOAD_SIZE_MB}MB limit."
            )
        return value

    def validate_bio(self, value):
        if value and len(value) > 500:
            raise serializers.ValidationError("Bio cannot exceed 500 characters.")
        return value

    def update(self, instance, validated_data):
        user_data = validated_data.pop("user", None)
        if user_data and "name" in user_data:
            name = (user_data["name"] or "").strip()
            if not name:
                raise serializers.ValidationError({"name": "Name cannot be empty."})
            instance.user.name = name
            instance.user.save(update_fields=["name", "updated_at"])
        return super().update(instance, validated_data)


class ChatUserSerializer(serializers.ModelSerializer):
    """A message as the client renders it."""

    sender = serializers.SerializerMethodField()
    sender_id = serializers.IntegerField(source="sender.id", read_only=True)
    attachment = serializers.SerializerMethodField()
    attachment_name = serializers.SerializerMethodField()
    images = serializers.SerializerMethodField()
    content = serializers.SerializerMethodField()
    is_mine = serializers.SerializerMethodField()
    read_by_count = serializers.SerializerMethodField()

    class Meta:
        model = Message
        fields = [
            "id", "chat_room", "sender", "sender_id", "content", "attachment",
            "attachment_name", "images", "timestamp", "is_mine", "read_by_count",
        ]
        read_only_fields = fields

    def get_content(self, obj):
        return obj.decrypted_content

    def get_sender(self, obj):
        profile = getattr(obj.sender, "profile", None)
        if profile is None:
            return {
                "user_id": obj.sender_id,
                "name": obj.sender.name,
                "email": obj.sender.email,
                "photo": default_avatar_url(),
            }
        return {
            "user_id": obj.sender_id,
            "name": obj.sender.name,
            "email": obj.sender.email,
            "photo": avatar_url(profile),
        }

    def get_attachment(self, obj):
        return media_url(obj.attachment)

    def get_attachment_name(self, obj):
        if not obj.attachment:
            return None
        return str(obj.attachment).rsplit("/", 1)[-1]

    def get_images(self, obj):
        return media_url(obj.images)

    def get_is_mine(self, obj):
        viewer = self.context.get("viewer")
        return bool(viewer and obj.sender_id == viewer.pk)

    def get_read_by_count(self, obj):
        # Populated by the annotated queryset; falls back to a count only when the
        # serializer is handed a bare instance.
        annotated = getattr(obj, "read_by_total", None)
        if annotated is not None:
            return annotated
        return obj.read_by.count()


class MessageCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Message
        fields = ["content", "attachment", "images"]

    def validate(self, attrs):
        if not any(attrs.get(field) for field in ("content", "attachment", "images")):
            raise serializers.ValidationError(
                "A message needs text, an image, or an attachment."
            )
        content = attrs.get("content")
        if content and len(content) > 5000:
            raise serializers.ValidationError({"content": "Message is too long (5000 characters max)."})

        limit = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
        for field in ("attachment", "images"):
            upload = attrs.get(field)
            if upload is not None and getattr(upload, "size", 0) > limit:
                raise serializers.ValidationError(
                    {field: f"File is larger than the {settings.MAX_UPLOAD_SIZE_MB}MB limit."}
                )
        return attrs


class ConversationSerializer(serializers.ModelSerializer):
    """A row in the conversation sidebar: who, last message, unread count."""

    title = serializers.SerializerMethodField()
    photo = serializers.SerializerMethodField()
    participants = serializers.SerializerMethodField()
    other_user_id = serializers.SerializerMethodField()
    last_message = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()
    is_online = serializers.SerializerMethodField()
    last_activity = serializers.SerializerMethodField()

    class Meta:
        model = ChatRoom
        fields = [
            "id", "title", "is_group", "photo", "participants", "other_user_id",
            "last_message", "unread_count", "is_online", "last_activity", "created_at",
        ]
        read_only_fields = fields

    def _viewer(self):
        return self.context["viewer"]

    def _others(self, obj):
        viewer = self._viewer()
        return [p for p in obj.participants.all() if p.pk != viewer.pk]

    def get_title(self, obj):
        if obj.is_group:
            return obj.name or f"Group Chat ({obj.pk})"
        others = self._others(obj)
        return (others[0].name or others[0].email) if others else "Empty conversation"

    def get_photo(self, obj):
        if obj.is_group:
            # Null when no group image is set, so the client draws initials for the
            # group name rather than requesting a placeholder that may not exist.
            return media_url(obj.group_image)
        others = self._others(obj)
        return avatar_url(getattr(others[0], "profile", None)) if others else default_avatar_url()

    def get_participants(self, obj):
        online = self.context.get("online_ids") or set()
        return [
            {
                "user_id": p.pk,
                "name": p.name,
                "email": p.email,
                "photo": avatar_url(getattr(p, "profile", None)),
                "is_online": p.pk in online,
            }
            for p in obj.participants.all()
        ]

    def get_other_user_id(self, obj):
        if obj.is_group:
            return None
        others = self._others(obj)
        return others[0].pk if others else None

    def get_last_message(self, obj):
        message = getattr(obj, "last_message_obj", None)
        if message is None:
            return None
        viewer = self._viewer()
        if message.attachment:
            preview = "📎 Attachment"
        elif message.images:
            preview = "🖼️ Photo"
        else:
            preview = message.decrypted_content
        return {
            "id": message.id,
            "preview": preview,
            "timestamp": message.timestamp.isoformat(),
            "sender_id": message.sender_id,
            "sender_name": message.sender.name,
            "is_mine": message.sender_id == viewer.pk,
        }

    def get_unread_count(self, obj):
        return getattr(obj, "unread_total", 0)

    def get_is_online(self, obj):
        if obj.is_group:
            return None
        online = self.context.get("online_ids") or set()
        others = self._others(obj)
        return bool(others) and others[0].pk in online

    def get_last_activity(self, obj):
        message = getattr(obj, "last_message_obj", None)
        return (message.timestamp if message else obj.created_at).isoformat()


class FriendRequestSerializer(serializers.ModelSerializer):
    from_user = serializers.SerializerMethodField()
    to_user = serializers.SerializerMethodField()
    direction = serializers.SerializerMethodField()

    class Meta:
        model = FriendRequest
        fields = ["id", "from_user", "to_user", "status", "direction", "created_at"]
        read_only_fields = fields

    def _person(self, user):
        return {
            "user_id": user.pk,
            "name": user.name,
            "email": user.email,
            "photo": avatar_url(getattr(user, "profile", None)),
        }

    def get_from_user(self, obj):
        return self._person(obj.from_user)

    def get_to_user(self, obj):
        return self._person(obj.to_user)

    def get_direction(self, obj):
        viewer = self.context.get("viewer")
        if viewer is None:
            return None
        return "outgoing" if obj.from_user_id == viewer.pk else "incoming"


class BlockedUserSerializer(serializers.ModelSerializer):
    user = serializers.SerializerMethodField()

    class Meta:
        model = BlockedUser
        fields = ["id", "user", "blocked_at"]
        read_only_fields = fields

    def get_user(self, obj):
        return {
            "user_id": obj.blocked_id,
            "name": obj.blocked.name,
            "email": obj.blocked.email,
            "photo": avatar_url(getattr(obj.blocked, "profile", None)),
        }


class ChatRoomSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChatRoom
        fields = ["id", "name", "is_group", "participants", "admin", "group_image", "created_at"]

    def validate_participants(self, value):
        return list(dict.fromkeys(value))
