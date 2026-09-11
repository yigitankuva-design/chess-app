# Madde 2026-09-11 (Ödev Sistemi, Faz 3): antrenör bir Alt Konu'yu (lesson_step)
# sporcu(lar)a ödev olarak gönderir. Eski ClassAssignment/GRUP D tamamen kaldırıldı.
import pytest
from httpx import AsyncClient
from chess_api.models import (
    Module, Lesson, LessonStep, LessonStepType, CustomTab, CustomTabSection,
    Homework, HomeworkRecipient, Class, ChildProfile,
)
from sqlalchemy import select


def auth(t: str) -> dict:
    return {"Authorization": f"Bearer {t}"}


async def _teacher(client: AsyncClient, email: str) -> str:
    r = await client.post("/auth/teacher/signup", json={
        "email": email, "password": "guvenli12345", "name": "Hoca",
    })
    assert r.status_code == 201, r.text
    return r.json()["access_token"]


async def _teacher2(client: AsyncClient, email: str) -> tuple[str, int]:
    r = await client.post("/auth/teacher/signup", json={
        "email": email, "password": "guvenli12345", "name": "Hoca",
    })
    assert r.status_code == 201, r.text
    return r.json()["access_token"], r.json()["user_id"]


async def _parent_child(client: AsyncClient, pemail: str, name: str = "Ali") -> tuple[str, int]:
    r = await client.post("/auth/parent/signup", json={
        "email": pemail, "password": "guvenli12345", "name": "Veli",
    })
    ptok = r.json()["access_token"]
    r = await client.post("/children", headers=auth(ptok),
                          json={"display_name": name, "age": 9, "pin": "1234"})
    return ptok, r.json()["id"]


async def _seed_step(db, title="Tahtanın Özellikleri") -> int:
    m = Module(order_index=1, name="Temel Düzey", description="d", icon="x")
    db.add(m); await db.flush()
    les = Lesson(module_id=m.id, order_index=1, title="Tahta ve Taşlar")
    db.add(les); await db.flush()
    step = LessonStep(lesson_id=les.id, order_index=1, type=LessonStepType.explanation,
                      content_json={"title": title})
    db.add(step); await db.commit()
    return step.id


async def _seed_section(db, linked_step_id: int | None) -> int:
    tab = CustomTab(order_index=1, label="Çalışmalar", emoji="🎓")
    db.add(tab); await db.flush()
    sec = CustomTabSection(custom_tab_id=tab.id, parent_id=None, order_index=1,
                           title="Alt Konu", body="", images=[],
                           linked_lesson_step_id=linked_step_id)
    db.add(sec); await db.commit()
    return sec.id


@pytest.mark.asyncio
async def test_target_baglı_ise_baslik_zincirini_doner(client, db):
    tok = await _teacher(client, "hwt1@t.com")
    step_id = await _seed_step(db, "Tahtanın Özellikleri")
    sec_id = await _seed_section(db, step_id)

    r = await client.get("/homework/target", headers=auth(tok), params={"section_id": sec_id})
    assert r.status_code == 200
    body = r.json()
    assert body["linked"] is True
    assert body["lesson_step_id"] == step_id
    assert body["alt_konu_title"] == "Tahtanın Özellikleri"
    assert body["konu_title"] == "Tahta ve Taşlar"
    assert body["duzey_title"] == "Temel Düzey"


@pytest.mark.asyncio
async def test_target_baglı_degil_ise_linked_false(client, db):
    tok = await _teacher(client, "hwt2@t.com")
    sec_id = await _seed_section(db, None)
    r = await client.get("/homework/target", headers=auth(tok), params={"section_id": sec_id})
    assert r.status_code == 200
    assert r.json()["linked"] is False


@pytest.mark.asyncio
async def test_odev_tek_tek_secilen_sporculara_gonderilir(client, db):
    tok, teacher_id = await _teacher2(client, "hw1@t.com")
    step_id = await _seed_step(db)
    _, c1 = await _parent_child(client, "hwp1@t.com", "Ali")
    _, c2 = await _parent_child(client, "hwp2@t.com", "Veli")
    # İkisini de bu antrenörün öğrencisi yap (teacher_user_id).
    for cid in (c1, c2):
        child = await db.get(ChildProfile, cid)
        child.teacher_user_id = teacher_id
    await db.commit()

    r = await client.post("/homework", headers=auth(tok), json={
        "lesson_step_id": step_id, "child_ids": [c1, c2],
        "start_date": "2026-09-15", "end_date": "2026-09-30", "note": "Bol pratik",
    })
    assert r.status_code == 201, r.text
    assert r.json()["recipient_count"] == 2

    hw_id = r.json()["id"]
    recs = (await db.execute(
        select(HomeworkRecipient).where(HomeworkRecipient.homework_id == hw_id)
    )).scalars().all()
    assert {rr.child_id for rr in recs} == {c1, c2}
    assert all(rr.via_class_id is None for rr in recs)
    hw = await db.get(Homework, hw_id)
    assert hw.note == "Bol pratik"
    assert hw.start_date.isoformat() == "2026-09-15"


