from django.contrib import admin
from .models import User

@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ('id','email', 'name', 'is_admin', 'is_active', 'created_at', 'updated_at')
    search_fields = ('email', 'name')