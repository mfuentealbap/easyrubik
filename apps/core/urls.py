from django.urls import path
from . import views

urlpatterns = [
path("", views.home, name="home"),
path("simulador/", views.simulador, name="simulador"),
]
