from datetime import timedelta
from pathlib import Path

import cloudinary
from decouple import Csv, config

# --------------------
# BASE DIRECTORY
# --------------------
BASE_DIR = Path(__file__).resolve().parent.parent

# --------------------
# SECURITY
# --------------------
SECRET_KEY = config('SECRET_KEY')
DEBUG = config('DEBUG', default=False, cast=bool)
ALLOWED_HOSTS = config('ALLOWED_HOSTS', default='localhost,127.0.0.1', cast=Csv())

# Public URL of the SPA. Used for OAuth redirects and CORS/CSRF trust, so it must
# never be hardcoded to localhost.
FRONTEND_URL = config('FRONTEND_URL', default='http://localhost:5173').rstrip('/')

CSRF_TRUSTED_ORIGINS = config(
    'CSRF_TRUSTED_ORIGINS', default=FRONTEND_URL, cast=Csv()
)

# Behind a reverse proxy / load balancer terminating TLS.
USE_X_FORWARDED_HOST = config('USE_X_FORWARDED_HOST', default=False, cast=bool)
if config('SECURE_PROXY_SSL_HEADER', default=False, cast=bool):
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

if not DEBUG:
    SECURE_CONTENT_TYPE_NOSNIFF = True
    SECURE_HSTS_SECONDS = config('SECURE_HSTS_SECONDS', default=31536000, cast=int)
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True

# --------------------
# Cloudinary configuration
# --------------------
cloudinary.config(
    cloud_name=config('CLOUDINARY_CLOUD_NAME'),
    api_key=config('CLOUDINARY_API_KEY'),
    api_secret=config('CLOUDINARY_API_SECRET'),
    secure=True
)

# Fallback images. Previously four different literals were scattered across the
# serializers, several of them typos pointing at assets that do not exist.
#
# Leave these blank (the default) and the API returns `photo: null` for anyone
# without an uploaded image, which the clients render as a coloured initials badge.
# Set them only to a public id that genuinely exists in the configured account —
# otherwise every avatar-less user produces a URL that 404s.
DEFAULT_AVATAR_URL = config('DEFAULT_AVATAR_URL', default='')
DEFAULT_AVATAR_PUBLIC_ID = config('DEFAULT_AVATAR_PUBLIC_ID', default='')
DEFAULT_GROUP_IMAGE_PUBLIC_ID = config('DEFAULT_GROUP_IMAGE_PUBLIC_ID', default='')

MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

# Absolute origin of this API, used to turn a relative media path into a URL the
# SPA on another port can actually load.
BACKEND_URL = config('BACKEND_URL', default='http://localhost:8000').rstrip('/')

# Where uploads go. 'auto' picks Cloudinary when all three credentials are present
# and falls back to local disk otherwise, so the project runs end to end without a
# Cloudinary account. Force either with MEDIA_BACKEND=cloudinary|local.
_cloudinary_configured = all(
    [config('CLOUDINARY_CLOUD_NAME', default=''),
     config('CLOUDINARY_API_KEY', default=''),
     config('CLOUDINARY_API_SECRET', default='')]
)
MEDIA_BACKEND = config('MEDIA_BACKEND', default='auto').lower()
if MEDIA_BACKEND == 'auto':
    MEDIA_BACKEND = 'cloudinary' if _cloudinary_configured else 'local'

# Django 5 storage API; DEFAULT_FILE_STORAGE has been removed. The "raw" alias
# exists because Cloudinary needs non-images uploaded as raw resources, while local
# storage treats every file the same.
if MEDIA_BACKEND == 'cloudinary':
    # django-cloudinary-storage reads its credentials from this dict, separately
    # from the cloudinary.config() call above, and raises on import without it.
    CLOUDINARY_STORAGE = {
        'CLOUD_NAME': config('CLOUDINARY_CLOUD_NAME', default=''),
        'API_KEY': config('CLOUDINARY_API_KEY', default=''),
        'API_SECRET': config('CLOUDINARY_API_SECRET', default=''),
    }
    STORAGES = {
        "default": {"BACKEND": "cloudinary_storage.storage.MediaCloudinaryStorage"},
        "raw": {"BACKEND": "cloudinary_storage.storage.RawMediaCloudinaryStorage"},
        "staticfiles": {"BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"},
    }
