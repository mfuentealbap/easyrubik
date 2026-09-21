from django.urls import path
from . import views


urlpatterns = [
    # Inicio
    path("", views.home, name="home"),

    # Autenticación
    path("login/", views.login_view, name="login"),
    path("registro/", views.registro_view, name="registro"),
    path("logout/", views.logout_view, name="logout"),

    # Perfil y selector
    path("perfil/", views.perfil_view, name="perfil"),
    path("selector/", views.selector, name="selector"),

    # Simuladores
    path("simulador/", views.simulador, name="simulador"),

    path(
        "simulador/4x4/",
        views.cuatro_por_cuatro,
        name="cuatro_por_cuatro",
    ),

    path(
        "5x5x5/",
        views.cinco_por_cinco,
        name="cinco_por_cinco",
    ),

    path(
        "6x6x6/",
        views.seis_por_seis,
        name="seis_por_seis",
    ),

    path("megaminx/", views.megaminx, name="megaminx"),
    path("pyraminx/", views.pyraminx, name="pyraminx"),
    path("mirror/", views.mirror, name="mirror"),

    # Desafío
    path("desafio/", views.desafio, name="desafio"),
]