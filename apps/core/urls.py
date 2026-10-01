from django.urls import path

from . import views, experiencia, pagos, recuperacion


urlpatterns = [
    # Inicio
    path("", views.home, name="home"),

    # Autenticación
    path("login/", views.login_view, name="login"),
    path("registro/", views.registro_view, name="registro"),
    path("logout/", views.logout_view, name="logout"),

    # Recuperación de contraseña
    path(
        "recuperar/",
        recuperacion.solicitar,
        name="recuperar_clave",
    ),
    path(
        "recuperar/codigo/",
        recuperacion.verificar,
        name="recuperar_codigo",
    ),
    path(
        "recuperar/nueva/",
        recuperacion.nueva,
        name="recuperar_nueva",
    ),

    # Perfil, selector y modos
    path("perfil/", views.perfil_view, name="perfil"),
    path("selector/", views.selector, name="selector"),
    path(
        "ElegirModo/",
        views.ElegirModo,
        name="elegir_modo",
    ),

    # Aprendizaje
    path("aprender/", views.aprender, name="aprender"),
    path(
        "aprender/3x3/",
        views.curso_3x3,
        name="curso_3x3",
    ),

    # Premium y pagos
    path("premium/", views.premium, name="premium"),
    path(
        "premium/pagar/",
        pagos.iniciar,
        name="pago_iniciar",
    ),
    path(
        "premium/resultado/<uuid:orden_id>/",
        pagos.resultado,
        name="pago_resultado",
    ),
    path(
        "pagos/mercadopago/webhook/",
        pagos.webhook,
        name="mp_webhook",
    ),

    # Experiencia por práctica
    path(
        "experiencia/iniciar/",
        experiencia.iniciar,
        name="xp_iniciar",
    ),
    path(
        "experiencia/pulso/",
        experiencia.pulso,
        name="xp_pulso",
    ),

    # Simuladores
    path(
        "simulador/",
        views.simulador,
        name="simulador",
    ),
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
    path(
        "megaminx/",
        views.megaminx,
        name="megaminx",
    ),
    path(
        "pyraminx/",
        views.pyraminx,
        name="pyraminx",
    ),
    path(
        "mirror/",
        views.mirror,
        name="mirror",
    ),
    path(
        "desafio/",
        views.desafio,
        name="desafio",
    ),
]