else:
    STORAGES = {
        "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
        "raw": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
        "staticfiles": {"BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"},
    }

# Upload ceiling enforced before a file reaches Cloudinary.
MAX_UPLOAD_SIZE_MB = config('MAX_UPLOAD_SIZE_MB', default=25, cast=int)
DATA_UPLOAD_MAX_MEMORY_SIZE = MAX_UPLOAD_SIZE_MB * 1024 * 1024
FILE_UPLOAD_MAX_MEMORY_SIZE = 5 * 1024 * 1024

# --------------------
# MESSAGE ENCRYPTION
# --------------------
# Comma separated, newest key first. Every key is tried on decrypt, the first one
# encrypts — so keys can be rotated without touching stored rows.
FERNET_KEYS = config('FERNET_KEYS', default=config('FERNET_KEY', default=''), cast=Csv())

# --------------------
# INSTALLED APPS
# --------------------
INSTALLED_APPS = [
    # Django core
    'django.contrib.admin',
    'daphne',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.sites',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    # Third-party
    'channels',
    'corsheaders',
    'rest_framework',
    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist',
    'cloudinary',
    'cloudinary_storage',
    'allauth',
    'allauth.account',
    'allauth.socialaccount',
    'allauth.socialaccount.providers.google',

    # Your apps
    'authentication',
    'chatapp',
]

# --------------------
# MIDDLEWARE
# --------------------
MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'allauth.account.middleware.AccountMiddleware',
]

# --------------------
# AUTHENTICATION
# --------------------
AUTH_USER_MODEL = 'authentication.User'

AUTHENTICATION_BACKENDS = [
    'django.contrib.auth.backends.ModelBackend',           # manual login
    'allauth.account.auth_backends.AuthenticationBackend', # social login
]

SITE_ID = config('SITE_ID', default=1, cast=int)

ACCOUNT_LOGIN_METHODS = {"email"}
ACCOUNT_SIGNUP_FIELDS = ["email*", "password1*", "password2*"]
ACCOUNT_USER_MODEL_USERNAME_FIELD = None

ACCOUNT_EMAIL_VERIFICATION = "optional"
SOCIALACCOUNT_EMAIL_VERIFICATION = "none"        # Google emails auto-verified

SOCIALACCOUNT_QUERY_EMAIL = True
SOCIALACCOUNT_AUTO_SIGNUP = True
SOCIALACCOUNT_LOGIN_ON_GET = True
SOCIALACCOUNT_EMAIL_AUTHENTICATION = True
SOCIALACCOUNT_EMAIL_AUTHENTICATION_AUTO_CONNECT = True

# Google config
SOCIALACCOUNT_PROVIDERS = {
    'google': {
        'SCOPE': ['profile', 'email'],
        'AUTH_PARAMS': {'access_type': 'online'},
        'APP': {
            'client_id': config('GOOGLE_CLIENT_ID', default=''),
            'secret': config('GOOGLE_CLIENT_SECRET', default=''),
            'key': ''
        }
    }
}

# After a social login allauth lands here; the SPA exchanges the session for JWTs.
LOGIN_REDIRECT_URL = f"{FRONTEND_URL}/auth/social/callback"
LOGOUT_REDIRECT_URL = f"{FRONTEND_URL}/login"

# --------------------
# ROOT URLS & TEMPLATES
# --------------------
ROOT_URLCONF = 'System.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

# --------------------
# REDIS / ASGI / CHANNELS
# --------------------
REDIS_URL = config('REDIS_URL', default='redis://127.0.0.1:6379')

