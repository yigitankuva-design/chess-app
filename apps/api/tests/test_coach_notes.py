# Madde 2026-09-11 (Görsel Turu Aşama E / Madde 9): antrenörün bir sporcunun
# profiline yazdığı not — SADECE SON not tutulur (S4: silinebilir, düzenlenmez),
# yazıldığında sporcuya bir NotificationType.hoca_notu bildirimi düşer.
import pytest
from chess_api.models import ChildProfile
from tests.test_notifications import _child_login, ch
from tests.test_homework import _teacher2, auth


@pytest.mark.asyncio
async def test_antrenor_not_yazar_sporcu_kendi_profilinde_gorur(client, db):
    tok, teacher_id = await _teacher2(client, "cn1@t.com")
    ctok, cid = await _child_login(client, "cn1a@t.com", "Ali Veli")
    child = await db.get(ChildProfile, cid)
    child.teacher_user_id = teacher_id
    await db.commit()

    r = await client.put(f"/teacher/students/{cid}/note", headers=auth(tok), json={"text": "Açılışta daha dikkatli ol."})
    assert r.status_code == 200, r.text
    assert r.json()["text"] == "Açılışta daha dikkatli ol."
    assert r.json()["teacher_name"] == "Hoca"
    assert r.json()["created_at"]

    me = await client.get("/gamification/me", headers=ch(ctok))
    assert me.json()["coach_note"] == {
        "text": "Açılışta daha dikkatli ol.", "teacher_name": "Hoca",
        "created_at": r.json()["created_at"],
    }


@pytest.mark.asyncio
async def test_not_yazinca_bildirim_dusuyor(client, db):
    tok, teacher_id = await _teacher2(client, "cn2@t.com")
    ctok, cid = await _child_login(client, "cn2a@t.com")
    child = await db.get(ChildProfile, cid)
    child.teacher_user_id = teacher_id
    await db.commit()

    await client.put(f"/teacher/students/{cid}/note", headers=auth(tok), json={"text": "Aferin, çok çalışıyorsun!"})

    notifs = await client.get("/notifications", headers=ch(ctok))
    items = notifs.json()["items"]
    assert len(items) == 1
    assert items[0]["type"] == "hoca_notu"
    assert "Hoca" in items[0]["title"]
    assert items[0]["subtitle"] == "Aferin, çok çalışıyorsun!"
    assert notifs.json()["unread_count"] == 1


@pytest.mark.asyncio
async def test_ikinci_kez_yazinca_eskisinin_uzerine_yazar_ama_ikinci_bildirim_dusuyor(client, db):
    tok, teacher_id = await _teacher2(client, "cn3@t.com")
    ctok, cid = await _child_login(client, "cn3a@t.com")
    child = await db.get(ChildProfile, cid)
    child.teacher_user_id = teacher_id
    await db.commit()

    await client.put(f"/teacher/students/{cid}/note", headers=auth(tok), json={"text": "İlk not"})
    r2 = await client.put(f"/teacher/students/{cid}/note", headers=auth(tok), json={"text": "İkinci not"})
    assert r2.json()["text"] == "İkinci not"

    me = await client.get("/gamification/me", headers=ch(ctok))
    assert me.json()["coach_note"]["text"] == "İkinci not"  # eskisi ÜZERİNE yazıldı, tek satır

    notifs = await client.get("/notifications", headers=ch(ctok))
    assert len(notifs.json()["items"]) == 2  # ama İKİ bildirim var (her yazımda biri)


@pytest.mark.asyncio
async def test_not_silinebilir(client, db):
    tok, teacher_id = await _teacher2(client, "cn4@t.com")
    ctok, cid = await _child_login(client, "cn4a@t.com")
    child = await db.get(ChildProfile, cid)
    child.teacher_user_id = teacher_id
    await db.commit()

    await client.put(f"/teacher/students/{cid}/note", headers=auth(tok), json={"text": "Silinecek not"})
    d = await client.delete(f"/teacher/students/{cid}/note", headers=auth(tok))
    assert d.status_code == 200

    me = await client.get("/gamification/me", headers=ch(ctok))
    assert me.json()["coach_note"] is None
    # Geçmiş bildirim SATIRINA dokunulmaz.
    notifs = await client.get("/notifications", headers=ch(ctok))
    assert len(notifs.json()["items"]) == 1

    # Not yokken silme no-op (404 değil, sessizce ok).
    d2 = await client.delete(f"/teacher/students/{cid}/note", headers=auth(tok))
    assert d2.status_code == 200


@pytest.mark.asyncio
async def test_bos_not_reddedilir_ve_baska_ogretmen_yazamaz(client, db):
    tok, teacher_id = await _teacher2(client, "cn5@t.com")
    tok2, _ = await _teacher2(client, "cn5b@t.com")
    ctok, cid = await _child_login(client, "cn5a@t.com")
    child = await db.get(ChildProfile, cid)
    child.teacher_user_id = teacher_id
    await db.commit()

    assert (await client.put(f"/teacher/students/{cid}/note", headers=auth(tok), json={"text": "   "})).status_code == 422
    assert (await client.put(f"/teacher/students/{cid}/note", headers=auth(tok2), json={"text": "x"})).status_code == 403
    assert (await client.delete(f"/teacher/students/{cid}/note", headers=auth(tok2))).status_code == 403


@pytest.mark.asyncio
async def test_antrenorun_ogrenci_gorunumu_de_notu_dondurur(client, db):
    """/teacher/students/{id}/profile-summary — antrenörün salt-okunur
    görünümü de AYNI notu görür (yazma UI'ı buradan besleniyor)."""
    tok, teacher_id = await _teacher2(client, "cn6@t.com")
    ctok, cid = await _child_login(client, "cn6a@t.com")
    child = await db.get(ChildProfile, cid)
    child.teacher_user_id = teacher_id
    await db.commit()
    await client.put(f"/teacher/students/{cid}/note", headers=auth(tok), json={"text": "Görünüm testi"})

    r = await client.get(f"/teacher/students/{cid}/profile-summary", headers=auth(tok))
    assert r.json()["coach_note"]["text"] == "Görünüm testi"


@pytest.mark.asyncio
async def test_antrenorun_kendi_profilinde_not_yok(client, db):
    """Antrenörün KENDİ oyun profilinde (hibrit jeton) kimse ona not
    yazmadığı için coach_note hep None — kart zaten coach/profile'da yok."""
    tok, _ = await _teacher2(client, "cn7@t.com")
    r = await client.get("/gamification/me", headers=auth(tok))
    assert r.json()["coach_note"] is None
