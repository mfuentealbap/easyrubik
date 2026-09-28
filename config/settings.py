"""
Configuración de easyRubik para desarrollo local y Railway.
"""

import os
from pathlib import Path

import dj_database_url
from django.core.exceptions import ImproperlyConfigured


# =========================================================
# DIRECTORIO DEL PROYECTO
# =========================================================

BASE_DIR = Path(__file__).resolve().parent.parent


# =========================================================
# ENTORNO Y SEGURIDAD
# =========================================================

EN_RAILWAY = bool(
    os.environ.get("RAILWAY_ENVIRONMENT_ID")
)

# En Railway se desactiva el modo de depuración.
DEBUG = not EN_RAILWAY

SECRET_KEY = os.environ.get(
    "DJANGO_SECRET_KEY", ""
).strip()

if not SECRET_KEY:
    if EN_RAILWAY:
        raise ImproperlyConfigured(
            "Falta configurar DJANGO_SECRET_KEY en Railway."
        )

    # Exclusivamente para desarrollo local.
    SECRET_KEY = (
        "django-insecure-solo-desarrollo-local-easyrubik"
    )


# =========================================================
# DOMINIOS PERMITIDOS
# =========================================================

ALLOWED_HOSTS = [
    host.strip()
    for host in os.environ.get(
        "DJANGO_ALLOWED_HOSTS", ""
    ).split(",")
    if host.strip()
]

dominio_railway = os.environ.get(
    "RAILWAY_PUBLIC_DOMAIN", ""
).strip()

if dominio_railway:
    ALLOWED_HOSTS.append(dominio_railway)

if not EN_RAILWAY:
    ALLOWED_HOSTS.extend([
        "localhost",
        "127.0.0.1",
        "[::1]",
    ])

ALLOWED_HOSTS = list(dict.fromkeys(ALLOWED_HOSTS))


# =========================================================
# CSRF Y COOKIES
# =========================================================

CSRF_TRUSTED_ORIGINS = [
    origen.strip()
    for origen in os.environ.get(
        "DJANGO_CSRF_TRUSTED_ORIGINS", ""
    ).split(",")
    if origen.strip()
]

if dominio_railway:
    CSRF_TRUSTED_ORIGINS.append(
        f"https://{dominio_railway}"
    )

CSRF_TRUSTED_ORIGINS = list(
    dict.fromkeys(CSRF_TRUSTED_ORIGINS)
)

SESSION_COOKIE_SECURE = EN_RAILWAY
CSRF_COOKIE_SECURE = EN_RAILWAY

SESSION_EXPIRE_AT_BROWSER_CLOSE = True


# =========================================================
# APLICACIONES
# =========================================================

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",

    "apps.core",
]


# =========================================================
# MIDDLEWARE
# =========================================================

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]


# =========================================================
# RUTAS Y WSGI
# =========================================================

ROOT_URLCONF = "config.urls"

WSGI_APPLICATION = "config.wsgi.application"


# =========================================================
# PLANTILLAS
# =========================================================

TEMPLATES = [
    {
        "BACKEND": (
            "django.template.backends.django.DjangoTemplates"
        ),
        "DIRS": [
            BASE_DIR / "templates",
        ],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]


# =========================================================
# BASE DE DATOS: LOCAL / RAILWAY
# =========================================================

DATABASE_URL = os.environ.get(
    "DATABASE_URL", ""
).strip()

if DATABASE_URL:
    DATABASES = {
        "default": dj_database_url.parse(
            DATABASE_URL,
            conn_max_age=60,
            conn_health_checks=True,
        ),
    }

elif EN_RAILWAY:
    raise ImproperlyConfigured(
        "Falta configurar DATABASE_URL en Railway."
    )

else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": "easyrubik",
            "USER": "postgres",
            "PASSWORD": os.environ.get(
                "DB_PASSWORD", ""
            ),
            "HOST": "localhost",
            "PORT": "5432",
        },
    }


# =========================================================
# VALIDACIÓN DE CONTRASEÑAS
# =========================================================

AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": (
            "django.contrib.auth.password_validation."
            "UserAttributeSimilarityValidator"
        ),
    },
    {
        "NAME": (
            "django.contrib.auth.password_validation."
            "MinimumLengthValidator"
        ),
    },
    {
        "NAME": (
            "django.contrib.auth.password_validation."
            "CommonPasswordValidator"
        ),
    },
    {
        "NAME": (
            "django.contrib.auth.password_validation."
            "NumericPasswordValidator"
        ),
    },
]


# =========================================================
# IDIOMA Y ZONA HORARIA
# =========================================================

LANGUAGE_CODE = "en-us"

TIME_ZONE = "UTC"

USE_I18N = True

USE_TZ = True


# =========================================================
# ARCHIVOS ESTÁTICOS
# =========================================================

STATIC_URL = "/static/"

# Archivos originales del proyecto.
STATICFILES_DIRS = [
    BASE_DIR / "static",
]

# Archivos reunidos mediante collectstatic.
STATIC_ROOT = BASE_DIR / "staticfiles"

STORAGES = {
    "default": {
        "BACKEND": (
            "django.core.files.storage.FileSystemStorage"
        ),
    },
    "staticfiles": {
        "BACKEND": (
            "whitenoise.storage.CompressedStaticFilesStorage"
        ),
    },
}


# =========================================================
# ARCHIVOS SUBIDOS POR USUARIOS
# =========================================================

MEDIA_URL = "/media/"

MEDIA_ROOT = BASE_DIR / "media"


# =========================================================
# CORREO — SALIDA A CONSOLA
# =========================================================

MAILERS = {
    "default": {
        "BACKEND": (
            "django.core.mail.backends.console.EmailBackend"
        ),
    },
}


# =========================================================
# MERCADO PAGO — PREMIUM
# =========================================================

MP_ACCESS_TOKEN = os.environ.get(
    "MP_ACCESS_TOKEN", ""
).strip()

MP_WEBHOOK_SECRET = os.environ.get(
    "MP_WEBHOOK_SECRET", ""
).strip()

MP_COLLECTOR_ID = os.environ.get(
    "MP_COLLECTOR_ID", ""
).strip()

MP_BASE_URL = os.environ.get(
    "MP_BASE_URL", ""
).strip().rstrip("/")

MP_LIVE_MODE = (
    os.environ.get(
        "MP_LIVE_MODE", "false"
    ).strip().lower()
    == "true"
)