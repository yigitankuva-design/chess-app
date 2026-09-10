# Madde 2026-09-11 (Ödev Sistemi, Faz 2): "Çalışmalar/Dersler" ağacındaki bir
# Alt Konu ↔ Dersler müfredatındaki LessonStep köprüsü (linked_lesson_step_id).
# Bağ yoksa antrenörün "Ödev Gönder" düğmesi devre dışıdır.
import pytest
from chess_api.models import User, UserRole, Module, Lesson, LessonStep, LessonStepType


async def _admin_token(client, db, email="kopru@t.com"):
    r = await client.post("/auth/teacher/signup", json={
        "email": email, "password": "guvenli12345", "name": "Admin",
    })
    body = r.json()
    user = await db.get(User, body["user_id"])
    user.role = UserRole.admin
    await db.commit()
    return body["access_token"]


async def _seed_curriculum(db, duzey: str, konu: str, alt_konular: list[str], order: int = 1):
    m = Module(order_index=order, name=duzey, description="d", icon="x")
    db.add(m)
    await db.flush()
    les = Lesson(module_id=m.id, order_index=1, title=konu)
    db.add(les)
    await db.flush()
    step_ids = {}
    for i, t in enumerate(alt_konular):
        step = LessonStep(lesson_id=les.id, order_index=i + 1,
                          type=LessonStepType.explanation, content_json={"title": t})
        db.add(step)
        await db.flush()
        step_ids[t] = step.id
    # Başlıksız / farklı türde adımlar — katalog bunları atlamalı.
    noise = LessonStep(lesson_id=les.id, order_index=99, type=LessonStepType.quiz,
                       content_json={"question": "x"})
    db.add(noise)
    await db.commit()
    return m.id, les.id, step_ids


async def _build_dersler_tree(client, h, duzey: str, konu: str, alt_konular: list[str]):
    """CustomTab → dersler_root → Düzey → Konu → [Alt Konu...] ağacı kurar."""
    tab = (await client.post("/admin/custom-tabs", headers=h, json={"label": "Çalışmalar"})).json()
    root = (await client.post(f"/admin/custom-tabs/{tab['id']}/sections", headers=h, json={
        "title": "Dersler", "body": "", "images": [], "section_kind": "dersler_root",
    })).json()
    duzey_s = (await client.post(f"/admin/custom-tabs/{tab['id']}/sections", headers=h, json={
        "title": duzey, "body": "", "images": [], "parent_id": root["id"],
    })).json()
    konu_s = (await client.post(f"/admin/custom-tabs/{tab['id']}/sections", headers=h, json={
        "title": konu, "body": "", "images": [], "parent_id": duzey_s["id"],
    })).json()
    alt_ids = {}
    for t in alt_konular:
        a = (await client.post(f"/admin/custom-tabs/{tab['id']}/sections", headers=h, json={
            "title": t, "body": "", "images": [], "parent_id": konu_s["id"],
        })).json()
        alt_ids[t] = a["id"]
    return tab["id"], root["id"], alt_ids


@pytest.mark.asyncio
async def test_lesson_step_catalog_sadece_bas3likli_explanation_adimlarini_doner(client, db):
    tok = await _admin_token(client, db, "cat1@t.com")
    h = {"Authorization": f"Bearer {tok}"}
    await _seed_curriculum(db, "Temel Düzey", "Tahta ve Taşlar", ["Tahtanın Özellikleri", "Merkez"])

    r = await client.get("/admin/lesson-step-catalog", headers=h)
    assert r.status_code == 200
    cat = r.json()
    assert len(cat) == 1
    mod = cat[0]
    assert mod["module_name"] == "Temel Düzey"
    assert len(mod["lessons"]) == 1
    steps = mod["lessons"][0]["steps"]
    # quiz (başlıksız) adım atlandı — sadece 2 explanation adımı.
    assert [s["title"] for s in steps] == ["Tahtanın Özellikleri", "Merkez"]


