# Madde 2026-09-13 (Sınıflarım yönetimi): antrenör sınıflarını yeniden
# adlandırabilir, sıralayabilir (▲/▼ komşu takası), silebilir. Silme
# öncesi 3 nullable foreign key (child_profiles.class_id,
# homework_recipients.via_class_id, parent_surveys.target_class_id)
# NULL'a çekilir — hiçbirinde ondelete yok, aksi halde Postgres'te FK
# ihlali olurdu.
import pytest
from datetime import date
from chess_api.models import Homework, HomeworkRecipient, ParentSurvey, ChildProfile
from tests.test_teacher import _teacher_signup, _parent_signup, _create_child, auth
from tests.test_homework import _seed_step, _teacher2


async def _second_teacher(client, email="teacher2@t.com") -> str:
    return await _teacher_signup(client, email)


@pytest.mark.asyncio
async def test_rename_class_basarili(client):
    tok = await _teacher_signup(client, "ren1@t.com")
    r = await client.post("/teacher/classes", headers=auth(tok), json={"name": "Eski Ad"})
    cid = r.json()["id"]

    r = await client.patch(f"/teacher/classes/{cid}", headers=auth(tok), json={"name": "Yeni Ad"})
    assert r.status_code == 200, r.text
    assert r.json()["name"] == "Yeni Ad"

    r = await client.get("/teacher/classes", headers=auth(tok))
    assert r.json()[0]["name"] == "Yeni Ad"


@pytest.mark.asyncio
async def test_baska_antrenor_sinifi_rename_edemez(client):
    tok_a = await _teacher_signup(client, "ren2a@t.com")
    tok_b = await _second_teacher(client, "ren2b@t.com")
    r = await client.post("/teacher/classes", headers=auth(tok_a), json={"name": "A'nın Sınıfı"})
    cid = r.json()["id"]

    r = await client.patch(f"/teacher/classes/{cid}", headers=auth(tok_b), json={"name": "Ele Geçirildi"})
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_delete_class_basarili(client):
    tok = await _teacher_signup(client, "del1@t.com")
    r = await client.post("/teacher/classes", headers=auth(tok), json={"name": "Silinecek"})
    cid = r.json()["id"]

    r = await client.delete(f"/teacher/classes/{cid}", headers=auth(tok))
    assert r.status_code == 200, r.text

    r = await client.get("/teacher/classes", headers=auth(tok))
    assert r.json() == []


@pytest.mark.asyncio
async def test_baska_antrenor_sinifi_silemez(client):
    tok_a = await _teacher_signup(client, "del2a@t.com")
    tok_b = await _second_teacher(client, "del2b@t.com")
    r = await client.post("/teacher/classes", headers=auth(tok_a), json={"name": "A'nın Sınıfı"})
    cid = r.json()["id"]

    r = await client.delete(f"/teacher/classes/{cid}", headers=auth(tok_b))
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_ogrencili_odevli_ankete_hedeflenmis_sinif_hatasiz_silinir(client, db):
    """Silmeden önce 3 FK de NULL'a çekildiği için (child_profiles.class_id,
    homework_recipients.via_class_id, parent_surveys.target_class_id) hiçbir
    entegrite hatası olmadan silinmeli."""
    tok, teacher_id = await _teacher2(client, "del3@t.com")
    r = await client.post("/teacher/classes", headers=auth(tok), json={"name": "Dolu Sınıf"})
    cid = r.json()["id"]

    parent_tok = await _parent_signup(client, "del3p@t.com")
    child_id = await _create_child(client, parent_tok, "Ayşe")
    child = await db.get(ChildProfile, child_id)
    child.class_id = cid
    await db.commit()

    step_id = await _seed_step(db, "Test Alt Konu")
    hw = Homework(teacher_user_id=teacher_id, lesson_step_id=step_id, start_date=date.today())
    db.add(hw); await db.flush()
    db.add(HomeworkRecipient(homework_id=hw.id, child_id=child_id, via_class_id=cid))
    survey = ParentSurvey(
        created_by_teacher_id=teacher_id, title="Anket", questions_json=[{"q": "?"}], target_class_id=cid,
    )
    db.add(survey)
    await db.commit()

    r = await client.delete(f"/teacher/classes/{cid}", headers=auth(tok))
    assert r.status_code == 200, r.text

    await db.refresh(child)
    assert child.class_id is None

    from sqlalchemy import select
    recipient = (await db.execute(
        select(HomeworkRecipient).where(HomeworkRecipient.child_id == child_id)
    )).scalar_one()
    assert recipient.via_class_id is None

    await db.refresh(survey)
    assert survey.target_class_id is None


@pytest.mark.asyncio
async def test_move_up_down_sirayi_degistirir(client):
    tok = await _teacher_signup(client, "move1@t.com")
    ids = []
    for name in ["Birinci", "İkinci", "Üçüncü"]:
        r = await client.post("/teacher/classes", headers=auth(tok), json={"name": name})
        ids.append(r.json()["id"])

    r = await client.post(f"/teacher/classes/{ids[1]}/move", headers=auth(tok), json={"direction": "up"})
    assert r.status_code == 200, r.text

    r = await client.get("/teacher/classes", headers=auth(tok))
    names = [c["name"] for c in r.json()]
    assert names == ["İkinci", "Birinci", "Üçüncü"]


