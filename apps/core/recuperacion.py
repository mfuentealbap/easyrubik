import json
import logging
import os
import secrets

from datetime import timedelta
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from django import forms
from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.forms import SetPasswordForm
from django.core.mail import EmailMessage
from django.db import transaction
from django.shortcuts import redirect, render
from django.utils import timezone
from django.utils.crypto import constant_time_compare, salted_hmac
from django.views.decorators.cache import never_cache
from django.views.decorators.debug import sensitive_post_parameters, sensitive_variables
from django.views.decorators.http import require_http_methods

from .models import Perfil, RecuperacionClave


logger = logging.getLogger(__name__)

SESION = "recuperacion_clave"
SESION_CUENTA = "recuperacion_cuenta"

VIDA = timedelta(minutes=10)
VENTANA = timedelta(hours=1)
ESPERA = timedelta(seconds=60)

MAX_ENVIOS = 3
MAX_INTENTOS = 5
MAX_SOLICITUDES_GLOBAL = 100


class UsuarioForm(forms.Form):
    username = forms.CharField(
        label="Nombre de usuario",
        max_length=150,
        widget=forms.TextInput(
            attrs={
                "autocomplete": "username",
                "placeholder": "Tu nombre de jugador",
            }
        ),
    )


class CorreoForm(forms.Form):
    email = forms.EmailField(
        label="Correo asociado a tu cuenta",
        max_length=254,
        widget=forms.EmailInput(
            attrs={
                "autocomplete": "email",
                "placeholder": "correo@ejemplo.com",
            }
        ),
    )


class CodigoForm(forms.Form):
    codigo = forms.RegexField(
        regex=r"\A[0-9]{6}\Z",
        label="Código de 6 dígitos",
        max_length=6,
        error_messages={
            "invalid": "Escribe los 6 números del código.",
        },
        widget=forms.TextInput(
            attrs={
                "inputmode": "numeric",
                "autocomplete": "one-time-code",
                "placeholder": "000000",
            }
        ),
    )


def huella(valor):
    return salted_hmac(
        "easyrubik.recuperacion.v2",
        valor,
        algorithm="sha256",
    ).hexdigest()


def normalizar_email(valor):
    return (valor or "").strip().lower()


def correo_registrado_del_usuario(usuario):
    """
    Devuelve el correo canónico solo si User.email y Perfil.email
    existen y coinciden. Si están desincronizados, la recuperación
    se bloquea hasta corregir los datos de la cuenta.
    """
    email_usuario = normalizar_email(usuario.email)

    perfil = (
        Perfil.objects
        .filter(usuario_id=usuario.pk)
        .only("email")
        .first()
    )

    email_perfil = normalizar_email(
        perfil.email if perfil else ""
    )

    if not email_usuario or not email_perfil:
        return None

    if not constant_time_compare(
        email_usuario,
        email_perfil,
    ):
        return None

    return email_usuario


def configuracion_correo():
    """
    Local:
        - Usa Gmail/SMTP configurado en Django.
    Railway:
        - Usa Resend por HTTPS para evitar el bloqueo de SMTP.
    """
    en_railway = bool(os.environ.get("RAILWAY_ENVIRONMENT_ID"))

    modo = os.environ.get(
        "RECUPERACION_MODO",
        "resend" if en_railway else "smtp",
    ).strip().lower()

    # Consola solo para desarrollo local.
    if (
        modo == "consola"
        and settings.DEBUG
        and not en_railway
    ):
        return {
            "modo": "consola",
            "remitente": "",
            "api_key": "",
        }

    if modo == "smtp":
        remitente = str(
            getattr(settings, "DEFAULT_FROM_EMAIL", "") or ""
        ).strip()

        if not remitente:
            raise RuntimeError(
                "Falta configurar DEFAULT_FROM_EMAIL."
            )

        return {
            "modo": "smtp",
            "remitente": remitente,
            "api_key": "",
        }

    if modo == "resend":
        api_key = os.environ.get(
            "RESEND_API_KEY",
            "",
        ).strip()

        remitente = os.environ.get(
            "RECUPERACION_REMITENTE",
            "",
        ).strip()

        if not api_key or not remitente:
            raise RuntimeError(
                "Falta configurar RESEND_API_KEY o "
                "RECUPERACION_REMITENTE."
            )

        return {
            "modo": "resend",
            "remitente": remitente,
            "api_key": api_key,
        }

    raise RuntimeError(
        "RECUPERACION_MODO debe ser smtp, resend o consola."
    )


