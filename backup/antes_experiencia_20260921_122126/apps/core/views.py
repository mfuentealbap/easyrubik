from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import login_required
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.db import IntegrityError, transaction
from django.shortcuts import render, redirect

from .models import Perfil, ExperienciaCubo


# =========================================================
# FUNCIONES AUXILIARES
# =========================================================

def obtener_perfil(usuario):
    perfil, _ = Perfil.objects.get_or_create(
        usuario=usuario,
        defaults={
            "nombre": usuario.first_name,
            "apellido": usuario.last_name,
            "email": usuario.email,
        },
    )
    return perfil


def contexto_formulario(datos=None, error=None):
    return {
        "datos": datos or {},
        "error": error,
        "sexos": Perfil.SEXOS,
        "avatares": Perfil.AVATARES,
    }


def validar_datos_personales(post):
    datos = {
        campo: post.get(campo, "").strip()
        for campo in (
            "nombre",
            "apellido",
            "email",
            "sexo",
            "avatar",
        )
    }

    datos["avatar"] = datos["avatar"] or "cubo"

    if not datos["nombre"]:
        raise ValidationError("Debes ingresar tu nombre.")

    if len(datos["nombre"]) > 100:
        raise ValidationError(
            "El nombre no puede superar los 100 caracteres."
        )

    if len(datos["apellido"]) > 100:
        raise ValidationError(
            "El apellido no puede superar los 100 caracteres."
        )

    if not datos["email"]:
        raise ValidationError(
            "Debes ingresar tu correo electrónico."
        )

    if len(datos["email"]) > 254:
        raise ValidationError(
            "El correo electrónico es demasiado largo."
        )

    try:
        validate_email(datos["email"])
    except ValidationError:
        raise ValidationError(
            "Ingresa un correo electrónico válido."
        )

    if datos["sexo"] not in dict(Perfil.SEXOS):
        raise ValidationError(
            "Selecciona una opción válida de sexo."
        )

    if datos["avatar"] not in dict(Perfil.AVATARES):
        raise ValidationError(
            "Selecciona un avatar válido."
        )

    return datos


# =========================================================
# INICIO
# =========================================================

def home(request):
    return render(request, "HomeEasyRubik.html")


# =========================================================
# INICIAR SESIÓN
# =========================================================

def login_view(request):
    if request.user.is_authenticated:
        return redirect("selector")

    if request.method == "POST":
        username = request.POST.get("username", "").strip()
        password = request.POST.get("password", "")

        user = authenticate(
            request,
            username=username,
            password=password,
        )

        if user is not None:
            login(request, user)
            return redirect("selector")

        return render(
            request,
            "Login.html",
            {"error": "Usuario o contraseña incorrectos."},
        )

    return render(request, "Login.html")


# =========================================================
# REGISTRO
# =========================================================

def registro_view(request):
    if request.user.is_authenticated:
        return redirect("selector")

    if request.method == "POST":
        # Conservamos los datos si hay un error.
        # Las contraseñas nunca se devuelven al formulario.
        datos = {
            campo: request.POST.get(campo, "").strip()
            for campo in (
                "username",
                "nombre",
                "apellido",
                "email",
                "sexo",
                "avatar",
            )
        }

        try:
            personal = validar_datos_personales(request.POST)

            username = User.normalize_username(
                datos["username"]
            )
            datos["username"] = username

            if not username:
                raise ValidationError(
                    "Debes ingresar un nombre de jugador."
                )

            # Comprueba longitud y caracteres admitidos por Django.
            User._meta.get_field("username").clean(
                username,
                None,
            )

            if User.objects.filter(
                username__iexact=username
            ).exists():
                raise ValidationError(
                    "Ese nombre de jugador ya está registrado."
                )

            password = request.POST.get("password", "")
            password2 = request.POST.get("password2", "")

            if not password:
                raise ValidationError(
                    "Debes ingresar una contraseña."
                )

            if password != password2:
                raise ValidationError(
                    "Las contraseñas no coinciden."
                )

            candidato = User(
                username=username,
                first_name=personal["nombre"],
                last_name=personal["apellido"],
                email=personal["email"],
            )

            # Usa los validadores configurados en settings.py.
            validate_password(password, candidato)

            # Usuario y perfil se guardan juntos.
            with transaction.atomic():
                user = User.objects.create_user(
                    username=username,
                    password=password,
                    first_name=personal["nombre"],
                    last_name=personal["apellido"],
                    email=personal["email"],
                )

                # Compatible con señales que creen el perfil.
                Perfil.objects.update_or_create(
                    usuario=user,
                    defaults=personal,
                )

        except ValidationError as exc:
            return render(
                request,
                "Registro.html",
                contexto_formulario(
                    datos,
                    " ".join(exc.messages),
                ),
            )

        except IntegrityError:
            return render(
                request,
                "Registro.html",
                contexto_formulario(
                    datos,
                    "No se pudo crear la cuenta. "
                    "Comprueba si el nombre de jugador "
                    "ya está registrado.",
                ),
            )

        login(request, user)
        return redirect("selector")

    return render(
        request,
        "Registro.html",
        contexto_formulario(),
    )


