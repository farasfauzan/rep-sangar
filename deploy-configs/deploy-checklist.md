# Pre-Deployment Checklist — ERP Konstruksi

> **Instruksi**: Centang (☑) setiap item sebelum deploy. Semua item wajib ✅ kecuali yang diberi label [OPSIONAL].

---

## 🔐 Security & Credentials

| # | Item | Status | Notes |
|---|------|--------|-------|
| 1 | `APP_KEY` di-generate & disimpan aman | ☐ | `php artisan key:generate --show` |
| 2 | `APP_DEBUG=false` di production | ☐ | Harus `false` |
| 3 | `APP_ENV=production` | ☐ | Bukan `local` |
| 4 | Database password kuat & unik | ☐ | Min 16 char, special chars |
| 5 | Redis password diset (kalau remote) | ☐ | |
| 6 | Mail credentials (SMTP/API) valid | ☐ | Test kirim email |
| 7 | S3/MinIO credentials untuk file upload | ☐ | Bucket private, CORS config |
| 8 | AI service API key (MiMo/OpenAI) | ☐ | Untuk klasifikasi RAB |
| 9 | JWT secret (kalau pakai Sanctum SPA) | ☐ | |
| 10 | Semua `CHANGE_ME` di `.env` sudah diganti | ☐ | Cek `.env.production.example` |

---

## 🖥️ Server Requirements

| # | Item | Status | Notes |
|---|------|--------|-------|
| 11 | Ubuntu 22.04/24.04 LTS | ☐ | |
| 12 | PHP 8.3+ dengan ekstensi wajib | ☐ | mbstring, dom, pdo_mysql, redis, gd, zip, bcmath, intl, fileinfo, xml, curl, openssl |
| 13 | Composer 2.x | ☐ | |
| 14 | Node.js 20+ & npm | ☐ | |
| 15 | Nginx 1.24+ | ☐ | |
| 16 | MySQL 8.0+ / MariaDB 10.6+ | ☐ | InnoDB, utf8mb4 |
| 17 | Redis 7+ | ☐ | Dengan persistence (AOF) |
| 18 | Supervisor / systemd | ☐ | Untuk queue & scheduler |
| 19 | Certbot (Let's Encrypt) | ☐ | Untuk SSL otomatis |
| 20 | Disk space ≥ 20GB free | ☐ | DB + storage + logs + backup |
| 21 | RAM ≥ 4GB (rekomendasi 8GB) | ☐ | PHP-FPM + MySQL + Redis + Queue |
| 22 | Swap ≥ 2GB | ☐ | Safety net |

---

## 🌐 Network & DNS

| # | Item | Status | Notes |
|---|------|--------|-------|
| 23 | Domain/subdomain sudah arahkan ke IP server | ☐ | A record + www |
| 24 | Port 80, 443 terbuka (firewall) | ☐ | UFW/iptables |
| 25 | Port 3306 (MySQL) HANYA localhost | ☐ | Bind 127.0.0.1 |
| 26 | Port 6379 (Redis) HANYA localhost | ☐ | Bind 127.0.0.1 |
| 27 | Port 9001 (Supervisor web) HANYA localhost | ☐ | Atau via SSH tunnel |
| 28 | [OPSIONAL] CDN (Cloudflare) dikonfigurasi | ☐ | Proxy DNS, WAF, caching |

---

## 📦 Application Setup

| # | Item | Command | Status |
|---|------|---------|--------|
| 29 | Clone repo ke `/var/www/erp` | `git clone ... /var/www/erp` | ☐ |
| 30 | `composer install --optimize-autoloader --no-dev` | | ☐ |
| 31 | `cp .env.production.example .env` + edit | | ☐ |
| 32 | `php artisan key:generate --force` | | ☐ |
| 33 | `php artisan migrate --force` | | ☐ |
| 34 | `php artisan db:seed --force` (kalau perlu) | | ☐ |
| 35 | `npm ci && npm run build` | | ☐ |
| 36 | `php artisan storage:link` | | ☐ |
| 37 | `php artisan config:cache` | | ☐ |
| 38 | `php artisan route:cache` | | ☐ |
| 39 | `php artisan view:cache` | | ☐ |
| 40 | `php artisan event:cache` (kalau pakai event) | | ☐ |
| 41 | Set permission: `chown -R www-data:www-data storage bootstrap/cache` | | ☐ |
| 42 | `chmod -R 775 storage bootstrap/cache` | | ☐ |

---

## ⚙️ Services Configuration

| # | Item | File | Status |
|---|------|------|--------|
| 43 | Nginx config deployed & tested | `/etc/nginx/sites-available/erp` | ☐ |
| 44 | `nginx -t` pass | | ☐ |
| 45 | SSL cert via Certbot | `certbot --nginx -d domain.com` | ☐ |
| 46 | SSL auto-renewal cron | `certbot renew --dry-run` | ☐ |
| 47 | PHP-FPM pool config | `/etc/php/8.3/fpm/pool.d/erp.conf` | ☐ |
| 49 | `pm.max_children` disesuaikan RAM | | ☐ |
| 50 | Supervisor config deployed | `/etc/supervisor/conf.d/erp.conf` | ☐ |
| 51 | `supervisorctl reread && supervisorctl update` | | ☐ |
| 52 | `supervisorctl status` semua RUNNING | | ☐ |
| 53 | Systemd services enabled & started | `systemctl enable --now erp-*` | ☐ |
| 54 | Logrotate config untuk Laravel logs | `/etc/logrotate.d/erp` | ☐ |

---

## ✅ Validation Tests (Post-Deploy)

| # | Test | Expected | Status |
|---|------|----------|--------|
| 55 | `curl -I https://domain.com` | `200 OK`, `Strict-Transport-Security` | ☐ |
| 56 | Login page load | `200`, form login muncul | ☐ |
| 59 | Login dengan admin user | Redirect ke dashboard | ☐ |
| 60 | Dashboard API `/api/dashboard/executive` | `200`, JSON valid | ☐ |
| 61 | RAB import test (file Excel kecil) | Preview → Confirm → Success | ☐ |
| 62 | Create PO → Submit → Approve | Full workflow sukses | ☐ |
| 63 | Upload lampiran PO (PDF/JPG) | File tersimpan & downloadable | ☐ |
| 64 | Print PO (format SCS) | PDF/print layout benar | ☐ |
| 65 | Queue worker jalan | `supervisorctl status` semua RUNNING | ☐ |
| 66 | Scheduler jalan | Cek `schedule:run` log | ☐ |
| 67 | Email test (password reset) | Terkirim & diterima | ☐ |
| 68 | File upload > 5MB | Berhasil (cek `upload_max_filesize`) | ☐ |
| 69 | Redis cache hit | `redis-cli monitor` ada aktivitas | ☐ |
| 70 | Backup script test | File backup terbuat di S3/local | ☐ |

---

## 🔄 Rollback Plan

| # | Item | Status |
|---|------|--------|
| 71 | Backup DB sebelum deploy | ☐ |
| 72 | Backup `.env` lama | ☐ |
| 73 | Git tag release (contoh: `v1.0.0`) | ☐ |
| 74 | Dokumentasi rollback step | ☐ |
| 75 | Test rollback di staging | ☐ |

---

## 📋 Go/No-Go Decision

```
✅ Semua item wajib (tanpa [OPSIONAL]) = ☑
❌ Ada item wajib yang ☐ = NO-GO
```

**Deployer**: ________________  
**Tanggal**: ________________  
**Versi/Tag**: ________________  
**Tanda tangan**: ________________