@sensitive_variables()
def enviar_codigo(email, codigo, identificador):
    config = configuracion_correo()
    modo = config["modo"]
    remitente = config["remitente"]

    texto = (
        f"Tu código de recuperación de easyRubik es: {codigo}\n\n"
        "Caduca en 10 minutos y solo puede utilizarse una vez.\n"
        "Escríbelo en el mismo navegador donde lo solicitaste.\n"
        "Si no solicitaste cambiar tu contraseña, ignora este correo.\n"
        "No compartas este código con nadie."
    )

    if modo == "consola":
        from django.core.mail.backends.console import EmailBackend

        enviados = EmailMessage(
            "Recupera tu cuenta de easyRubik",
            texto,
            remitente or "easyRubik <no-reply@localhost>",
            [email],
            connection=EmailBackend(),
        ).send(fail_silently=False)

        if enviados != 1:
            raise RuntimeError(
                "El backend de consola no confirmó el envío."
            )

        return

    if modo == "smtp":
        enviados = EmailMessage(
            subject="Recupera tu cuenta de easyRubik",
            body=texto,
            from_email=remitente,
            to=[email],
        ).send(fail_silently=False)

        if enviados != 1:
            raise RuntimeError(
                "El servidor SMTP no confirmó el envío."
            )

        return

    # Railway / producción: Resend mediante HTTPS.
    payload = json.dumps(
        {
            "from": remitente,
            "to": [email],
            "subject": "Recupera tu cuenta de easyRubik",
            "text": texto,
        }
    ).encode("utf-8")

    peticion = Request(
        "https://api.resend.com/emails",
        data=payload,
        headers={
            "Authorization": f"Bearer {config['api_key']}",
            "Content-Type": "application/json",
            "User-Agent": "easyRubik/1.0",
            "Idempotency-Key": identificador,
        },
        method="POST",
    )

    try:
        with urlopen(
            peticion,
            timeout=10,
        ) as respuesta:
            contenido = json.loads(
                respuesta.read().decode("utf-8")
            )
    except (HTTPError, URLError, OSError) as exc:
        raise RuntimeError(
            "El proveedor de correo no pudo enviar el mensaje."
        ) from exc

    if not contenido.get("id"):
        raise RuntimeError(
            "El proveedor de correo no confirmó el envío."
        )


def reiniciar_contadores(fila, ahora):
    if ahora >= fila.ventana + VENTANA:
        fila.ventana = ahora
        fila.envios = 0
        fila.intentos = 0


