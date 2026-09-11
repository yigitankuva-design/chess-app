# Madde 2026-09-11 (Ödev Sistemi, Faz 4): sporcu "Bildirimler" sekmesi.
# POST /homework her alıcıya type=odev bir Notification satırı üretir;
# bu satırlar visible_from (=start_date) gelene kadar listede görünmez.
import pytest
from datetime import date, timedelta
from httpx import AsyncClient
from chess_api.models import (
    Module, Lesson, LessonStep, LessonStepType, Notification, NotificationType,
    ChildProfile, User, UserRole,
)
from sqlalchemy import select
from tests.test_homework import _teacher2, auth


async def _seed_step(db, title="Tahtanın Özellikleri") -> int:
    m = Module(order_index=1, name="Temel Düzey", description="d", icon="x")
    db.add(m); await db.flush()
    les = Lesson(module_id=m.id, order_index=1, title="Tahta ve Taşlar")
    db.add(les); await db.flush()
    step = LessonStep(lesson_id=les.id, order_index=1, type=LessonStepType.explanation,
                      content_json={"title": title})
    db.add(step); await db.commit()
    return step.id


async def _child_login(client: AsyncClient, pemail: str, name: str = "Ali") -> tuple[str, int]:
    """Tam veli→çocuk→cihaz→PIN akışı — `child_auth` fixture'ıyla AYNI desen,
    ama farklı e-posta/isimle birden çok çocuk kurabilmek için parametrik."""
    r = await client.post("/auth/parent/signup", json={
        "email": pemail, "password": "guvenli12345", "name": "Veli",
    })
    ptok = r.json()["access_token"]
    r = await client.post("/children", headers=auth(ptok),
                          json={"display_name": name, "age": 9, "pin": "1234"})
    child_id = r.json()["id"]
    await client.post("/auth/device/register", headers=auth(ptok),
                      json={"device_fingerprint": f"dev-{pemail}", "name": "Test"})
    r = await client.post("/auth/child/pin", json={
        "child_profile_id": child_id, "pin": "1234", "device_fingerprint": f"dev-{pemail}",
    })
    return r.json()["access_token"], child_id