@pytest.mark.asyncio
async def test_move_sinir_disi_400(client):
    tok = await _teacher_signup(client, "move2@t.com")
    r = await client.post("/teacher/classes", headers=auth(tok), json={"name": "Tek"})
    cid = r.json()["id"]

    r = await client.post(f"/teacher/classes/{cid}/move", headers=auth(tok), json={"direction": "up"})
    assert r.status_code == 400
    r = await client.post(f"/teacher/classes/{cid}/move", headers=auth(tok), json={"direction": "down"})
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_non_teacher_rename_delete_move_403(client):
    tok = await _teacher_signup(client, "role1@t.com")
    r = await client.post("/teacher/classes", headers=auth(tok), json={"name": "Sınıf"})
    cid = r.json()["id"]
    parent_tok = await _parent_signup(client, "role1p@t.com")

    r = await client.patch(f"/teacher/classes/{cid}", headers=auth(parent_tok), json={"name": "x"})
    assert r.status_code == 403
    r = await client.delete(f"/teacher/classes/{cid}", headers=auth(parent_tok))
    assert r.status_code == 403
    r = await client.post(f"/teacher/classes/{cid}/move", headers=auth(parent_tok), json={"direction": "up"})
    assert r.status_code == 403


# ---------------------------------------------------------------------------
# Madde 2026-09-13 (devam, Sınıf Listesi yönetimi): sporcu satırındaki
# nickname/foto, ▲/▼ sıralama, "Sınıf Değiştir".
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_roster_nickname_foto_ve_siraya_gore_doner(client, db):
    tok = await _teacher_signup(client, "ros1@t.com")
    r = await client.post("/teacher/classes", headers=auth(tok), json={"name": "Sınıf R"})
    cid = r.json()["id"]

    parent_tok = await _parent_signup(client, "ros1p@t.com")
    c1 = await _create_child(client, parent_tok, "Ali")
    c2 = await _create_child(client, parent_tok, "Veli")
    await client.post(f"/teacher/classes/{cid}/students/{c1}", headers=auth(tok))
    await client.post(f"/teacher/classes/{cid}/students/{c2}", headers=auth(tok))

    child1 = await db.get(ChildProfile, c1)
    child1.nickname = "eyes of Polgar"
    child1.photo_data_url = "data:image/png;base64,xx"
    await db.commit()

    r = await client.get(f"/teacher/classes/{cid}/students", headers=auth(tok))
    assert r.status_code == 200, r.text
    students = r.json()
    assert [s["id"] for s in students] == [c1, c2]
    assert students[0]["nickname"] == "eyes of Polgar"
    assert students[0]["photo_data_url"] == "data:image/png;base64,xx"
    assert students[0]["order_index"] == 0
    assert students[1]["order_index"] == 1
    assert students[1]["nickname"] is None


@pytest.mark.asyncio
async def test_ogrenci_yukari_asagi_tasinabilir(client):
    tok = await _teacher_signup(client, "ros2@t.com")
    r = await client.post("/teacher/classes", headers=auth(tok), json={"name": "Sınıf S"})
    cid = r.json()["id"]
    parent_tok = await _parent_signup(client, "ros2p@t.com")
    c1 = await _create_child(client, parent_tok, "Ali")
    c2 = await _create_child(client, parent_tok, "Veli")
    await client.post(f"/teacher/classes/{cid}/students/{c1}", headers=auth(tok))
    await client.post(f"/teacher/classes/{cid}/students/{c2}", headers=auth(tok))

    r = await client.post(f"/teacher/classes/{cid}/students/{c2}/move", headers=auth(tok), json={"direction": "up"})
    assert r.status_code == 200, r.text

    r = await client.get(f"/teacher/classes/{cid}/students", headers=auth(tok))
    assert [s["id"] for s in r.json()] == [c2, c1]


@pytest.mark.asyncio
async def test_ogrenci_tasima_sinir_disi_400(client):
    tok = await _teacher_signup(client, "ros3@t.com")
    r = await client.post("/teacher/classes", headers=auth(tok), json={"name": "Sınıf T"})
    cid = r.json()["id"]
    parent_tok = await _parent_signup(client, "ros3p@t.com")
    c1 = await _create_child(client, parent_tok, "Tek")
    await client.post(f"/teacher/classes/{cid}/students/{c1}", headers=auth(tok))

    r = await client.post(f"/teacher/classes/{cid}/students/{c1}/move", headers=auth(tok), json={"direction": "up"})
    assert r.status_code == 400
    r = await client.post(f"/teacher/classes/{cid}/students/{c1}/move", headers=auth(tok), json={"direction": "down"})
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_sinif_degistirince_yeni_sinifin_sonuna_eklenir(client):
    """'Sınıf Değiştir' — mevcut add_student ucu force=true ile tekrar
    kullanılıyor; taşınan öğrenci yeni sınıfın SONUNA eklenir, eski
    sınıfta artık görünmez."""
    tok = await _teacher_signup(client, "ros4@t.com")
    r1 = await client.post("/teacher/classes", headers=auth(tok), json={"name": "Eski Sınıf"})
    cid1 = r1.json()["id"]
    r2 = await client.post("/teacher/classes", headers=auth(tok), json={"name": "Yeni Sınıf"})
    cid2 = r2.json()["id"]

    parent_tok = await _parent_signup(client, "ros4p@t.com")
    mevcut = await _create_child(client, parent_tok, "Mevcut")
    tasinan = await _create_child(client, parent_tok, "Taşınan")

    await client.post(f"/teacher/classes/{cid2}/students/{mevcut}", headers=auth(tok))
    await client.post(f"/teacher/classes/{cid1}/students/{tasinan}", headers=auth(tok))

    r = await client.post(
        f"/teacher/classes/{cid2}/students/{tasinan}",
        headers=auth(tok), params={"force": "true"},
    )
    assert r.status_code == 200, r.text

    r = await client.get(f"/teacher/classes/{cid2}/students", headers=auth(tok))
    students = r.json()
    assert [s["id"] for s in students] == [mevcut, tasinan]
    assert students[1]["order_index"] == 1

    r = await client.get(f"/teacher/classes/{cid1}/students", headers=auth(tok))
    assert r.json() == []
