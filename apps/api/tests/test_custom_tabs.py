def test_custom_tab_modeli_tablo_adi_ve_alanlari():
    from chess_api.models import CustomTab

    assert CustomTab.__tablename__ == "custom_tabs"
    cols = set(CustomTab.__table__.columns.keys())
    assert cols == {"id", "order_index", "label", "emoji"}


def test_custom_tab_section_modeli_tablo_adi_ve_alanlari():
    from chess_api.models import CustomTabSection

    assert CustomTabSection.__tablename__ == "custom_tab_sections"
    cols = set(CustomTabSection.__table__.columns.keys())
    assert cols == {"id", "custom_tab_id", "order_index", "title", "body", "images"}


import pytest


@pytest.mark.asyncio
async def test_bos_liste_bos_dizi_doner(client):
    r = await client.get("/custom-tabs")
    assert r.status_code == 200
    assert r.json() == []


@pytest.mark.asyncio
async def test_olmayan_sekme_404_doner(client):
    r = await client.get("/custom-tabs/999999")
    assert r.status_code == 404
