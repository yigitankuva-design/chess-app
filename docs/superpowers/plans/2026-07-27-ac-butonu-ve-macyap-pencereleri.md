# AÇ Butonu + Maç Yap 4 Pencere Implementation Plan (Alt proje A)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans.

**Goal:** Admin > Sekmeler: AÇ yazısı %50 büyür (0.65rem -> 0.975rem); Maç Yap kartı
açılınca 4 açılır pencere (Arkadaşınla Oyna / Bota Karşı Oyna / Açılış Pratiği Yap /
Turnuvaya Katıl), Açılış Listesi linki "Açılış Pratiği Yap"ın altına taşınır,
diğer üçü "yakında" iskeleti. Aynı anda tek alt pencere açık.

**Files:** apps/web/app/admin/settings/tabs/page.tsx (değişir),
apps/web/tests/admin-tabs-accordion.test.tsx (Maç Yap testi yeniden yazılır + yeni testler).

Task 1: Testleri güncelle (kırmızı) -> uygula (yeşil) -> commit.
Task 2: tsc/lint/vitest/build kapısı -> push kullanıcı onayıyla (zaten "push et" akışı).
