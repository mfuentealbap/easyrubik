from django.contrib import admin
from .models import Perfil, Cubo, Partida


@admin.register(Perfil)
class PerfilAdmin(admin.ModelAdmin):
    list_display = (
        "usuario",
        "nombre",
        "apellido",
        "email",
        "puntaje_total",
        "nivel",
        "fecha_registro",
    )

    search_fields = (
        "usuario__username",
        "nombre",
        "apellido",
        "email",
    )


@admin.register(Cubo)
class CuboAdmin(admin.ModelAdmin):
    list_display = (
        "nombre",
        "tipo",
        "tamaño",
        "dificultad",
        "activo",
    )

    list_filter = (
        "tipo",
        "dificultad",
        "activo",
    )

    search_fields = (
        "nombre",
        "tipo",
        "tamaño",
    )


@admin.register(Partida)
class PartidaAdmin(admin.ModelAdmin):
    list_display = (
        "usuario",
        "cubo",
        "tiempo",
        "movimientos",
        "puntaje",
        "fecha",
    )

    list_filter = (
        "cubo",
        "fecha",
    )

    search_fields = (
        "usuario__username",
        "cubo__nombre",
    )

