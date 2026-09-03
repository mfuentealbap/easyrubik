from django.core.serializers import python
from django.shortcuts import render


def home(request):
    return render(request, "HomeEasyRubik.html")


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