"""preDeployCommand tohum zincirinin butunlugu.

Bu test P8'de yasanan sessiz hatayi kilitler: seed_pool_images.py yazildi,
verisi uretildi, testi kuruldu — ama preDeployCommand'a EKLENMEDI. Sonuc:
canli havuz bos kaldi ve ikonlar elle yuklenmek zorunda kalindi.

Kural: scripts/ altindaki her seed_*.py ya deploy zincirinde olmali ya da
burada BILINCLI olarak muaf sayilmali.
"""
import json
from pathlib import Path

API_ROOT = Path(__file__).resolve().parents[1]
RAILWAY = API_ROOT / "railway.json"
SCRIPTS = API_ROOT / "scripts"

# Deploy'da KASTEN calismayan seed'ler ve gerekcesi.
EXEMPT = {
    # Mufredat icerigi artik hocanin panelden girdigi KULLANICI VERISIDIR
    # (KURAL #4). Her deploy'da tohumlanirsa hocanin girdileri ezilir.
    "seed_curriculum",
}


def _pre_deploy() -> str:
    cfg = json.loads(RAILWAY.read_text(encoding="utf-8"))
    return cfg["deploy"]["preDeployCommand"]


def test_railway_json_pre_deploy_komutu_vardir():
    assert "alembic upgrade head" in _pre_deploy()


def test_her_seed_scripti_ya_deployda_ya_muaf():
    cmd = _pre_deploy()
    names = {p.stem for p in SCRIPTS.glob("seed_*.py")}
    assert names, "scripts/ altinda seed_*.py bulunamadi"
    for name in sorted(names):
        if name in EXEMPT:
            continue
        assert f"scripts.{name}" in cmd, (
            f"{name} deploy zincirinde YOK. Ya preDeployCommand'a ekle "
            f"ya da gerekcesiyle EXEMPT'e al."
        )


def test_havuz_tohumu_deploy_zincirindedir():
    """Bugun yasanan somut hata — ayrica ve acikca kilitlenir."""
    assert "scripts.seed_pool_images" in _pre_deploy()
