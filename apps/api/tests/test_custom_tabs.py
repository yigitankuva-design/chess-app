def test_custom_tab_modeli_tablo_adi_ve_alanlari():
    from chess_api.models import CustomTab

    assert CustomTab.__tablename__ == "custom_tabs"
    cols = set(CustomTab.__table__.columns.keys())
    assert cols == {"id", "order_index", "label", "emoji"}


def test_custom_tab_section_modeli_tablo_adi_ve_alanlari():
    from chess_api.models import CustomTabSection

    assert CustomTabSection.__tablename__ == "custom_tab_sections"
    cols = set(CustomTabSection.__table__.columns.keys())
    # Madde 2026-08-22: parent_id — ic ice (nested) alt sekmeler.
    assert cols == {
        "id", "custom_tab_id", "parent_id", "order_index", "title", "body", "images",
        "practice_positions", "emoji", "board_exercises", "position_pool",
    }


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


async def _teacher_token(client, email="ct@t.com"):
    r = await client.post("/auth/teacher/signup", json={
        "email": email, "password": "guvenli12345", "name": "Teacher",
    })
    return r.json()["access_token"]


@pytest.mark.asyncio
async def test_ogretmen_sekme_ekler_emoji_otomatik_atanir(client):
    tok = await _teacher_token(client, "ct1@t.com")
    r = await client.post("/admin/custom-tabs", headers={"Authorization": f"Bearer {tok}"},
                          json={"label": "Turnuvalar"})
    assert r.status_code == 201
    body = r.json()
    assert body["label"] == "Turnuvalar"
    assert body["emoji"] == "📌"


@pytest.mark.asyncio
async def test_ikinci_sekme_farkli_emoji_alir(client):
    tok = await _teacher_token(client, "ct2@t.com")
    h = {"Authorization": f"Bearer {tok}"}
    await client.post("/admin/custom-tabs", headers=h, json={"label": "Birinci"})
    r = await client.post("/admin/custom-tabs", headers=h, json={"label": "İkinci"})
    assert r.json()["emoji"] == "⭐"


@pytest.mark.asyncio
async def test_tokensiz_sekme_ekleme_engellenir(client):
    r = await client.post("/admin/custom-tabs", json={"label": "Turnuvalar"})
    assert r.status_code in (401, 403)


@pytest.mark.asyncio
async def test_bos_etiketle_sekme_reddedilir(client):
    tok = await _teacher_token(client, "ct3@t.com")
    r = await client.post("/admin/custom-tabs", headers={"Authorization": f"Bearer {tok}"},
                          json={"label": "  "})
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_sekme_silinince_bolumleri_de_silinir(client):
    tok = await _teacher_token(client, "ct4@t.com")
    h = {"Authorization": f"Bearer {tok}"}
    tab = await client.post("/admin/custom-tabs", headers=h, json={"label": "Silinecek"})
    tab_id = tab.json()["id"]
    await client.post(f"/admin/custom-tabs/{tab_id}/sections", headers=h,
                      json={"title": "Bölüm 1", "body": "metin", "images": []})

    r = await client.delete(f"/admin/custom-tabs/{tab_id}", headers=h)
    assert r.status_code == 200

    listing = await client.get("/custom-tabs")
    assert tab_id not in [t["id"] for t in listing.json()]
    detail = await client.get(f"/custom-tabs/{tab_id}")
    assert detail.status_code == 404


@pytest.mark.asyncio
async def test_sekme_siralamasi_degistirilebilir(client):
    tok = await _teacher_token(client, "ct5@t.com")
    h = {"Authorization": f"Bearer {tok}"}
    a = (await client.post("/admin/custom-tabs", headers=h, json={"label": "A"})).json()
    b = (await client.post("/admin/custom-tabs", headers=h, json={"label": "B"})).json()

    r = await client.post("/admin/custom-tabs/reorder", headers=h,
                          json={"ordered_ids": [b["id"], a["id"]]})
    assert r.status_code == 200

    listing = (await client.get("/custom-tabs")).json()
    assert [t["id"] for t in listing] == [b["id"], a["id"]]