@pytest.mark.asyncio
async def test_tum_sinif_secilince_mevcut_ogrencilere_acilir(client, db):
    tok = await _teacher(client, "hw2@t.com")
    step_id = await _seed_step(db)
    cls_r = await client.post("/teacher/classes", headers=auth(tok), json={"name": "Sınıf A"})
    class_id = cls_r.json()["id"]
    _, c1 = await _parent_child(client, "hwc1@t.com", "A")
    _, c2 = await _parent_child(client, "hwc2@t.com", "B")
    for cid in (c1, c2):
        await client.post(f"/teacher/classes/{class_id}/students/{cid}", headers=auth(tok))

    r = await client.post("/homework", headers=auth(tok), json={
        "lesson_step_id": step_id, "class_ids": [class_id], "start_date": "2026-09-15",
    })
    assert r.status_code == 201, r.text
    assert r.json()["recipient_count"] == 2
    recs = (await db.execute(
        select(HomeworkRecipient).where(HomeworkRecipient.homework_id == r.json()["id"])
    )).scalars().all()
    assert all(rr.via_class_id == class_id for rr in recs)


@pytest.mark.asyncio
async def test_baska_antrenorun_sinifina_odev_gonderilemez(client, db):
    tok_a = await _teacher(client, "hwA@t.com")
    tok_b = await _teacher(client, "hwB@t.com")
    step_id = await _seed_step(db)
    cls_r = await client.post("/teacher/classes", headers=auth(tok_a), json={"name": "A sınıfı"})
    class_id = cls_r.json()["id"]

    r = await client.post("/homework", headers=auth(tok_b), json={
        "lesson_step_id": step_id, "class_ids": [class_id], "start_date": "2026-09-15",
    })
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_baska_antrenorun_ogrencisine_odev_gonderilemez(client, db):
    tok = await _teacher(client, "hw3@t.com")
    step_id = await _seed_step(db)
    _, c1 = await _parent_child(client, "hwx1@t.com")  # hiçbir antrenöre bağlı değil

    r = await client.post("/homework", headers=auth(tok), json={
        "lesson_step_id": step_id, "child_ids": [c1], "start_date": "2026-09-15",
    })
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_alici_yoksa_422(client, db):
    tok = await _teacher(client, "hw4@t.com")
    step_id = await _seed_step(db)
    r = await client.post("/homework", headers=auth(tok), json={
        "lesson_step_id": step_id, "start_date": "2026-09-15",
    })
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_bitis_baslangictan_once_ise_422(client, db):
    tok = await _teacher(client, "hw5@t.com")
    step_id = await _seed_step(db)
    cls_r = await client.post("/teacher/classes", headers=auth(tok), json={"name": "S"})
    class_id = cls_r.json()["id"]
    _, c1 = await _parent_child(client, "hwe1@t.com")
    await client.post(f"/teacher/classes/{class_id}/students/{c1}", headers=auth(tok))

    r = await client.post("/homework", headers=auth(tok), json={
        "lesson_step_id": step_id, "class_ids": [class_id],
        "start_date": "2026-09-30", "end_date": "2026-09-01",
    })
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_olmayan_step_404(client, db):
    tok = await _teacher(client, "hw6@t.com")
    r = await client.post("/homework", headers=auth(tok), json={
        "lesson_step_id": 999999, "child_ids": [1], "start_date": "2026-09-15",
    })
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_gonderilenler_listesi(client, db):
    tok = await _teacher(client, "hw7@t.com")
    step_id = await _seed_step(db, "Merkez")
    cls_r = await client.post("/teacher/classes", headers=auth(tok), json={"name": "S7"})
    class_id = cls_r.json()["id"]
    _, c1 = await _parent_child(client, "hwg1@t.com", "Deniz")
    await client.post(f"/teacher/classes/{class_id}/students/{c1}", headers=auth(tok))
    await client.post("/homework", headers=auth(tok), json={
        "lesson_step_id": step_id, "class_ids": [class_id], "start_date": "2026-09-15",
        "note": "not",
    })

    r = await client.get("/homework/sent", headers=auth(tok))
    assert r.status_code == 200
    data = r.json()
    assert len(data) == 1
    assert data[0]["alt_konu_title"] == "Merkez"
    assert data[0]["recipient_count"] == 1
    assert data[0]["recipient_names"] == ["Deniz"]


