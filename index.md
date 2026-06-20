
## **UI/UX**

***FlashMind***

*Masuk untuk uji coba!*
atau
*Daftar untuk membuat akun baru*
*masuk uji coba berbeda dengan memakai akun

*scroll/swipe ke bawah untuk informasi lebih lanjut.

// satu scroll atau swipe ke bawah untuk melihat fitur-fitur yang tersedia. slides.

***FlashMind*** merupakan alat yang digunakan untuk membantu pembelajaran anda.

// scroll/swipe

Bagaimana ***FlashMind*** membantu?
***FlashMind*** mengubah catatan anda dibentuk seperti flash card.

// scroll/swipe

*showcasing examples

// scroll/swipe

penelitian menunjukan metode belajar ini sangatlah efektif.

// scroll/swipe

jangan tunggu lagi

segera
*masuk untuk uji coba*
atau
*daftar untuk membuat akun baru*
*masuk uji coba berbeda dengan memakai akun

footer here

// dialog masuk
masuk/daftar (toggle button)
username (fieldname)
password (fieldpassword)
masuk (button)
atau
masuk dengan google (button)

//dialog daftar
nama_depan
nama_belakang
email
jenis_kelamin

//fitur flashmind
judul(fieldname)
catatan(fieldtext)
attachment(uploadimage/multipleimages)

## **BACKEND/API-HANDLER**

***tamu penguji*** //untuk database
id | ipaddress | jejak

***pengunjung berakun*** //untuk database
id | nama_depan | nama_belakang | email | jenis_kelamin | catatan | jejak

***sudo admin***
username | password
accepted -> apikey generate (full control and stats)

***auth tamu penguji/berakun***
username | password | *konfirmasi_password untuk daftar akun


**routes**
\ -> homepage & dialog daftar atau masuk
\api -> traffic. ai services, auth, server.
\api\v0 -> admin
\api\users -> auth, users with account.
\api\users?history=fetchall
\api\test -> exchange from client, server to ai services.


