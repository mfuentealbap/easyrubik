"""Conexión de easyRubik con Mercado Pago Checkout Pro."""

import calendar
import hashlib
import hmac
import json
import logging
import re
import uuid

from datetime import timedelta, timezone as dt_timezone
from decimal import Decimal, InvalidOperation
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urlsplit
from urllib.request import Request, build_opener, HTTPRedirectHandler
from zoneinfo import ZoneInfo

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.exceptions import ImproperlyConfigured
from django.db import transaction
from django.urls import reverse
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from .models import PagoPremium, Suscripcion


logger = logging.getLogger(__name__)

CHILE = ZoneInfo("America/Santiago")
PRECIO = 2000


class ErrorMercadoPago(Exception):
    pass


class PagoInvalido(Exception):
    pass


class SinRedirecciones(HTTPRedirectHandler):
    def redirect_request(
        self,
        req,
        fp,
        code,
        msg,
        headers,
        newurl,
    ):
        return None


def configuracion():
    token = getattr(
        settings,
        "MP_ACCESS_TOKEN",
        "",
    ).strip()

    secreto = getattr(
        settings,
        "MP_WEBHOOK_SECRET",
        "",
    ).strip()

    vendedor = str(
        getattr(settings, "MP_COLLECTOR_ID", "")
    ).strip()

    base = getattr(
        settings,
        "MP_BASE_URL",
        "",
    ).rstrip("/")

    url = urlsplit(base)

    if (
        not token
        or not secreto
        or not vendedor.isdigit()
        or url.scheme != "https"
        or not url.hostname
        or url.hostname in {"localhost", "127.0.0.1"}
        or url.username
        or url.password
        or url.query
        or url.fragment
        or url.path
    ):
        raise ImproperlyConfigured(
            "Configura MP_ACCESS_TOKEN, MP_WEBHOOK_SECRET, "
            "MP_COLLECTOR_ID y MP_BASE_URL "
            "(origen público HTTPS)."
        )

    produccion = bool(
        getattr(settings, "MP_LIVE_MODE", False)
    )

    return token, secreto, vendedor, base, produccion


