# نشر منظومة العزب (VPS واحد)

## أول مرة
1. ثبّت Docker + Compose + certbot على السيرفر؛ وجّه DNS لـ `chat.alazab.com` إلى IP السيرفر.
2. `git clone` أو انسخ الملفات إلى `DEPLOY_PATH` ثم:
   ```bash
   cp .env.alazab.example .env       # املأ كل القيم الفارغة (openssl rand -hex 32 ...)
   cp librechat.alazab.yaml librechat.yaml
   ```
3. (خادم بلا nginx مضيف فقط) الشهادة قبل تشغيل nginx الحاوية بـ 443: 
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

## خادم فيه nginx على المضيف (حالة azab-orchestrator)
- لا تشغّل `--profile container-nginx` (سيتعارض مع 80/443). التطبيقات تُنشر على `127.0.0.1:3080` و`127.0.0.1:3002` فقط.
- استخدم `deploy/nginx.host.conf` كـ vhost لـ `chat.alazab.com`، ثم `nginx -t && systemctl reload nginx`.
- قبل التفعيل: `ss -tlnp | grep -E ':(3080|3002)\b'` (يجب ألا يظهر شيء).

## تحذير: قرص /mnt على Azure مؤقت
على azab-orchestrator القرص `/mnt` (`/dev/sdb1`) مؤقت (ملف DATALOSS_WARNING_README.txt). لا تضع عليه بيانات LibreChat ولا النسخ الاحتياطية.
`DEPLOY_PATH=/opt/librechat` على القرص الجذر. فكّر بإرفاق Managed Data Disk ونقل البيانات المهمة إليه.

## أول نشر
أنشئ مجلد المشروع و`.env` و`librechat.yaml` أولًا (الـ workflow يعدّل `.env` ويفشل إن لم يوجد).
مجلدات `images/uploads/logs/skill` ينشئها Docker، وحاوية api تعمل بمستخدم root فلا حاجة لـ chown.