@pytest.mark.asyncio
async def test_bolum_guncellenir(client):
    tok = await _teacher_token(client, "cts1@t.com")
    h = {"Authorization": f"Bearer {tok}"}
    tab = (await client.post("/admin/custom-tabs", headers=h, json={"label": "Sekme"})).json()
    section = (await client.post(f"/admin/custom-tabs/{tab['id']}/sections", headers=h,
                                 json={"title": "Eski", "body": "eski metin", "images": []})).json()

    r = await client.patch(f"/admin/custom-tab-sections/{section['id']}", headers=h,
                           json={"title": "Yeni", "body": "yeni metin"})
    assert r.status_code == 200
    assert r.json()["title"] == "Yeni"
    assert r.json()["body"] == "yeni metin"


@pytest.mark.asyncio
async def test_bolum_silinir(client):
    tok = await _teacher_token(client, "cts2@t.com")
    h = {"Authorization": f"Bearer {tok}"}
    tab = (await client.post("/admin/custom-tabs", headers=h, json={"label": "Sekme"})).json()
    section = (await client.post(f"/admin/custom-tabs/{tab['id']}/sections", headers=h,
                                 json={"title": "Bölüm", "body": "x", "images": []})).json()

    r = await client.delete(f"/admin/custom-tab-sections/{section['id']}", headers=h)
    assert r.status_code == 200

    detail = (await client.get(f"/custom-tabs/{tab['id']}")).json()
    assert detail["sections"] == []


@pytest.mark.asyncio
async def test_bolum_siralamasi_degistirilebilir(client):
    tok = await _teacher_token(client, "cts3@t.com")
    h = {"Authorization": f"Bearer {tok}"}
    tab = (await client.post("/admin/custom-tabs", headers=h, json={"label": "Sekme"})).json()
    s1 = (await client.post(f"/admin/custom-tabs/{tab['id']}/sections", headers=h,
                            json={"title": "S1", "body": "", "images": []})).json()
    s2 = (await client.post(f"/admin/custom-tabs/{tab['id']}/sections", headers=h,
                            json={"title": "S2", "body": "", "images": []})).json()

    r = await client.post(f"/admin/custom-tabs/{tab['id']}/sections/reorder", headers=h,
                          json={"ordered_ids": [s2["id"], s1["id"]]})
    assert r.status_code == 200

    detail = (await client.get(f"/custom-tabs/{tab['id']}")).json()
    assert [s["id"] for s in detail["sections"]] == [s2["id"], s1["id"]]


@pytest.mark.asyncio
async def test_cok_buyuk_bolum_gorseli_reddedilir(client):
    tok = await _teacher_token(client, "cts4@t.com")
    h = {"Authorization": f"Bearer {tok}"}
    tab = (await client.post("/admin/custom-tabs", headers=h, json={"label": "Sekme"})).json()
    huge = "data:image/png;base64," + ("A" * 400_001)
    r = await client.post(f"/admin/custom-tabs/{tab['id']}/sections", headers=h,
                          json={"title": "Bölüm", "body": "", "images": [huge]})
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_konum_havuzu_kaydedilir(client):
    tok = await _teacher_token(client, "ctp1@t.com")
    h = {"Authorization": f"Bearer {tok}"}
    tab = (await client.post("/admin/custom-tabs", headers=h, json={"label": "Pratik Yap"})).json()
    section = (await client.post(f"/admin/custom-tabs/{tab['id']}/sections", headers=h,
                                 json={"title": "Süresiz Pratik", "body": "", "images": []})).json()
    assert section["practice_positions"] == []

    fen = "8/8/8/4k3/8/8/4P3/4K3 w - - 0 1"
    r = await client.patch(f"/admin/custom-tab-sections/{section['id']}", headers=h,
                           json={"practice_positions": [{"id": "p1", "fen": fen}]})
    assert r.status_code == 200
    assert r.json()["practice_positions"] == [{"id": "p1", "fen": fen, "category": None, "code": None}]


