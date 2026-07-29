"""Generates KULLANIM_KILAVUZU.pdf with Turkish character support."""
from fpdf import FPDF
import os

FONT_REGULAR = r"C:\Windows\Fonts\calibri.ttf"
FONT_BOLD    = r"C:\Windows\Fonts\calibrib.ttf"
OUT_PATH     = os.path.join(os.path.dirname(__file__), "KULLANIM_KILAVUZU.pdf")

GREEN  = (34, 139, 34)
BLUE   = (37, 99, 235)
DARK   = (30, 30, 30)
GRAY   = (100, 100, 100)
LGRAY  = (245, 245, 245)
WHITE  = (255, 255, 255)
ORANGE = (234, 88, 12)


class PDF(FPDF):
    def header(self):
        # top color bar
        self.set_fill_color(*BLUE)
        self.rect(0, 0, 210, 14, "F")
        self.set_font("bold", size=9)
        self.set_text_color(*WHITE)
        self.set_xy(10, 4)
        self.cell(0, 6, "Çocuklar İçin Satranç — Kullanım Kılavuzu", align="L")
        self.set_xy(0, 4)
        self.cell(200, 6, "chess-app-web-one.vercel.app", align="R")
        self.ln(14)

    def footer(self):
        self.set_y(-12)
        self.set_font("regular", size=8)
        self.set_text_color(*GRAY)
        self.cell(0, 6, f"Sayfa {self.page_no()}", align="C")

    # ------------------------------------------------------------------ helpers

    def chapter_title(self, number: str, title: str, color=BLUE):
        self.ln(4)
        self.set_fill_color(*color)
        self.set_text_color(*WHITE)
        self.set_font("bold", size=13)
        self.cell(0, 10, f"  {number}  {title}", fill=True, new_x="LMARGIN", new_y="NEXT")
        self.ln(2)
        self.set_text_color(*DARK)

    def section_title(self, title: str):
        self.ln(3)
        self.set_font("bold", size=11)
        self.set_text_color(*BLUE)
        self.cell(0, 7, title, new_x="LMARGIN", new_y="NEXT")
        self.set_draw_color(*BLUE)
        self.set_line_width(0.4)
        x = self.get_x()
        y = self.get_y()
        self.line(x, y, x + 170, y)
        self.ln(2)
        self.set_text_color(*DARK)

    def body(self, txt: str, indent: int = 0):
        self.set_font("regular", size=10)
        self.set_text_color(*DARK)
        self.set_x(self.l_margin + indent)
        self.multi_cell(0, 6, txt)
        self.ln(1)

    def step(self, number: int, text: str):
        """Numbered step with circle bullet."""
        self.set_font("bold", size=10)
        self.set_fill_color(*BLUE)
        self.set_text_color(*WHITE)
        x0 = self.l_margin + 2
        y0 = self.get_y()
        self.set_xy(x0, y0)
        self.cell(6, 6, str(number), fill=True, align="C")
        self.set_font("regular", size=10)
        self.set_text_color(*DARK)
        self.set_xy(x0 + 9, y0)
        self.multi_cell(155, 6, text)
        self.ln(1)

    def bullet(self, text: str):
        self.set_font("regular", size=10)
        self.set_text_color(*DARK)
        self.set_x(self.l_margin + 6)
        self.cell(5, 6, "•")
        self.set_x(self.l_margin + 12)
        self.multi_cell(0, 6, text)

    def info_box(self, text: str, color=LGRAY, text_color=DARK):
        self.ln(2)
        self.set_fill_color(*color)
        self.set_text_color(*text_color)
        self.set_font("regular", size=9)
        self.set_x(self.l_margin + 4)
        self.multi_cell(162, 6, text, fill=True, border=0, padding=4)
        self.ln(2)
        self.set_text_color(*DARK)

    def table_row(self, col1: str, col2: str, header=False):
        fill_color = BLUE if header else WHITE
        text_color = WHITE if header else DARK
        font = "bold" if header else "regular"
        self.set_fill_color(*fill_color)
        self.set_text_color(*text_color)
        self.set_font(font, size=10)
        self.set_x(self.l_margin)
        self.cell(30, 7, col1, border=1, fill=header, align="C")
        self.cell(140, 7, col2, border=1, fill=header)
        self.ln()
        self.set_text_color(*DARK)


