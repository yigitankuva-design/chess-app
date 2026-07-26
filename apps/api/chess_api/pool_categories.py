"""Görsel havuzu kategorileri — tek doğruluk kaynağı.

Hem POST /admin/pool-images doğrulaması hem tohum verisi (scripts/) bu listeyi
kullanır. Sıra kullanıcının belirttiği sıradır, UI'da da bu sırayla gösterilir.
"Satranç Şampiyonları" KASTEN tohum verisi olmadan gelir — gerçek kişi
fotoğrafları telif riski taşır, uydurulmaz (KURAL #1); Zafer Hoca kendisi ekler.

"Gök Cisimleri" kullanıcı isteğiyle KALDIRILDI (madde 3c). Kategoriden çıkan
tohum görselleri seed_pool_images.py tarafından silinir; bir soruya eklenmiş
görseller ETKİLENMEZ — soru, görseli kendi içine kopyalar.
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
    "Satranç Şampiyonları",
    "Harfler",
    "Rakamlar",
]
