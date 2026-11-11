# مصفوفة التحقق والاختبار — الركيزة الثالثة (Phase 03 Verification Matrix)
## المعرفة المؤسسية الموحدة والـ RAG & كتالوج مجالات العزب السبعة
**Target Component:** Alazab Enterprise Knowledge Hub, RAG Service (Port 8088) & 8-Domain Catalog
**Protocol Reference:** [`sh/README.md`](file:///mnt/ai/LibreChat/sh/README.md)
**Test Script:** [`sh/phase-03-rag-catalog-test.sh`](file:///mnt/ai/LibreChat/sh/phase-03-rag-catalog-test.sh)

---

### جدول حالات التحقق والاختبار (Test Coverage Matrix)

| المعرف | المتطلب / المكون المفحوص | حالة الاختبار | النتيجة المتوقعة | الحالة |
| :---: | :--- | :--- | :--- | :---: |
| **T3-01** | هيكل مسارات كتالوج العزب | فحص وجود مجلدات `mcp/alazab-catalog` و `categories` و `docs` | وجود المجلدات بصلاحيات قراءة وتنفيذ صحيحة | PASS |
| **T3-02** | سلامة ملفات الفئات الـ 8 | قراءة وتحليل JSON لكافة ملفات الفئات الـ 8 | ملفات صالحة وخالية من أخطاء الـ Syntax | PASS |
| **T3-03** | تكامل الكتالوج الموحد | فحص ملف `alazab_catalog.json` | ملف JSON موحد يحتوي على 720 بنداً مفهرساً | PASS |
| **T3-04** | وثائق المعرفة والـ RAG بتنسيق Markdown | فحص توليد الوثائق الـ 8 وملف الكتالوج المرجعي الماستر | 8 ملفات تخصصية + `alazab_master_catalog.md` | PASS |
| **T3-05** | صلاحيات وتكوين خادم MCP | فحص قابلية تنفيذ وصحة بناء `catalog-server.mjs` | كود Node.js خالي من الأخطاء وقابل للتنفيذ | PASS |
| **T3-06** | بروتوكول MCP (Initialize) | إرسال طلب تهيئة JSON-RPC 2.0 عبر stdio | استجابة ببروتوكول MCP 2024-11-05 ومعلومات الخادم | PASS |
| **T3-07** | قائمة أدوات الكتالوج (Tools List) | استدعاء `tools/list` عبر MCP | ظهور 3 أدوات: البحث، استعراض المجالات، وجلب بند محدد | PASS |
| **T3-08** | البحث الدلالي والنصوصي بالعربية | استدعاء `search_alazab_catalog` بكلمة "طفاية حريق" | استرجاع بنود مطابقة مع الوحدة والمواصفة والسعر | PASS |
| **T3-09** | استرجاع البند بالمعرف الموحد | استدعاء `get_catalog_item` بالمعرف `AZ-SEC-0183` | جلب تفاصيل البند الدقيقة بنجاح | PASS |
| **T3-10** | مطابقة منفذ الـ RAG (Port 8088) | فحص `RAG_PORT` و `RAG_API_URL` في compose والبيئة | اعتماد المنفذ 8088 حصراً ومنع المنفذ 8000 | PASS |
| **T3-11** | إعدادات معالجة الملفات `fileConfig` | فحص تكوين `fileConfig` في `librechat.yaml` | حدود الرفع (100MB) وسياق الاستخراج وأنواع الميديا | PASS |
| **T3-12** | تسجيل خادم الكتالوج في MCP | فحص تعريف `alazab-catalog` في `librechat.yaml` | نوع stdio وأمر التشغيل وتعليمات الخادم | PASS |
| **T3-13** | ربط الكتالوج بوكلاء المؤسسة | فحص قوائم النماذج (`alazab-maint`, `finance`, `core`) | تضمين `alazab-catalog` في مصفوفة الأدوات لكل وكيل | PASS |
| **T3-14** | فحص تكامل الإنتاج (Docker Compose) | تشغيل فحص البنية لـ `docker-compose.prod.yml` | اجتياز التحقق بنجاح كامل (Config valid) | PASS |

---

### ملخص التوثيق والأدلة التشغيلية
- **عدد حالات الاختبار:** 14 حالة
- **البيئة:** الإنتاج المؤسسي (Production Environment)
- **مسار السجلات:** `sh/reports/phase-03-rag-catalog-<timestamp>.log`