ASGI_APPLICATION = 'System.asgi.application'

# Redis is the real deployment target for both of the following. The in-memory
# alternatives exist so a single developer can run the stack without Redis
# installed; they are per-process and must never be used with more than one worker.
CHANNEL_LAYER_BACKEND = config('CHANNEL_LAYER_BACKEND', default='redis').lower()

if CHANNEL_LAYER_BACKEND == 'inmemory':
    CHANNEL_LAYERS = {'default': {'BACKEND': 'channels.layers.InMemoryChannelLayer'}}
else:
    CHANNEL_LAYERS = {
        'default': {
            'BACKEND': 'channels_redis.core.RedisChannelLayer',
            'CONFIG': {
                "hosts": [f"{REDIS_URL}/{config('REDIS_CHANNELS_DB', default=1, cast=int)}"],
                # Per-channel buffer. The default of 100 starts dropping messages
                # for a busy room as soon as one client falls behind.
                "capacity": config('CHANNEL_CAPACITY', default=1500, cast=int),
                "expiry": config('CHANNEL_EXPIRY', default=30, cast=int),
                "group_expiry": config('CHANNEL_GROUP_EXPIRY', default=86400, cast=int),
            },
        },
    }

# --------------------
# CACHE
# --------------------
# A shared cache is what makes presence counters and OTP rate limits correct
# across workers: a per-process LocMemCache makes both wrong the moment a second
# worker starts. Reads in chatapp.cache_utils degrade gracefully if it is down.
CACHE_BACKEND = config('CACHE_BACKEND', default='redis').lower()

if CACHE_BACKEND == 'locmem':
    CACHES = {
        "default": {
            "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
            "LOCATION": "vibechat-dev",
        }
    }
else:
    CACHES = {
        "default": {
            "BACKEND": "django.core.cache.backends.redis.RedisCache",
            "LOCATION": f"{REDIS_URL}/{config('REDIS_CACHE_DB', default=2, cast=int)}",
            "KEY_PREFIX": config('CACHE_KEY_PREFIX', default='vibechat'),
            "TIMEOUT": 300,
        }
    }

SESSION_ENGINE = 'django.contrib.sessions.backends.cached_db'

# --------------------
# CORS
# --------------------
# Credentialed requests (the refresh-token cookie) cannot be used with a
# wildcard origin, so the allow-list has to be explicit.
CORS_ALLOWED_ORIGINS = config('CORS_ALLOWED_ORIGINS', default=FRONTEND_URL, cast=Csv())
CORS_ALLOW_CREDENTIALS = True

# --------------------
# DATABASE
# --------------------
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': config('DB_NAME'),
        'USER': config('DB_USER'),
        'PASSWORD': config('DB_PASSWORD'),
        'HOST': config('DB_HOST', default='127.0.0.1'),
        'PORT': config('DB_PORT', default='5432'),
        # Reuse connections instead of a TCP handshake + auth per request.
        'CONN_MAX_AGE': config('DB_CONN_MAX_AGE', default=60, cast=int),
        'CONN_HEALTH_CHECKS': True,
        'OPTIONS': {
            'connect_timeout': config('DB_CONNECT_TIMEOUT', default=10, cast=int),
        },
    }
}

# --------------------
# PASSWORD VALIDATORS
# --------------------
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

# --------------------
# INTERNATIONALIZATION
# --------------------
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

# --------------------
# STATIC FILES
# --------------------
STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# --------------------
# REST FRAMEWORK
# --------------------
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    # Endpoints opt out explicitly with AllowAny; the previous default of
    # AllowAny meant a forgotten permission_classes silently exposed a view.
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle',
    ],
    'DEFAULT_THROTTLE_RATES': {
        'anon': config('THROTTLE_ANON', default='100/hour'),
        'user': config('THROTTLE_USER', default='2000/hour'),
        'auth': config('THROTTLE_AUTH', default='20/hour'),
        'otp': config('THROTTLE_OTP', default='10/hour'),
        'search': config('THROTTLE_SEARCH', default='120/minute'),
        'upload': config('THROTTLE_UPLOAD', default='60/minute'),
    },
    'DEFAULT_PAGINATION_CLASS': 'chatapp.pagination.StandardPagination',
    'PAGE_SIZE': config('PAGE_SIZE', default=30, cast=int),
    'EXCEPTION_HANDLER': 'chatapp.exceptions.api_exception_handler',
}