@pytest.mark.asyncio
async def test_konum_havuzu_bos_id_reddedilir(client):
    tok = await _teacher_token(client, "ctp2@t.com")
    h = {"Authorization": f"Bearer {tok}"}
    tab = (await client.post("/admin/custom-tabs", headers=h, json={"label": "Pratik Yap"})).json()
    section = (await client.post(f"/admin/custom-tabs/{tab['id']}/sections", headers=h,
                                 json={"title": "Süresiz Pratik", "body": "", "images": []})).json()

    r = await client.patch(f"/admin/custom-tab-sections/{section['id']}", headers=h,
                           json={"practice_positions": [{"id": "", "fen": "8/8/8/8/8/8/8/8 w - - 0 1"}]})
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_konum_kategori_alani_korunur(client):
    tok = await _teacher_token(client, "ctp4@t.com")
    h = {"Authorization": f"Bearer {tok}"}
    tab = (await client.post("/admin/custom-tabs", headers=h, json={"label": "Pratik Yap"})).json()
    section = (await client.post(f"/admin/custom-tabs/{tab['id']}/sections", headers=h,
                                 json={"title": "Oyunsonu Pratiği Yap", "body": "", "images": []})).json()

    fen = "4k3/8/8/8/8/8/4P3/4K3 w - - 0 1"
    r = await client.patch(f"/admin/custom-tab-sections/{section['id']}", headers=h,
                           json={"practice_positions": [
                               {"id": "p1", "fen": fen, "category": "Piyon Finalleri"},
                               {"id": "p2", "fen": fen},
                           ]})
    assert r.status_code == 200
    poz = r.json()["practice_positions"]
    assert poz[0]["category"] == "Piyon Finalleri"
    # Kategorisiz kayit da calisir (eski veriler bozulmaz).
    assert poz[1].get("category") is None


@pytest.mark.asyncio
async def test_konum_kodu_korunur(client):
    tok = await _teacher_token(client, "ctp5@t.com")
    h = {"Authorization": f"Bearer {tok}"}
    tab = (await client.post("/admin/custom-tabs", headers=h, json={"label": "Pratik Yap"})).json()
    section = (await client.post(f"/admin/custom-tabs/{tab['id']}/sections", headers=h,
                                 json={"title": "Kazanç Konumunu Pratik Yap", "body": "", "images": []})).json()

    fen = "4k3/8/8/8/8/8/4P3/4K3 w - - 0 1"
    r = await client.patch(f"/admin/custom-tab-sections/{section['id']}", headers=h,
                           json={"practice_positions": [
                               {"id": "p1", "fen": fen, "code": "001"},
                               {"id": "p2", "fen": fen},
                           ]})
    assert r.status_code == 200
    poz = r.json()["practice_positions"]
    assert poz[0]["code"] == "001"
    # Kodsuz kayit da calisir (eski veriler bozulmaz).
    assert poz[1].get("code") is None


@pytest.mark.asyncio
async def test_genel_bolum_gorunumu_konum_havuzunu_icerir(client):
    tok = await _teacher_token(client, "ctp3@t.com")
    h = {"Authorization": f"Bearer {tok}"}
    tab = (await client.post("/admin/custom-tabs", headers=h, json={"label": "Pratik Yap"})).json()
    section = (await client.post(f"/admin/custom-tabs/{tab['id']}/sections", headers=h,
                                 json={"title": "Süresiz Pratik", "body": "", "images": []})).json()
    fen = "8/8/8/4k3/8/8/4P3/4K3 w - - 0 1"
    await client.patch(f"/admin/custom-tab-sections/{section['id']}", headers=h,
                       json={"practice_positions": [{"id": "p1", "fen": fen}]})

    detail = (await client.get(f"/custom-tabs/{tab['id']}")).json()
    assert detail["sections"][0]["practice_positions"] == [{"id": "p1", "fen": fen, "category": None, "code": None}]


# ── Iç içe (nested) alt sekmeler — madde: 2026-08-22, "Antrenör"/"Sınıflar" ihtiyacı ──

@pytest.mark.asyncio
async def test_parent_id_ile_cocuk_bolum_eklenir(client):
    tok = await _teacher_token(client, "ctn1@t.com")
    h = {"Authorization": f"Bearer {tok}"}
    tab = (await client.post("/admin/custom-tabs", headers=h, json={"label": "Antrenör"})).json()
    parent = (await client.post(f"/admin/custom-tabs/{tab['id']}/sections", headers=h,
                                json={"title": "Sınıflar", "body": "", "images": []})).json()

    r = await client.post(f"/admin/custom-tabs/{tab['id']}/sections", headers=h,
                          json={"title": "9-A Sınıfı", "body": "", "images": [], "parent_id": parent["id"]})
    assert r.status_code == 201
    assert r.json()["parent_id"] == parent["id"]

    detail = (await client.get(f"/custom-tabs/{tab['id']}")).json()
    ids_and_parents = {s["id"]: s["parent_id"] for s in detail["sections"]}
    assert ids_and_parents[parent["id"]] is None
    assert ids_and_parents[r.json()["id"]] == parent["id"]