def ch(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_odev_gonderilince_bildirim_olusur_ve_listede_gorunur(client, db):
    tok, teacher_id = await _teacher2(client, "n1@t.com")
    step_id = await _seed_step(db, "Merkez")
    child_tok, c1 = await _child_login(client, "n1p@t.com", "Ali")
    child = await db.get(ChildProfile, c1)
    child.teacher_user_id = teacher_id
    await db.commit()

    today = date.today().isoformat()
    r = await client.post("/homework", headers=auth(tok), json={
        "lesson_step_id": step_id, "child_ids": [c1], "start_date": today,
    })
    assert r.status_code == 201

    r2 = await client.get("/notifications", headers=ch(child_tok))
    assert r2.status_code == 200
    body = r2.json()
    assert body["unread_count"] == 1
    assert len(body["items"]) == 1
    item = body["items"][0]
    assert item["type"] == "odev"
    assert "Merkez" in item["title"]
    assert item["subtitle"] == "Temel Düzey › Tahta ve Taşlar"
    assert item["visited_at"] is None
    assert item["target"]["lesson_step_id"] == step_id


@pytest.mark.asyncio
async def test_baslangic_tarihinden_once_bildirim_gorunmez(client, db):
    tok, teacher_id = await _teacher2(client, "n2@t.com")
    step_id = await _seed_step(db)
    child_tok, c1 = await _child_login(client, "n2p@t.com")
    child = await db.get(ChildProfile, c1)
    child.teacher_user_id = teacher_id
    await db.commit()

    future = (date.today() + timedelta(days=5)).isoformat()
    await client.post("/homework", headers=auth(tok), json={
        "lesson_step_id": step_id, "child_ids": [c1], "start_date": future,
    })

    r = await client.get("/notifications", headers=ch(child_tok))
    body = r.json()
    assert body["items"] == []
    assert body["unread_count"] == 0


@pytest.mark.asyncio
async def test_git_ile_ziyaret_isaretlenir_ve_tekrar_okunmaz_sayilmaz(client, db):
    tok, teacher_id = await _teacher2(client, "n3@t.com")
    step_id = await _seed_step(db)
    child_tok, c1 = await _child_login(client, "n3p@t.com")
    child = await db.get(ChildProfile, c1)
    child.teacher_user_id = teacher_id
    await db.commit()
    await client.post("/homework", headers=auth(tok), json={
        "lesson_step_id": step_id, "child_ids": [c1], "start_date": date.today().isoformat(),
    })
    notif_id = (await client.get("/notifications", headers=ch(child_tok))).json()["items"][0]["id"]

    r = await client.post(f"/notifications/{notif_id}/visit", headers=ch(child_tok))
    assert r.status_code == 200
    assert r.json()["visited_at"] is not None

    r2 = await client.get("/notifications", headers=ch(child_tok))
    body = r2.json()
    assert body["unread_count"] == 0
    assert body["items"][0]["visited_at"] is not None


@pytest.mark.asyncio
async def test_baska_cocugun_bildirimi_ziyaret_edilemez(client, db):
    tok, teacher_id = await _teacher2(client, "n4@t.com")
    step_id = await _seed_step(db)
    _, c1 = await _child_login(client, "n4p1@t.com")
    other_tok, _c2 = await _child_login(client, "n4p2@t.com")
    child = await db.get(ChildProfile, c1)
    child.teacher_user_id = teacher_id
    await db.commit()
    await client.post("/homework", headers=auth(tok), json={
        "lesson_step_id": step_id, "child_ids": [c1], "start_date": date.today().isoformat(),
    })
    notif = (await db.execute(select(Notification).where(Notification.child_id == c1))).scalar_one()

    r = await client.post(f"/notifications/{notif.id}/visit", headers=ch(other_tok))
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_hic_odev_gonderilmemis_sporcuda_bos_liste(client, db):
    child_tok, _c1 = await _child_login(client, "n5p@t.com")
    r = await client.get("/notifications", headers=ch(child_tok))
    assert r.status_code == 200
    assert r.json() == {"unread_count": 0, "items": []}


@pytest.mark.asyncio
async def test_farkli_turlerin_hepsi_gecerli_enum(client, db):
    # Madde 2026-09-11 (Görsel Turu Aşama E / Madde 9): hoca_notu eklendi.
    assert {t.value for t in NotificationType} == {
        "odev", "turnuva", "online_ders", "pratik", "mac", "eglence", "hoca_notu",
    }


@pytest.mark.asyncio
async def test_adim_silinince_bildirim_de_silinir(client, db):
    tok, teacher_id = await _teacher2(client, "n6@t.com")
    step_id = await _seed_step(db)
    _child_tok, c1 = await _child_login(client, "n6p@t.com")
    child = await db.get(ChildProfile, c1)
    child.teacher_user_id = teacher_id
    await db.commit()
    await client.post("/homework", headers=auth(tok), json={
        "lesson_step_id": step_id, "child_ids": [c1], "start_date": date.today().isoformat(),
    })
    assert (await db.execute(
        select(Notification).where(Notification.child_id == c1)
    )).scalar_one_or_none() is not None

    admin_r = await client.post("/auth/teacher/signup", json={
        "email": "n6admin@t.com", "password": "guvenli12345", "name": "Admin",
    })
    admin_user = await db.get(User, admin_r.json()["user_id"])
    admin_user.role = UserRole.admin
    await db.commit()
    admin_tok = admin_r.json()["access_token"]

    r = await client.delete(f"/admin/steps/{step_id}", headers=auth(admin_tok))
    assert r.status_code == 200
    assert (await db.execute(
        select(Notification).where(Notification.child_id == c1)
    )).scalar_one_or_none() is None


@pytest.mark.asyncio
async def test_cocuk_silinince_bildirimleri_de_silinir(client, db):
    from chess_api.services.child_deletion import delete_child_cascade
    tok, teacher_id = await _teacher2(client, "n7@t.com")
    step_id = await _seed_step(db)
    _child_tok, c1 = await _child_login(client, "n7p@t.com")
    child = await db.get(ChildProfile, c1)
    child.teacher_user_id = teacher_id
    await db.commit()
    await client.post("/homework", headers=auth(tok), json={
        "lesson_step_id": step_id, "child_ids": [c1], "start_date": date.today().isoformat(),
    })

    child = await db.get(ChildProfile, c1)
    await delete_child_cascade(db, child)
    await db.commit()
    assert (await db.execute(
        select(Notification).where(Notification.child_id == c1)
    )).scalar_one_or_none() is None
