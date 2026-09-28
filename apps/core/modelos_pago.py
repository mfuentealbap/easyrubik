import uuid

from django.conf import settings
from django.db import models


class PagoPremium(models.Model):
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="pagos_premium",
    )

    monto = models.PositiveIntegerField(
        default=2000,
    )

    moneda = models.CharField(
        max_length=3,
        default="CLP",
    )

    vendedor_id = models.CharField(
        max_length=40,
    )

    produccion = models.BooleanField(
        default=False,
    )

    preferencia_id = models.CharField(
        max_length=200,
        blank=True,
    )

    checkout_url = models.URLField(
        max_length=1000,
        blank=True,
    )

    pago_externo_id = models.CharField(
        max_length=100,
        unique=True,
        null=True,
        blank=True,
    )

    estado = models.CharField(
        max_length=40,
        default="creado",
    )

    creado = models.DateTimeField(
        auto_now_add=True,
    )

    aprobado = models.DateTimeField(
        null=True,
        blank=True,
    )

    actualizado_mp = models.DateTimeField(
        null=True,
        blank=True,
    )

    acceso_inicio = models.DateTimeField(
        null=True,
        blank=True,
    )

    acceso_fin = models.DateTimeField(
        null=True,
        blank=True,
    )

    dia_ancla = models.PositiveSmallIntegerField(
        null=True,
        blank=True,
    )

    aplicado = models.BooleanField(
        default=False,
    )

    acceso_revocado = models.BooleanField(
        default=False,
    )

    requiere_revision = models.BooleanField(
        default=False,
    )

    class Meta:
        ordering = ["-creado"]

    def __str__(self):
        return (
            f"{self.usuario_id} · "
            f"{self.monto} {self.moneda} · "
            f"{self.estado}"
        )