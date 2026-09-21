from django.db import models
from django.contrib.auth.models import User


class Perfil(models.Model):
    SEXOS = [
        ("", "Prefiero no indicarlo"),
        ("f", "Femenino"),
        ("m", "Masculino"),
        ("otro", "Otro"),
    ]

    AVATARES = [
        ("cubo", "🧩 Cubo"),
        ("rayo", "⚡ Rayo"),
        ("cohete", "🚀 Cohete"),
        ("estrella", "⭐ Estrella"),
    ]

    usuario = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="perfil",
    )

    nombre = models.CharField(
        max_length=100,
        blank=True,
    )

    apellido = models.CharField(
        max_length=100,
        blank=True,
    )

    email = models.EmailField(
        blank=True,
    )

    sexo = models.CharField(
        max_length=10,
        choices=SEXOS,
        blank=True,
        default="",
    )

    avatar = models.CharField(
        max_length=20,
        choices=AVATARES,
        default="cubo",
    )

    # Conservamos estos campos y los datos existentes.
    # La experiencia de cada cubo se guarda en ExperienciaCubo.
    puntaje_total = models.PositiveIntegerField(
        default=0,
    )

    nivel = models.PositiveIntegerField(
        default=1,
    )

    fecha_registro = models.DateTimeField(
        auto_now_add=True,
    )

    @property
    def nombre_jugador(self):
        return self.usuario.username

    @property
    def avatar_icono(self):
        etiqueta = dict(self.AVATARES).get(
            self.avatar,
            "🧩 Cubo",
        )
        return etiqueta.split()[0]

    def __str__(self):
        return self.usuario.username


class Cubo(models.Model):
    nombre = models.CharField(
        max_length=100,
    )

    tipo = models.CharField(
        max_length=50,
    )

    tamaño = models.CharField(
        max_length=20,
    )

    dificultad = models.CharField(
        max_length=30,
    )

    descripcion = models.TextField(
        blank=True,
    )

    activo = models.BooleanField(
        default=True,
    )

    def __str__(self):
        return self.nombre


class Partida(models.Model):
    usuario = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="partidas",
    )

    cubo = models.ForeignKey(
        Cubo,
        on_delete=models.CASCADE,
        related_name="partidas",
    )

    tiempo = models.DecimalField(
        max_digits=8,
        decimal_places=2,
    )

    movimientos = models.PositiveIntegerField(
        default=0,
    )

    puntaje = models.PositiveIntegerField(
        default=0,
    )

    fecha = models.DateTimeField(
        auto_now_add=True,
    )

    def __str__(self):
        return f"{self.usuario.username} - {self.cubo.nombre}"


class ExperienciaCubo(models.Model):
    TIPOS = [
        ("3x3", "3×3×3"),
        ("4x4", "4×4×4"),
        ("5x5", "5×5×5"),
        ("6x6", "6×6×6"),
        ("mirror", "Mirror"),
        ("megaminx", "Megaminx"),
        ("pyraminx", "Pyraminx"),
    ]

    usuario = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="experiencias_cubos",
    )

    tipo = models.CharField(
        max_length=20,
        choices=TIPOS,
    )

    experiencia = models.PositiveIntegerField(
        default=0,
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["usuario", "tipo"],
                name="core_xp_usuario_tipo_unico",
            ),
        ]

    @staticmethod
    def umbral(nivel):
        """Experiencia total necesaria para alcanzar un nivel."""
        return 50 * nivel * (nivel - 1)

    @property
    def nivel(self):
        """Calcula el nivel actual, con un máximo de 30."""
        return max(
            numero
            for numero in range(1, 31)
            if self.experiencia >= self.umbral(numero)
        )

    @property
    def porcentaje(self):
        """Progreso entre el nivel actual y el siguiente."""
        actual = self.nivel

        if actual == 30:
            return 100

        inicio = self.umbral(actual)
        siguiente = self.umbral(actual + 1)

        return int(
            100 * (self.experiencia - inicio)
            / (siguiente - inicio)
        )

    @property
    def faltante(self):
        """Experiencia que falta para subir de nivel."""
        actual = self.nivel

        if actual == 30:
            return 0

        return self.umbral(actual + 1) - self.experiencia

    def __str__(self):
        return (
            f"{self.usuario.username} - "
            f"{self.get_tipo_display()} - "
            f"Nivel {self.nivel}"
        )