@pytest.mark.asyncio
async def test_odev_ucları_sadece_antrenor(client, db):
    r1 = await client.post("/homework", json={"lesson_step_id": 1, "start_date": "2026-09-15"})
    r2 = await client.get("/homework/target", params={"section_id": 1})
    assert r1.status_code in (401, 403)
    assert r2.status_code in (401, 403)


async def _admin_token(client, db, email):
    r = await client.post("/auth/teacher/signup", json={
        "email": email, "password": "guvenli12345", "name": "Admin",
    })
    from chess_api.models import User, UserRole
    u = await db.get(User, r.json()["user_id"])
    u.role = UserRole.admin
    await db.commit()
    return r.json()["access_token"]


@pytest.mark.asyncio
async def test_adim_silinince_odev_de_silinir(client, db):
    tok, teacher_id = await _teacher2(client, "hwds1@t.com")
    step_id = await _seed_step(db)
    _, c1 = await _parent_child(client, "hwds_p1@t.com")
    child = await db.get(ChildProfile, c1)
    child.teacher_user_id = teacher_id
    await db.commit()
    hw_r = await client.post("/homework", headers=auth(tok), json={
        "lesson_step_id": step_id, "child_ids": [c1], "start_date": "2026-09-15",
    })
    hw_id = hw_r.json()["id"]

    atok = await _admin_token(client, db, "hwds_admin@t.com")
    r = await client.delete(f"/admin/steps/{step_id}", headers=auth(atok))
    assert r.status_code == 200
    assert await db.get(Homework, hw_id) is None
    recs = (await db.execute(
        select(HomeworkRecipient).where(HomeworkRecipient.homework_id == hw_id)
    )).scalars().all()
    assert recs == []


@pytest.mark.asyncio
async def test_kaynak_bolum_silinince_odev_kalir_bag_kopar(client, db):
    tok, teacher_id = await _teacher2(client, "hwsrc1@t.com")
    step_id = await _seed_step(db)
    sec_id = await _seed_section(db, step_id)
    _, c1 = await _parent_child(client, "hwsrc_p1@t.com")
    child = await db.get(ChildProfile, c1)
    child.teacher_user_id = teacher_id
    await db.commit()
    hw_r = await client.post("/homework", headers=auth(tok), json={
        "lesson_step_id": step_id, "source_section_id": sec_id, "child_ids": [c1],
        "start_date": "2026-09-15",
    })
    hw_id = hw_r.json()["id"]

    atok = await _admin_token(client, db, "hwsrc_admin@t.com")
    r = await client.delete(f"/admin/custom-tab-sections/{sec_id}", headers=auth(atok))
    assert r.status_code == 200
    hw = await db.get(Homework, hw_id)
    assert hw is not None
    assert hw.source_custom_tab_section_id is None


@pytest.mark.asyncio
async def test_cocuk_silinince_alici_kaydi_silinir_odev_kalir(client, db):
    from chess_api.services.child_deletion import delete_child_cascade
    tok, teacher_id = await _teacher2(client, "hw8@t.com")
    step_id = await _seed_step(db)
    _, c1 = await _parent_child(client, "hwd1@t.com")
    child = await db.get(ChildProfile, c1)
    child.teacher_user_id = teacher_id
    await db.commit()
    hw_r = await client.post("/homework", headers=auth(tok), json={
        "lesson_step_id": step_id, "child_ids": [c1], "start_date": "2026-09-15",
    })
    hw_id = hw_r.json()["id"]

    child = await db.get(ChildProfile, c1)
    await delete_child_cascade(db, child)
    await db.commit()

    assert await db.get(Homework, hw_id) is not None
    recs = (await db.execute(
        select(HomeworkRecipient).where(HomeworkRecipient.homework_id == hw_id)
    )).scalars().all()
    assert recs == []
