"""Ödev sistemi: bireysel atama + Antrenör kaynağı izleme

Revision ID: ClassAssignmentTargets
Revises: GameRatingSnapshot

Madde 2026-09-05: Zafer, Hızlı Erişim/Antrenör'de anlattığı bir konu/altkonu
ile ilgili Hızlı Erişim/Dersler içeriğini (modül/ders) ödev olarak vermek
istiyor — hem TEK bir sporcuya hem de bir SINIFA. `class_assignments` şu ana
kadar sadece sınıfa atanabiliyordu (class_id NOT NULL). Bu migration:
  - `class_id`'yi NULLABLE yapar (bireysel atamada sınıf yok).
  - `target_child_id` ekler (NULLABLE, tek sporcuya atama).
  - `source_custom_tab_section_id` ekler (NULLABLE, ödevin Antrenör'de HANGİ
    Alt Konu anlatılırken verildiğini kaydeder — izlenebilirlik).
  - `teacher_user_id` ekler (NOT NULL, ödevi oluşturan öğretmen — bireysel
    atamalarda `class_id` olmadığı için sahiplik artık DOĞRUDAN bu sütundan
    okunur; `ParentSurvey.created_by_teacher_id` ile AYNI desen).
Uygulama kuralı (kod seviyesinde doğrulanır, DB'de zorunlu kılınmaz — bu
kod tabanında CHECK constraint kullanılmıyor): class_id VEYA
target_child_id'den TAM OLARAK BİRİ dolu olmalı.
"""
import sqlalchemy as sa
from alembic import op

revision = "ClassAssignmentTargets"
down_revision = "GameRatingSnapshot"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "class_assignments",
        sa.Column("target_child_id", sa.Integer(), sa.ForeignKey("child_profiles.id"), nullable=True),
    )
    op.add_column(
        "class_assignments",
        sa.Column("source_custom_tab_section_id", sa.Integer(),
                  sa.ForeignKey("custom_tab_sections.id"), nullable=True),
    )
    # Var olan satırlar hep sınıfa atanmıştı; onları oluşturan öğretmeni
    # ilişkili sınıftan devral (bir kerelik geriye dönük doldurma).
    op.add_column(
        "class_assignments",
        sa.Column("teacher_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
    )
    op.execute(
        "UPDATE class_assignments SET teacher_user_id = "
        "(SELECT teacher_user_id FROM classes WHERE classes.id = class_assignments.class_id) "
        "WHERE teacher_user_id IS NULL"
    )
    op.alter_column("class_assignments", "teacher_user_id", nullable=False)
    op.alter_column("class_assignments", "class_id", nullable=True)
    op.create_index(
        "ix_class_assignments_target_child_id", "class_assignments", ["target_child_id"],
    )
    op.create_index(
        "ix_class_assignments_teacher_user_id", "class_assignments", ["teacher_user_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_class_assignments_teacher_user_id", table_name="class_assignments")
    op.drop_index("ix_class_assignments_target_child_id", table_name="class_assignments")
    op.alter_column("class_assignments", "class_id", nullable=False)
    op.drop_column("class_assignments", "teacher_user_id")
    op.drop_column("class_assignments", "source_custom_tab_section_id")
    op.drop_column("class_assignments", "target_child_id")
