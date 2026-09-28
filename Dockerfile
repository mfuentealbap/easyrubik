FROM python:3.13-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

# Usuario que ejecutará la aplicación.
RUN useradd --create-home --uid 10001 appuser \
    && mkdir /app \
    && chown appuser:appuser /app

WORKDIR /app

# Instalar las dependencias.
COPY requirements.txt .

RUN python -m pip install --upgrade pip \
    && python -m pip install -r requirements.txt

# Copiar el proyecto.
COPY --chown=appuser:appuser . .

USER appuser

# Reunir los archivos estáticos y arrancar Django con Gunicorn.
CMD ["sh", "-c", "python manage.py collectstatic --noinput && exec gunicorn config.wsgi:application --bind 0.0.0.0:${PORT:-8000} --workers 2 --threads 2 --timeout 120 --access-logfile - --error-logfile -"]