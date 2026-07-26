"""Görsel havuzu kategorileri — tek doğruluk kaynağı.

Hem POST /admin/pool-images doğrulaması hem tohum verisi (scripts/) bu listeyi
kullanır. Sıra kullanıcının belirttiği sıradır, UI'da da bu sırayla gösterilir.
"Satranç Şampiyonları" KASTEN tohum verisi olmadan gelir — gerçek kişi
fotoğrafları telif riski taşır, uydurulmaz (KURAL #1); Zafer Hoca kendisi ekler.
"""

POOL_CATEGORIES = [
    "Geometrik Şekiller",
    "Satranç Tahtası",
    "Satranç Taşları",
    "Hayvanlar",
    "Bitkiler",
    "Taşıtlar",
    "Gezegenler",
    "Meslekler",
    "Gök Cisimleri",
    "Satranç Şampiyonları",
    "Harfler",
    "Rakamlar",
]
