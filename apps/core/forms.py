from django import forms


class RecuperarPasswordForm(forms.Form):
    username = forms.CharField(
        label="Nombre de usuario",
        max_length=150,
        widget=forms.TextInput(
            attrs={
                "placeholder": "Tu nombre de usuario",
                "autocomplete": "username",
            }
        ),
    )