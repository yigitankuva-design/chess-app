"""assign admin role to zfrdnc25@gmail.com

Revision ID: AdminAccountAssign
Revises: AdminRole
Create Date: 2026-09-07 00:00:01.000000

Madde 2026-09-07 (Antrenör Paneli, 5-6): gerçek yönetici rolünü
"teacher"dan ayırmanın İKİNCİ (ve son) adımı — Zafer'in gerçek giriş
maili (zfrdnc25@gmail.com) 'admin' rolüne geçirilir. BİLEREK bu, önceki
'AdminRole' migration'ından (SADECE enum'a değer ekleyen) AYRI, SONRAKİ
bir deploy'da yapılıyor — PostgreSQL bir transaction içinde ENUM'a
eklenen değeri AYNI transaction'da KULLANMAYA izin vermiyor;
'AdminRole' migration'ı ÖNCEKİ bir deploy'da (preDeployCommand) zaten
çalışıp commit edildiği için burada 'admin' değerini kullanmak GÜVENLİ.

Hesap zaten var olmalı (Zafer bu maille daha önce "teacher" rolüyle
kayıt oldu) — yoksa bu migration hiçbir satırı etkilemeden sessizce
geçer (WHERE eşleşmez).
"""
from alembic import op

revision = 'AdminAccountAssign'
down_revision = 'AdminRole'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "UPDATE users SET role = 'admin' WHERE email = 'zfrdnc25@gmail.com'"
    )


def downgrade() -> None:
    op.execute(
        "UPDATE users SET role = 'teacher' WHERE email = 'zfrdnc25@gmail.com'"
    )
