# مصفوفة التحقق من المرحلة الأولى: توحيد النماذج والمحركات (Unified Model Hub)

- **رقم المرحلة:** Phase 01
- **الاسم المختصر:** `model-hub`
- **نطاق المرحلة:** ضبط وتهيئة محركات ونماذج الذكاء الاصطناعي (Azure OpenAI, Google Gemini, DeepSeek, Ollama Local) وقوائم النماذج الذكية المخصصة للمؤسسة (Smart Model Specs) ومعالجة معاملات الاستدلال وحل مشكلة 404.
- **الملفات المعنية:**
  - `librechat.alazab.yaml`
  - `librechat.yaml`
  - `.env.alazab.example`
  - `packages/data-provider/src/config.ts`

---

## مصفوفة التغطية الاختبارية (Coverage Matrix)

| المعرّف (ID) | العنصر / المتطلب (Requirement / Component) | حالة الاختبار (Test Case) | النتيجة المتوقعة (Expected Result) | النتيجة الفعلية (Actual Result) | الحالة (Status) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **T-001** | وجود ملفات الإعداد وصحة صياغة YAML | التحقق من وجود `librechat.alazab.yaml` و `librechat.yaml` وصحة صياغة YAML | قراءة ناجحة دون أخطاء صياغة | تم الفحص بنجاح بدون أخطاء | PASS |
| **T-002** | مطابقة المخطط الرسمي لنظام LibreChat (`configSchema`) | التحقق من صحة الإعدادات عبر Zod `configSchema` من حزمة `data-provider` | اجتياز التحقق بنسبة 100% بدون أخطاء هيكلية | تم الفحص ونجح 100% | PASS |
| **T-003** | تهيئة نقطة Azure OpenAI (`Alazab Azure`) | فحص وجود نقطة Azure OpenAI والـ baseURL والـ headers ومفتاح المصادقة | تكوين صحيح متوافق مع Azure OpenAI v1 | معرفة بالكامل مع النماذج الستة | PASS |
| **T-004** | معالجة معاملات الاستدلال (`dropParams`) في Azure | فحص وجود `dropParams` واستبعاد `temperature`, `top_p`, `stop`, `user`, إلخ | احتواء `dropParams` على المعاملات المسببة لأخطاء 400 في نماذج التفكير | تم إسقاط كافة المعاملات غير المدعومة | PASS |
| **T-005** | تهيئة نقطة Google Gemini الرسمية وحل مشكلة 404 | التحقق من وجود نقطة `endpoints.google` ونماذج Gemini الحديثة المعرفة صراحةً | تواجد النماذج: `gemini-2.5-pro`, `gemini-2.5-flash`, `gemini-2.5-flash-lite`, `gemini-2.0-flash` | معرفة صراحةً ومطابقة لـ modelListEndpointSchema | PASS |
| **T-006** | تهيئة نقطة DeepSeek المباشرة | التحقق من وجود نقطة DeepSeek بنماذجها السحابية والاكتشاف التلقائي | تواجد `deepseek-chat`, `deepseek-reasoner`, `deepseek-flash`, `deepseek-v4-pro` مع `fetch: true` | تم التحقق بنجاح | PASS |
| **T-007** | تهيئة نقطة Ollama المحلية والسرية التامة (On-Premise) | التحقق من نقطة Ollama وسيرفر الشركة `https://ollama.alazab.com/v1` ومفتاح الربط | وجود النماذج: `gpt-oss:20b`, `deepseek-coder-v2:16b`, `qwen3.6:27b`, إلخ مع `fetch: true` | تم التحقق بنجاح | PASS |
| **T-008** | هيكل قوائم النماذج الذكية (Model Specs) | فحص تفعيل `prioritize: true` وعدد النماذج المحددة (8 نماذج تخصصية) | تصنيف النماذج الـ 8 حسب الغرض مع `order` وترتيب منطقي | 8 نماذج مرتبة ومصنفة | PASS |
| **T-009** | التعليمات التخصصية وبدايات المحادثة (Prompt Prefixes & Starters) | فحص احتواء كل قالب نموذج على تعليمات دور واضحة باللغة العربية وأسئلة انطلاق | كل نموذج يحمل `promptPrefix` عربي رسمي و `conversation_starters` | مغطاة بالكامل لجميع النماذج | PASS |
| **T-010** | مزامنة قالب متغيرات البيئة (`.env.alazab.example`) | التحقق من توافق المتغيرات مع الإعدادات (`GOOGLE_MODELS`, `OLLAMA_API_KEY`, إلخ) | توفر كافة المتغيرات بدون نواقص | متطابقة تماماً | PASS |
| **T-011** | التحقق من سلامة الأنواع البرمجية (TypeScript Typecheck) | تشغيل `tsc --noEmit` على حزمة `data-provider` | خروج بكود 0 دون أي أخطاء أنواع | 0 errors | PASS |
| **T-012** | فحص الاتصال بالشبكة وخوادم النماذج (Live Reachability Probe) | فحص استجابة واجهات خوادم النماذج عبر HTTP HEAD/GET الآمن بدون كشف أسرار | إعطاء تقرير بحالة الاتصال مع SKIP آمن في حال عدم توفر اتصال بالشبكة أو DNS داخلي | تم الفحص وتوثيق النتائج بأمان | PASS |