# ============================================================= build

pdf = PDF(orientation="P", unit="mm", format="A4")
pdf.set_margins(left=15, top=18, right=15)
pdf.add_font("regular", fname=FONT_REGULAR)
pdf.add_font("bold",    fname=FONT_BOLD)
pdf.set_auto_page_break(auto=True, margin=16)

# ---------------------------------------------------------------- COVER PAGE
pdf.add_page()
pdf.set_fill_color(*BLUE)
pdf.rect(0, 30, 210, 60, "F")

pdf.set_font("bold", size=28)
pdf.set_text_color(*WHITE)
pdf.set_xy(0, 45)
pdf.cell(210, 14, "Çocuklar İçin Satranç", align="C", new_x="LMARGIN", new_y="NEXT")

pdf.set_font("bold", size=16)
pdf.set_xy(0, 63)
pdf.cell(210, 10, "Kullanım Kılavuzu", align="C", new_x="LMARGIN", new_y="NEXT")

pdf.set_font("regular", size=11)
pdf.set_xy(0, 78)
pdf.set_text_color(200, 220, 255)
pdf.cell(210, 8, "Öğretmen  •  Veli  •  Öğrenci", align="C", new_x="LMARGIN", new_y="NEXT")

# URL box
pdf.set_fill_color(*WHITE)
pdf.set_text_color(*BLUE)
pdf.set_font("bold", size=12)
pdf.set_xy(40, 105)
pdf.cell(130, 12, "chess-app-web-one.vercel.app", fill=True, align="C", border=0)

# Version
pdf.set_font("regular", size=9)
pdf.set_text_color(*GRAY)
pdf.set_xy(0, 270)
pdf.cell(210, 8, "v1.0 Beta  —  Mayıs 2026", align="C")

# Table of contents
pdf.set_xy(15, 130)
pdf.set_font("bold", size=12)
pdf.set_text_color(*DARK)
pdf.cell(0, 8, "İçindekiler", new_x="LMARGIN", new_y="NEXT")
pdf.set_draw_color(*BLUE)
pdf.set_line_width(0.5)
pdf.line(15, pdf.get_y(), 195, pdf.get_y())
pdf.ln(3)

toc = [
    ("1", "Öğretmen Kılavuzu", "Hesap açma, sınıf yönetimi, ödev ve anket"),
    ("2", "Veli Kılavuzu",     "Kayıt, çocuk profili, sınıfa katılım, takip"),
    ("3", "Öğrenci Kılavuzu",  "Giriş, dersler, bulmacalar, oyun, rozetler"),
]
for num, title, desc in toc:
    pdf.set_font("bold", size=11)
    pdf.set_text_color(*BLUE)
    pdf.set_x(15)
    pdf.cell(10, 8, num + ".")
    pdf.set_text_color(*DARK)
    pdf.cell(70, 8, title)
    pdf.set_font("regular", size=10)
    pdf.set_text_color(*GRAY)
    pdf.cell(0, 8, desc, new_x="LMARGIN", new_y="NEXT")

# ================================================================ PAGE 2+: TEACHER
pdf.add_page()
pdf.chapter_title("1", "ÖĞRETMEN KILAVUZU", color=BLUE)

# 1.1
pdf.section_title("1.1  Hesap Oluşturma")
pdf.body("Öğretmen hesabı açmak için aşağıdaki adımları izleyin:")
pdf.step(1, "Tarayıcınızda şu adresi açın:")
pdf.info_box("chess-app-web-one.vercel.app/teacher-signup", color=(219, 234, 254), text_color=BLUE)
pdf.step(2, "Adınızı soyadınızı, e-posta adresinizi ve şifrenizi girin.")
pdf.step(3, "Şifre en az 8 karakter olmalıdır.")
pdf.step(4, '"Öğretmen Hesabı Aç" butonuna tıklayın.')
pdf.step(5, "Hesabınız oluşturulur ve sınıf yönetim paneline yönlendirilirsiniz.")
pdf.ln(2)
pdf.info_box(
    "Sonraki girişlerde: chess-app-web-one.vercel.app/parent-login adresini kullanın.\n"
    "Sistem sizi otomatik olarak öğretmen panelinize yönlendirir.",
    color=(254, 249, 195), text_color=(133, 77, 14)
)

