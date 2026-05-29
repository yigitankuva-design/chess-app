"""Lesson 1 — replace single board_exercise with board_exercises array (10 per step)

Revision ID: Lesson1_Add10Exercises
Revises: Fix_DarkSquares
Create Date: 2026-05-29 08:00:00.000000
"""
from alembic import op
from sqlalchemy import text
import json

revision = 'Lesson1_Add10Exercises'
down_revision = 'Fix_DarkSquares'
branch_labels = None
depends_on = None

# ── Square sets ───────────────────────────────────────────────────────────────
DARK = ["a1","a3","a5","a7","b2","b4","b6","b8","c1","c3","c5","c7",
        "d2","d4","d6","d8","e1","e3","e5","e7","f2","f4","f6","f8",
        "g1","g3","g5","g7","h2","h4","h6","h8"]
LIGHT= ["a2","a4","a6","a8","b1","b3","b5","b7","c2","c4","c6","c8",
        "d1","d3","d5","d7","e2","e4","e6","e8","f1","f3","f5","f7",
        "g2","g4","g6","g8","h1","h3","h5","h7"]
EMPTY = "8/8/8/8/8/8/8/8 w - - 0 1"
START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"

# ── 60 exercises (10 per step) ────────────────────────────────────────────────
STEP_EXERCISES = {

# ── 1.1  Tahtanın Genel Özellikleri ──────────────────────────────────────────
1: [
  {"type":"click_square","instruction":"🎯 Tahtada koyu renkli bir kareye tıkla!",
   "fen":EMPTY,"target_squares":DARK,"hint_squares":[],
   "success_msg":"Evet! Bu koyu renkli bir kare.","fail_msg":"Bu açık renkli. Koyu (kahverengi) kareye tıkla!"},

  {"type":"click_square","instruction":"🎯 Tahtada açık renkli (krem rengi) bir kareye tıkla!",
   "fen":EMPTY,"target_squares":LIGHT,"hint_squares":[],
   "success_msg":"Harika! Bu açık renkli bir kare.","fail_msg":"Bu koyu renkli. Açık (krem) kareye tıkla!"},

  {"type":"click_square","instruction":"🎯 Altın renkli karelerden birine tıkla — bunlar koyu kareler!",
   "fen":EMPTY,"target_squares":DARK,"hint_squares":DARK,
   "success_msg":"Bravo! Koyu kareleri tanıyorsun.","fail_msg":"Altın renkli karelere tıkla!"},

  {"type":"click_square","instruction":"🎯 Sol alt köşedeki kareye (a1) tıkla!",
   "fen":EMPTY,"target_squares":["a1"],"hint_squares":["a1"],
   "success_msg":"Mükemmel! a1 sol alt köşedir — koyu renktedir.","fail_msg":"Sol alt köşeye tıkla!"},

  {"type":"click_square","instruction":"🎯 Sağ üst köşedeki kareye (h8) tıkla!",
   "fen":EMPTY,"target_squares":["h8"],"hint_squares":["h8"],
   "success_msg":"Süper! h8 sağ üst köşedir — koyu renktedir.","fail_msg":"Sağ üst köşeye tıkla!"},

  {"type":"click_square","instruction":"🎯 1. sıradaki koyu karelerden birine tıkla!",
   "fen":EMPTY,"target_squares":["a1","c1","e1","g1"],"hint_squares":["a1","c1","e1","g1"],
   "success_msg":"Doğru! 1. sıranın koyu kareleri: a1, c1, e1, g1.","fail_msg":"1. sıradaki altın karelere tıkla!"},

  {"type":"click_square","instruction":"🎯 1. sıradaki açık karelerden birine tıkla!",
   "fen":EMPTY,"target_squares":["b1","d1","f1","h1"],"hint_squares":["b1","d1","f1","h1"],
   "success_msg":"Harika! 1. sıranın açık kareleri: b1, d1, f1, h1.","fail_msg":"1. sıradaki altın karelere tıkla!"},

  {"type":"click_square","instruction":"🎯 'e' sütunundaki koyu karelerden birine tıkla!",
   "fen":EMPTY,"target_squares":["e1","e3","e5","e7"],"hint_squares":["e1","e3","e5","e7"],
   "success_msg":"Doğru! e sütununun koyu kareleri: e1, e3, e5, e7.","fail_msg":"e sütununun altın renkli karelerine tıkla!"},

  {"type":"click_square","instruction":"🎯 e4 karesine tıkla! (e sütunu, 4. sıra — açık renkli)",
   "fen":EMPTY,"target_squares":["e4"],"hint_squares":["e4"],
   "success_msg":"Mükemmel! e4 açık renkli bir karedir.","fail_msg":"e sütunu, 4. sıra → e4!"},

  {"type":"click_square","instruction":"🎯 Altın renkli açık karelerden birine tıkla!",
   "fen":EMPTY,"target_squares":LIGHT,"hint_squares":LIGHT,
   "success_msg":"Harika! Açık kareleri tanıyorsun.","fail_msg":"Altın renkli karelere tıkla!"},
],

# ── 1.2  Merkez Kavramı ───────────────────────────────────────────────────────
2: [
  {"type":"click_square","instruction":"🎯 Tahtanın merkezindeki 4 kareden birine tıkla!",
   "fen":EMPTY,"target_squares":["d4","d5","e4","e5"],"hint_squares":["d4","d5","e4","e5"],
   "success_msg":"Harika! Bu merkez karelerinden biri.","fail_msg":"Altın renkli merkez karelerinden birine tıkla!"},

  {"type":"click_square","instruction":"🎯 d4 karesine tıkla! (d sütunu, 4. sıra)",
   "fen":EMPTY,"target_squares":["d4"],"hint_squares":["d4"],
   "success_msg":"Mükemmel! d4 merkez karelerinden biridir.","fail_msg":"d sütunu, 4. sıra → d4!"},

  {"type":"click_square","instruction":"🎯 e5 karesine tıkla! (e sütunu, 5. sıra)",
   "fen":EMPTY,"target_squares":["e5"],"hint_squares":["e5"],
   "success_msg":"Süper! e5 merkez karelerinden biridir.","fail_msg":"e sütunu, 5. sıra → e5!"},

  {"type":"click_square","instruction":"🎯 d5 karesine tıkla! (d sütunu, 5. sıra)",
   "fen":EMPTY,"target_squares":["d5"],"hint_squares":["d5"],
   "success_msg":"Harika! d5 merkez karelerinden biridir.","fail_msg":"d sütunu, 5. sıra → d5!"},

  {"type":"click_square","instruction":"🎯 e4 karesine tıkla! (e sütunu, 4. sıra)",
   "fen":EMPTY,"target_squares":["e4"],"hint_squares":["e4"],
   "success_msg":"Mükemmel! e4 merkez karelerinden biridir.","fail_msg":"e sütunu, 4. sıra → e4!"},

  {"type":"click_square","instruction":"🎯 Merkezi bul ve tıkla! (ipucu yok 😊)",
   "fen":EMPTY,"target_squares":["d4","d5","e4","e5"],"hint_squares":[],
   "success_msg":"Bravo! Merkezi artık bellekten biliyorsun.","fail_msg":"Tahtanın tam ortasına bak — d4,d5,e4,e5!"},

  {"type":"move_piece","instruction":"🎯 Piyonu seç ve merkeze (e4'e) taşı!",
   "fen":"8/8/8/8/8/8/4P3/8 w - - 0 1","piece_square":"e2",
   "target_squares":["e4"],"hint_squares":["e4"],
   "success_msg":"Harika! Piyon merkeze ulaştı: e4.","fail_msg":"Piyonu seç, sonra e4'e tıkla!"},

  {"type":"move_piece","instruction":"🎯 Kaleyi d sütununda merkeze (d4 veya d5) taşı!",
   "fen":"8/8/8/8/8/8/8/3R4 w - - 0 1","piece_square":"d1",
   "target_squares":["d4","d5"],"hint_squares":["d4","d5"],
   "success_msg":"Mükemmel! Kale merkeze ulaştı.","fail_msg":"d1'deki kaleyi seç, altın kareye tıkla!"},

  {"type":"move_piece","instruction":"🎯 Atı L şeklinde hareket ettir! (merkeze yaklaştır)",
   "fen":"8/8/8/8/8/8/8/4N3 w - - 0 1","piece_square":"e1",
   "target_squares":["d3","f3","c2","g2"],"hint_squares":["d3","f3"],
   "success_msg":"Süper! At L şeklinde atlayarak merkeze yaklaştı.","fail_msg":"e1'deki atı seç, altın kareye tıkla!"},

  {"type":"click_square","instruction":"🎯 Tahtadaki 4 merkezden boş karelere tıkla!",
   "fen":"8/8/8/8/4P3/8/8/8 w - - 0 1","target_squares":["d4","d5","e5"],
   "hint_squares":["d4","d5","e4","e5"],
   "success_msg":"Harika! Merkez karesini buldun.","fail_msg":"Altın renkli boş merkez karelerine tıkla!"},
],

# ── 1.3  Tahtadaki Yollar ─────────────────────────────────────────────────────
3: [
  {"type":"move_piece","instruction":"🎯 Kaleyi seç ve YATAY hareket ettir!",
   "fen":"8/8/8/8/4R3/8/8/8 w - - 0 1","piece_square":"e4",
   "target_squares":["a4","b4","c4","d4","f4","g4","h4"],"hint_squares":["a4","b4","c4","d4","f4","g4","h4"],
   "success_msg":"Süper! Kale yatay (sıra boyunca) hareket etti.","fail_msg":"Kale yatay hareket eder — aynı sıradaki altın kareye taşı!"},

  {"type":"move_piece","instruction":"🎯 Kaleyi seç ve DİKEY hareket ettir!",
   "fen":"8/8/8/8/4R3/8/8/8 w - - 0 1","piece_square":"e4",
   "target_squares":["e1","e2","e3","e5","e6","e7","e8"],"hint_squares":["e1","e2","e3","e5","e6","e7","e8"],
   "success_msg":"Harika! Kale dikey (sütun boyunca) hareket etti.","fail_msg":"Kale dikey hareket eder — aynı sütundaki altın kareye taşı!"},

  {"type":"click_square","instruction":"🎯 4. sıradaki (yatay hat) herhangi bir kareye tıkla!",
   "fen":EMPTY,"target_squares":["a4","b4","c4","d4","e4","f4","g4","h4"],
   "hint_squares":["a4","b4","c4","d4","e4","f4","g4","h4"],
   "success_msg":"Doğru! 4. sıradaki (yatay hat) kareleri tanıdın.","fail_msg":"4. sıradaki altın renkli karelere tıkla!"},

  {"type":"click_square","instruction":"🎯 e sütunundaki (dikey hat) herhangi bir kareye tıkla!",
   "fen":EMPTY,"target_squares":["e1","e2","e3","e4","e5","e6","e7","e8"],
   "hint_squares":["e1","e2","e3","e4","e5","e6","e7","e8"],
   "success_msg":"Süper! e sütununun dikey hattını tanıdın.","fail_msg":"e sütunundaki altın renkli karelere tıkla!"},

  {"type":"move_piece","instruction":"🎯 Fili seç ve ÇAPRAZ hareket ettir!",
   "fen":"8/8/8/8/8/8/8/2B5 w - - 0 1","piece_square":"c1",
   "target_squares":["b2","a3","d2","e3","f4","g5","h6"],"hint_squares":["b2","a3","d2","e3","f4","g5","h6"],
   "success_msg":"Mükemmel! Fil çapraz hareket eder.","fail_msg":"Fil sadece çapraz hareket eder — altın kareye taşı!"},

  {"type":"click_square","instruction":"🎯 Ana çapraz hattaki (a1→h8) karelerden birine tıkla!",
   "fen":EMPTY,"target_squares":["a1","b2","c3","d4","e5","f6","g7","h8"],
   "hint_squares":["a1","b2","c3","d4","e5","f6","g7","h8"],
   "success_msg":"Doğru! Bu ana çapraz hattaki karelerden biri.","fail_msg":"a1'den h8'e uzanan çapraz hatta tıkla!"},

  {"type":"move_piece","instruction":"🎯 Kaleyi a sütununda en üste (a8'e) taşı!",
   "fen":"8/8/8/8/8/8/8/R7 w - - 0 1","piece_square":"a1",
   "target_squares":["a8"],"hint_squares":["a8"],
   "success_msg":"Harika! Kale a sütununda a1'den a8'e gitti.","fail_msg":"a1'deki kaleyi seç, a8'e tıkla!"},

  {"type":"click_square","instruction":"🎯 8. sıradaki (en üst yatay hat) herhangi bir kareye tıkla!",
   "fen":EMPTY,"target_squares":["a8","b8","c8","d8","e8","f8","g8","h8"],
   "hint_squares":["a8","b8","c8","d8","e8","f8","g8","h8"],
   "success_msg":"Doğru! 8. sıra en üst yatay hattır.","fail_msg":"En üst sıradaki (8. sıra) altın karelere tıkla!"},

  {"type":"move_piece","instruction":"🎯 Kaleyi h sütununda h5'e taşı!",
   "fen":"8/8/8/8/8/8/8/7R w - - 0 1","piece_square":"h1",
   "target_squares":["h5"],"hint_squares":["h5"],
   "success_msg":"Süper! Kale h sütununda h1'den h5'e çıktı.","fail_msg":"h1'deki kaleyi seç, h5'e tıkla!"},

  {"type":"click_square","instruction":"🎯 Ters çapraz hattaki (h1→a8) karelerden birine tıkla!",
   "fen":EMPTY,"target_squares":["h1","g2","f3","e4","d5","c6","b7","a8"],
   "hint_squares":["h1","g2","f3","e4","d5","c6","b7","a8"],
   "success_msg":"Harika! Bu ters çapraz hattaki karelerden biri.","fail_msg":"h1'den a8'e uzanan çapraz hatta tıkla!"},
],

# ── 1.4  Satranç Taşlarının Görünümü ─────────────────────────────────────────
4: [
  {"type":"identify_piece","instruction":"🎯 Altın karedeki taşın adı nedir?",
   "fen":"8/8/8/8/4n3/8/8/8 b - - 0 1","highlight_square":"e4",
   "options":["Piyon","At","Fil","Kale"],"correct_index":1,
   "success_msg":"Doğru! Bu bir AT (Knight). L şeklinde hareket eder."},

  {"type":"identify_piece","instruction":"🎯 Altın karedeki taşın adı nedir?",
   "fen":"8/8/8/8/4b3/8/8/8 b - - 0 1","highlight_square":"e4",
   "options":["Kale","At","Fil","Vezir"],"correct_index":2,
   "success_msg":"Doğru! Bu bir FİL (Bishop). Çapraz hareket eder."},

  {"type":"identify_piece","instruction":"🎯 Altın karedeki taşın adı nedir?",
   "fen":"8/8/8/8/4r3/8/8/8 b - - 0 1","highlight_square":"e4",
   "options":["Fil","Vezir","Piyon","Kale"],"correct_index":3,
   "success_msg":"Doğru! Bu bir KALE (Rook). Düz hareket eder."},

  {"type":"identify_piece","instruction":"🎯 Altın karedeki taşın adı nedir?",
   "fen":"8/8/8/4q3/8/8/8/8 b - - 0 1","highlight_square":"e5",
   "options":["Vezir","Şah","At","Fil"],"correct_index":0,
   "success_msg":"Doğru! Bu bir VEZİR (Queen). En güçlü taştır!"},

  {"type":"identify_piece","instruction":"🎯 Altın karedeki taşın adı nedir?",
   "fen":"8/8/8/4k3/8/8/8/8 b - - 0 1","highlight_square":"e5",
   "options":["Kale","Vezir","Şah","At"],"correct_index":2,
   "success_msg":"Doğru! Bu bir ŞAH (King). En önemli taştır!"},

  {"type":"identify_piece","instruction":"🎯 Altın karedeki taşın adı nedir?",
   "fen":"8/8/8/4p3/8/8/8/8 b - - 0 1","highlight_square":"e5",
   "options":["Piyon","At","Fil","Kale"],"correct_index":0,
   "success_msg":"Doğru! Bu bir PİYON (Pawn). En küçük taştır."},

  {"type":"identify_piece","instruction":"🎯 Bu BEYAZ taşın adı nedir?",
   "fen":"8/8/8/8/4N3/8/8/8 w - - 0 1","highlight_square":"e4",
   "options":["Fil","At","Kale","Vezir"],"correct_index":1,
   "success_msg":"Doğru! Beyaz AT."},

  {"type":"identify_piece","instruction":"🎯 Bu BEYAZ taşın adı nedir?",
   "fen":"8/8/8/8/4B3/8/8/8 w - - 0 1","highlight_square":"e4",
   "options":["Kale","Vezir","Fil","Piyon"],"correct_index":2,
   "success_msg":"Doğru! Beyaz FİL."},

  {"type":"identify_piece","instruction":"🎯 Bu BEYAZ taşın adı nedir?",
   "fen":"8/8/8/8/4R3/8/8/8 w - - 0 1","highlight_square":"e4",
   "options":["At","Kale","Piyon","Şah"],"correct_index":1,
   "success_msg":"Doğru! Beyaz KALE."},

  {"type":"identify_piece","instruction":"🎯 Bu BEYAZ taşın adı nedir?",
   "fen":"8/8/8/8/4Q3/8/8/8 w - - 0 1","highlight_square":"e4",
   "options":["Fil","Şah","At","Vezir"],"correct_index":3,
   "success_msg":"Doğru! Beyaz VEZİR — en güçlü taş!"},
],

# ── 1.5  Taşların Başlangıç Konumu ───────────────────────────────────────────
5: [
  {"type":"click_square","instruction":"🎯 Başlangıç konumundaki herhangi bir piyona tıkla!",
   "fen":START,"hint_squares":[],
   "target_squares":["a2","b2","c2","d2","e2","f2","g2","h2","a7","b7","c7","d7","e7","f7","g7","h7"],
   "success_msg":"Harika! Piyonlar 2. ve 7. sırada başlar.","fail_msg":"2. veya 7. sıradaki küçük taşlara tıkla!"},

  {"type":"click_square","instruction":"🎯 Herhangi bir BEYAZ piyona tıkla! (alt sıra)",
   "fen":START,"target_squares":["a2","b2","c2","d2","e2","f2","g2","h2"],
   "hint_squares":["a2","b2","c2","d2","e2","f2","g2","h2"],
   "success_msg":"Doğru! Beyaz piyonlar 2. sırada başlar.","fail_msg":"Alttaki (2. sıra) beyaz piyonlara tıkla!"},

  {"type":"click_square","instruction":"🎯 Herhangi bir SİYAH piyona tıkla! (üst sıra)",
   "fen":START,"target_squares":["a7","b7","c7","d7","e7","f7","g7","h7"],
   "hint_squares":["a7","b7","c7","d7","e7","f7","g7","h7"],
   "success_msg":"Doğru! Siyah piyonlar 7. sırada başlar.","fail_msg":"Üstteki (7. sıra) siyah piyonlara tıkla!"},

  {"type":"click_square","instruction":"🎯 Beyaz VEZİR'e tıkla! (d1)",
   "fen":START,"target_squares":["d1"],"hint_squares":["d1"],
   "success_msg":"Harika! Beyaz Vezir d1'de başlar.","fail_msg":"d1 karesine tıkla — Beyaz Vezir orada!"},

  {"type":"click_square","instruction":"🎯 Beyaz ŞAH'a tıkla! (e1)",
   "fen":START,"target_squares":["e1"],"hint_squares":["e1"],
   "success_msg":"Doğru! Beyaz Şah e1'de başlar.","fail_msg":"e1 karesine tıkla — Beyaz Şah orada!"},

  {"type":"click_square","instruction":"🎯 Köşelerden herhangi bir KALEye tıkla!",
   "fen":START,"target_squares":["a1","h1","a8","h8"],"hint_squares":["a1","h1","a8","h8"],
   "success_msg":"Süper! Kaleler köşelerde başlar: a1, h1, a8, h8.","fail_msg":"Tahtanın dört köşesine tıkla — Kaleler orada!"},

  {"type":"click_square","instruction":"🎯 Herhangi bir ATA tıkla!",
   "fen":START,"target_squares":["b1","g1","b8","g8"],"hint_squares":["b1","g1","b8","g8"],
   "success_msg":"Doğru! Atlar b1, g1, b8, g8'de başlar.","fail_msg":"b1, g1, b8 veya g8'e tıkla — Atlar orada!"},

  {"type":"click_square","instruction":"🎯 Herhangi bir FİLe tıkla!",
   "fen":START,"target_squares":["c1","f1","c8","f8"],"hint_squares":["c1","f1","c8","f8"],
   "success_msg":"Harika! Filler c1, f1, c8, f8'de başlar.","fail_msg":"c1, f1, c8 veya f8'e tıkla — Filler orada!"},

  {"type":"click_square","instruction":"🎯 Siyah VEZİR'e tıkla! (d8)",
   "fen":START,"target_squares":["d8"],"hint_squares":["d8"],
   "success_msg":"Doğru! Siyah Vezir d8'de başlar.","fail_msg":"d8 karesine tıkla — Siyah Vezir orada!"},

  {"type":"click_square","instruction":"🎯 Siyah ŞAH'a tıkla! (e8)",
   "fen":START,"target_squares":["e8"],"hint_squares":["e8"],
   "success_msg":"Mükemmel! Siyah Şah e8'de başlar.","fail_msg":"e8 karesine tıkla — Siyah Şah orada!"},
],

# ── 1.6  Uygulama Etkinlikleri ────────────────────────────────────────────────
6: [
  {"type":"move_piece","instruction":"🎯 Fili seç ve çapraz hareket ettir!",
   "fen":"8/8/8/8/8/8/8/2B5 w - - 0 1","piece_square":"c1",
   "target_squares":["b2","a3","d2","e3","f4","g5","h6"],"hint_squares":["b2","a3","d2","e3","f4","g5","h6"],
   "success_msg":"Mükemmel! Fil sadece çapraz hareket eder.","fail_msg":"Fil çapraz hareket eder — altın renkli kareye taşı!"},

  {"type":"move_piece","instruction":"🎯 Atı L şeklinde hareket ettir!",
   "fen":"8/8/8/8/4N3/8/8/8 w - - 0 1","piece_square":"e4",
   "target_squares":["d6","f6","c5","g5","c3","g3","d2","f2"],"hint_squares":["d6","f6","c5","g5","c3","g3","d2","f2"],
   "success_msg":"Harika! At L şeklinde (2+1 kare) hareket eder.","fail_msg":"At L şeklinde atlar — altın karelerden birine tıkla!"},

  {"type":"identify_piece","instruction":"🎯 Sarı ile işaretli taşın adı nedir?",
   "fen":"8/8/8/4q3/8/8/8/8 b - - 0 1","highlight_square":"e5",
   "options":["Vezir","Kale","Şah","Fil"],"correct_index":0,
   "success_msg":"Doğru! Vezir hem düz hem çapraz hareket eder."},

  {"type":"move_piece","instruction":"🎯 Kaleyi a1'den h1'e taşı!",
   "fen":"8/8/8/8/8/8/8/R7 w - - 0 1","piece_square":"a1",
   "target_squares":["h1"],"hint_squares":["h1"],
   "success_msg":"Süper! Kale 1. sıra boyunca yatay hareket etti.","fail_msg":"a1'deki kaleyi seç, h1'e tıkla!"},

  {"type":"move_piece","instruction":"🎯 Piyonu ilerlet! e2'den e3 veya e4'e taşı.",
   "fen":"8/8/8/8/8/8/4P3/8 w - - 0 1","piece_square":"e2",
   "target_squares":["e3","e4"],"hint_squares":["e3","e4"],
   "success_msg":"Harika! Piyon yalnızca ileri hareket eder.","fail_msg":"e2'deki piyonu seç, e3 veya e4'e tıkla!"},

  {"type":"move_piece","instruction":"🎯 Veziri herhangi bir yönde hareket ettir!",
   "fen":"8/8/8/4q3/8/8/8/8 b - - 0 1","piece_square":"e5",
   "target_squares":["e4","e6","d5","f5","d4","f6","d6","f4","e1","e2","e3","e7","e8","a5","b5","c5","g5","h5","d6","c7","b8","f6","g7","h8","d4","c3","b2","a1","f4","g3","h2"],
   "hint_squares":["e4","d5","f5","e6"],
   "success_msg":"Mükemmel! Vezir her yönde hareket edebilir.","fail_msg":"Veziri herhangi altın renkli kareye taşı!"},

  {"type":"click_square","instruction":"🎯 Başlangıç konumunda boş koyu karelere tıkla! (3-6. sıralar)",
   "fen":START,"target_squares":["a3","c3","e3","g3","b3","d3","f3","h3","a6","c6","e6","g6","b6","d6","f6","h6"],
   "hint_squares":[],
   "success_msg":"Doğru! 3. ve 6. sıralar başlangıçta boştur.","fail_msg":"3. veya 6. sıradaki karelere tıkla!"},

  {"type":"identify_piece","instruction":"🎯 g1 karesindeki taşın adı nedir?",
   "fen":START,"highlight_square":"g1",
   "options":["Fil","At","Kale","Piyon"],"correct_index":1,
   "success_msg":"Doğru! g1'deki taş bir AT (Knight)."},

  {"type":"move_piece","instruction":"🎯 f1'deki Fili çapraz hareket ettir!",
   "fen":"8/8/8/8/8/8/8/5B2 w - - 0 1","piece_square":"f1",
   "target_squares":["e2","d3","c4","b5","a6","g2","h3"],"hint_squares":["e2","d3","c4","b5","a6","g2","h3"],
   "success_msg":"Harika! Fil çapraz hareket etti.","fail_msg":"f1'deki Fili seç, çapraz altın kareye tıkla!"},

  {"type":"click_square","instruction":"🎯 e5'teki atın gidebileceği karelerden birine tıkla!",
   "fen":"8/8/8/4N3/8/8/8/8 w - - 0 1",
   "target_squares":["d7","f7","c6","g6","c4","g4","d3","f3"],"hint_squares":["d7","f7","c6","g6","c4","g4","d3","f3"],
   "success_msg":"Süper! At bu L şeklindeki karelere gidebilir.","fail_msg":"Atın L hareketi — altın renkli karelere tıkla!"},
],

}

