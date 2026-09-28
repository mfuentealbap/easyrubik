import logging

from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.core.exceptions import ImproperlyConfigured
from django.db import DatabaseError
from django.http import HttpResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET, require_POST

from .models import PagoPremium
from .mercadopago_servicio import (
    ErrorMercadoPago,
    PagoInvalido,
    crear_checkout,
    validar_firma,
    sincronizar_pago,
    reconciliar_orden,
)


logger = logging.getLogger(__name__)


@login_required(login_url="login")
@require_POST
def iniciar(request):
    """Abre el checkout para el usuario autenticado."""
    try:
        url = crear_checkout(request.user)

    except (
        ErrorMercadoPago,
        ImproperlyConfigured,
        DatabaseError,
    ):
        logger.warning(
            "No se pudo iniciar checkout; "
            "revisar configuración o conexión."
        )

        messages.error(
            request,
            "No pudimos abrir el pago. "
            "Intenta de nuevo en unos minutos.",
        )

        return redirect("premium")

    return redirect(url or "premium")


@login_required(login_url="login")
@require_GET
def resultado(request, orden_id):
    """Muestra únicamente la compra del usuario autenticado."""
    orden = get_object_or_404(
        PagoPremium,
        pk=orden_id,
        usuario=request.user,
    )

    error = ""

    try:
        # Consulta Mercado Pago.
        # No confía en el estado recibido desde el navegador.
        orden = reconciliar_orden(orden)

    except (
        ErrorMercadoPago,
        PagoInvalido,
        ImproperlyConfigured,
        DatabaseError,
    ):
        error = (
            "La confirmación aún no está disponible. "
            "Puedes volver a consultar en unos momentos."
        )

    return render(
        request,
        "PagoResultado.html",
        {
            "pago": orden,
            "error_pago": error,
        },
    )


@csrf_exempt
@require_POST
def webhook(request):
    """Recibe las notificaciones firmadas de Mercado Pago."""
    try:
        payment_id = validar_firma(request)

        if payment_id is None:
            return HttpResponse(status=401)

        sincronizar_pago(payment_id)

    except PagoInvalido:
        # La notificación no corresponde a un pago válido
        # de esta integración. No se concede acceso.
        logger.warning(
            "Notificación de pago descartada por validación."
        )

        return HttpResponse(status=200)

    except (
        ErrorMercadoPago,
        ImproperlyConfigured,
        DatabaseError,
    ):
        # Permite que Mercado Pago reintente la notificación.
        return HttpResponse(status=503)

    return HttpResponse(status=200)