# MarketSense PLS-SEM — Prototype Web V2

Versi ini dibuat lebih dekat dengan pola web assessment dosen:
- Dashboard penelitian
- Kuesioner bertahap
- Scoring deskriptif raw mean dan normalized 0–100
- Grafik radar profil konstruk
- Insight/rekomendasi otomatis berbasis skor
- Roadmap jangka pendek, menengah, panjang
- Halaman model PLS-SEM
- Laporan siap cetak / Save as PDF
- Export CSV untuk SmartPLS
- Preview data respons

## Penting
1. Web ini **tidak menghitung PLS-SEM inferensial**. PLS-SEM tetap dianalisis di SmartPLS.
2. Web hanya menghitung skor deskriptif untuk dashboard dan laporan.
3. EK3 dan EK5 disimpan juga dalam versi reverse-coded (`EK3_R`, `EK5_R`).
4. KP2 belum di-reverse otomatis karena status item negatifnya masih perlu dipastikan dari sumber jurnal.
5. Penyimpanan masih `localStorage`, jadi belum cocok untuk pengumpulan data multi-user sungguhan.

## Cara menjalankan
Buka `index.html`.

## GitHub Pages
Upload:
- index.html
- style.css
- app.js

Lalu aktifkan Settings > Pages pada repository.