# ─────────────────────────────────────────────────────────────────────────────

def upgrade() -> None:
    conn = op.get_bind()

    rows = conn.execute(text("""
        SELECT ls.id, ls.order_index, ls.content_json
        FROM lesson_steps ls
        JOIN lessons l ON ls.lesson_id = l.id
        JOIN modules m ON l.module_id = m.id
        WHERE m.order_index = 1 AND l.order_index = 1
        ORDER BY ls.order_index
    """)).fetchall()

    for row in rows:
        step_id, step_order, raw = row
        content = raw if isinstance(raw, dict) else json.loads(raw)
        exercises = STEP_EXERCISES.get(step_order)
        if exercises:
            content["board_exercises"] = exercises
            content.pop("board_exercise", None)  # remove singular
            conn.execute(text(
                "UPDATE lesson_steps SET content_json = :c WHERE id = :id"
            ), {"c": json.dumps(content, ensure_ascii=False), "id": step_id})


def downgrade() -> None:
    conn = op.get_bind()
    rows = conn.execute(text("""
        SELECT ls.id, ls.content_json
        FROM lesson_steps ls
        JOIN lessons l ON ls.lesson_id = l.id
        JOIN modules m ON l.module_id = m.id
        WHERE m.order_index = 1 AND l.order_index = 1
    """)).fetchall()

    for row in rows:
        step_id, raw = row
        content = raw if isinstance(raw, dict) else json.loads(raw)
        exercises = content.pop("board_exercises", [])
        if exercises:
            content["board_exercise"] = exercises[0]
        conn.execute(text(
            "UPDATE lesson_steps SET content_json = :c WHERE id = :id"
        ), {"c": json.dumps(content, ensure_ascii=False), "id": step_id})