@pytest.mark.asyncio
async def test_alt_konu_bagi_patch_ile_kurulur_ve_kaldirilir(client, db):
    tok = await _admin_token(client, db, "patch1@t.com")
    h = {"Authorization": f"Bearer {tok}"}
    _, _, step_ids = await _seed_curriculum(db, "Temel Düzey", "Tahta ve Taşlar", ["Tahtanın Özellikleri"])
    step_id = step_ids["Tahtanın Özellikleri"]
    _, _, alt_ids = await _build_dersler_tree(client, h, "Temel Düzey", "Tahta ve Taşlar", ["Tahtanın Özellikleri"])
    section_id = alt_ids["Tahtanın Özellikleri"]

    r = await client.patch(f"/admin/custom-tab-sections/{section_id}", headers=h,
                           json={"linked_lesson_step_id": step_id})
    assert r.status_code == 200
    assert r.json()["linked_lesson_step_id"] == step_id

    # None gönderilince bağ kalkar.
    r2 = await client.patch(f"/admin/custom-tab-sections/{section_id}", headers=h,
                            json={"linked_lesson_step_id": None})
    assert r2.status_code == 200
    assert r2.json()["linked_lesson_step_id"] is None


@pytest.mark.asyncio
async def test_bag_alani_gonderilmezse_degismez(client, db):
    tok = await _admin_token(client, db, "patch2@t.com")
    h = {"Authorization": f"Bearer {tok}"}
    _, _, step_ids = await _seed_curriculum(db, "Düzey", "Konu", ["A"])
    _, _, alt_ids = await _build_dersler_tree(client, h, "Düzey", "Konu", ["A"])
    section_id = alt_ids["A"]
    await client.patch(f"/admin/custom-tab-sections/{section_id}", headers=h,
                       json={"linked_lesson_step_id": step_ids["A"]})

    # Sadece başlık güncelle — bağ korunmalı.
    r = await client.patch(f"/admin/custom-tab-sections/{section_id}", headers=h,
                           json={"title": "A (yeni ad)"})
    assert r.json()["linked_lesson_step_id"] == step_ids["A"]


@pytest.mark.asyncio
async def test_gecersiz_step_id_ile_baglama_404(client, db):
    tok = await _admin_token(client, db, "patch3@t.com")
    h = {"Authorization": f"Bearer {tok}"}
    _, _, alt_ids = await _build_dersler_tree(client, h, "Düzey", "Konu", ["A"])
    r = await client.patch(f"/admin/custom-tab-sections/{alt_ids['A']}", headers=h,
                           json={"linked_lesson_step_id": 999999})
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_custom_tab_detay_linked_lesson_step_id_doner(client, db):
    tok = await _admin_token(client, db, "det1@t.com")
    h = {"Authorization": f"Bearer {tok}"}
    _, _, step_ids = await _seed_curriculum(db, "Düzey", "Konu", ["A"])
    tab_id, _, alt_ids = await _build_dersler_tree(client, h, "Düzey", "Konu", ["A"])
    await client.patch(f"/admin/custom-tab-sections/{alt_ids['A']}", headers=h,
                       json={"linked_lesson_step_id": step_ids["A"]})

    detail = (await client.get(f"/custom-tabs/{tab_id}")).json()
    alt = next(s for s in detail["sections"] if s["id"] == alt_ids["A"])
    assert alt["linked_lesson_step_id"] == step_ids["A"]
    # Bağlanmamış bölümlerde None.
    root = next(s for s in detail["sections"] if s["section_kind"] == "dersler_root")
    assert root["linked_lesson_step_id"] is None


@pytest.mark.asyncio
async def test_auto_match_birebir_baslik_eslesmesinde_baglar(client, db):
    tok = await _admin_token(client, db, "am1@t.com")
    h = {"Authorization": f"Bearer {tok}"}
    _, _, step_ids = await _seed_curriculum(
        db, "Temel Düzey", "Tahta ve Taşlar", ["Tahtanın Özellikleri", "Merkez"])
    tab_id, _, alt_ids = await _build_dersler_tree(
        client, h, "Temel Düzey", "Tahta ve Taşlar", ["Tahtanın Özellikleri", "Merkez"])

    r = await client.post("/admin/custom-tabs/lesson-link/auto-match", headers=h)
    assert r.status_code == 200
    rep = r.json()
    assert len(rep["linked"]) == 2
    assert rep["unmatched"] == []
    assert rep["ambiguous"] == []

    detail = (await client.get(f"/custom-tabs/{tab_id}")).json()
    by_id = {s["id"]: s for s in detail["sections"]}
    assert by_id[alt_ids["Tahtanın Özellikleri"]]["linked_lesson_step_id"] == step_ids["Tahtanın Özellikleri"]
    assert by_id[alt_ids["Merkez"]]["linked_lesson_step_id"] == step_ids["Merkez"]


