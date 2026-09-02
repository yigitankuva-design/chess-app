from sqlalchemy import String, Integer, Text, JSON, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from chess_api.database import Base


class CustomTab(Base):
    """Zafer hoca'nin ekledigi ozel sekme — kendi sayfasi olan sinirsiz-sayida
    sekme (B grubu). Eski "hazir sayfaya kisayol" ozelliginin yerine gecer."""

    __tablename__ = "custom_tabs"
    id: Mapped[int] = mapped_column(primary_key=True)
    order_index: Mapped[int] = mapped_column(Integer)
    label: Mapped[str] = mapped_column(String(60))
    emoji: Mapped[str] = mapped_column(String(10))


class CustomTabSection(Base):
    """Bir ozel sekmenin sayfasindaki tek bir bolum — baslik + yazi + gorseller.
    Pratik Yap sekmesi icin ayrica bir bot-pratigi konum havuzu tutar
    (practice_positions) — {id, fen} sozlukleri; turn FEN icinde zaten var.

    Madde 2026-08-22: `parent_id` ile KENDINE REFERANS veren bir agac yapisi —
    bir alt sekmenin kendi alt sekmeleri, onlarin da kendi alt sekmeleri
    olabilir (sinirsiz derinlik). `custom_tab_id` her seviyede AYNI kok
    sekmeyi gosterir (sorgular basitlesin diye) — parent_id iceride hangi
    dugumun altinda oldugunu belirler. parent_id NULL ise en ust seviye
    (dogrudan sekmenin altindaki) bolumdur."""

    __tablename__ = "custom_tab_sections"
    id: Mapped[int] = mapped_column(primary_key=True)
    custom_tab_id: Mapped[int] = mapped_column(ForeignKey("custom_tabs.id"), index=True)
    parent_id: Mapped[int | None] = mapped_column(
        ForeignKey("custom_tab_sections.id"), nullable=True, index=True,
    )
    order_index: Mapped[int] = mapped_column(Integer)
    title: Mapped[str] = mapped_column(String(160))
    body: Mapped[str] = mapped_column(Text)
    images: Mapped[list] = mapped_column(JSON, default=list)
    practice_positions: Mapped[list] = mapped_column(JSON, default=list)
    emoji: Mapped[str | None] = mapped_column(String(10), nullable=True)
    # Madde 2026-08-26: Alt Konu'nun "Konum Havuzu"su — her biri KENDİ kod
    # numarasıyla havuza eklenen bir GRUP: {id, code, steps: [{id, fen,
    # sentence, turn}]}. Bir grubun içindeki adımlar (numaralı butonlar)
    # Hızlı Erişim'de tahtanın solunda sırayla gösterilir; gruplar arasında
    # (kodlar arasında) İleri/Geri ile gezinilir. Madde 2026-08-25'teki ayrı
    # "explanation_cards" (açıklama kartları) özelliğinin YERİNE geçer — o
    # zaman hiç gerçek veri girilmemişti (henüz production'a hiç uygulanmadı).
    position_pool: Mapped[list] = mapped_column(JSON, default=list)
    # Madde 2026-09-02: "Pratik Yap" sekmesinin 3 sabit alt bölümünü (Açılış/
    # Kazanç/Oyunsonu) ADDAN BAĞIMSIZ tanımak için — admin artık bunların
    # BAŞLIĞINI (title) serbestçe değiştirebiliyor, ama özel davranışları
    # (açılış pratiği ekranı, 5 kategori seçimi, "Konumun Sahibi" alanı)
    # hâlâ bu sabit değere bakarak çalışmalı — 'opening' | 'kazanc' |
    # 'oyunsonu' | None (None = sıradan bölüm, hoca'nın kendi eklediği gibi).
    # BİR KEZ oluşturulunca DEĞİŞMEZ; PATCH ile güncellenemez.
    section_kind: Mapped[str | None] = mapped_column(String(20), nullable=True)
    # Madde 2026-09-02 (devam): "Açılış Pratiği Yap" a/b/c'ye ayrıldı — bu iki
    # kolon a) Konum Pratiği (çoktan seçmeli soru: {id, code, instruction,
    # fen, answer_kind, options, correct_index, success_msg?, fail_msg?}) ve
    # b) Teori Pratiği (hamle-dizisi sorusu: {id, code, instruction, fen,
    # moves, opening_name, student_color, success_msg?, fail_msg?}) havuzlarını
    # tutar. practice_positions/position_pool ile AYNI desen — section_kind
    # 'opening' olan bölümde doldurulur, diğerlerinde boş kalır.
    konum_pratigi_pool: Mapped[list] = mapped_column(JSON, default=list)
    teori_pratigi_pool: Mapped[list] = mapped_column(JSON, default=list)