@pytest.mark.asyncio
async def test_ic_ice_2_seviye_calisir(client):
    tok = await _teacher_token(client, "ctn2@t.com")
    h = {"Authorization": f"Bearer {tok}"}
    tab = (await client.post("/admin/custom-tabs", headers=h, json={"label": "Antrenör"})).json()
    a = (await client.post(f"/admin/custom-tabs/{tab['id']}/sections", headers=h,
                           json={"title": "Sınıflar", "body": "", "images": []})).json()
    b = (await client.post(f"/admin/custom-tabs/{tab['id']}/sections", headers=h,
                           json={"title": "9-A Sınıfı", "body": "", "images": [], "parent_id": a["id"]})).json()
    c = (await client.post(f"/admin/custom-tabs/{tab['id']}/sections", headers=h,
                           json={"title": "Öğrenci Listesi", "body": "", "images": [], "parent_id": b["id"]})).json()
    assert c["parent_id"] == b["id"]


@pytest.mark.asyncio
async def test_baska_sekmenin_bolumune_parent_verilirse_404(client):
    tok = await _teacher_token(client, "ctn3@t.com")
    h = {"Authorization": f"Bearer {tok}"}
    tab1 = (await client.post("/admin/custom-tabs", headers=h, json={"label": "A"})).json()
    tab2 = (await client.post("/admin/custom-tabs", headers=h, json={"label": "B"})).json()
    section_in_tab1 = (await client.post(f"/admin/custom-tabs/{tab1['id']}/sections", headers=h,
                                         json={"title": "X", "body": "", "images": []})).json()

    r = await client.post(f"/admin/custom-tabs/{tab2['id']}/sections", headers=h,
                          json={"title": "Y", "body": "", "images": [], "parent_id": section_in_tab1["id"]})
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_bolum_silinince_torunlari_da_silinir(client):
    tok = await _teacher_token(client, "ctn4@t.com")
    h = {"Authorization": f"Bearer {tok}"}
    tab = (await client.post("/admin/custom-tabs", headers=h, json={"label": "Antrenör"})).json()
    a = (await client.post(f"/admin/custom-tabs/{tab['id']}/sections", headers=h,
                           json={"title": "Sınıflar", "body": "", "images": []})).json()
    b = (await client.post(f"/admin/custom-tabs/{tab['id']}/sections", headers=h,
                           json={"title": "9-A Sınıfı", "body": "", "images": [], "parent_id": a["id"]})).json()
    c = (await client.post(f"/admin/custom-tabs/{tab['id']}/sections", headers=h,
                           json={"title": "Öğrenci Listesi", "body": "", "images": [], "parent_id": b["id"]})).json()

    r = await client.delete(f"/admin/custom-tab-sections/{a['id']}", headers=h)
    assert r.status_code == 200

    detail = (await client.get(f"/custom-tabs/{tab['id']}")).json()
    remaining_ids = {s["id"] for s in detail["sections"]}
    assert a["id"] not in remaining_ids
    assert b["id"] not in remaining_ids
    assert c["id"] not in remaining_ids


@pytest.mark.asyncio
async def test_kardes_siralamasi_parent_bazinda_ayri_tutulur(client):
    tok = await _teacher_token(client, "ctn5@t.com")
    h = {"Authorization": f"Bearer {tok}"}
    tab = (await client.post("/admin/custom-tabs", headers=h, json={"label": "Antrenör"})).json()
    a = (await client.post(f"/admin/custom-tabs/{tab['id']}/sections", headers=h,
                           json={"title": "Sınıflar", "body": "", "images": []})).json()
    child1 = (await client.post(f"/admin/custom-tabs/{tab['id']}/sections", headers=h,
                                json={"title": "9-A", "body": "", "images": [], "parent_id": a["id"]})).json()
    child2 = (await client.post(f"/admin/custom-tabs/{tab['id']}/sections", headers=h,
                                json={"title": "9-B", "body": "", "images": [], "parent_id": a["id"]})).json()
    # Kök seviyede AYRICA bir bölüm — sıra numarası çocuklarla KARIŞMAMALI.
    root2 = (await client.post(f"/admin/custom-tabs/{tab['id']}/sections", headers=h,
                               json={"title": "Diğer", "body": "", "images": []})).json()

    assert child1["order_index"] == 1
    assert child2["order_index"] == 2
    # root2, a'dan sonra kök seviyede 2. sıradadır (a=1, root2=2) — child'ların
    # sırasından etkilenmemiştir.
    assert root2["order_index"] == 2


