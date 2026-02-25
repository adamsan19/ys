# Video Site Project

Proyek ini adalah situs web video statis yang dihosting di Cloudflare Pages dengan fungsionalitas serverless menggunakan Cloudflare Functions.

## Struktur Proyek

- `/public`: Berisi file statis (HTML, images, data).
- `/functions`: Berisi logika serverless (Cloudflare Functions).
- `wrangler.toml`: Konfigurasi untuk Cloudflare Wrangler.

## Cara Deploy ke Cloudflare

### 1. Melalui Cloudflare Dashboard (Direkomendasikan)

Metode ini paling mudah jika kode Anda ada di GitHub atau GitLab.

1.  Login ke [Cloudflare Dashboard](https://dash.cloudflare.com/).
2.  Buka **Workers & Pages** > **Create application** > **Pages** > **Connect to Git**.
3.  Pilih repositori Anda.
4.  Di bagian **Build settings**:
    *   **Framework preset**: None
    *   **Build command**: (Kosongkan)
    *   **Build output directory**: `public`
5.  Klik **Save and Deploy**.
6.  Cloudflare akan secara otomatis mendeteksi folder `functions` dan men-deploy-nya sebagai Functions.

---

### 2. Melalui Wrangler CLI

Metode ini berguna untuk deployment manual langsung dari terminal.

1.  **Install Wrangler:**
    ```bash
    npm install -g wrangler
    ```

2.  **Login ke Cloudflare:**
    ```bash
    wrangler login
    ```

3.  **Deploy Proyek:**
    Jalankan perintah berikut di root direktori proyek:
    ```bash
    wrangler pages deploy ./public
    ```
    *Wrangler akan otomatis mengunggah isi folder `./public` dan memproses folder `functions` di root.*

---

## Pengembangan Lokal

Untuk menjalankan proyek secara lokal menggunakan Wrangler:

```bash
wrangler pages dev ./public
```
Proyek akan berjalan di `http://localhost:8788`.