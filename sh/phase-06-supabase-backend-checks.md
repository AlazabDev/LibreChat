# مصفوفة التحقق والاختبار — الركيزة السادسة (Phase 06 Verification Matrix)
## تنظيم الباك إند الداخلي والخارجي: سوبابيس ودوال الحافة وتكامل الأعمال (Supabase & Backend Orchestration)
**Target Components:** Supabase Configuration, Storage RLS Policies, Edge Functions (ollama-proxy, daftra-mcp, auth-mcp), Arabic Aliases, Shared Drivers (MinIO/S3, WhatsApp), MCP Registration & Environment Sync
**Protocol Reference:** [`sh/README.md`](file:///mnt/ai/LibreChat/sh/README.md)
**Test Script:** [`sh/phase-06-supabase-backend-test.sh`](file:///mnt/ai/LibreChat/sh/phase-06-supabase-backend-test.sh)

---

### جدول حالات التحقق والاختبار (Test Coverage Matrix)

| المعرف | المتطلب / المكون المفحوص | حالة الاختبار | النتيجة المتوقعة | الحالة |
| :---: | :--- | :--- | :--- | :---: |
| **T6-01** | نطاق سوبابيس وتوجيه المصادقة | فحص `site_url` و `additional_redirect_urls` في `supabase/config.toml` | مطابقة النطاق المعتمد `https://chat.alazab.com` ومسار الكولباك | PASS |
| **T6-02** | تطابق معرف المشروع السحابي (Project Ref) | مطابقة `supabase/.temp/project-ref` مع `SUPABASE_PROJECT_ID` في البيئة | تطابق المعرف المعتمد `refpgfvhfzralhzwnyyi` | PASS |
| **T6-03** | سياسات الأمان والعزل لتخزين المرفقات (Storage RLS) | فحص سياسات الأمان في `supabase/migrations/` لحاوية `chat-attachments` | وجود سياسات `insert_own` و `select_own` و `delete_own` | PASS |
| **T6-04** | دالة الحافة `ollama-proxy` ومعالجة CORS | فحص `supabase/functions/ollama-proxy/index.ts` لدعم CORS و OPTIONS 204 و JWT | حماية تامة للاستدلال الداخلي مع دعم preflight ورمز هوية العزب | PASS |
| **T6-05** | كتالوج عمليات دفترة المحاسبية (Daftra Catalog) | فحص سلامة وتكامل `supabase/functions/daftra-mcp/catalog.json` | ملف JSON صالح يضم 301 عملية مؤسسية معتمدة | PASS |
| **T6-06** | تغطية وحدات وأقسام دفترة (Daftra Coverage) | تشغيل فحص التغطية البرمجية `coverage.test.ts` عبر tsx | اجتياز الفحص بـ 70 موديول برمجي يغطي 27 قسماً إدارياً ومحاسبياً | PASS |
| **T6-07** | المرادفات الدلالية العربية لدفترة (Arabic Aliases) | فحص `supabase/functions/daftra-mcp/arabic-aliases.ts` | دعم المصطلحات العربية (فواتير، قيود، أوامر عمل، عملاء، أصول) | PASS |
| **T6-08** | دالة حافة المصادقة الموحدة `auth-mcp` | فحص أدوات التحقق في `supabase/functions/auth-mcp/index.ts` | تعريف الأدوات الـ 5 (check_account, send_auth_otp, conflict, ticket, apps) | PASS |
| **T6-09** | محركات الربط المشتركة (`_shared`) | فحص `minio.ts` للتخزين و `wa.ts` لبوابة واتساب | سلامة صياغة كود محركات التخزين السحابي والتواصل الفوري | PASS |
| **T6-10** | سلامة أداة سوبابيس (Supabase CLI) | فحص تنفيذ أمر `HOME=/tmp supabase --version` | استجابة الأداة بنجاح بإصدار v2.x متوافق مع الحاويات | PASS |
| **T6-11** | مزامنة متغيرات البيئة الأساسية لسوبابيس | فحص متغيرات `SUPABASE_URL` و `SUPABASE_ANON_KEY` و `DATABASE_URL` | تفعيل المتغيرات المعتمدة وربطها بالسيرفر السحابي | PASS |
| **T6-12** | تسجيل وتكامل خوادم MCP في `librechat.yaml` | فحص تسجيل خوادم `daftra` و `supabase` ضمن `mcpServers` والوكلاء | ربط خوادم الباك إند بالوكيل المالي `alazab-finance` ومساعد الموظفين | PASS |

---

### ملخص التوثيق والأدلة التشغيلية
- **عدد حالات الاختبار:** 12 حالة
- **البيئة المستهدفة:** خوادم الباك إند الداخلي والخارجي وسوبابيس لمنظومة العزب (`chat.alazab.com`)
- **مسار السجلات:** `sh/reports/phase-06-supabase-backend-<timestamp>.log`

