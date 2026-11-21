"""Buat / promosikan akun admin atau staff.

Contoh:
    uv run python -m app.scripts.create_admin \
        --email admin@toko.com --password 'rahasia123' --name "Admin Toko"

    uv run python -m app.scripts.create_admin \
        --email staff@toko.com --password 'rahasia123' --role staff
"""

from __future__ import annotations

import argparse
import sys

from sqlalchemy import select

from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models import Role, User


def main() -> int:
    parser = argparse.ArgumentParser(description="Buat akun admin/staff")
    parser.add_argument("--email", required=True)
    parser.add_argument("--password", required=True)
    parser.add_argument("--name", default=None)
    parser.add_argument("--role", choices=["admin", "staff"], default="admin")
    args = parser.parse_args()

    email = args.email.strip().lower()
    name = (args.name or args.role.capitalize()).strip()

    if not args.password:
        print("Password tidak boleh kosong", file=sys.stderr)
        return 1
    if len(args.password) < 8:
        print(
            "PERINGATAN: password kurang dari 8 karakter, tidak disarankan untuk production",
            file=sys.stderr,
        )

    with SessionLocal() as db:
        role = db.scalar(select(Role).where(Role.name == args.role))
        if role is None:
            print(
                "Role belum ada. Jalankan dulu: uv run alembic upgrade head",
                file=sys.stderr,
            )
            return 1

        user = db.scalar(select(User).where(User.email == email))
        if user is None:
            user = User(
                name=name,
                email=email,
                password_hash=hash_password(args.password),
                is_active=True,
            )
            db.add(user)
            action = "dibuat"
        else:
            user.password_hash = hash_password(args.password)
            user.is_active = True
            action = "diperbarui"

        if role not in user.roles:
            user.roles.append(role)

        db.commit()
        db.refresh(user)

    print(f"Akun {args.role} {email} berhasil {action} (id={user.id}).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