# ── Bölüm YAPISINI kopyalama — madde: 2026-08-24, "Sınıf 1"→"Sınıf 2" ihtiyacı ──

@pytest.mark.asyncio
async def test_yapraksiz_bolum_kopyalanir(client):
    tok = await _teacher_token(client, "ctd1@t.com")
    h = {"Authorization": f"Bearer {tok}"}
    tab = (await client.post("/admin/custom-tabs", headers=h, json={"label": "Antrenör"})).json()
    src = (await client.post(f"/admin/custom-tabs/{tab['id']}/sections", headers=h,
                             json={"title": "Sınıf 1", "body": "orijinal metin",
                                   "images": ["data:image/png;base64,AAAA"]})).json()

    r = await client.post(f"/admin/custom-tab-sections/{src['id']}/duplicate", headers=h,
                          json={"new_title": "Sınıf 2"})
    assert r.status_code == 201
    copy = r.json()
    assert copy["title"] == "Sınıf 2"
    assert copy["body"] == ""
    assert copy["images"] == []
    assert copy["parent_id"] is None
    assert copy["id"] != src["id"]


@pytest.mark.asyncio
async def test_bos_yeni_ad_reddedilir(client):
    tok = await _teacher_token(client, "ctd2@t.com")
    h = {"Authorization": f"Bearer {tok}"}
    tab = (await client.post("/admin/custom-tabs", headers=h, json={"label": "Antrenör"})).json()
    src = (await client.post(f"/admin/custom-tabs/{tab['id']}/sections", headers=h,
                             json={"title": "Sınıf 1", "body": "", "images": []})).json()

    r = await client.post(f"/admin/custom-tab-sections/{src['id']}/duplicate", headers=h,
                          json={"new_title": "  "})
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_ic_ice_yapi_kopyalanir_yazi_ve_gorsel_bos_kalir(client):
    tok = await _teacher_token(client, "ctd3@t.com")
    h = {"Authorization": f"Bearer {tok}"}
    tab = (await client.post("/admin/custom-tabs", headers=h, json={"label": "Antrenör"})).json()
    root = (await client.post(f"/admin/custom-tabs/{tab['id']}/sections", headers=h,
                              json={"title": "Sınıf 1", "body": "", "images": [], "emoji": "📘"})).json()
    child = (await client.post(f"/admin/custom-tabs/{tab['id']}/sections", headers=h,
                               json={"title": "Konu Anlatımı", "body": "metin",
                                     "images": ["data:image/png;base64,AAAA"],
                                     "parent_id": root["id"]})).json()
    grandchild = (await client.post(f"/admin/custom-tabs/{tab['id']}/sections", headers=h,
                                    json={"title": "Video", "body": "y", "images": [],
                                          "parent_id": child["id"]})).json()

    r = await client.post(f"/admin/custom-tab-sections/{root['id']}/duplicate", headers=h,
                          json={"new_title": "Sınıf 2"})
    assert r.status_code == 201
    new_root = r.json()
    assert new_root["title"] == "Sınıf 2"
    assert new_root["emoji"] == "📘"

    detail = (await client.get(f"/custom-tabs/{tab['id']}")).json()
    by_parent: dict = {}
    for s in detail["sections"]:
        by_parent.setdefault(s["parent_id"], []).append(s)

    new_children = by_parent.get(new_root["id"], [])
    assert len(new_children) == 1
    assert new_children[0]["title"] == "Konu Anlatımı"
    assert new_children[0]["body"] == ""
    assert new_children[0]["images"] == []

    new_grandchildren = by_parent.get(new_children[0]["id"], [])
    assert len(new_grandchildren) == 1
    assert new_grandchildren[0]["title"] == "Video"
    assert new_grandchildren[0]["body"] == ""

    # Orijinal yapı (yazı/görseliyle) DOKUNULMAMIŞ olmalı.
    original_child = next(s for s in detail["sections"] if s["id"] == child["id"])
    assert original_child["body"] == "metin"
    assert original_child["images"] == ["data:image/png;base64,AAAA"]


