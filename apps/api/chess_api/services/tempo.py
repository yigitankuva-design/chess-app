"""Tempo siniflandirmasi — apps/web/lib/play/levels.ts'deki TIME_GROUPS ile
BIREBIR AYNI 9 sabit (taban_saniye, artirim_saniye) cifti. Iki taraf ayri
dillerde oldugu icin tek bir kaynaktan paylasilamiyor; degisirse İKİSİ DE
guncellenmeli (bkz. o dosyadaki yorum).

Eslesmeyen bir tempo (saatsiz mac, ya da admin'in eskiden serbest girdigi
bir deger) None doner — o mac hicbir puanlama etkilemez (madde 6, 2026-08-20:
"Sporcu Performans Puanı" YALNIZCA bu 9 sabitten birine tam eslesen maclarda
degisir).
"""

TEMPO_BY_SECONDS: dict[tuple[int, int], str] = {
    (180, 2): "Yıldırım", (300, 0): "Yıldırım", (300, 3): "Yıldırım",
    (600, 0): "Hızlı", (600, 5): "Hızlı", (900, 10): "Hızlı",
    (1800, 0): "Klasik", (1800, 10): "Klasik", (1800, 20): "Klasik",
}

TEMPO_CATEGORIES = ("Yıldırım", "Hızlı", "Klasik")


def tempo_category(base_ms: int | None, increment_ms: int | None) -> str | None:
    if base_ms is None:
        return None
    base_s = round(base_ms / 1000)
    inc_s = round((increment_ms or 0) / 1000)
    return TEMPO_BY_SECONDS.get((base_s, inc_s))