@pytest.mark.asyncio
async def test_auto_match_bosluk_ve_buyuk_harf_farkini_yok_sayar(client, db):
    tok = await _admin_token(client, db, "am2@t.com")
    h = {"Authorization": f"Bearer {tok}"}
    _, _, step_ids = await _seed_curriculum(db, "Temel Düzey", "Tahta ve Taşlar", ["Merkez Kareler"])
    tab_id, _, alt_ids = await _build_dersler_tree(
        client, h, "  temel  düzey ", "Tahta ve Taşlar", ["  MERKEZ   Kareler  "])

    r = await client.post("/admin/custom-tabs/lesson-link/auto-match", headers=h)
    assert len(r.json()["linked"]) == 1

    detail = (await client.get(f"/custom-tabs/{tab_id}")).json()
    by_id = {s["id"]: s for s in detail["sections"]}
    assert by_id[alt_ids["  MERKEZ   Kareler  "]]["linked_lesson_step_id"] == step_ids["Merkez Kareler"]


@pytest.mark.asyncio
async def test_auto_match_elle_baglanmisa_dokunmaz(client, db):
    tok = await _admin_token(client, db, "am3@t.com")
    h = {"Authorization": f"Bearer {tok}"}
    _, _, step_ids = await _seed_curriculum(db, "Düzey", "Konu", ["A", "B"])
    _, _, alt_ids = await _build_dersler_tree(client, h, "Düzey", "Konu", ["A", "B"])
    # "A"yı bilerek YANLIŞ adıma bağla (B'nin adımına).
    await client.patch(f"/admin/custom-tab-sections/{alt_ids['A']}", headers=h,
                       json={"linked_lesson_step_id": step_ids["B"]})

    r = await client.post("/admin/custom-tabs/lesson-link/auto-match", headers=h)
    rep = r.json()
    assert rep["already_linked"] == 1
    # Sadece "B" yeni bağlandı, "A" elle bağlı kaldı (bozulmadı).
    assert [x["section_id"] for x in rep["linked"]] == [alt_ids["B"]]

    lst = (await client.get("/admin/custom-tabs/lesson-link/status", headers=h)).json()
    by_sec = {i["section_id"]: i for i in lst["items"]}
    assert by_sec[alt_ids["A"]]["linked_lesson_step_id"] == step_ids["B"]


@pytest.mark.asyncio
async def test_auto_match_eslesmeyeni_rapor_eder(client, db):
    tok = await _admin_token(client, db, "am4@t.com")
    h = {"Authorization": f"Bearer {tok}"}
    await _seed_curriculum(db, "Düzey", "Konu", ["A"])
    _, _, alt_ids = await _build_dersler_tree(client, h, "Düzey", "Konu", ["A", "Bambaşka Alt Konu"])

    r = await client.post("/admin/custom-tabs/lesson-link/auto-match", headers=h)
    rep = r.json()
    assert len(rep["linked"]) == 1
    assert [x["section_id"] for x in rep["unmatched"]] == [alt_ids["Bambaşka Alt Konu"]]