# 1.2
pdf.section_title("1.2  Sınıf Oluşturma")
pdf.step(1, "Giriş yaptıktan sonra Sınıflarım sayfasına gelirsiniz.")
pdf.step(2, '"Yeni Sınıf Oluştur" alanına sınıf adını yazın.')
pdf.body('   Örnek: "5-A Satranç"  veya  "Başlangıç Grubu"', indent=4)
pdf.step(3, '"Oluştur" butonuna tıklayın.')
pdf.step(4, "Sınıfınıza özel 8 haneli bir Katılım Kodu oluşturulur.")
pdf.ln(1)
pdf.info_box(
    "Katılım Kodu — Bu kodu velilere gönderin. Veliler bu kodla çocuklarını\n"
    "sınıfınıza kaydedebilir. Kod sınıf listesinde her zaman görülebilir.",
    color=(220, 252, 231), text_color=(21, 128, 61)
)

# 1.3
pdf.section_title("1.3  Sınıf Yönetimi")
pdf.body("Sınıfınıza tıklayarak üç sekmeye ulaşabilirsiniz:")
pdf.ln(1)

pdf.set_font("bold", size=10)
pdf.set_text_color(*GREEN)
pdf.cell(0, 7, "  Öğrenciler Sekmesi", new_x="LMARGIN", new_y="NEXT")
pdf.set_text_color(*DARK)
pdf.bullet("Sınıfa katılmış tüm öğrencileri görürsünüz")
pdf.bullet("Her öğrencinin adı ve avatarı listelenir")
pdf.ln(2)

pdf.set_font("bold", size=10)
pdf.set_text_color(*ORANGE)
pdf.cell(0, 7, "  Ödev Ver Sekmesi", new_x="LMARGIN", new_y="NEXT")
pdf.set_text_color(*DARK)
pdf.bullet("Ödev başlığı, açıklama ve son tarih belirleyebilirsiniz")
pdf.bullet('Örnek: "Hafta 1 – Temel Hareketler", son tarih: 5 Haziran 2026')
pdf.ln(2)

pdf.set_font("bold", size=10)
pdf.set_text_color(*BLUE)
pdf.cell(0, 7, "  Liderlik Tablosu Sekmesi", new_x="LMARGIN", new_y="NEXT")
pdf.set_text_color(*DARK)
pdf.bullet("Öğrencilerin XP (deneyim puanı) sıralamasını görürsünüz")
pdf.bullet("Satranç rütbeleri: Piyon → At → Fil → Kale → Vezir → Şah")

# ================================================================ PAGE: PARENT
pdf.add_page()
pdf.chapter_title("2", "VELİ KILAVUZU", color=GREEN)

# 2.1
pdf.section_title("2.1  Hesap Oluşturma")
pdf.step(1, "Tarayıcınızda şu adresi açın:")
pdf.info_box("chess-app-web-one.vercel.app/parent-signup", color=(220, 252, 231), text_color=(21, 128, 61))
pdf.step(2, "Adınızı, e-posta adresinizi ve şifrenizi girin.")
pdf.step(3, "KVKK onay kutusunu işaretleyin.")
pdf.step(4, '"Kayıt Ol" butonuna tıklayın.')
pdf.step(5, "Veli paneliniz açılır.")

# 2.2
pdf.section_title("2.2  Çocuk Profili Ekleme")
pdf.step(1, '"Çocuk Ekle" butonuna tıklayın.')
pdf.step(2, "Çocuğunuzun adını ve yaşını girin.")
pdf.step(3, "4 haneli bir PIN kodu belirleyin (çocuğunuz bunu hatırlamalı).")
pdf.step(4, "Bir avatar seçin.")
pdf.step(5, '"Kaydet" butonuna tıklayın.')
pdf.ln(1)
pdf.info_box(
    "PIN Kodu: Çocuğunuz uygulamaya her girişinde bu 4 rakamı kullanacak.\n"
    "Basit ama tahmin edilmesi zor bir kod seçin.",
    color=(254, 249, 195), text_color=(133, 77, 14)
)

