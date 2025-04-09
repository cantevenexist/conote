#!/usr/bin/env python

import os
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "NoteCloud_Config.settings")

import django
django.setup()

from django.contrib.auth.models import Group, Permission
from django.contrib.contenttypes.models import ContentType


def add_permissions(group, perms):
    """
    Назначает группе переданный список разрешений.
    perms — список кодовых имен прав (codename).
    """
    for codename in perms:
        try:
            perm = Permission.objects.get(codename=codename)
            group.permissions.add(perm)
            print(f"The '{codename}' right has been assigned to the '{group.name}' group")
        except Permission.DoesNotExist:
            print(f"Warning: permission with codename '{codename}' not found")


def main():
    groups = {
        "администраторы": {
            "permissions": [
                "view_group",
                "view_user", "change_user",
                "add_news", "change_news", "delete_news", "view_news",
                "add_board", "change_board", "delete_board", "view_board",
                "add_comment", "change_comment", "delete_comment", "view_comment",
            ]
        },
        "модераторы": {
            "permissions": [
                "view_board", "delete_board",
                "view_comment", "delete_comment",
                "view_news", "delete_news",
            ]
        },
        "поддержка": {
            "permissions": []
        },
        "редакторы": {
            "permissions": [
                "add_news", "change_news", "delete_news", "view_news",
            ]
        },
    }

    for group_name, data in groups.items():
        group, created = Group.objects.get_or_create(name=group_name)
        if created:
            print(f"Group '{group_name}' created")
        else:
            print(f"The group '{group_name}' already exists")

        add_permissions(group, data["permissions"])


if __name__ == "__main__":
    main()
