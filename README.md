# Video Site - Cloudflare Pages Deployment

Proyek website video yang menggunakan Cloudflare Pages Functions untuk serve konten video dari multiple API sources (Doodstream & Lulustream).

## 🚀 Fitur

- ✅ Fetch data video dari multiple API sources (Doodstream & Lulustream)
- ✅ Generate sharded JSON files untuk optimasi performa
- ✅ Search functionality dengan prefix-based indexing
- ✅ Pagination untuk list videos
- ✅ SEO-friendly dengan sitemap.xml dan video-sitemap.xml
- ✅ Structured data (JSON-LD) untuk setiap video
- ✅ Caching untuk performa optimal
- ✅ Deploy otomatis via Cloudflare Pages

## 📁 Struktur Proyek

```
video-deploy/
├── functions/
│   └── [[path]].js          # Cloudflare Pages Functions handler
├── public/
│   └── data/
│       ├── detail/          # Detail shards (MD5 hash based)
│       ├── list/             # Paginated list files
│       ├── index/            # Search index files (prefix-based)
│       ├── lookup_shard.json # Lookup table untuk shard mapping
│       └── meta.json         # Metadata (total videos, per_page)
├── requirements.txt          # Python dependencies
├── sedot.py                  # Script untuk fetch & generate data
└── README.md                 # Dokumentasi ini
```

## 🛠️ Setup Lokal

### Prerequisites

- Python 3.7+ 
- pip (Python package manager)
- Git
- Akun Cloudflare (untuk deploy)

### Install Dependencies

```bash
pip install -r requirements.txt
```

### Konfigurasi API Keys

Edit file `sedot.py` dan ganti API keys di bagian `CONFIGS`:

```python
CONFIGS = {
    'doodstream': {
        'api_key': 'YOUR_DOODSTREAM_API_KEY',  # Ganti dengan API key Anda
        ...
    },
    'lulustream': {
        'api_key': 'YOUR_LULUSTREAM_API_KEY',  # Ganti dengan API key Anda
        ...
    }
}
```

### Generate Data

Jalankan script untuk fetch data dan generate JSON files:

```bash
python sedot.py
```

Script akan:
1. Fetch semua video dari API sources
2. Normalize dan clean data
3. Generate sharded JSON files di `public/data/`
4. Create search indexes
5. Generate paginated list files

## 🌐 Deploy ke Cloudflare Pages

### 1. Push ke GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin <your-repo-url>
git push -u origin main
```

### 2. Connect ke Cloudflare Pages

1. Login ke [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Pilih **Pages** → **Create a project**
3. Connect ke repository GitHub Anda
4. Pilih branch yang akan di-deploy (biasanya `main`)

### 3. Konfigurasi Build Settings

Di halaman build configuration, set:

- **Build command**: 
  ```
  pip install -r requirements.txt && python sedot.py
  ```
  
- **Output directory**: 
  ```
  public
  ```

- **Python version**: `3.x` (jika ada opsi)

### 4. Deploy

Cloudflare Pages akan otomatis:
1. Install Python dependencies
2. Run `sedot.py` untuk generate data
3. Deploy semua file di folder `public/`
4. Setup Pages Functions dari folder `functions/`

## 📍 Routes

Setelah deploy, website akan memiliki routes berikut:

- `/` - Homepage
- `/list/{page}` - List videos dengan pagination
- `/e/{filecode}` - Detail video page
- `/f/{query}/page/{page}` - Search results
- `/sitemap.xml` - Sitemap untuk semua list pages
- `/video-sitemap.xml` - Video sitemap untuk SEO
- `/robots.txt` - Robots.txt file

## 🔧 Konfigurasi

### Mengubah jumlah data per page

Edit `DATA_PER_PAGE` di `sedot.py`:

```python
DATA_PER_PAGE = 200  # Default: 200 videos per page
```

### Mengubah limit search index

Edit `PREFIX2_LIMIT` di `sedot.py`:

```python
PREFIX2_LIMIT = 500  # Default: max 500 items per prefix index
```

### Menambah API source baru

Tambahkan entry baru di `CONFIGS` di `sedot.py`:

```python
CONFIGS = {
    'doodstream': {...},
    'lulustream': {...},
    'newsource': {
        'api_url': 'https://api.newsource.com/api/file/list',
        'api_key': 'YOUR_API_KEY',
        'per_page': 200,
        'request_delay': 0.5,
        'max_retries': 3,
        'concurrent_requests': 5
    }
}
```

## 📝 Catatan Penting

1. **API Keys**: Jangan commit API keys ke public repository. Gunakan environment variables atau Cloudflare Pages secrets.

2. **Build Time**: Proses fetch data bisa memakan waktu lama jika ada banyak pages. Pastikan build timeout di Cloudflare Pages cukup (default: 15 menit).

3. **Rate Limiting**: Script sudah include delay antar request untuk menghindari rate limiting. Sesuaikan `request_delay` jika perlu.

4. **Data Update**: Untuk update data, cukup push perubahan ke GitHub atau trigger manual rebuild di Cloudflare Pages dashboard.

## 🐛 Troubleshooting

### Build gagal karena timeout
- Kurangi jumlah pages yang di-fetch
- Atau fetch data secara manual dan commit JSON files ke repo

### API error saat fetch
- Cek API keys sudah benar
- Cek koneksi internet
- Cek rate limiting dari API provider

### Functions tidak jalan
- Pastikan file ada di `functions/[[path]].js`
- Cek Cloudflare Pages Functions logs di dashboard

## 📄 License

Proyek ini dibuat untuk keperluan personal/educational.

## 🤝 Kontribusi

Silakan buat issue atau pull request jika ada bug atau improvement.