@pytest.mark.asyncio
async def test_kopya_kardestir_ve_bagimsizdir(client):
    tok = await _teacher_token(client, "ctd4@t.com")
    h = {"Authorization": f"Bearer {tok}"}
    tab = (await client.post("/admin/custom-tabs", headers=h, json={"label": "Antrenör"})).json()
    parent = (await client.post(f"/admin/custom-tabs/{tab['id']}/sections", headers=h,
                                json={"title": "Sınıflar", "body": "", "images": []})).json()
    src = (await client.post(f"/admin/custom-tabs/{tab['id']}/sections", headers=h,
                             json={"title": "Sınıf 1", "body": "", "images": [],
                                   "parent_id": parent["id"]})).json()

    copy = (await client.post(f"/admin/custom-tab-sections/{src['id']}/duplicate", headers=h,
                              json={"new_title": "Sınıf 2"})).json()
    assert copy["parent_id"] == parent["id"]

    # Sonradan orijinali düzenlemek kopyayı ETKİLEMEMELİ.
    await client.patch(f"/admin/custom-tab-sections/{src['id']}", headers=h,
                       json={"body": "sınıf 1'e özel yeni metin"})
    detail = (await client.get(f"/custom-tabs/{tab['id']}")).json()
    copy_after = next(s for s in detail["sections"] if s["id"] == copy["id"])
    assert copy_after["body"] == ""


@pytest.mark.asyncio
async def test_olmayan_bolum_kopyalanamaz(client):
    tok = await _teacher_token(client, "ctd5@t.com")
    h = {"Authorization": f"Bearer {tok}"}
    r = await client.post("/admin/custom-tab-sections/999999/duplicate", headers=h,
                          json={"new_title": "Yeni"})
    assert r.status_code == 404


# ── Alt Konu: Kareye Tıkla/Taşa Tıkla/Taşı Oynat soruları — madde: 2026-08-24 ──

FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"


@pytest.mark.asyncio
async def test_kareye_tikla_sorusu_kaydedilir(client):
    tok = await _teacher_token(client, "cte1@t.com")
    h = {"Authorization": f"Bearer {tok}"}
    tab = (await client.post("/admin/custom-tabs", headers=h, json={"label": "Antrenör"})).json()
    section = (await client.post(f"/admin/custom-tabs/{tab['id']}/sections", headers=h,
                                 json={"title": "Tahtanın Genel Özellikleri", "body": "", "images": []})).json()
    assert section["board_exercises"] == []

    r = await client.patch(f"/admin/custom-tab-sections/{section['id']}", headers=h,
                           json={"board_exercises": [
                               {"type": "click_square", "instruction": "e4 karesine tıkla",
                                "fen": FEN, "target_squares": ["e4"]},
                           ]})
    assert r.status_code == 200
    assert r.json()["board_exercises"] == [
        {"type": "click_square", "instruction": "e4 karesine tıkla", "fen": FEN, "target_squares": ["e4"]},
    ]


@pytest.mark.asyncio
async def test_tasa_tikla_ve_tasi_oynat_sorulari_kaydedilir(client):
    tok = await _teacher_token(client, "cte2@t.com")
    h = {"Authorization": f"Bearer {tok}"}
    tab = (await client.post("/admin/custom-tabs", headers=h, json={"label": "Antrenör"})).json()
    section = (await client.post(f"/admin/custom-tabs/{tab['id']}/sections", headers=h,
                                 json={"title": "Alt Konu", "body": "", "images": []})).json()

    r = await client.patch(f"/admin/custom-tab-sections/{section['id']}", headers=h,
                           json={"board_exercises": [
                               {"type": "click_piece", "instruction": "Atları göster",
                                "fen": FEN, "piece_squares": ["b1", "g1"]},
                               {"type": "move_piece", "instruction": "e4 oyna",
                                "fen": FEN, "moves": ["e4"]},
                           ]})
    assert r.status_code == 200
    types = [ex["type"] for ex in r.json()["board_exercises"]]
    assert types == ["click_piece", "move_piece"]


@pytest.mark.asyncio
async def test_izin_verilmeyen_soru_turu_reddedilir(client):
    tok = await _teacher_token(client, "cte3@t.com")
    h = {"Authorization": f"Bearer {tok}"}
    tab = (await client.post("/admin/custom-tabs", headers=h, json={"label": "Antrenör"})).json()
    section = (await client.post(f"/admin/custom-tabs/{tab['id']}/sections", headers=h,
                                 json={"title": "Alt Konu", "body": "", "images": []})).json()

    for bad_type in ("place_pieces", "identify_piece", "sentence_question", "image_question"):
        r = await client.patch(f"/admin/custom-tab-sections/{section['id']}", headers=h,
                               json={"board_exercises": [{"type": bad_type, "instruction": "x", "fen": FEN}]})
        assert r.status_code == 400, bad_type