# 2.3
pdf.section_title("2.3  Öğretmen Sınıfına Katılma")
pdf.body("Öğretmeninizden aldığınız Katılım Kodu ile çocuğunuzu sınıfa kaydedin:")
pdf.step(1, "Veli panelinde çocuğunuzun profiline tıklayın.")
pdf.step(2, '"Sınıfa Katıl" butonuna tıklayın.')
pdf.step(3, "Öğretmenin size verdiği 8 haneli kodu girin.")
pdf.step(4, '"Katıl" butonuna tıklayın.')
pdf.step(5, '"Başarıyla katıldınız" mesajı görünecek.')

# 2.4
pdf.section_title("2.4  Çocuk İlerlemesini Takip Etme")
pdf.body("Veli panelinden aşağıdakileri takip edebilirsiniz:")
pdf.bullet("Haftalık tamamlanan ders sayısı")
pdf.bullet("Çözülen bulmaca sayısı")
pdf.bullet("Kazanılan rozetler")
pdf.bullet("Uygulama kullanım süresi")
pdf.ln(2)

pdf.section_title("2.5  Ekran Süresi Limiti")
pdf.step(1, "Çocuk profiline tıklayın.")
pdf.step(2, '"Süre Limiti" bölümüne girin.')
pdf.step(3, "Günlük maksimum dakikayı belirleyin.")

# ================================================================ PAGE: STUDENT
pdf.add_page()
pdf.chapter_title("3", "ÖĞRENCİ KILAVUZU", color=ORANGE)

# 3.1
pdf.section_title("3.1  Uygulamaya Giriş")
pdf.step(1, "Tarayıcınızda şu adresi açın:")
pdf.info_box("chess-app-web-one.vercel.app/child-login", color=(255, 237, 213), text_color=(154, 52, 18))
pdf.step(2, "Profilinizi listeden seçin.")
pdf.step(3, "4 haneli PIN kodunuzu girin.")

# 3.2
pdf.section_title("3.2  Ders Çalışma")
pdf.step(1, 'Ana menüden "Dersler" e tıklayın.')
pdf.step(2, "Modülleri sırayla tamamlayın (Modül 1'den başlayın).")
pdf.step(3, "Her derste: konu anlatımını okuyun, tahtada pratik yapın.")
pdf.step(4, "Modülü bitirince mini quiz ile kendinizi test edin.")
pdf.step(5, "Başarıyla geçince bir sonraki modüle ilerleyin.")
pdf.ln(2)

# Curriculum table
pdf.set_font("bold", size=10)
pdf.set_text_color(*DARK)
pdf.cell(0, 7, "Müfredat — 9 Modül, 45 Ders:", new_x="LMARGIN", new_y="NEXT")
pdf.table_row("Modül", "Konu", header=True)
modules = [
    ("1", "Satranç tahtası ve taşlar — temel bilgiler"),
    ("2", "Temel hareketler — her taşın hareketi"),
    ("3", "Özel hamleler — rok, geçerken alma"),
    ("4", "Temel stratejiler — merkez kontrolü, taş geliştirme"),
    ("5", "Açılışlar — yaygın açılış prensipleri"),
    ("6", "Orta oyun taktikleri — çatal, iğne, pil"),
    ("7", "Son oyun teknikleri — piyade endoyunu"),
    ("8", "Bulmaca çözme — taktik problemler"),
    ("9", "Turnuva hazırlığı — zaman yönetimi"),
]
for num, topic in modules:
    pdf.table_row(num, topic)

pdf.ln(3)

# 3.3
pdf.section_title("3.3  Bulmaca Çözme")
pdf.step(1, 'Ana menüden "Bulmacalar" a tıklayın.')
pdf.step(2, "Size uygun seviyede bulmacalar otomatik gelir.")
pdf.step(3, "Doğru hamleyi tahtada yapın.")
pdf.bullet("Her doğru bulmaca XP puanı kazandırır")

# 3.4
pdf.section_title("3.4  Oyun Oynama")
pdf.set_font("bold", size=10)
pdf.set_text_color(*DARK)
pdf.cell(0, 7, "Bot ile Oynamak:", new_x="LMARGIN", new_y="NEXT")
pdf.step(1, '"Oyna" → "Bot ile Oyna" seçin.')
pdf.step(2, "Zorluk seviyesini seçin (1–8).")
pdf.step(3, "Oyunu oynayın.")
pdf.ln(2)

