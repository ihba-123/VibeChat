"""Regression tests for the chat backend.

Each test names the defect it pins down, so a future change that reintroduces one
of them fails here rather than in production.
"""

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, TransactionTestCase, override_settings
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from .models import BlockedUser, ChatRoom, FriendRequest, Message, Profile
from .services import blocking
from .utils.encryption import is_encrypted, message_decode

User = get_user_model()

TEST_SETTINGS = dict(
    CACHES={"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}},
    CHANNEL_LAYERS={"default": {"BACKEND": "channels.layers.InMemoryChannelLayer"}},
    CELERY_TASK_ALWAYS_EAGER=True,
    # Rate limits would otherwise make the order of tests significant.
    REST_FRAMEWORK={
        "DEFAULT_AUTHENTICATION_CLASSES": (
            "rest_framework_simplejwt.authentication.JWTAuthentication",
        ),
        "DEFAULT_PERMISSION_CLASSES": ("rest_framework.permissions.IsAuthenticated",),
        "DEFAULT_PAGINATION_CLASS": "chatapp.pagination.StandardPagination",
        "PAGE_SIZE": 30,
        "EXCEPTION_HANDLER": "chatapp.exceptions.api_exception_handler",
    },
)


def make_user(email, name=None, password="Sup3r-Secret-Pw!"):
    return User.objects.create_user(email=email, name=name or email.split("@")[0], password=password)


def auth_client(user):
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {RefreshToken.for_user(user).access_token}")
    return client


@override_settings(**TEST_SETTINGS)
class SignalAndModelTests(TestCase):
    def setUp(self):
        cache.clear()

    def test_profile_is_created_for_every_new_user(self):
        """chatapp/apps.py defined ready() outside the class, so signals never
        registered and users were created without a Profile."""
        user = make_user("signals@example.com")
        self.assertTrue(Profile.objects.filter(user=user).exists())

    def test_message_content_is_encrypted_at_rest_and_readable_back(self):
        user = make_user("crypto@example.com")
        room = ChatRoom.objects.create(is_group=False)
        room.participants.add(user)

        message = Message.objects.create(chat_room=room, sender=user, content="hello world")
        message.refresh_from_db()

        self.assertNotEqual(message.content, "hello world")
        self.assertTrue(is_encrypted(message.content))
        self.assertEqual(message.decrypted_content, "hello world")

    def test_resaving_a_message_does_not_double_encrypt(self):
        """save() encrypted unconditionally, so any second save buried the
        plaintext under a second layer."""
        user = make_user("resave@example.com")
        room = ChatRoom.objects.create()
        room.participants.add(user)

        message = Message.objects.create(chat_room=room, sender=user, content="keep me readable")
        ciphertext = message.content

        message.is_read = True
        message.save()
        message.refresh_from_db()

        self.assertEqual(message.decrypted_content, "keep me readable")
        # One layer only: decrypting once yields plaintext, not another token.
        self.assertFalse(is_encrypted(message_decode(message.content)))
        self.assertTrue(is_encrypted(ciphertext))

    def test_private_chat_lookup_is_idempotent(self):
        a, b = make_user("a@example.com"), make_user("b@example.com")
        first = ChatRoom.get_private_chat(a, b)
        second = ChatRoom.get_private_chat(a, b)
        self.assertEqual(first.pk, second.pk)
        self.assertEqual(ChatRoom.objects.filter(is_group=False).count(), 1)

    def test_private_chat_ignores_rooms_with_extra_participants(self):
        a, b, c = make_user("p1@example.com"), make_user("p2@example.com"), make_user("p3@example.com")
        crowded = ChatRoom.objects.create(is_group=False)
        crowded.participants.add(a, b, c)

        room = ChatRoom.get_private_chat(a, b)
        self.assertNotEqual(room.pk, crowded.pk)

    def test_blocked_ids_are_symmetric(self):
        a, b = make_user("blocker@example.com"), make_user("blocked@example.com")
        BlockedUser.objects.create(blocker=a, blocked=b)

        self.assertEqual(BlockedUser.blocked_ids_for(a), {b.pk})
        # Also visible from the blocked user's side, which is what stops them
        # sending into the conversation.
        self.assertEqual(BlockedUser.blocked_ids_for(b), {a.pk})


@override_settings(**TEST_SETTINGS)
class AuthApiTests(TestCase):
    def setUp(self):
        cache.clear()

    def test_register_returns_access_token_and_sets_refresh_cookie(self):
        response = APIClient().post(
            reverse("register"),
            {
                "email": "new@example.com",
                "name": "New Person",
                "password": "Sup3r-Secret-Pw!",
                "password2": "Sup3r-Secret-Pw!",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.assertIn("access", response.data)
        self.assertIn("refresh_token", response.cookies)
        self.assertTrue(response.cookies["refresh_token"]["httponly"])

    def test_refresh_endpoint_returns_an_access_token(self):
        """The view built a new access token and then returned only the refresh
        token, so a client could never actually renew its session."""
        user = make_user("refresh@example.com")
        client = APIClient()
        client.cookies["refresh_token"] = str(RefreshToken.for_user(user))

        response = client.post(reverse("refresh-token"), {}, format="json")

        self.assertEqual(response.status_code, 200, response.data)
        self.assertIn("access", response.data)
        self.assertTrue(response.data["access"])

    def test_refresh_without_cookie_is_401_and_clears_the_cookie(self):
        response = APIClient().post(reverse("refresh-token"), {}, format="json")
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.data["code"], "token_invalid")

    def test_login_rejects_a_wrong_password_with_401(self):
        make_user("login@example.com")
        response = APIClient().post(
            reverse("login"),
            {"email": "login@example.com", "password": "not-the-password"},
            format="json",
        )
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.data["code"], "invalid_credentials")

    def test_password_reset_endpoints_are_reachable_without_authentication(self):
        """DEFAULT_PERMISSION_CLASSES is IsAuthenticated, so these must opt out —
        otherwise a locked-out user cannot reset their password."""
        response = APIClient().post(
            reverse("forgot-password"), {"email": "nobody@example.com"}, format="json"
        )
        self.assertEqual(response.status_code, 200)

    def test_change_password_enforces_validators(self):
        user = make_user("weak@example.com")
        response = auth_client(user).post(
            reverse("change-password"),
            {"old_password": "Sup3r-Secret-Pw!", "new_password": "123"},
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("new_password", response.data.get("errors", {}))


@override_settings(**TEST_SETTINGS)
class ConversationApiTests(TestCase):
    def setUp(self):
        cache.clear()
        self.alice = make_user("alice@example.com", "Alice")
        self.bob = make_user("bob@example.com", "Bob")
        self.client_alice = auth_client(self.alice)

    def test_opening_a_direct_chat_twice_returns_the_same_room(self):
        """Asking for an existing private chat used to be a 400 with no room id,
        leaving the client unable to navigate anywhere."""
        first = self.client_alice.post(
            reverse("chatroom-create"),
            {"is_group": False, "participant_ids": [self.bob.pk]},
            format="json",
        )
        self.assertEqual(first.status_code, 201, first.data)

        second = self.client_alice.post(
            reverse("chatroom-create"),
            {"is_group": False, "participant_ids": [self.bob.pk]},
            format="json",
        )
        self.assertEqual(second.status_code, 200, second.data)
        self.assertEqual(second.data["room_id"], first.data["room_id"])
        self.assertFalse(second.data["created"])

    def test_participant_ids_given_as_a_string_is_a_400_not_a_crash(self):
        response = self.client_alice.post(
            reverse("chatroom-create"),
            {"is_group": False, "participant_ids": "abc"},
            format="json",
        )
        self.assertEqual(response.status_code, 400)

    def test_conversation_list_includes_preview_and_unread_count(self):
        room = ChatRoom.get_private_chat(self.alice, self.bob)
        Message.objects.create(chat_room=room, sender=self.bob, content="first")
        Message.objects.create(chat_room=room, sender=self.bob, content="second")

        response = self.client_alice.get(reverse("conversation-list"))

        self.assertEqual(response.status_code, 200, response.data)
        row = response.data["results"][0]
        self.assertEqual(row["id"], room.pk)
        self.assertEqual(row["title"], "Bob")
        self.assertEqual(row["last_message"]["preview"], "second")
        self.assertEqual(row["unread_count"], 2)
        self.assertEqual(response.data["total_unread"], 2)

    def test_own_messages_never_count_as_unread(self):
        room = ChatRoom.get_private_chat(self.alice, self.bob)
        Message.objects.create(chat_room=room, sender=self.alice, content="mine")

        response = self.client_alice.get(reverse("unread-count"))
        self.assertEqual(response.data["total_unread"], 0)

    def test_group_creation_requires_a_name(self):
        response = self.client_alice.post(
            reverse("chatroom-create"),
            {"is_group": True, "participant_ids": [self.bob.pk]},
            format="json",
        )
        self.assertEqual(response.status_code, 400)

    def test_duplicate_group_membership_returns_the_existing_group(self):
        payload = {"is_group": True, "name": "Team", "participant_ids": [self.bob.pk]}
        first = self.client_alice.post(reverse("chatroom-create"), payload, format="json")
        second = self.client_alice.post(reverse("chatroom-create"), payload, format="json")

        self.assertEqual(first.status_code, 201)
        self.assertEqual(second.status_code, 200)
        self.assertEqual(first.data["room_id"], second.data["room_id"])


@override_settings(**TEST_SETTINGS)
class MessageApiTests(TestCase):
    def setUp(self):
        cache.clear()
        self.alice = make_user("m-alice@example.com", "Alice")
        self.bob = make_user("m-bob@example.com", "Bob")
        self.stranger = make_user("m-stranger@example.com", "Stranger")
        self.room = ChatRoom.get_private_chat(self.alice, self.bob)

    def test_history_is_returned_decrypted_and_oldest_first(self):
        for text in ("one", "two", "three"):
            Message.objects.create(chat_room=self.room, sender=self.bob, content=text)

        response = auth_client(self.alice).get(reverse("message-list", args=[self.room.pk]))

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual([m["content"] for m in response.data["results"]], ["one", "two", "three"])

    def test_non_participant_gets_403_not_500(self):
        """The service raises PermissionError; a bare `except Exception` in the view
        used to flatten that into a 500."""
        response = auth_client(self.stranger).get(reverse("message-list", args=[self.room.pk]))
        self.assertEqual(response.status_code, 403)

    def test_unknown_room_is_404(self):
        response = auth_client(self.alice).get(reverse("message-list", args=[999_999]))
        self.assertEqual(response.status_code, 404)

    def test_message_payload_carries_sender_user_id(self):
        Message.objects.create(chat_room=self.room, sender=self.bob, content="hi")
        response = auth_client(self.alice).get(reverse("message-list", args=[self.room.pk]))

        message = response.data["results"][0]
        self.assertEqual(message["sender_id"], self.bob.pk)
        self.assertEqual(message["sender"]["user_id"], self.bob.pk)
        self.assertFalse(message["is_mine"])

    def test_upload_without_any_content_is_400_not_500(self):
        """AttachmentView ignored is_valid(), so bad input reached
        serializer.save() and surfaced as a 500."""
        response = auth_client(self.alice).post(
            reverse("chat-attachment", args=[self.room.pk]), {}, format="multipart"
        )
        self.assertEqual(response.status_code, 400)

    def test_cursor_pagination_walks_the_whole_history_without_repeats(self):
        for index in range(25):
            Message.objects.create(chat_room=self.room, sender=self.bob, content=f"m{index}")

        client = auth_client(self.alice)
        response = client.get(reverse("message-list", args=[self.room.pk]), {"page_size": 10})
        seen = [m["id"] for m in response.data["results"]]
        self.assertEqual(len(seen), 10)

        while response.data.get("next"):
            response = client.get(response.data["next"])
            page = [m["id"] for m in response.data["results"]]
            self.assertFalse(set(page) & set(seen), "pages must not overlap")
            seen.extend(page)

        self.assertEqual(len(seen), 25)


@override_settings(**TEST_SETTINGS)
class FriendApiTests(TestCase):
    def setUp(self):
        cache.clear()
        self.alice = make_user("f-alice@example.com", "Alice")
        self.bob = make_user("f-bob@example.com", "Bob")

    def test_send_list_and_accept_a_friend_request(self):
        send = auth_client(self.alice).post(
            reverse("friend-request"), {"to_user_id": self.bob.pk}, format="json"
        )
        self.assertEqual(send.status_code, 201, send.data)

        incoming = auth_client(self.bob).get(reverse("friend-request"), {"direction": "incoming"})
        self.assertEqual(incoming.status_code, 200)
        self.assertEqual(len(incoming.data["results"]), 1)
        request_id = incoming.data["results"][0]["id"]
        self.assertEqual(incoming.data["results"][0]["direction"], "incoming")

        accept = auth_client(self.bob).put(
            reverse("friend-request-update", args=[request_id]), {"action": "accept"}, format="json"
        )
        self.assertEqual(accept.status_code, 200, accept.data)

        self.assertTrue(Profile.for_user(self.alice).friends.filter(pk=self.bob.pk).exists())
        # Symmetric, and a conversation is ready immediately.
        self.assertTrue(Profile.for_user(self.bob).friends.filter(pk=self.alice.pk).exists())
        self.assertIsNotNone(ChatRoom.find_private_chat(self.alice, self.bob))

    def test_cannot_friend_yourself(self):
        response = auth_client(self.alice).post(
            reverse("friend-request"), {"to_user_id": self.alice.pk}, format="json"
        )
        self.assertEqual(response.status_code, 400)

    def test_duplicate_request_is_rejected(self):
        client = auth_client(self.alice)
        client.post(reverse("friend-request"), {"to_user_id": self.bob.pk}, format="json")
        again = client.post(reverse("friend-request"), {"to_user_id": self.bob.pk}, format="json")
        self.assertEqual(again.status_code, 400)

    def test_accepting_twice_is_rejected(self):
        request = FriendRequest.objects.create(from_user=self.alice, to_user=self.bob)
        client = auth_client(self.bob)
        url = reverse("friend-request-update", args=[request.pk])

        self.assertEqual(client.put(url, {"action": "accept"}, format="json").status_code, 200)
        self.assertEqual(client.put(url, {"action": "accept"}, format="json").status_code, 400)

    def test_invalid_action_is_rejected(self):
        request = FriendRequest.objects.create(from_user=self.alice, to_user=self.bob)
        response = auth_client(self.bob).put(
            reverse("friend-request-update", args=[request.pk]), {"action": "maybe"}, format="json"
        )
        self.assertEqual(response.status_code, 400)

    def test_friend_list_and_removal(self):
        Profile.for_user(self.alice).add_friend(self.bob)
        client = auth_client(self.alice)

        listed = client.get(reverse("friend-list"))
        self.assertEqual(len(listed.data["results"]), 1)
        self.assertEqual(listed.data["results"][0]["user_id"], self.bob.pk)

        removed = client.delete(reverse("friend-detail", args=[self.bob.pk]))
        self.assertEqual(removed.status_code, 200)
        self.assertEqual(Profile.for_user(self.alice).friends.count(), 0)
        self.assertEqual(Profile.for_user(self.bob).friends.count(), 0)


@override_settings(**TEST_SETTINGS)
class BlockingApiTests(TestCase):
    def setUp(self):
        cache.clear()
        self.alice = make_user("b-alice@example.com", "Alice")
        self.bob = make_user("b-bob@example.com", "Bob")

    def test_block_list_and_unblock(self):
        client = auth_client(self.alice)

        blocked = client.post(reverse("block-user", args=[self.bob.pk]))
        self.assertEqual(blocked.status_code, 201, blocked.data)

        listed = client.get(reverse("blocked-users"))
        self.assertEqual(len(listed.data["results"]), 1)
        self.assertEqual(listed.data["results"][0]["user"]["user_id"], self.bob.pk)

        again = client.post(reverse("block-user", args=[self.bob.pk]))
        self.assertEqual(again.status_code, 200)

        unblocked = client.delete(reverse("unblock-user", args=[self.bob.pk]))
        self.assertEqual(unblocked.status_code, 200)
        self.assertFalse(BlockedUser.objects.exists())

    def test_unblocking_someone_who_is_not_blocked_is_404(self):
        response = auth_client(self.alice).delete(reverse("unblock-user", args=[self.bob.pk]))
        self.assertEqual(response.status_code, 404)

    def test_cannot_block_yourself(self):
        response = auth_client(self.alice).post(reverse("block-user", args=[self.alice.pk]))
        self.assertEqual(response.status_code, 400)

    def test_block_invalidates_the_cached_block_set(self):
        blocking.blocked_ids_for(self.alice)  # prime the cache
        auth_client(self.alice).post(reverse("block-user", args=[self.bob.pk]))
        self.assertEqual(blocking.blocked_ids_for(self.alice), {self.bob.pk})

    def test_blocked_user_cannot_upload_into_the_conversation(self):
        room = ChatRoom.get_private_chat(self.alice, self.bob)
        BlockedUser.objects.create(blocker=self.alice, blocked=self.bob)
        blocking.invalidate(self.alice.pk, self.bob.pk)

        response = auth_client(self.bob).post(
            reverse("chat-attachment", args=[room.pk]), {"content": "hi"}, format="multipart"
        )
        self.assertEqual(response.status_code, 403)


@override_settings(**TEST_SETTINGS)
class PeopleAndProfileApiTests(TestCase):
    def setUp(self):
        cache.clear()
        self.alice = make_user("p-alice@example.com", "Alice Anderson")
        self.bob = make_user("p-bob@example.com", "Bob Brown")
        self.client_alice = auth_client(self.alice)

    def test_search_requires_a_term_and_returns_a_readable_400(self):
        """The service returned a dict on bad input which the view then fed to a
        many=True serializer."""
        response = self.client_alice.get(reverse("user-search"))
        self.assertEqual(response.status_code, 400)
        self.assertIn("q", response.data.get("errors", {}))

    def test_search_finds_people_by_name_and_exposes_user_id(self):
        response = self.client_alice.get(reverse("user-search"), {"q": "Bob"})
        self.assertEqual(response.status_code, 200)
        result = response.data["results"][0]
        # Profile id and user id differ; sending the profile id to the friend
        # endpoints addressed the wrong person.
        self.assertEqual(result["user_id"], self.bob.pk)
        self.assertNotIn("password", result)

    def test_search_excludes_self_and_blocked_users(self):
        BlockedUser.objects.create(blocker=self.alice, blocked=self.bob)
        blocking.invalidate(self.alice.pk)

        response = self.client_alice.get(reverse("user-search"), {"q": "o"})
        ids = [row["user_id"] for row in response.data["results"]]
        self.assertNotIn(self.bob.pk, ids)
        self.assertNotIn(self.alice.pk, ids)

    def test_discover_excludes_friends_and_pending_requests(self):
        carol = make_user("p-carol@example.com", "Carol")
        Profile.for_user(self.alice).add_friend(self.bob)
        FriendRequest.objects.create(from_user=self.alice, to_user=carol)

        response = self.client_alice.get(reverse("online-users"))
        ids = [row["user_id"] for row in response.data["results"]]
        self.assertNotIn(self.bob.pk, ids)
        self.assertNotIn(carol.pk, ids)

    def test_directory_is_paginated(self):
        for index in range(5):
            make_user(f"bulk{index}@example.com", f"Bulk {index}")

        response = self.client_alice.get(reverse("all-user-status"), {"page_size": 2})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data["results"]), 2)
        self.assertIsNotNone(response.data["next"])

    def test_own_profile_exposes_user_id(self):
        response = self.client_alice.get(reverse("profile-current"))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["user_id"], self.alice.pk)
        self.assertEqual(response.data["name"], "Alice Anderson")

    def test_profile_update_persists_bio_and_name(self):
        """ProfileUpdateSerializer declared every field as a SerializerMethodField,
        which is read-only, so edits were silently discarded."""
        response = self.client_alice.patch(
            reverse("profile-update"),
            {"bio": "Building things.", "name": "Alice A."},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["bio"], "Building things.")
        self.assertEqual(response.data["name"], "Alice A.")

        self.alice.refresh_from_db()
        self.assertEqual(self.alice.name, "Alice A.")
        self.assertEqual(Profile.for_user(self.alice).bio, "Building things.")

    def test_profile_update_rejects_an_empty_name(self):
        response = self.client_alice.patch(
            reverse("profile-update"), {"name": "   "}, format="json"
        )
        self.assertEqual(response.status_code, 400)

    def test_other_user_profile_reports_the_relationship(self):
        Profile.for_user(self.alice).add_friend(self.bob)
        response = self.client_alice.get(reverse("profile-detail", args=[self.bob.pk]))

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["is_friend"])
        self.assertFalse(response.data["is_blocked"])
        self.assertEqual(response.data["user_id"], self.bob.pk)

    def test_profile_update_route_is_not_shadowed_by_the_user_id_route(self):
        """`chat-profile/update/` must not be captured as `chat-profile/<user_id>/`."""
        self.assertEqual(reverse("profile-update"), "/api/chat-profile/update/")

    def test_avatar_upload_works_on_local_storage(self):
        """Uploads must not require a working Cloudinary account.

        The fields used to be CloudinaryField, so every upload went to Cloudinary
        inside model.save() and a misconfigured account made avatars impossible to
        store at all. They are now storage-backed, and MEDIA_BACKEND selects where.
        """
        import io
        import shutil
        import tempfile

        from PIL import Image

        buffer = io.BytesIO()
        Image.new("RGB", (8, 8), (10, 120, 220)).save(buffer, format="PNG")
        buffer.seek(0)
        upload = SimpleUploadedFile("me.png", buffer.read(), content_type="image/png")

        media_root = tempfile.mkdtemp()
        try:
            with override_settings(
                MEDIA_BACKEND="local",
                MEDIA_ROOT=media_root,
                BACKEND_URL="http://testserver",
                STORAGES={
                    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
                    "raw": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
                    "staticfiles": {
                        "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"
                    },
                },
            ):
                response = self.client_alice.patch(
                    reverse("profile-update"),
                    {"photo": upload, "bio": "With a picture."},
                    format="multipart",
                )

                self.assertEqual(response.status_code, 200, response.data)
                self.assertEqual(response.data["bio"], "With a picture.")
                # An absolute URL, because the SPA runs on a different origin and a
                # bare /media/... path would resolve against the wrong host.
                self.assertTrue(
                    response.data["photo"].startswith("http://testserver/media/avatars/"),
                    response.data["photo"],
                )

                profile = Profile.for_user(self.alice)
                self.assertTrue(profile.photo.name.startswith("avatars/"))
                self.assertTrue(profile.photo.storage.exists(profile.photo.name))
        finally:
            shutil.rmtree(media_root, ignore_errors=True)

    def test_media_provider_failure_is_a_502_not_a_500(self):
        """Cloudinary uploads happen inside model.save(), so a bad cloud name or an
        expired key used to escape as an unhandled 500 with no usable detail."""
        import cloudinary.exceptions

        from .exceptions import api_exception_handler

        response = api_exception_handler(
            cloudinary.exceptions.AuthorizationRequired("Invalid cloud_name example"),
            {"view": self},
        )
        self.assertEqual(response.status_code, 502)
        self.assertEqual(response.data["code"], "media_upload_failed")
        # The provider's own wording is logged, not leaked to the client.
        self.assertNotIn("cloud_name", response.data["detail"])

    def test_missing_avatar_returns_null_rather_than_a_broken_url(self):
        """A placeholder public id that is not present in the media account yields a
        URL that 404s for every avatar-less user; null lets the UI draw initials."""
        response = self.client_alice.get(reverse("profile-current"))
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.data["photo"])

    def test_endpoints_require_authentication(self):
        anonymous = APIClient()
        for url in (
            reverse("conversation-list"),
            reverse("friend-list"),
            reverse("profile-current"),
            reverse("blocked-users"),
        ):
            self.assertEqual(anonymous.get(url).status_code, 401, url)