@pytest.mark.asyncio
async def test_gecersiz_hamle_reddedilir(client):
    tok = await _teacher_token(client, "cte4@t.com")
    h = {"Authorization": f"Bearer {tok}"}
    tab = (await client.post("/admin/custom-tabs", headers=h, json={"label": "Antrenör"})).json()
    section = (await client.post(f"/admin/custom-tabs/{tab['id']}/sections", headers=h,
                                 json={"title": "Alt Konu", "body": "", "images": []})).json()

    r = await client.patch(f"/admin/custom-tab-sections/{section['id']}", headers=h,
                           json={"board_exercises": [
                               {"type": "move_piece", "instruction": "x", "fen": FEN, "moves": ["e9"]},
                           ]})
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_kopyalanan_bolumde_soru_havuzu_bos_baslar(client):
    tok = await _teacher_token(client, "cte5@t.com")
    h = {"Authorization": f"Bearer {tok}"}
    tab = (await client.post("/admin/custom-tabs", headers=h, json={"label": "Antrenör"})).json()
    src = (await client.post(f"/admin/custom-tabs/{tab['id']}/sections", headers=h,
                             json={"title": "Sınıf 1", "body": "", "images": []})).json()
    await client.patch(f"/admin/custom-tab-sections/{src['id']}", headers=h,
                       json={"board_exercises": [
                           {"type": "click_square", "instruction": "x", "fen": FEN, "target_squares": ["e4"]},
                       ]})

    copy = (await client.post(f"/admin/custom-tab-sections/{src['id']}/duplicate", headers=h,
                              json={"new_title": "Sınıf 2"})).json()
    assert copy["board_exercises"] == []


# ── Alt Konu: Konum Havuzu (gruplu — kod + numaralı adımlar) — madde: 2026-08-26 ──

@pytest.mark.asyncio
async def test_konum_havuzu_grubu_kaydedilir(client):
    tok = await _teacher_token(client, "cty1@t.com")
    h = {"Authorization": f"Bearer {tok}"}
    tab = (await client.post("/admin/custom-tabs", headers=h, json={"label": "Antrenör"})).json()
    section = (await client.post(f"/admin/custom-tabs/{tab['id']}/sections", headers=h,
                                 json={"title": "Tahtanın Genel Özellikleri", "body": "", "images": []})).json()
    assert section["position_pool"] == []

    r = await client.patch(f"/admin/custom-tab-sections/{section['id']}", headers=h,
                           json={"position_pool": [{
                               "id": "g1", "code": "001",
                               "steps": [
                                   {"id": "s1", "fen": FEN, "sentence": "Tahta 8x8 karelerden oluşur.", "turn": "w"},
                                   {"id": "s2", "fen": FEN, "sentence": "Işıklı/koyu kareler sırayla dizilir.", "turn": "b"},
                               ],
                           }]})
    assert r.status_code == 200
    pool = r.json()["position_pool"]
    assert len(pool) == 1
    assert pool[0]["code"] == "001"
    assert len(pool[0]["steps"]) == 2
    assert pool[0]["steps"][0]["sentence"] == "Tahta 8x8 karelerden oluşur."
    assert pool[0]["steps"][1]["turn"] == "b"


