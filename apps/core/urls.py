from django.urls import path
from . import views

urlpatterns = [

    path("", views.home, name="home"),

    # Autenticación
    path("login/", views.login_view, name="login"),
    path("logout/", views.logout_view, name="logout"),

    # Selector
    path("selector/", views.selector, name="selector"),

    # Simuladores
    path("simulador/", views.simulador, name="simulador"),
    path("simulador/4x4/", views.cuatro_por_cuatro, name="cuatro_por_cuatro"),
    path("desafio/", views.desafio, name="desafio"),
    path("5x5x5/", views.cinco_por_cinco, name="cinco_por_cinco"),
    path("megaminx/", views.megaminx, name="megaminx"),
    path("registro/", views.registro_view, name="registro"),
]