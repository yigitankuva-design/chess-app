import pytest
from sqlalchemy import select
from chess_api.models.child import ChildProfile


async def _set_teacher(db, child_id: int, teacher_id: int | None) -> None:
    row = (await db.execute(
        select(ChildProfile).where(ChildProfile.id == child_id)
    )).scalar_one()
    row.teacher_user_id = teacher_id
    await db.commit()


async def _add_child(db, name: str, teacher_id: int | None, parent_id: int) -> int:
    c = ChildProfile(
        parent_user_id=parent_id, display_name=name, age=10,
        pin_hash="x", teacher_user_id=teacher_id,
    )
    db.add(c)
    await db.commit()
    await db.refresh(c)
    return c.id


@pytest.mark.asyncio
async def test_hocasi_olmayan_sporcu_bos_liste_alir(client, child_auth):
    """Hangi akademiye ait oldugu bilinmeyen cocuga isim gosterilmez."""
    token, _ = child_auth
    r = await client.get("/athletes", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    assert r.json() == []


@pytest.mark.asyncio
async def test_ayni_hocanin_sporculari_listelenir_kendisi_haric(client, child_auth, db):
    token, my_id = child_auth
    me = (await db.execute(
        select(ChildProfile).where(ChildProfile.id == my_id)
    )).scalar_one()
    parent_id = me.parent_user_id
    await _set_teacher(db, my_id, 77)

    ayni = await _add_child(db, "Ayse", 77, parent_id)
    await _add_child(db, "Baska Hoca Sporcusu", 88, parent_id)

    r = await client.get("/athletes", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    data = r.json()
    assert [a["child_id"] for a in data] == [ayni]
    assert data[0]["display_name"] == "Ayse"


@pytest.mark.asyncio
async def test_ada_gore_sirali_doner(client, child_auth, db):
    token, my_id = child_auth
    me = (await db.execute(
        select(ChildProfile).where(ChildProfile.id == my_id)
    )).scalar_one()
    parent_id = me.parent_user_id
    await _set_teacher(db, my_id, 77)

    await _add_child(db, "Zeynep", 77, parent_id)
    await _add_child(db, "Ahmet", 77, parent_id)

    r = await client.get("/athletes", headers={"Authorization": f"Bearer {token}"})
    assert [a["display_name"] for a in r.json()] == ["Ahmet", "Zeynep"]


@pytest.mark.asyncio
async def test_kimliksiz_istek_reddedilir(client):
    r = await client.get("/athletes")
    assert r.status_code in (401, 403)
