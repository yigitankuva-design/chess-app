"""ÖZ-DENETİM: bir çocuk BAŞKA bir çocuğun bot oyununa hamle yazabiliyor mu?

Bu test bir GÜVENLİK İDDİASINI kanıtlar/çürütür — tahmin değil, gerçek çalıştırma.
Test GEÇERSE (ikinci çocuk 4xx alır) sistem güvenli demektir.
Test BAŞARISIZ olursa (hamle kabul edilir) IDOR açığı KANITLANMIŞ olur.
"""
import pytest


async def _make_child(client, email: str, dev: str):
    r = await client.post("/auth/parent/signup", json={
        "email": email, "password": "guvenli12345", "name": "Parent",
    })
    ptok = r.json()["access_token"]
    r = await client.post("/children", headers={"Authorization": f"Bearer {ptok}"},
                          json={"display_name": "Cocuk", "age": 10, "pin": "1234"})
    cid = r.json()["id"]
    await client.post("/auth/device/register",
                      headers={"Authorization": f"Bearer {ptok}"},
                      json={"device_fingerprint": dev, "name": "D"})
    r = await client.post("/auth/child/pin", json={
        "child_profile_id": cid, "pin": "1234", "device_fingerprint": dev,
    })
    return r.json()["access_token"], cid


@pytest.mark.asyncio
async def test_child_cannot_move_in_another_childs_game(client):
    tok_a, _ = await _make_child(client, "audit_a@t.com", "devA")
    tok_b, _ = await _make_child(client, "audit_b@t.com", "devB")

    # Çocuk A bir bot oyunu başlatır.
    r = await client.post("/games/bot/start",
                          headers={"Authorization": f"Bearer {tok_a}"},
                          json={"skill_level": 0})
    assert r.status_code == 200, r.text
    game_id = r.json()["game_id"]

    # Çocuk B, A'nın oyununa hamle yazmayı DENER.
    r = await client.post(f"/games/{game_id}/move",
                          headers={"Authorization": f"Bearer {tok_b}"},
                          json={"move_uci": "e2e4"})

    # GÜVENLİ davranış: reddedilmeli (403).
    assert r.status_code == 403, (
        f"IDOR: baska cocuk hamle yazabildi! status={r.status_code} body={r.text}"
    )


@pytest.mark.asyncio
async def test_game_detail_requires_participant(client):
    tok_a, _ = await _make_child(client, "audit_c@t.com", "devC")
    tok_b, _ = await _make_child(client, "audit_d@t.com", "devD")

    r = await client.post("/games/bot/start",
                          headers={"Authorization": f"Bearer {tok_a}"},
                          json={"skill_level": 0})
    game_id = r.json()["game_id"]

    # Kimlik doğrulamasız erişim reddedilmeli (401/403).
    r = await client.get(f"/games/{game_id}")
    assert r.status_code in (401, 403), f"auth'suz erisim acik! {r.status_code}"

    # Başka çocuk da göremez (403).
    r = await client.get(f"/games/{game_id}",
                         headers={"Authorization": f"Bearer {tok_b}"})
    assert r.status_code == 403, f"baska cocuk detay gordu! {r.status_code} {r.text}"

    # Sahibi görebilir (200).
    r = await client.get(f"/games/{game_id}",
                         headers={"Authorization": f"Bearer {tok_a}"})
    assert r.status_code == 200, r.text
