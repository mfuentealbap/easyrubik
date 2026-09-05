from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import login_required
from django.contrib.auth.models import User
from django.shortcuts import render, redirect

from .models import Perfil


def home(request):
    return render(request, "HomeEasyRubik.html")


def login_view(request):

    if request.user.is_authenticated:
        return redirect("selector")

    if request.method == "POST":

        username = request.POST.get("username", "").strip()
        password = request.POST.get("password", "")

        user = authenticate(
            request,
            username=username,
            password=password
        )

        if user is not None:
            login(request, user)
            return redirect("selector")

        return render(
            request,
            "Login.html",
            {
                "error": "Usuario o contraseña incorrectos."
            }
        )

    return render(request, "Login.html")


def registro_view(request):

    if request.user.is_authenticated:
        return redirect("selector")

    if request.method == "POST":

        username = request.POST.get("username", "").strip()
        password = request.POST.get("password", "")
        password2 = request.POST.get("password2", "")

        nombre = request.POST.get("nombre", "").strip()
        apellido = request.POST.get("apellido", "").strip()
        email = request.POST.get("email", "").strip()

        # Comprobar usuario
        if not username:
            return render(
                request,
                "Registro.html",
                {"error": "Debes ingresar un nombre de usuario."}
            )

        # Comprobar contraseñas
        if password != password2:
            return render(
                request,
                "Registro.html",
                {"error": "Las contraseñas no coinciden."}
            )

        # Comprobar usuario existente
        if User.objects.filter(username=username).exists():
            return render(
                request,
                "Registro.html",
                {"error": "Ese nombre de usuario ya está registrado."}
            )

        # Crear usuario
        user = User.objects.create_user(
            username=username,
            password=password,
            email=email
        )

        # Crear perfil asociado al usuario
        Perfil.objects.create(
            usuario=user,
            nombre=nombre,
            apellido=apellido,
            email=email
        )

        # Iniciar sesión automáticamente
        login(request, user)

        return redirect("selector")

    return render(request, "Registro.html")


def logout_view(request):
    logout(request)
    return redirect("home")


@login_required(login_url="login")
def selector(request):
    return render(request, "Selector.html")


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

