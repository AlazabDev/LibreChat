# مصفوفة التحقق والاختبار — الركيزة الرابعة (Phase 04 Verification Matrix)
## الاستقرار، الحماية، الأداء العالي، والمراقبة والنسخ الاحتياطي (Production Hardening & High Availability)
**Target Components:** Nginx Reverse Proxy (SSL/TLS & Rate Limiting), Docker Compose Prod, Automated Backups, Langfuse Tracing, and Network Isolation
**Protocol Reference:** [`sh/README.md`](file:///mnt/ai/LibreChat/sh/README.md)
**Test Script:** [`sh/phase-04-production-hardening-test.sh`](file:///mnt/ai/LibreChat/sh/phase-04-production-hardening-test.sh)

---

### جدول حالات التحقق والاختبار (Test Coverage Matrix)

| المعرف | المتطلب / المكون المفحوص | حالة الاختبار | النتيجة المتوقعة | الحالة |
| :---: | :--- | :--- | :--- | :---: |
| **T4-01** | صحة بنية Compose للإنتاج | فحص ملف `docker-compose.prod.yml` والخدمات الـ 7 | نجاح الفحص المعياري وتكامل الخدمات | PASS |
| **T4-02** | منافذ التخزين ومجلدات الحاويات | فحص ربط مجلدات `./mcp` و `./librechat.yaml` و `./uploads` و `librechat-data` | مسارات مربوطة بصلاحيات القراءة الصحيحة `ro` | PASS |
| **T4-03** | تكامل خادم Nginx العكسي | فحص ملف `deploy/nginx.prod.conf` وبنية الخوادم والموجهات | بنية كاملة تدعم HTTP (301) و HTTPS المشفر | PASS |
| **T4-04** | هيدرز الأمان العالي (Security Headers) | فحص HSTS و X-Frame و nosniff و XSS و Referrer | تطبيق كامل للمعايير الأمنية المؤسسية | PASS |
| **T4-05** | سياسات جدار الحماية (Rate Limiting) | فحص نطاقات `limit_req_zone` لنقاط المصادقة والـ API | حماية من هجمات DoS وتخمين كلمات المرور | PASS |
| **T4-06** | تطابق حد الرفع (100MB) | مطابقة `client_max_body_size` مع `fileConfig` في yaml | رفع حتى 100MB دون خطأ HTTP 413 | PASS |
| **T4-07** | دعم البث اللحظي للردود (SSE Streaming) | فحص `proxy_buffering off` وزمن الانتظار 3600s | استجابات فورية بدون تقطيع أو تخزين مؤقت | PASS |
| **T4-08** | نقطة فحص الجاهزية (Health Check) | فحص توجيه المسار `/health` وإلغاء تسجيل السجلات غير الضرورية | مراقبة جاهزية مستمرة ومستقرة | PASS |
| **T4-09** | سكربت النسخ الاحتياطي التلقائي | تشغيل `deploy/scripts/backup.sh` والتحقق من المخرجات | إنشاء الأرشيف وتطبيق سياسة الاحتفاظ (14 يوماً) | PASS |
| **T4-10** | سكربت استعادة الكوارث (Disaster Recovery) | فحص `deploy/scripts/restore.sh` والصلاحيات ومطالبة التأكيد | طلب تأكيد صريح `YES` لمنع المساس بالبيانات | PASS |
| **T4-11** | الرصد وتتبع الأداء (Langfuse Tracing) | فحص متغيرات `LANGFUSE_TRACING_ENABLED` و `SAMPLE_RATE` | تفعيل التتبع بنسبة 100% ورصد الأداء | PASS |
| **T4-12** | مسار سجلات التدقيق (Audit Logging) | فحص `AUDIT_LOG_PATH` وضوابط العمليات الحساسة | توثيق كامل للعمليات الحساسة وضوابط الكتابة | PASS |
| **T4-13** | عزل الشبكات والمنافذ غير الآمنة | فحص اقتصار المنافذ الخارجية على 80 و 443 فقط | عزل قواعد البيانات والـ API داخل شبكة `internal` | PASS |
| **T4-14** | حظر تسريب الأسرار في السجلات | فحص مخرجات السجلات والسكربتات للتأكد من عدم كشف المفاتيح | حجب وتشفير كامل للرموز والبيانات الحساسة | PASS |

---

### ملخص التوثيق والأدلة التشغيلية
- **عدد حالات الاختبار:** 14 حالة
- **البيئة المستهدفة:** الإنتاج الفعلي لمنظومة العزب (`chat.alazab.com`)
- **مسار السجلات:** `sh/reports/phase-04-production-hardening-<timestamp>.log`