@pytest.mark.asyncio
async def test_adimsiz_grup_reddedilir(client):
    tok = await _teacher_token(client, "cty2@t.com")
    h = {"Authorization": f"Bearer {tok}"}
    tab = (await client.post("/admin/custom-tabs", headers=h, json={"label": "Antrenör"})).json()
    section = (await client.post(f"/admin/custom-tabs/{tab['id']}/sections", headers=h,
                                 json={"title": "Alt Konu", "body": "", "images": []})).json()

    r = await client.patch(f"/admin/custom-tab-sections/{section['id']}", headers=h,
                           json={"position_pool": [{"id": "g1", "code": "001", "steps": []}]})
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_gecersiz_fenli_adim_reddedilir(client):
    tok = await _teacher_token(client, "cty3@t.com")
    h = {"Authorization": f"Bearer {tok}"}
    tab = (await client.post("/admin/custom-tabs", headers=h, json={"label": "Antrenör"})).json()
    section = (await client.post(f"/admin/custom-tabs/{tab['id']}/sections", headers=h,
                                 json={"title": "Alt Konu", "body": "", "images": []})).json()

    r = await client.patch(f"/admin/custom-tab-sections/{section['id']}", headers=h,
                           json={"position_pool": [{
                               "id": "g1", "code": "001",
                               "steps": [{"id": "s1", "fen": "gecersiz-fen", "sentence": "x", "turn": "w"}],
                           }]})
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_bos_cumleli_adim_reddedilir(client):
    tok = await _teacher_token(client, "cty4@t.com")
    h = {"Authorization": f"Bearer {tok}"}
    tab = (await client.post("/admin/custom-tabs", headers=h, json={"label": "Antrenör"})).json()
    section = (await client.post(f"/admin/custom-tabs/{tab['id']}/sections", headers=h,
                                 json={"title": "Alt Konu", "body": "", "images": []})).json()

    r = await client.patch(f"/admin/custom-tab-sections/{section['id']}", headers=h,
                           json={"position_pool": [{
                               "id": "g1", "code": "001",
                               "steps": [{"id": "s1", "fen": FEN, "sentence": "", "turn": "w"}],
                           }]})
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_gecersiz_hamle_sirasi_reddedilir(client):
    tok = await _teacher_token(client, "cty5@t.com")
    h = {"Authorization": f"Bearer {tok}"}
    tab = (await client.post("/admin/custom-tabs", headers=h, json={"label": "Antrenör"})).json()
    section = (await client.post(f"/admin/custom-tabs/{tab['id']}/sections", headers=h,
                                 json={"title": "Alt Konu", "body": "", "images": []})).json()

    r = await client.patch(f"/admin/custom-tab-sections/{section['id']}", headers=h,
                           json={"position_pool": [{
                               "id": "g1", "code": "001",
                               "steps": [{"id": "s1", "fen": FEN, "sentence": "x", "turn": "z"}],
                           }]})
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_havuz_gruplari_yeniden_siralanabilir(client):
    """Madde 2026-08-26 (madde 1): havuzdaki gruplar sırası değiştirilebilir —
    tam dizi yeni sırayla PATCH edilir (mevcut TÜM-DİZİ-PATCH deseniyle AYNI)."""
    tok = await _teacher_token(client, "cty6@t.com")
    h = {"Authorization": f"Bearer {tok}"}
    tab = (await client.post("/admin/custom-tabs", headers=h, json={"label": "Antrenör"})).json()
    section = (await client.post(f"/admin/custom-tabs/{tab['id']}/sections", headers=h,
                                 json={"title": "Alt Konu", "body": "", "images": []})).json()
    group_a = {"id": "g1", "code": "001", "steps": [{"id": "s1", "fen": FEN, "sentence": "A", "turn": "w"}]}
    group_b = {"id": "g2", "code": "002", "steps": [{"id": "s2", "fen": FEN, "sentence": "B", "turn": "w"}]}
    await client.patch(f"/admin/custom-tab-sections/{section['id']}", headers=h,
                       json={"position_pool": [group_a, group_b]})

    r = await client.patch(f"/admin/custom-tab-sections/{section['id']}", headers=h,
                           json={"position_pool": [group_b, group_a]})
    assert r.status_code == 200
    assert [g["id"] for g in r.json()["position_pool"]] == ["g2", "g1"]


@pytest.mark.asyncio
async def test_kopyalanan_bolumde_konum_havuzu_bos_baslar(client):
    tok = await _teacher_token(client, "cty7@t.com")
    h = {"Authorization": f"Bearer {tok}"}
    tab = (await client.post("/admin/custom-tabs", headers=h, json={"label": "Antrenör"})).json()
    src = (await client.post(f"/admin/custom-tabs/{tab['id']}/sections", headers=h,
                             json={"title": "Sınıf 1", "body": "", "images": []})).json()
    await client.patch(f"/admin/custom-tab-sections/{src['id']}", headers=h,
                       json={"position_pool": [{
                           "id": "g1", "code": "001",
                           "steps": [{"id": "s1", "fen": FEN, "sentence": "x", "turn": "w"}],
                       }]})

    copy = (await client.post(f"/admin/custom-tab-sections/{src['id']}/duplicate", headers=h,
                              json={"new_title": "Sınıf 2"})).json()
    assert copy["position_pool"] == []