def api(method, path, payload=None):
    token = configuracion()[0]

    body = (
        json.dumps(payload).encode()
        if payload is not None
        else None
    )

    request = Request(
        "https://api.mercadopago.com" + path,
        data=body,
        method=method,
        headers={
            "Authorization": "Bearer " + token,
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
    )

    try:
        with build_opener(SinRedirecciones).open(
            request,
            timeout=12,
        ) as response:
            result = json.load(response)

    except (
        HTTPError,
        URLError,
        TimeoutError,
        OSError,
        ValueError,
    ) as exc:
        # No registrar tokens ni datos personales del pago.
        logger.warning(
            "Mercado Pago: error de API (%s)",
            type(exc).__name__,
        )

        raise ErrorMercadoPago(
            "No se pudo consultar Mercado Pago."
        ) from exc

    if not isinstance(result, dict):
        raise ErrorMercadoPago(
            "Respuesta de Mercado Pago no válida."
        )

    return result


def sumar_mes(fecha, dia_ancla=None):
    """
    Suma un mes calendario usando la hora de Chile.

    Si el día no existe en el mes siguiente,
    utiliza el último día de ese mes.
    """
    local = fecha.astimezone(CHILE)

    year = local.year
    month = local.month + 1

    if month == 13:
        year += 1
        month = 1

    day = min(
        dia_ancla or local.day,
        calendar.monthrange(year, month)[1],
    )

    destino = local.replace(
        year=year,
        month=month,
        day=day,
    )

    return destino.astimezone(dt_timezone.utc)


def validar_firma(request):
    secreto = configuracion()[1]

    ids = request.GET.getlist("data.id")

    if (
        len(ids) != 1
        or not re.fullmatch(r"[0-9]{1,100}", ids[0])
    ):
        return None

    payment_id = ids[0]

    request_id = request.headers.get(
        "x-request-id",
        "",
    )

    parts = {}

    for item in request.headers.get(
        "x-signature",
        "",
    ).split(","):
        if "=" in item:
            key, value = item.split("=", 1)

            parts.setdefault(
                key.strip(),
                [],
            ).append(value.strip())

    if (
        not request_id
        or len(parts.get("ts", [])) != 1
    ):
        return None

    ts = parts["ts"][0]

    if not ts.isdigit():
        return None

    manifest = (
        f"id:{payment_id};"
        f"request-id:{request_id};"
        f"ts:{ts};"
    )

    expected = hmac.new(
        secreto.encode(),
        manifest.encode(),
        hashlib.sha256,
    ).hexdigest()

    firma_correcta = any(
        hmac.compare_digest(expected, value)
        for value in parts.get("v1", [])
    )

    if not firma_correcta:
        return None

    # Después se consulta este pago directamente en la API.
    return payment_id


def crear_checkout(usuario):
    _, _, vendedor, base, live = configuracion()

    with transaction.atomic():
        get_user_model().objects.select_for_update().get(
            pk=usuario.pk,
        )

        suscripcion = Suscripcion.objects.filter(
            usuario=usuario,
        ).first()

        if suscripcion and suscripcion.esta_activa:
            return None

        # Reutilizar una compra reciente ante doble clic.
        orden = PagoPremium.objects.filter(
            usuario=usuario,
            aplicado=False,
            requiere_revision=False,
            vendedor_id=vendedor,
            produccion=live,
            creado__gte=(
                timezone.now() - timedelta(minutes=30)
            ),
            estado__in=[
                "creado",
                "pending",
                "in_process",
                "rejected",
            ],
        ).first()

        if orden and orden.checkout_url:
            return orden.checkout_url

        if orden is None:
            orden = PagoPremium.objects.create(
                usuario=usuario,
                monto=PRECIO,
                vendedor_id=vendedor,
                produccion=live,
            )

        retorno = base + reverse(
            "pago_resultado",
            args=[orden.pk],
        )

        payload = {
            "items": [
                {
                    "id": "easyrubik-premium-mes",
                    "title": "easyRubik Premium · 1 mes",
                    "description": (
                        "Acceso completo por un mes calendario. "
                        "Sin renovación automática."
                    ),
                    "quantity": 1,
                    "currency_id": "CLP",
                    "unit_price": orden.monto,
                },
            ],
            "external_reference": str(orden.pk),
            "back_urls": {
                "success": retorno,
                "failure": retorno,
                "pending": retorno,
            },
            "auto_return": "approved",
            "notification_url": (
                base
                + reverse("mp_webhook")
                + "?source_news=webhooks"
            ),
        }

        result = api(
            "POST",
            "/checkout/preferences",
            payload,
        )

        if str(result.get("collector_id", "")) != vendedor:
            raise ErrorMercadoPago(
                "Las credenciales no corresponden "
                "al vendedor configurado."
            )

        link = result.get(
            "init_point" if live else "sandbox_init_point",
            "",
        )

        url_checkout = urlsplit(link)
        host = url_checkout.hostname or ""

        dominio_valido = (
            host == "mercadopago.com"
            or host.endswith(".mercadopago.com")
            or host == "mercadopago.cl"
            or host.endswith(".mercadopago.cl")
        )

        if (
            url_checkout.scheme != "https"
            or not dominio_valido
        ):
            raise ErrorMercadoPago(
                "Checkout no válido."
            )

        if not result.get("id"):
            raise ErrorMercadoPago(
                "Falta identificador de preferencia."
            )

        orden.preferencia_id = str(result["id"])
        orden.checkout_url = link

        orden.save(
            update_fields=[
                "preferencia_id",
                "checkout_url",
            ],
        )

        return link


def fecha_mp(value):
    try:
        fecha = (
            parse_datetime(value)
            if isinstance(value, str)
            else None
        )
    except ValueError:
        fecha = None

    if fecha is None or timezone.is_naive(fecha):
        raise PagoInvalido(
            "Falta una fecha válida de Mercado Pago."
        )

    return fecha


def sincronizar_pago(payment_id, orden_esperada=None):
    if not re.fullmatch(
        r"[0-9]{1,100}",
        str(payment_id),
    ):
        raise PagoInvalido(
            "Identificador de pago no válido."
        )

    datos = api(
        "GET",
        "/v1/payments/" + str(payment_id),
    )

    try:
        referencia = uuid.UUID(
            str(datos.get("external_reference", "")),
        )
    except (ValueError, TypeError):
        raise PagoInvalido(
            "Pago ajeno a easyRubik."
        )

    if (
        orden_esperada is not None
        and referencia != orden_esperada
    ):
        raise PagoInvalido(
            "El pago no corresponde a esta compra."
        )

    orden = PagoPremium.objects.filter(
        pk=referencia,
    ).first()

    if orden is None:
        raise PagoInvalido(
            "Compra desconocida."
        )

    try:
        monto = Decimal(
            str(datos.get("transaction_amount")),
        )

        devuelto = Decimal(
            str(
                datos.get(
                    "transaction_amount_refunded",
                    0,
                ),
            ),
        )
    except InvalidOperation:
        raise PagoInvalido(
            "Monto no válido."
        )

    if (
        str(datos.get("id")) != str(payment_id)
        or monto != Decimal(orden.monto)
        or not devuelto.is_finite()
        or devuelto < 0
        or datos.get("currency_id") != orden.moneda
        or str(datos.get("collector_id")) != orden.vendedor_id
        or datos.get("live_mode") is not orden.produccion
        or orden.produccion != configuracion()[4]
    ):
        raise PagoInvalido(
            "No coincide monto, moneda, vendedor o ambiente."
        )

    actualizado = fecha_mp(
        datos.get("date_last_updated"),
    )

    estado = str(datos.get("status", ""))

    estados_validos = {
        "approved",
        "pending",
        "in_process",
        "authorized",
        "in_mediation",
        "rejected",
        "cancelled",
        "refunded",
        "charged_back",
    }

    if estado not in estados_validos:
        raise PagoInvalido(
            "Estado no reconocido."
        )

    aprobado = (
        fecha_mp(datos.get("date_approved"))
        if estado == "approved"
        else None
    )

    with transaction.atomic():
        get_user_model().objects.select_for_update().get(
            pk=orden.usuario_id,
        )

        orden = PagoPremium.objects.select_for_update().get(
            pk=referencia,
        )

        if (
            orden.pago_externo_id
            and orden.pago_externo_id != str(payment_id)
        ):
            if estado == "approved":
                orden.requiere_revision = True

                orden.save(
                    update_fields=["requiere_revision"],
                )

                logger.error(
                    "Dos pagos aprobados para la orden %s; "
                    "revisar en Mercado Pago.",
                    orden.pk,
                )

            return orden

        if (
            orden.pago_externo_id == str(payment_id)
            and orden.actualizado_mp
            and actualizado < orden.actualizado_mp
        ):
            return orden

        # Un intento rechazado permite reintentar
        # el mismo checkout con otro identificador de pago.
        if estado in {
            "approved",
            "refunded",
            "charged_back",
            "in_mediation",
        }:
            orden.pago_externo_id = str(payment_id)

        orden.estado = estado
        orden.actualizado_mp = actualizado

        revocado = (
            estado in {
                "refunded",
                "charged_back",
                "in_mediation",
                "cancelled",
            }
            or devuelto > 0
        )

        orden.acceso_revocado = revocado

        suscripcion, _ = Suscripcion.objects.get_or_create(
            usuario_id=orden.usuario_id,
        )

        if (
            estado == "approved"
            and not revocado
            and not orden.aplicado
        ):
            orden.aprobado = aprobado
            orden.aplicado = True

        orden.save()

        if orden.aplicado or revocado:
            # Recalcular usando únicamente compras válidas.
            validos = list(
                PagoPremium.objects.filter(
                    usuario_id=orden.usuario_id,
                    aplicado=True,
                    acceso_revocado=False,
                    estado="approved",
                ).order_by(
                    "aprobado",
                    "creado",
                    "id",
                ),
            )

            fin_anterior = None
            ancla_anterior = None

            for vigente in validos:
                base = vigente.aprobado
                ancla = base.astimezone(CHILE).day

                if fin_anterior and fin_anterior > base:
                    base = fin_anterior
                    ancla = ancla_anterior

                elif (
                    fin_anterior
                    and fin_anterior.astimezone(CHILE).date()
                    == base.astimezone(CHILE).date()
                ):
                    ancla = ancla_anterior

                vigente.acceso_inicio = vigente.aprobado

                vigente.acceso_fin = sumar_mes(
                    base,
                    ancla,
                )

                vigente.dia_ancla = ancla

                vigente.save(
                    update_fields=[
                        "acceso_inicio",
                        "acceso_fin",
                        "dia_ancla",
                    ],
                )

                fin_anterior = vigente.acceso_fin
                ancla_anterior = ancla

            if validos:
                vigente = validos[-1]

                suscripcion.premium = True
                suscripcion.fecha_inicio = vigente.acceso_inicio
                suscripcion.fecha_fin = vigente.acceso_fin
                suscripcion.proveedor = "mercadopago"

                suscripcion.id_suscripcion_externa = (
                    vigente.pago_externo_id
                )

                suscripcion.save()

            elif suscripcion.proveedor == "mercadopago":
                suscripcion.premium = False

                suscripcion.save(
                    update_fields=["premium"],
                )

            orden.refresh_from_db()

        return orden


def reconciliar_orden(orden):
    if orden.pago_externo_id:
        return sincronizar_pago(
            orden.pago_externo_id,
            orden.pk,
        )

    query = urlencode(
        {
            "external_reference": str(orden.pk),
            "sort": "date_created",
            "criteria": "desc",
            "limit": 100,
        },
    )

    result = api(
        "GET",
        "/v1/payments/search?" + query,
    )

    for pago in result.get("results", []):
        sincronizar_pago(
            str(pago["id"]),
            orden.pk,
        )

    orden.refresh_from_db()

    return orden