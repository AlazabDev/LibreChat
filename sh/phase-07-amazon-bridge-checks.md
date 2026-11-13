# مصفوفة التحقق والاختبار — الركيزة السابعة (Phase 07 Verification Matrix)
## جسر متجر أمازون المباشر للأسعار والمواصفات اللحظية (Amazon SP-API Live Pricing & Catalog Bridge)
**Target Components:** Amazon SP-API Bridge MCP Server, Live Pricing Verification, Real-Time Inventory Tracking, Arabic Search, Model Bindings & Anti-Hallucination
**Protocol Reference:** [`sh/README.md`](file:///mnt/ai/LibreChat/sh/README.md)
**Test Script:** [`sh/phase-07-amazon-bridge-test.sh`](file:///mnt/ai/LibreChat/sh/phase-07-amazon-bridge-test.sh)

---

### جدول حالات التحقق والاختبار (Test Coverage Matrix)

| المعرف | المتطلب / المكون المفحوص | حالة الاختبار | النتيجة المتوقعة | الحالة |
| :---: | :--- | :--- | :--- | :---: |
| **T7-01** | هيكل مجلدات وملفات جسر أمازون | فحص وجود مجلد `mcp/amazon-sp-api/` وملفات `server.mjs` و `catalog.json` | الملفات الأساسية موجودة ومكتملة | PASS |
| **T7-02** | صلاحيات وصحة كود خادم أمازون | فحص صلاحية التنفيذ وخلو `server.mjs` من أخطاء الـ Syntax | كود صالح وقابل للتنفيذ المباشر عبر Node.js | PASS |
| **T7-03** | تكامل كتالوج منتجات متجر العزب على أمازون | فحص بنية `mcp/amazon-sp-api/catalog.json` والحقول الإلزامية | كتالوج JSON صالح يضم منتجات المتجر مع ASIN والأسعار والمواصفات | PASS |
| **T7-04** | دورة حياة بروتوكول MCP (Initialize) | إرسال طلب `initialize` بصيغة JSON-RPC 2.0 للخادم عبر stdio | استجابة الخادم ببروتوكول MCP 2024-11-05 ومعلومات الخادم | PASS |
| **T7-05** | تسجيل أدوات متجر أمازون الذكية الأربعة | إرسال طلب `tools/list` وفحص قائمة الأدوات | تسجيل الأدوات الـ 4 (pricing, search, inventory, status) | PASS |
| **T7-06** | استعلام الأسعار اللحظية (Live Pricing) | استدعاء `get_amazon_live_pricing` برمز ASIN (B09AZAB001) | جلب السعر الفعلي المعتمد (Buy Box) والخصم والعملة دون تخمين | PASS |
| **T7-07** | البحث الدلالي العربي في منتجات أمازون | استدعاء `search_amazon_products` بالكلمات العربية ("طفاية حريق") | استرجاع المنتجات المطابقة بالمواصفات والأسعار بدقة | PASS |
| **T7-08** | تتبع مستويات المخزون (Inventory Status) | استدعاء `get_amazon_inventory_status` | إرجاع الوحدات القابلة للشحن الفوري FBA والوحدات الواردة | PASS |
| **T7-09** | تشخيص جاهزية مفاتيح SP-API و LWA | استدعاء `check_amazon_sp_api_status` | التحقق من تكوين Seller ID ومفاتيح LWA وحالة الجسر | PASS |
| **T7-10** | تسجيل الجسر في سجل MCP (registry.json) | فحص ملف `mcp/registry.json` للتأكد من تسجيل موفر `amazon-sp-api` | تسجيل الخادم كموفر معتمد نوع `mcp-server` | PASS |
| **T7-11** | تسجيل خادم أمازون في `librechat.yaml` | فحص تسجيل خادم `amazon-sp-api` تحت `mcpServers` | الخادم معرف بنمط stdio ومع مفتاح `chatMenu: true` | PASS |
| **T7-12** | ربط أداة أمازون بنماذج العزب التخصصية | فحص قوائم النماذج (`alazab-finance`, `alazab-core`, `alazab-maint`) | ربط الأدوات بالنماذج لدعم القرارات المالية والفنية والتشغيلية | PASS |

---

### ملخص التوثيق والأدلة التشغيلية
- **عدد حالات الاختبار:** 12 حالة
- **البيئة المستهدفة:** جسر متجر أمازون ومنظومة العزب للذكاء الاصطناعي (`chat.alazab.com`)
- **مسار السجلات:** `sh/reports/phase-07-amazon-bridge-<timestamp>.log`