# --------------------
# SIMPLE JWT
# --------------------
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=config('ACCESS_TOKEN_MINUTES', default=50, cast=int)),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=config('REFRESH_TOKEN_DAYS', default=7, cast=int)),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'UPDATE_LAST_LOGIN': False,
    'AUTH_HEADER_TYPES': ('Bearer',),
    'COOKIE_NAME': 'refresh_token',
    'COOKIE_SAMESITE': config('REFRESH_COOKIE_SAMESITE', default='Lax'),
    'COOKIE_PATH': '/',
    'COOKIE_DOMAIN': config('REFRESH_COOKIE_DOMAIN', default=None) or None,
    # Cross-site cookies must be Secure; browsers reject SameSite=None otherwise.
    'COOKIE_SECURE': config('REFRESH_COOKIE_SECURE', default=not DEBUG, cast=bool),
}

# --------------------
# CELERY
# --------------------
CELERY_BROKER_URL = config('CELERY_BROKER_URL', default=f'{REDIS_URL}/0')
CELERY_RESULT_BACKEND = config('CELERY_RESULT_BACKEND', default=f'{REDIS_URL}/0')
# Dev escape hatch: run tasks inline so OTP email works without a broker or worker.
CELERY_TASK_ALWAYS_EAGER = config('CELERY_TASK_ALWAYS_EAGER', default=False, cast=bool)
CELERY_TASK_EAGER_PROPAGATES = False

CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_TASK_ACKS_LATE = True
CELERY_TASK_REJECT_ON_WORKER_LOST = True
CELERY_WORKER_PREFETCH_MULTIPLIER = 1   # Important with acks_late
CELERY_BROKER_CONNECTION_RETRY_ON_STARTUP = True
CELERY_RESULT_EXPIRES = 3600
CELERY_TASK_DEFAULT_QUEUE = 'default'
# task_queues must be a sequence of kombu Queues; the previous dict form is not a
# valid Celery value and made the emails queue unroutable.
CELERY_TASK_CREATE_MISSING_QUEUES = True
CELERY_TASK_ROUTES = {
    'authentication.tasks.*': {'queue': 'emails'},
}

# --------------------
# EMAIL
# --------------------
EMAIL_BACKEND = config(
    'EMAIL_BACKEND', default='django.core.mail.backends.smtp.EmailBackend'
)
EMAIL_HOST = config('EMAIL_HOST', default='localhost')
EMAIL_PORT = config('EMAIL_PORT', default=587, cast=int)
EMAIL_HOST_USER = config('EMAIL_HOST_USER', default='')
EMAIL_HOST_PASSWORD = config('EMAIL_HOST_PASSWORD', default='')
EMAIL_USE_TLS = config('EMAIL_USE_TLS', default=True, cast=bool)
EMAIL_TIMEOUT = config('EMAIL_TIMEOUT', default=15, cast=int)
DEFAULT_FROM_EMAIL = config('DEFAULT_FROM_EMAIL', default='VibeChat <noreply@vibechat.app>')

# --------------------
# LOGGING
# --------------------
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'standard': {
            'format': '[{asctime}] {levelname} {name}: {message}',
            'style': '{',
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'standard',
        },
    },
    'root': {
        'handlers': ['console'],
        'level': config('LOG_LEVEL', default='INFO'),
    },
    'loggers': {
        'django.db.backends': {'level': 'WARNING', 'handlers': ['console'], 'propagate': False},
    },
}