@sensitive_variables()
def solicitar_codigo(request, usuario):
    """
    Genera y envía el código exclusivamente al correo guardado
    en la base de datos del usuario previamente identificado.
    Nunca usa el correo escrito en el formulario como destino.
    """
    correo_destino = correo_registrado_del_usuario(usuario)

    if not correo_destino:
        return "datos_invalidos"

    ahora = timezone.now()
    clave = huella(f"usuario:{usuario.pk}")
    token = secrets.token_urlsafe(32)
    codigo = f"{secrets.randbelow(1000000):06d}"

    with transaction.atomic():
        RecuperacionClave.objects.get_or_create(
            clave="limite-global",
        )

        global_ = (
            RecuperacionClave.objects
            .select_for_update()
            .get(clave="limite-global")
        )

        reiniciar_contadores(global_, ahora)

        if global_.envios >= MAX_SOLICITUDES_GLOBAL:
            global_.save()
            return "limite"

        RecuperacionClave.objects.get_or_create(
            clave=clave,
        )

        fila = (
            RecuperacionClave.objects
            .select_for_update()
            .get(clave=clave)
        )

        reiniciar_contadores(fila, ahora)

        if (
            fila.envios >= MAX_ENVIOS
            or fila.intentos >= MAX_INTENTOS
            or (
                fila.ultimo_envio
                and ahora < fila.ultimo_envio + ESPERA
            )
        ):
            fila.save()
            return "limite"

        global_.envios += 1
        global_.save()

        fila.usuario = usuario
        fila.token_hash = huella(token)
        fila.codigo_hash = ""
        fila.password_hash = huella(usuario.password)
        fila.expira = ahora + VIDA
        fila.verificado = False
        fila.consumido = False
        fila.ultimo_envio = ahora
        fila.envios += 1
        fila.save()

    request.session[SESION] = {
        "clave": clave,
        "token": token,
        "usuario_id": usuario.pk,
    }

    try:
        enviar_codigo(
            correo_destino,
            codigo,
            fila.token_hash,
        )
    except Exception as exc:
        # No guardar correo, código, contraseña ni credenciales en logs.
        logger.error(
            "No se pudo enviar recuperación (%s).",
            type(exc).__name__,
        )

        RecuperacionClave.objects.filter(
            clave=clave,
            token_hash=huella(token),
        ).update(
            codigo_hash="",
        )

        request.session.pop(SESION, None)
        return "error_envio"

    RecuperacionClave.objects.filter(
        clave=clave,
        token_hash=huella(token),
    ).update(
        codigo_hash=huella(token + ":" + codigo),
    )

    return "enviado"


def buscar_solicitud(request):
    datos = request.session.get(SESION, {})

    fila = (
        RecuperacionClave.objects
        .select_for_update()
        .filter(clave=datos.get("clave", ""))
        .first()
    )

    if (
        not fila
        or not fila.usuario_id
        or fila.consumido
        or not fila.expira
        or timezone.now() >= fila.expira
        or fila.intentos >= MAX_INTENTOS
        or datos.get("usuario_id") != fila.usuario_id
        or not constant_time_compare(
            fila.token_hash,
            huella(datos.get("token", "")),
        )
    ):
        return None, None

    usuario = (
        get_user_model().objects
        .select_for_update()
        .filter(pk=fila.usuario_id)
        .first()
    )

    if (
        not usuario
        or not usuario.is_active
        or not usuario.has_usable_password()
        or not constant_time_compare(
            fila.password_hash,
            huella(usuario.password),
        )
        or fila.clave != huella(
            f"usuario:{usuario.pk}"
        )
        or not correo_registrado_del_usuario(usuario)
    ):
        return None, None

    return fila, usuario


def pagina(request, paso, formulario=None, error=None):
    return render(
        request,
        "RecuperarClave.html",
        {
            "paso": paso,
            "form": formulario,
            "error": error,
        },
    )


