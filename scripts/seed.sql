-- Seed users + cards from test/flashmind_data_fake-cleaned.csv
-- Run in Supabase SQL Editor. Idempotent via ON CONFLICT.

CREATE TEMP TABLE _tmp_ids (id uuid);

INSERT INTO pengunjung_berakun (nama_depan, nama_belakang, surel, jenis_kelamin, sandi_hash, catatan, jejak)
VALUES ('Marcus', 'Ayman', 'marcus@flashmind-mail.com', 'male', '$2b$10$5s7hA0u0xYWWpryjiau4ON7qAquR6H7jN+JpBdIqFgU=', '', '[]'::jsonb)
ON CONFLICT (surel) DO UPDATE SET sandi_hash = EXCLUDED.sandi_hash
RETURNING id INTO _tmp_ids;

INSERT INTO kartu_belajar (id_pengguna, judul, catatan, lampiran, sumber)
SELECT id, 'Judul Materi: Recount Text (Teks Cerita Ulang)', 'Judul Materi: Recount Text (Teks Cerita Ulang)
I. Social Function & Structure
A. Social Function
Menceritakan kembali suatu pengalaman atau kejadian di masa lampau secara berurutan.
II. Language Features
A. Penggunaan Past Tense
Menggunakan kata kerja bentuk kedua (V2) karena bercerita tentang masa lalu.
B. Time Connectives
Menggunakan kata penghubung waktu seperti first, then, after that, finally.', '{}', 'manual' FROM _tmp_ids LIMIT 1;

INSERT INTO pengunjung_berakun (nama_depan, nama_belakang, surel, jenis_kelamin, sandi_hash, catatan, jejak)
VALUES ('Bagas', 'Saragih', 'bagas2@kakao-mail.com', 'male', '$2b$10$tDCebH4cgcdAs4gWLBzFqEhcErRRj+bN/0Uj4QaZ4bM=', '', '[]'::jsonb)
ON CONFLICT (surel) DO UPDATE SET sandi_hash = EXCLUDED.sandi_hash
RETURNING id INTO _tmp_ids;

INSERT INTO kartu_belajar (id_pengguna, judul, catatan, lampiran, sumber)
SELECT id, 'Rangkuman Materi: Reformasi Indonesia 1998', 'Rangkuman Materi: Reformasi Indonesia 1998
I. Latar Belakang Reformasi
A. Krisis Ekonomi
Terjadinya krisis moneter Asia yang melemahkan nilai tukar rupiah secara drastis.
II. Puncak Reformasi
A. Demonstrasi Mahasiswa
Mahasiswa dari berbagai daerah menduduki gedung DPR/MPR menuntut reformasi total.
B. Pengunduran Diri Soeharto
Presiden Soeharto menyatakan mundur dari jabatannya pada 21 Mei 1998.', '{}', 'manual' FROM _tmp_ids LIMIT 1;

INSERT INTO pengunjung_berakun (nama_depan, nama_belakang, surel, jenis_kelamin, sandi_hash, catatan, jejak)
VALUES ('Yusuf', 'Wibowo', 'yusuf@flashmind-mail.com', 'male', '$2b$10$YmrKcVxrPOuZEPvjvgyz7thGGhBexC/ZMk5QoArr938=', '', '[]'::jsonb)
ON CONFLICT (surel) DO UPDATE SET sandi_hash = EXCLUDED.sandi_hash
RETURNING id INTO _tmp_ids;

