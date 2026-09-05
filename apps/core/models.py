from django.db import models
from django.contrib.auth.models import User


class Perfil(models.Model):
    usuario = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="perfil"
    )

    nombre = models.CharField(
        max_length=100,
        blank=True
    )

    apellido = models.CharField(
        max_length=100,
        blank=True
    )

    email = models.EmailField(
        blank=True
    )

    puntaje_total = models.PositiveIntegerField(
        default=0
    )

    nivel = models.PositiveIntegerField(
        default=1
    )

    fecha_registro = models.DateTimeField(
        auto_now_add=True
    )

    def __str__(self):
        return self.usuario.username


class Cubo(models.Model):
    nombre = models.CharField(
        max_length=100
    )

    tipo = models.CharField(
        max_length=50
    )

    tamaño = models.CharField(
        max_length=20
    )

    dificultad = models.CharField(
        max_length=30
    )

    descripcion = models.TextField(
        blank=True
    )

    activo = models.BooleanField(
        default=True
    )

    def __str__(self):
        return self.nombre


class Partida(models.Model):
    usuario = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="partidas"
    )

    cubo = models.ForeignKey(
        Cubo,
        on_delete=models.CASCADE,
        related_name="partidas"
    )

    tiempo = models.DecimalField(
        max_digits=8,
        decimal_places=2
    )

    movimientos = models.PositiveIntegerField(
        default=0
    )

    puntaje = models.PositiveIntegerField(
        default=0
    )

    fecha = models.DateTimeField(
        auto_now_add=True
    )

    def __str__(self):
        return f"{self.usuario.username} - {self.cubo.nombre}"