# =========================================================
# EDITAR PERFIL
# =========================================================

@login_required(login_url="login")
def perfil_view(request):
    perfil = obtener_perfil(request.user)

    datos = {
        campo: getattr(perfil, campo)
        for campo in (
            "nombre",
            "apellido",
            "email",
            "sexo",
            "avatar",
        )
    }

    if request.method == "POST":
        datos = {
            campo: request.POST.get(campo, "").strip()
            for campo in datos
        }

        try:
            personal = validar_datos_personales(request.POST)

            with transaction.atomic():
                # Se modifica únicamente el perfil autenticado.
                Perfil.objects.filter(
                    pk=perfil.pk,
                    usuario=request.user,
                ).update(**personal)

                # Mantener sincronizados los datos de la cuenta.
                User.objects.filter(
                    pk=request.user.pk,
                ).update(
                    first_name=personal["nombre"],
                    last_name=personal["apellido"],
                    email=personal["email"],
                )

        except ValidationError as exc:
            return render(
                request,
                "Perfil.html",
                contexto_formulario(
                    datos,
                    " ".join(exc.messages),
                ),
            )

        return redirect("selector")

    return render(
        request,
        "Perfil.html",
        contexto_formulario(datos),
    )


# =========================================================
# CERRAR SESIÓN
# =========================================================

def logout_view(request):
    logout(request)
    return redirect("home")


# =========================================================
# SELECTOR Y EXPERIENCIA POR CUBO
# =========================================================

@login_required(login_url="login")
def selector(request):
    perfil = obtener_perfil(request.user)

    guardadas = {
        experiencia.tipo: experiencia
        for experiencia in (
            request.user.experiencias_cubos.all()
        )
    }

    experiencias = []

    for tipo, _ in ExperienciaCubo.TIPOS:
        experiencia = guardadas.get(tipo)

        if experiencia is None:
            # Solo para mostrar nivel 1 y 0 XP.
            # No se generan puntos ni escrituras al visitar la página.
            experiencia = ExperienciaCubo(
                usuario=request.user,
                tipo=tipo,
                experiencia=0,
            )

        experiencias.append(experiencia)

    return render(
        request,
        "Selector.html",
        {
            "perfil_jugador": perfil,
            "experiencias": experiencias,
        },
    )


# =========================================================
# SIMULADORES
# =========================================================

def simulador(request):
    return render(request, "Home.html")


def cuatro_por_cuatro(request):
    return render(request, "CuatroPorCuatro.html")


def desafio(request):
    return render(request, "desafio.html")


def cinco_por_cinco(request):
    return render(request, "CincoPorCinco.html")


def megaminx(request):
    return render(request, "Megaminx.html")


def pyraminx(request):
    return render(request, "Pyraminx.html")


def mirror(request):
    return render(request, "mirror.html")


def seis_por_seis(request):
    return render(request, "SeisPorSeis.html")