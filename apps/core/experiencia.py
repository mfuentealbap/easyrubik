import uuid

from django.contrib.auth.models import User
from django.db import transaction
from django.http import JsonResponse
from django.middleware.csrf import get_token
from django.shortcuts import render
from django.templatetags.static import static
from django.urls import reverse
from django.utils import timezone
from django.utils.html import format_html
from django.views.decorators.http import require_POST

from .models import ExperienciaCubo, SesionPractica


# Un punto cada 6 segundos activos = 10 XP por minuto.
MS_POR_XP = 6000

# Experiencia necesaria para llegar al nivel 30.
MAX_XP = ExperienciaCubo.umbral(30)


def estado(xp):
    """Información del progreso que recibirá el simulador."""
    return {
        "tipo": xp.tipo,
        "nombre": xp.get_tipo_display(),
        "xp": xp.experiencia,
        "nivel": xp.nivel,
        "porcentaje": xp.porcentaje,
        "faltante": xp.faltante,
        "maestro": xp.nivel == 30,
    }


@require_POST
def iniciar(request):
    """Inicia una sesión de práctica para el usuario conectado."""
    if not request.user.is_authenticated:
        return JsonResponse(
            {"error": "Inicia sesión para guardar experiencia."},
            status=401,
        )

    tipo = request.POST.get("tipo", "")

    if tipo not in dict(ExperienciaCubo.TIPOS):
        return JsonResponse(
            {"error": "Cubo no válido."},
            status=400,
        )

    with transaction.atomic():
        # Serializa las actualizaciones del mismo usuario
        # en bases con bloqueo de filas, como PostgreSQL.
        User.objects.select_for_update().get(
            pk=request.user.pk
        )

        xp, _ = ExperienciaCubo.objects.get_or_create(
            usuario=request.user,
            tipo=tipo,
        )

        # Una nueva sesión reemplaza la de otra pestaña.
        sesion, _ = SesionPractica.objects.update_or_create(
            usuario=request.user,
            defaults={
                "tipo": tipo,
                "token": uuid.uuid4(),
                "ultimo_pulso": timezone.now(),
                "secuencia": 0,
            },
        )

        datos = estado(xp)
        datos["token"] = str(sesion.token)

    return JsonResponse(datos)


@require_POST
def pulso(request):
    """Recibe un intervalo de actividad y calcula sus puntos."""
    if not request.user.is_authenticated:
        return JsonResponse(
            {"error": "Tu sesión ha terminado."},
            status=401,
        )

    try:
        token = uuid.UUID(
            request.POST.get("token", "")
        )

        secuencia = int(
            request.POST.get("secuencia", "")
        )

        activo_ms = int(
            request.POST.get("activo_ms", "")
        )

        if not (
            0 < secuencia <= 2147483647
            and 0 <= activo_ms <= 30000
        ):
            raise ValueError

    except (ValueError, TypeError, AttributeError):
        return JsonResponse(
            {"error": "Actualización de práctica no válida."},
            status=400,
        )

    with transaction.atomic():
        User.objects.select_for_update().get(
            pk=request.user.pk
        )

        sesion = SesionPractica.objects.filter(
            usuario=request.user,
            token=token,
        ).first()

        if sesion is None:
            return JsonResponse(
                {
                    "error": (
                        "Esta sesión de práctica ya no está vigente. "
                        "Puede haberse iniciado otra pestaña."
                    )
                },
                status=409,
            )

        xp = ExperienciaCubo.objects.get(
            usuario=request.user,
            tipo=sesion.tipo,
        )

        # Una actualización repetida no vuelve a sumar puntos.
        if secuencia <= sesion.secuencia:
            return JsonResponse({
                **estado(xp),
                "ganado": 0,
            })

        ahora = timezone.now()

        transcurrido_ms = max(
            0,
            int(
                (ahora - sesion.ultimo_pulso).total_seconds()
                * 1000
            ),
        )

        # Nunca acreditar más tiempo que el transcurrido
        # en el servidor. Los intervalos largos caducan.
        if transcurrido_ms <= 45000:
            aceptado_ms = min(
                activo_ms,
                transcurrido_ms,
                30000,
            )
        else:
            aceptado_ms = 0

        experiencia_anterior = xp.experiencia

        if experiencia_anterior < MAX_XP:
            tiempo_acumulado = (
                xp.resto_practica_ms + aceptado_ms
            )

            puntos, resto = divmod(
                tiempo_acumulado,
                MS_POR_XP,
            )

            xp.experiencia = min(
                MAX_XP,
                experiencia_anterior + puntos,
            )

            xp.resto_practica_ms = (
                0 if xp.experiencia == MAX_XP else resto
            )

            xp.save(
                update_fields=[
                    "experiencia",
                    "resto_practica_ms",
                ]
            )

        sesion.ultimo_pulso = ahora
        sesion.secuencia = secuencia

        sesion.save(
            update_fields=[
                "ultimo_pulso",
                "secuencia",
            ]
        )

        return JsonResponse({
            **estado(xp),
            "ganado": (
                xp.experiencia - experiencia_anterior
            ),
        })


def render_simulador(request, template, tipo):
    """Añade el indicador de XP al HTML del simulador."""
    respuesta = render(request, template)

    if not request.user.is_authenticated:
        return respuesta

    script = format_html(
        '<script defer src="{}" '
        'data-easyrubik-xp '
        'data-tipo="{}" '
        'data-iniciar="{}" '
        'data-pulso="{}" '
        'data-csrf="{}"></script>',
        static("easyrubik/experiencia.js") + "?v=1",
        tipo,
        reverse("xp_iniciar"),
        reverse("xp_pulso"),
        get_token(request),
    )

    html = respuesta.content.decode(
        respuesta.charset
    )

    posicion = html.lower().rfind("</body>")

    if posicion >= 0:
        html = (
            html[:posicion]
            + str(script)
            + html[posicion:]
        )
    else:
        html += str(script)

    respuesta.content = html.encode(
        respuesta.charset
    )

    return respuesta