# مصفوفة التحقق والاختبار — الركيزة الخامسة (Phase 05 Verification Matrix)
## الهوية البصرية، تجربة المستخدم الموحدة، وتخصيص الصلاحيات (Enterprise UI/UX, Customization & RBAC)
**Target Components:** Enterprise HTML Branding, Arabic Localization, Model Specs Personas (Managers, Staff, Technicians, Clients), Interface Policies & RBAC
**Protocol Reference:** [`sh/README.md`](file:///mnt/ai/LibreChat/sh/README.md)
**Test Script:** [`sh/phase-05-ui-ux-branding-test.sh`](file:///mnt/ai/LibreChat/sh/phase-05-ui-ux-branding-test.sh)

---

### جدول حالات التحقق والاختبار (Test Coverage Matrix)

| المعرف | المتطلب / المكون المفحوص | حالة الاختبار | النتيجة المتوقعة | الحالة |
| :---: | :--- | :--- | :--- | :---: |
| **T5-01** | عنوان المنظومة واسم التطبيق في HTML | فحص `<title>` و `<meta application-name>` في `client/index.html` | ظهور "منظومة العزب للذكاء الاصطناعي \| Alazab AI" | PASS |
| **T5-02** | الوصف المؤسسي التعريفي في HTML | فحص `<meta name="description">` في `client/index.html` | وصف مؤسسي دقيق بالعربية للبوابة الموحدة | PASS |
| **T5-03** | متغير عنوان التطبيق `APP_TITLE` | فحص قيمة `APP_TITLE` في ملفات البيئة | مطابقة الاسم المؤسسي لمنظومة العزب | PASS |
| **T5-04** | التذييل المؤسسي المعتمد `CUSTOM_FOOTER` | فحص قيمة `CUSTOM_FOOTER` في ملفات البيئة | تذييل رسمي يحمل اسم المنظومة ورابط النطاق | PASS |
| **T5-05** | رسالة الترحيب ورأس شاشة البداية | فحص `customWelcome` و `landingHeading: greeting` في `librechat.yaml` | ترحيب رسمي بهوية العزب وتحية مخصصة للمستخدم | PASS |
| **T5-06** | روابط الخصوصية وشروط الاستخدام | فحص `privacyPolicy` و `termsOfService` في `interface` | روابط رسمية تشير إلى نطاق `chat.alazab.com` | PASS |
| **T5-07** | رابط المساعدة والدعم الفني الموحد | فحص `helpAndFaqURL` في التكوين العام | توجيه المستخدم لمركز الدعم `https://chat.alazab.com/help` | PASS |
| **T5-08** | سلامة ملف الترجمة العربية (ar) | فحص `client/src/locales/ar/translation.json` | ملف JSON صالح يحتوي على ترجمات واجهات الشات والوكلاء | PASS |
| **T5-09** | سلامة ملف الترجمة الإنجليزية (en) | فحص `client/src/locales/en/translation.json` | ملف JSON صالح ومكتمل للواجهة الإنجليزية الموازية | PASS |
| **T5-10** | تنظيم عرض النماذج (Model Specs Layout) | فحص `prioritize: true` و `enforce: false` | إبراز قوالب العزب في الواجهة مع حرية التبديل | PASS |
| **T5-11** | تغطية الفئات الـ 4 (المدراء، الموظفين، الفنيين، المالية) | فحص تمثيل الفئات عبر قوالب النماذج التخصصية | قوالب مخصصة للمدراء، الموظفين، الفنيين، والمحلل المالي | PASS |
| **T5-12** | أسئلة الانطلاق السريعة بالعربية (Starters) | فحص `conversation_starters` لكافة النماذج الـ 8 | أسئلة انطلاق احترافية باللغة العربية لكل تخصص | PASS |
| **T5-13** | سياسات الصلاحيات والمشاركة (RBAC) | فحص قيود `prompts.public: false` و `agents.share: true` | حظر النشر العام غير المنضبط والسماح بالمشاركة المعتمدة | PASS |
| **T5-14** | مطابقة المخطط الشامل لنظام LibreChat | فحص التحقق عبر `configSchema.safeParse` | اجتياز الفحص البرمجي بنسبة 100% دون أي أخطاء | PASS |

---

### ملخص التوثيق والأدلة التشغيلية
- **عدد حالات الاختبار:** 14 حالة
- **البيئة المستهدفة:** الواجهة الموحدة لمنظومة العزب (`chat.alazab.com`)
- **مسار السجلات:** `sh/reports/phase-05-ui-ux-branding-<timestamp>.log`