pdf.set_font("bold", size=10)
pdf.cell(0, 7, "Online Oynamak:", new_x="LMARGIN", new_y="NEXT")
pdf.step(1, '"Oyna" → "Online Oyna" seçin.')
pdf.step(2, "Eşleşme bekleyin — sistem otomatik rakip bulur.")

# 3.5 Badges
pdf.section_title("3.5  Rozetler ve Rütbeler")
pdf.body("İlerledikçe rozetler kazanırsınız:")
pdf.bullet("İlk Ders — İlk dersi tamamla")
pdf.bullet("Bulmaca Ustası — 10 bulmaca çöz")
pdf.bullet("Seri Yakalayıcı — 7 gün üst üste çalış")
pdf.ln(2)
pdf.info_box(
    "Rütbeler (XP puanına göre):\n"
    "Piyon  →  At  →  Fil  →  Kale  →  Vezir  →  Şah",
    color=(220, 252, 231), text_color=(21, 128, 61)
)

# ================================================================ FAQ PAGE
pdf.add_page()
pdf.chapter_title("?", "SIKÇA SORULAN SORULAR", color=GRAY)

faqs = [
    (
        "Uygulama telefonda çalışıyor mu?",
        "Evet, tüm mobil tarayıcılarda tam uyumludur. Ayrıca Chrome'da 'Ana Ekrana Ekle' "
        "seçeneğiyle uygulama gibi yükleyebilirsiniz (PWA desteği)."
    ),
    (
        "Hangi tarayıcılar destekleniyor?",
        "Chrome, Firefox, Safari ve Edge'in güncel sürümleri desteklenmektedir."
    ),
    (
        "Çocuğum PIN kodunu unuttu, ne yapabilirim?",
        "Veli hesabınızdan çocuk profiline girin ve PIN kodunu güncelleyebilirsiniz."
    ),
    (
        "Şifremi unuttum.",
        "Şu an için şifre sıfırlama özelliği geliştirilme aşamasındadır. "
        "Yeni bir hesap oluşturabilirsiniz."
    ),
    (
        "Birden fazla çocuk ekleyebilir miyim?",
        "Evet. Veli hesabına birden fazla çocuk profili eklenebilir."
    ),
    (
        "Öğrenci birden fazla sınıfa katılabilir mi?",
        "Şu an bir öğrenci bir sınıfa üye olabilir."
    ),
]

for q, a in faqs:
    pdf.set_font("bold", size=10)
    pdf.set_text_color(*BLUE)
    pdf.set_x(15)
    pdf.multi_cell(0, 7, "S: " + q)
    pdf.set_font("regular", size=10)
    pdf.set_text_color(*DARK)
    pdf.set_x(15)
    pdf.multi_cell(0, 6, "C: " + a)
    pdf.ln(3)

# ---------------------------------------------------------------- Quick ref box
pdf.ln(4)
pdf.set_fill_color(*BLUE)
pdf.set_text_color(*WHITE)
pdf.set_font("bold", size=11)
pdf.cell(0, 9, "  Hızlı Bağlantılar", fill=True, new_x="LMARGIN", new_y="NEXT")

links = [
    ("Öğretmen Kaydı",  "chess-app-web-one.vercel.app/teacher-signup"),
    ("Veli Kaydı",      "chess-app-web-one.vercel.app/parent-signup"),
    ("Giriş (Öğretmen & Veli)", "chess-app-web-one.vercel.app/parent-login"),
    ("Öğrenci Girişi",  "chess-app-web-one.vercel.app/child-login"),
]
for label, url in links:
    pdf.set_fill_color(*LGRAY)
    pdf.set_text_color(*DARK)
    pdf.set_font("bold", size=10)
    pdf.set_x(15)
    pdf.cell(55, 8, label, fill=True)
    pdf.set_font("regular", size=10)
    pdf.set_text_color(*BLUE)
    pdf.cell(0, 8, url, fill=True, new_x="LMARGIN", new_y="NEXT")


pdf.output(OUT_PATH)
print(f"PDF olusturuldu: {OUT_PATH}")