@pytest.mark.asyncio
async def test_auto_match_belirsiz_adayi_baglamaz(client, db):
    tok = await _admin_token(client, db, "am5@t.com")
    h = {"Authorization": f"Bearer {tok}"}
    # AYNI (düzey, konu, alt konu) başlığına sahip İKİ adım — belirsiz.
    m = Module(order_index=1, name="Düzey", description="d", icon="x")
    db.add(m)
    await db.flush()
    les = Lesson(module_id=m.id, order_index=1, title="Konu")
    db.add(les)
    await db.flush()
    for i in range(2):
        db.add(LessonStep(lesson_id=les.id, order_index=i + 1,
                          type=LessonStepType.explanation, content_json={"title": "A"}))
    await db.commit()
    _, _, alt_ids = await _build_dersler_tree(client, h, "Düzey", "Konu", ["A"])

    r = await client.post("/admin/custom-tabs/lesson-link/auto-match", headers=h)
    rep = r.json()
    assert rep["linked"] == []
    assert len(rep["ambiguous"]) == 1
    assert rep["ambiguous"][0]["section_id"] == alt_ids["A"]
    assert len(rep["ambiguous"][0]["candidate_step_ids"]) == 2


@pytest.mark.asyncio
async def test_adim_silinince_bag_bosalir_bolum_kalir(client, db):
    tok = await _admin_token(client, db, "del1@t.com")
    h = {"Authorization": f"Bearer {tok}"}
    _, _, step_ids = await _seed_curriculum(db, "Düzey", "Konu", ["A"])
    tab_id, _, alt_ids = await _build_dersler_tree(client, h, "Düzey", "Konu", ["A"])
    await client.patch(f"/admin/custom-tab-sections/{alt_ids['A']}", headers=h,
                       json={"linked_lesson_step_id": step_ids["A"]})

    r = await client.delete(f"/admin/steps/{step_ids['A']}", headers=h)
    assert r.status_code == 200

    detail = (await client.get(f"/custom-tabs/{tab_id}")).json()
    alt = next(s for s in detail["sections"] if s["id"] == alt_ids["A"])
    assert alt["linked_lesson_step_id"] is None  # bağ koptu, bölüm duruyor


@pytest.mark.asyncio
async def test_ders_silinince_bag_bosalir(client, db):
    tok = await _admin_token(client, db, "del2@t.com")
    h = {"Authorization": f"Bearer {tok}"}
    _, lesson_id, step_ids = await _seed_curriculum(db, "Düzey", "Konu", ["A"])
    tab_id, _, alt_ids = await _build_dersler_tree(client, h, "Düzey", "Konu", ["A"])
    await client.patch(f"/admin/custom-tab-sections/{alt_ids['A']}", headers=h,
                       json={"linked_lesson_step_id": step_ids["A"]})

    r = await client.delete(f"/admin/lessons/{lesson_id}", headers=h)
    assert r.status_code == 200

    detail = (await client.get(f"/custom-tabs/{tab_id}")).json()
    alt = next(s for s in detail["sections"] if s["id"] == alt_ids["A"])
    assert alt["linked_lesson_step_id"] is None


@pytest.mark.asyncio
async def test_lesson_link_status_ozet_doner(client, db):
    tok = await _admin_token(client, db, "st1@t.com")
    h = {"Authorization": f"Bearer {tok}"}
    _, _, step_ids = await _seed_curriculum(db, "Düzey", "Konu", ["A", "B"])
    _, _, alt_ids = await _build_dersler_tree(client, h, "Düzey", "Konu", ["A", "B"])
    await client.patch(f"/admin/custom-tab-sections/{alt_ids['A']}", headers=h,
                       json={"linked_lesson_step_id": step_ids["A"]})

    r = await client.get("/admin/custom-tabs/lesson-link/status", headers=h)
    assert r.status_code == 200
    body = r.json()
    assert body["total"] == 2
    assert body["linked"] == 1
    by_sec = {i["section_id"]: i for i in body["items"]}
    assert by_sec[alt_ids["A"]]["linked_step_title"] == "A"
    assert by_sec[alt_ids["B"]]["linked_lesson_step_id"] is None


@pytest.mark.asyncio
async def test_uc_katalog_ve_auto_match_admin_ister(client, db):
    """Yönetici olmayan bu uçlara giremez."""
    r1 = await client.get("/admin/lesson-step-catalog")
    r2 = await client.post("/admin/custom-tabs/lesson-link/auto-match")
    assert r1.status_code in (401, 403)
    assert r2.status_code in (401, 403)
