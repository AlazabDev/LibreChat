# مصفوفة التحقق والاختبار — الركيزة الثامنة (Phase 08 Verification Matrix)
## التدشين الحي للحاويات وفحص الجاهزية الشاملة للإنتاج (Live Container Orchestration & Production Smoke Tests)
**Target Components:** Docker Compose Production Architecture (7 Services), Nginx Reverse Proxy & SSL, Port 8088 RAG Alignment, Health Routes, SSE Streaming, Log Rotation & Backup
**Target Domain:** `https://chat.alazab.com`
**Protocol Reference:** [`sh/README.md`](file:///mnt/ai/LibreChat/sh/README.md)
**Test Script:** [`sh/phase-08-production-deployment-test.sh`](file:///mnt/ai/LibreChat/sh/phase-08-production-deployment-test.sh)

---

### جدول حالات التحقق والاختبار (Test Coverage Matrix)

| المعرف | المتطلب / المكون المفحوص | حالة الاختبار | النتيجة المتوقعة | الحالة |
| :---: | :--- | :--- | :--- | :---: |
| **T8-01** | صحة هيكل الحاويات الـ 7 للإنتاج | فحص بنية `docker-compose.prod.yml` والخدمات السبع | اكتمال تعريف (api, admin-panel, nginx, mongodb, meilisearch, vectordb, rag_api) | PASS |
| **T8-02** | ربط مجلدات MCP والتكوين (Volume Mounts) | فحص ربط `./mcp:/app/mcp:ro` و `librechat.yaml` في الحاويات | إتاحة خوادم MCP والكتالوج بأمان للقراءة فقط | PASS |
| **T8-03** | تطابق منفذ الـ RAG المعتمد (8088) | فحص المنفذ 8088 في compose وخادم Nginx وملف البيئة | منع أي تعارض مع المنفذ 8000 وتوحيد المنفذ على 8088 | PASS |
| **T8-04** | مسار فحص الصحة اللحظي `/health` | فحص مسار `/health` في compose و Nginx | توجيه مسار الفحص إلى حاوية الـ API واستجابة 200 | PASS |
| **T8-05** | مسار لوحة الإدارة المؤسسية `/admin` | فحص توجيه المسار إلى حاوية `admin-panel:3000` | توجيه آمن للوحة الإدارة مع تمرير هيدرز الجلسة | PASS |
| **T8-06** | استقرار البث اللحظي للردود (SSE Streaming) | فحص `proxy_buffering off` ومهلة القراءة 3600 ثانية | إلغاء التخزين المؤقت لضمان تدفق الكلمات فورياً | PASS |
| **T8-07** | هيدرز الأمان العالي والحماية المؤسسية | فحص فرض HSTS و nosniff و SAMEORIGIN و CSP | حماية المتصفح من هجمات الاختراق وحقن الأكواد | PASS |
| **T8-08** | حدود تدفق الطلبات ومكافحة DoS (Rate Limiting) | فحص مناطق `alazab_auth_limit` و `alazab_api_limit` | حماية بوابات الدخول والـ API من الهجمات العشوائية | PASS |
| **T8-09** | تطابق سقف رفع الملفات (100MB) | فحص `client_max_body_size 100M` وتطابقه مع RAG | السماح برفع المستندات والوثائق الكبيرة دون خطأ 413 | PASS |
| **T8-10** | سياسة تدوير السجلات والحماية من امتلاء القرص | فحص `x-logging` (max-size 20m, max-file 5) | حظر تراكم السجلات اللانهائي والحفاظ على استقرار السيرفر | PASS |
| **T8-11** | جاهزية سكربت النسخ الاحتياطي التلقائي | فحص تنفيذ `deploy/scripts/backup.sh` وسياسة الـ 14 يوماً | أخذ نسخة مطابقة لقاعدة البيانات والمرفقات | PASS |
| **T8-12** | صمام أمان سكربت الاستعادة (Safety Prompt) | فحص `deploy/scripts/restore.sh` وطلب تأكيد YES الصريح | منع استبدال البيانات التشغيلية عن طريق الخطأ | PASS |

---

### ملخص التوثيق والأدلة التشغيلية
- **عدد حالات الاختبار:** 12 حالة
- **البيئة المستهدفة:** خوادم الإنتاج لمنظومة العزب (`chat.alazab.com`)
- **مسار السجلات:** `sh/reports/phase-08-production-deployment-<timestamp>.log`