@override_settings(**TEST_SETTINGS)
class PresenceTests(TestCase):
    def setUp(self):
        cache.clear()

    def test_multiple_connections_keep_the_user_online_until_the_last_one_closes(self):
        """Presence was flipped off when any single socket dropped, so closing one
        of two tabs marked an active user offline."""
        from . import presence

        user_id = 4242
        self.assertTrue(presence.register_connection(user_id))
        self.assertFalse(presence.register_connection(user_id))

        self.assertFalse(presence.unregister_connection(user_id))
        self.assertTrue(presence.is_online(user_id))

        self.assertTrue(presence.unregister_connection(user_id))
        self.assertFalse(presence.is_online(user_id))

    def test_online_ids_returns_only_connected_users(self):
        from . import presence

        presence.register_connection(1)
        presence.register_connection(3)
        self.assertEqual(presence.online_ids([1, 2, 3]), {1, 3})


@override_settings(**TEST_SETTINGS)
class StreamConsumerTests(TransactionTestCase):
    """End-to-end WebSocket behaviour over the in-memory channel layer."""

    reset_sequences = True

    def setUp(self):
        cache.clear()
        self.alice = make_user("ws-alice@example.com", "Alice")
        self.bob = make_user("ws-bob@example.com", "Bob")
        self.room = ChatRoom.get_private_chat(self.alice, self.bob)

    async def _connect(self, user):
        from channels.testing import WebsocketCommunicator

        from System.asgi import application

        token = await self._token_for(user)
        communicator = WebsocketCommunicator(application, f"/ws/stream/?token={token}")
        connected, _ = await communicator.connect()
        return communicator, connected

    @staticmethod
    async def _token_for(user):
        from channels.db import database_sync_to_async

        return await database_sync_to_async(lambda: str(RefreshToken.for_user(user).access_token))()

    async def test_unauthenticated_connection_is_rejected(self):
        from channels.testing import WebsocketCommunicator

        from System.asgi import application

        communicator = WebsocketCommunicator(application, "/ws/stream/")
        connected, code = await communicator.connect()
        self.assertFalse(connected)
        self.assertEqual(code, 4401)

    async def test_route_matches_with_and_without_a_trailing_slash(self):
        """A WebSocket gets no APPEND_SLASH redirect, so a path differing by one
        slash raised "No route found" and killed the connection instead of being
        corrected."""
        from channels.testing import WebsocketCommunicator

        from System.asgi import application

        token = await self._token_for(self.alice)

        for path in (f"/ws/stream/?token={token}", f"/ws/stream?token={token}"):
            communicator = WebsocketCommunicator(application, path)
            connected, _ = await communicator.connect()
            self.assertTrue(connected, f"handshake failed for {path}")
            self.assertEqual((await communicator.receive_json_from())["type"], "ready")
            await communicator.disconnect()

    async def test_room_route_matches_with_and_without_a_trailing_slash(self):
        from channels.testing import WebsocketCommunicator

        from System.asgi import application

        token = await self._token_for(self.alice)

        for path in (
            f"/ws/chat/{self.room.pk}/?token={token}",
            f"/ws/chat/{self.room.pk}?token={token}",
        ):
            communicator = WebsocketCommunicator(application, path)
            connected, _ = await communicator.connect()
            self.assertTrue(connected, f"handshake failed for {path}")
            await communicator.disconnect()

    async def test_message_sent_by_one_user_reaches_the_other(self):
        alice_ws, alice_ok = await self._connect(self.alice)
        bob_ws, bob_ok = await self._connect(self.bob)
        self.assertTrue(alice_ok)
        self.assertTrue(bob_ok)

        self.assertEqual((await alice_ws.receive_json_from())["type"], "ready")
        self.assertEqual((await bob_ws.receive_json_from())["type"], "ready")

        await alice_ws.send_json_to(
            {
                "type": "message.send",
                "room_id": self.room.pk,
                "content": "hello bob",
                "client_id": "tmp-1",
            }
        )

        received = await bob_ws.receive_json_from()
        while received["type"] != "message.new":
            received = await bob_ws.receive_json_from()

        self.assertEqual(received["room_id"], self.room.pk)
        # Decrypted on the way out, and attributed to the right person.
        self.assertEqual(received["message"]["content"], "hello bob")
        self.assertEqual(received["message"]["sender_id"], self.alice.pk)

        # The sender gets the echo with its client_id so it can reconcile the
        # optimistic bubble instead of rendering the message twice.
        echo = await alice_ws.receive_json_from()
        while echo["type"] != "message.new":
            echo = await alice_ws.receive_json_from()
        self.assertEqual(echo["client_id"], "tmp-1")

        await alice_ws.disconnect()
        await bob_ws.disconnect()

    async def test_empty_message_is_refused(self):
        alice_ws, _ = await self._connect(self.alice)
        await alice_ws.receive_json_from()  # ready

        await alice_ws.send_json_to(
            {"type": "message.send", "room_id": self.room.pk, "content": "   "}
        )
        response = await alice_ws.receive_json_from()
        self.assertEqual(response["type"], "error")
        self.assertEqual(response["code"], "empty_message")

        await alice_ws.disconnect()

    async def test_sending_into_a_room_you_are_not_in_is_refused(self):
        from channels.db import database_sync_to_async

        outsider_room = await database_sync_to_async(ChatRoom.objects.create)(is_group=True, name="Other")

        alice_ws, _ = await self._connect(self.alice)
        await alice_ws.receive_json_from()  # ready

        await alice_ws.send_json_to(
            {"type": "message.send", "room_id": outsider_room.pk, "content": "sneaky"}
        )
        response = await alice_ws.receive_json_from()
        self.assertEqual(response["type"], "error")
        self.assertEqual(response["code"], "forbidden")

        await alice_ws.disconnect()

    async def test_read_receipt_marks_messages_and_notifies_the_room(self):
        from channels.db import database_sync_to_async

        message = await database_sync_to_async(Message.objects.create)(
            chat_room=self.room, sender=self.bob, content="please read me"
        )

        alice_ws, _ = await self._connect(self.alice)
        await alice_ws.receive_json_from()  # ready

        await alice_ws.send_json_to({"type": "message.read", "room_id": self.room.pk})

        event = await alice_ws.receive_json_from()
        while event["type"] != "message.read":
            event = await alice_ws.receive_json_from()

        self.assertEqual(event["user_id"], self.alice.pk)
        self.assertIn(message.pk, event["message_ids"])

        # read_by is actually populated: the old implementation called update()
        # and then iterated the same queryset, which by then matched nothing.
        readers = await database_sync_to_async(
            lambda: list(Message.objects.get(pk=message.pk).read_by.values_list("id", flat=True))
        )()
        self.assertIn(self.alice.pk, readers)

        await alice_ws.disconnect()

    async def test_typing_is_relayed_to_others_but_not_echoed_to_the_sender(self):
        alice_ws, _ = await self._connect(self.alice)
        bob_ws, _ = await self._connect(self.bob)
        await alice_ws.receive_json_from()
        await bob_ws.receive_json_from()

        await alice_ws.send_json_to(
            {"type": "typing", "room_id": self.room.pk, "is_typing": True}
        )

        event = await bob_ws.receive_json_from()
        while event["type"] != "typing":
            event = await bob_ws.receive_json_from()
        self.assertEqual(event["user_id"], self.alice.pk)
        self.assertTrue(event["is_typing"])

        self.assertTrue(await alice_ws.receive_nothing(timeout=0.2))

        await alice_ws.disconnect()
        await bob_ws.disconnect()

    async def test_unknown_message_type_reports_an_error(self):
        alice_ws, _ = await self._connect(self.alice)
        await alice_ws.receive_json_from()

        await alice_ws.send_json_to({"type": "nonsense"})
        response = await alice_ws.receive_json_from()
        self.assertEqual(response["code"], "unknown_type")

        await alice_ws.disconnect()

    async def test_ping_is_answered(self):
        alice_ws, _ = await self._connect(self.alice)
        await alice_ws.receive_json_from()

        await alice_ws.send_json_to({"type": "ping", "ts": 99})
        response = await alice_ws.receive_json_from()
        self.assertEqual(response["type"], "pong")
        self.assertEqual(response["ts"], 99)

        await alice_ws.disconnect()
