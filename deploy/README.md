# نشر منظومة العزب (VPS واحد)

## أول مرة
1. ثبّت Docker + Compose + certbot على السيرفر؛ وجّه DNS لـ `chat.alazab.com` إلى IP السيرفر.
2. `git clone` أو انسخ الملفات إلى `DEPLOY_PATH` ثم:
   ```bash
   cp .env.alazab.example .env       # املأ كل القيم الفارغة (openssl rand -hex 32 ...)
   cp librechat.alazab.yaml librechat.yaml
   ```
3. الشهادة (قبل تشغيل nginx بـ 443): 
   `certbot certonly --standalone -d chat.alazab.com` ثم جدّد دوريًا بـ `certbot renew --deploy-hook "docker exec LibreChat-NGINX nginx -s reload"`.
4. `docker compose -f docker-compose.prod.yml up -d` ثم راقب `docker compose -f docker-compose.prod.yml ps`.
5. أنشئ أول مستخدم: `docker exec -it LibreChat-API npm run create-user`.
6. جدول النسخ الاحتياطي: `0 3 * * * cd /opt/librechat && ./deploy/scripts/backup.sh >> logs/backup.log 2>&1`.

## أسرار GitHub المطلوبة (Environment: production)
`DEPLOY_HOST` `DEPLOY_USER` `DEPLOY_SSH_KEY` `DEPLOY_PATH` `GHCR_PULL_USER` `GHCR_PULL_TOKEN` (PAT بصلاحية read:packages).

## تراجع
عدّل `IMAGE_TAG` في `.env` إلى الوسم السابق ثم `docker compose -f docker-compose.prod.yml up -d`.
استعادة البيانات: `./deploy/scripts/restore.sh backups/mongo-XXXX.archive.gz`.

## تنبيه ترحيل
إن كانت `data-node` قائمة بدون مصادقة (--noauth سابقًا)، فمتغيرات `MONGO_INITDB_*` لن تنشئ المستخدم.
خذ نسخة `mongodump`، أنشئ المستخدم يدويًا بـ mongosh، ثم فعّل compose.prod.

## النشر اليدوي والتحكم بالـ workflows
- `deploy-alazab.yml` يعمل يدويًا فقط (Run workflow من فرع `main`). لإعادة النشر التلقائي راجع التعليق أعلى الملف، وفعّل Required reviewers على بيئة `production`.
- لتعطيل workflows الخاصة بـ upstream في الـ fork: `./deploy/scripts/disable-upstream-workflows.sh` (يتطلب `gh auth login`).

## دالة ollama-proxy (Supabase)
- تتحقق الآن أن JWT يعود لمستخدم حقيقي (ليس `anon`). لتقييدها بنطاقات بريد: 
  `supabase secrets set OLLAMA_ALLOWED_EMAIL_DOMAINS=alazab.com`
- النشر: `supabase functions deploy ollama-proxy` (و`verify_jwt = true` مثبَّت في `supabase/config.toml`).