INSERT INTO kartu_belajar (id_pengguna, judul, catatan, lampiran, sumber)
SELECT id, 'Rangkuman Materi: Jenis-Jenis Gaya dalam Fisika', 'Rangkuman Materi: Jenis-Jenis Gaya dalam Fisika
I. Gaya Sentuh (Membutuhkan Kontak Fisik)
A. Gaya Gesek
Muncul akibat sentuhan dua permukaan benda yang saling bergerak.
Arahnya selalu berlawanan dengan arah gerak benda.
B. Gaya Pegas
Dihasilkan oleh benda yang memiliki sifat elastis atau lentur.
Contohnya adalah gaya pada karet gelang atau busur panah yang ditarik.
II. Gaya Tak Sentuh (Tidak Membutuhkan Kontak Fisik)
A. Gaya Gravitasi
Gaya tarik-menarik antara semua benda yang memiliki massa di alam semesta.
Contoh bumi menarik semua benda di permukaannya menuju ke pusat bumi.
B. Gaya Magnet
Gaya tarik atau gaya tolak yang dihasilkan oleh benda yang memiliki sifat magnet.
Hanya bekerja pada benda-benda tertentu seperti besi, baja, dan nikel.', '{}', 'manual' FROM _tmp_ids LIMIT 1;

INSERT INTO pengunjung_berakun (nama_depan, nama_belakang, surel, jenis_kelamin, sandi_hash, catatan, jejak)
VALUES ('Sana', 'Tampubolon', 'sana@flashmind-mail.com', 'female', '$2b$10$Gqi2qnaCWY9d0CS3T8M8X1KTLONc8h/ncAe7mS1cVXk=', '', '[]'::jsonb)
ON CONFLICT (surel) DO UPDATE SET sandi_hash = EXCLUDED.sandi_hash
RETURNING id INTO _tmp_ids;

INSERT INTO kartu_belajar (id_pengguna, judul, catatan, lampiran, sumber)
SELECT id, 'Judul Materi: Ekosistem dan Rantai Makanan (IPA)', 'Judul Materi: Ekosistem dan Rantai Makanan (IPA)
I. Komponen Ekosistem
A. Komponen Biotik
Terdiri dari makhluk hidup seperti tumbuhan, hewan, dan mikroorganisme.
Dibagi menjadi produsen, konsumen, dan pengurai (dekomposer).
B. Komponen Abiotik
Terdiri dari unsur tak hidup seperti air, udara, tanah, dan cahaya matahari.
II. Aliran Energi dalam Ekosistem
A. Rantai Makanan
Peristiwa makan dan dimakan dengan urutan tertentu dan satu arah.
Contoh: padi dimakan tikus, tikus dimakan ular, ular dimakan elang.
B. Jaring-Jaring Makanan
Gabungan dari beberapa rantai makanan yang saling berhubungan dalam suatu ekosistem.', '{}', 'manual' FROM _tmp_ids LIMIT 1;

INSERT INTO pengunjung_berakun (nama_depan, nama_belakang, surel, jenis_kelamin, sandi_hash, catatan, jejak)
VALUES ('Agung', 'Ronnie', 'agung5@edumail.co.id', 'female', '$2b$10$YuNCHSm70XL1L9UA1JeKxZ5itlhS7XIPtZ2JvVeWmak=', '', '[]'::jsonb)
ON CONFLICT (surel) DO UPDATE SET sandi_hash = EXCLUDED.sandi_hash
RETURNING id INTO _tmp_ids;

INSERT INTO kartu_belajar (id_pengguna, judul, catatan, lampiran, sumber)
SELECT id, 'Judul Materi: Energi dan Perubahannya (IPA)]', 'Judul Materi: Energi dan Perubahannya (IPA)]
I. Bentuk-Bentuk Energi
A. Energi Kinetik
Energi yang dimiliki oleh benda yang sedang bergerak.
B. Energi Potensial
Energi yang tersimpan pada benda karena posisi atau kedudukannya.
II. Perubahan Bentuk Energi
A. Energi Listrik menjadi Energi Cahaya
Contohnya terjadi pada lampu yang menyala saat dialiri listrik.
B. Energi Kimia menjadi Energi Gerak
Contohnya terjadi pada mesin kendaraan yang menggunakan bahan bakar.', '{}', 'manual' FROM _tmp_ids LIMIT 1;

DROP TABLE _tmp_ids;