@never_cache
@require_http_methods(["GET", "POST"])
@sensitive_post_parameters()
def solicitar(request):
    """
    PASO 1: identifica el usuario.
    PASO 2: pide el correo y lo compara con User.email y Perfil.email.
    Solo después genera y envía un código.
    """
    if request.GET.get("reiniciar") == "1":
        request.session.pop(SESION_CUENTA, None)
        request.session.pop(SESION, None)
        return redirect("recuperar_clave")

    cuenta = request.session.get(SESION_CUENTA, {})
    usuario_id = cuenta.get("usuario_id")

    usuario = None
    if usuario_id:
        usuario = (
            get_user_model().objects
            .filter(
                pk=usuario_id,
                is_active=True,
            )
            .first()
        )

        if (
            not usuario
            or not usuario.has_usable_password()
        ):
            request.session.pop(SESION_CUENTA, None)
            usuario = None

    # PASO 1: nombre de usuario
    if usuario is None:
        formulario = UsuarioForm(
            request.POST
            if request.method == "POST"
            else None
        )

        if request.method == "POST" and formulario.is_valid():
            username = formulario.cleaned_data["username"].strip()

            candidato = (
                get_user_model().objects
                .filter(
                    username__iexact=username,
                    is_active=True,
                )
                .first()
            )

            if (
                not candidato
                or not candidato.has_usable_password()
            ):
                return pagina(
                    request,
                    "usuario",
                    formulario,
                    "No pudimos validar los datos de esa cuenta.",
                )

            # Debe existir un correo válido y sincronizado antes
            # de permitir pasar al segundo paso.
            if not correo_registrado_del_usuario(candidato):
                return pagina(
                    request,
                    "usuario",
                    formulario,
                    (
                        "No pudimos validar los datos de esa cuenta. "
                        "Comprueba que tu perfil tenga un correo registrado."
                    ),
                )

            request.session[SESION_CUENTA] = {
                "usuario_id": candidato.pk,
            }
            request.session.pop(SESION, None)

            return redirect("recuperar_clave")

        return pagina(
            request,
            "usuario",
            formulario,
        )

    # PASO 2: correo asociado a ESE usuario
    formulario = CorreoForm(
        request.POST
        if request.method == "POST"
        else None
    )

    if request.method == "POST" and formulario.is_valid():
        correo_ingresado = normalizar_email(
            formulario.cleaned_data["email"]
        )
        correo_registrado = correo_registrado_del_usuario(usuario)

        if (
            not correo_registrado
            or not constant_time_compare(
                correo_ingresado,
                correo_registrado,
            )
        ):
            return pagina(
                request,
                "correo",
                formulario,
                (
                    "El nombre de usuario y el correo ingresado "
                    "no coinciden con la misma cuenta."
                ),
            )

        try:
            configuracion_correo()
        except RuntimeError:
            return pagina(
                request,
                "correo",
                formulario,
                "El envío de correos aún no está disponible. "
                "Inténtalo más tarde.",
            )

        resultado = solicitar_codigo(
            request,
            usuario,
        )

        if resultado == "enviado":
            return redirect("recuperar_codigo")

        if resultado == "limite":
            return pagina(
                request,
                "correo",
                formulario,
                (
                    "Has solicitado demasiados códigos. "
                    "Espera un momento e inténtalo de nuevo."
                ),
            )

        if resultado == "datos_invalidos":
            return pagina(
                request,
                "correo",
                formulario,
                (
                    "Los datos de la cuenta cambiaron. "
                    "Vuelve a iniciar la recuperación."
                ),
            )

        return pagina(
            request,
            "correo",
            formulario,
            (
                "No pudimos enviar el código en este momento. "
                "Inténtalo más tarde."
            ),
        )

    return pagina(
        request,
        "correo",
        formulario,
    )


@never_cache
@require_http_methods(["GET", "POST"])
@sensitive_post_parameters()
def verificar(request):
    formulario = CodigoForm(
        request.POST
        if request.method == "POST"
        else None
    )

    error = None

    if request.method == "POST":
        valido = formulario.is_valid()

        with transaction.atomic():
            fila, usuario = buscar_solicitud(request)

            if fila and not fila.verificado:
                fila.intentos += 1
                token = request.session[SESION]["token"]

                if (
                    valido
                    and fila.codigo_hash
                    and constant_time_compare(
                        fila.codigo_hash,
                        huella(
                            token
                            + ":"
                            + formulario.cleaned_data["codigo"]
                        ),
                    )
                ):
                    fila.verificado = True
                    fila.codigo_hash = ""
                    fila.intentos -= 1
                    fila.save()

                    return redirect("recuperar_nueva")

                fila.save()

        error = (
            "Código incorrecto, vencido o agotado. "
            "Solicita otro si es necesario."
        )

    return pagina(
        request,
        "codigo",
        formulario,
        error,
    )


@never_cache
@require_http_methods(["GET", "POST"])
@sensitive_post_parameters()
def nueva(request):
    with transaction.atomic():
        fila, usuario = buscar_solicitud(request)

        if not fila or not fila.verificado:
            return redirect("recuperar_codigo")

        formulario = SetPasswordForm(
            usuario,
            request.POST
            if request.method == "POST"
            else None,
        )

        if request.method == "POST" and formulario.is_valid():
            formulario.save()

            fila.consumido = True
            fila.verificado = False
            fila.codigo_hash = ""
            fila.save()

            request.session.flush()

            return pagina(
                request,
                "listo",
            )

    return pagina(
        request,
        "nueva",
        formulario,
    )
