# تكاملات العزب — Alazab integrations

مصدر هذه التكاملات: حزمة `codex.zip` (مشروع `az-codex`). يُترجم هنا ما يصلح لـ LibreChat،
وما لا يصلح موثَّق أدناه مع سببه.

## البنية

```text
integrations/alazab/
├── agents/*.json            تعريفات الوكلاء العشرة (المصدر الوحيد للتعديل)
├── scripts/modelspecs.mjs   يولّد modelSpecs داخل librechat.alazab.yaml
└── README.md
```

الوكلاء تظهر في محدد النماذج تحت المجموعة **وكلاء العزب**. كل وكيل هو `modelSpec`
يربط: نشر Azure (`preset.model`) + تعليمات النظام (`promptPrefix`) + أدوات + خوادم MCP.

### تعديل وكيل

1. عدّل `agents/<id>.json` (التعليمات، النموذج، المبادرات، الأدوات).
2. `node integrations/alazab/scripts/modelspecs.mjs`
3. للتحقق في CI: `node integrations/alazab/scripts/modelspecs.mjs --check` (يفشل إن كانت الكتلة قديمة،
   أو إن أشار وكيل إلى نشر/خادم MCP غير معرَّف).

لا تعدّل الكتلة المحصورة بين `GENERATED:agent-specs` يدوياً؛ ستُستبدل.

## ما يُنقل وما لا يُنقل

| العنصر في Foundry | في LibreChat | ملاحظة |
| --- | --- | --- |
| `instructions` | `preset.promptPrefix` | نص حرفي. بعض التعليمات تذكر اسم نشر قديماً (مثل `az-model-finance` داخل az-agent-prod)؛ تُركت كما هي |
| `model` (نشر Azure) | `preset.model` على endpoint `Alazab Azure` | |
| `temperature` / `top_p` | تُنقل فقط حيث وُجدت (finance, payments) | قد ترفضها نماذج الاستدلال؛ اختبر |
| `web_search` | `webSearch: true` | **يتطلب** ضبط مزود البحث في LibreChat (غير مضبوط بعد) |
| `file_search` | `fileSearch: true` | |
| `mcp` → `kb-az-knowledge` | `mcpServers: [kb-az-knowledge]` | نقطة Azure AI Search MCP؛ مفتاح `AZURE_SEARCH_API_KEY` |
| `mcp` → `az-uberfix-mcp` | `mcpServers: [uberfix-apim]` | SSE عبر APIM؛ مصادقة APIM غير مؤكدة |
| `code_interpreter` | **غير مفعّل** | يحتاج Code API/بيئة تنفيذ في LibreChat |
| `memory_search_preview` | غير منقول | لا مكافئ مضبوط (ذاكرة LibreChat إعداد منفصل) |
| `azure_ai_search` (أداة) | غير منقول | تُستبدل بخادم `kb-az-knowledge` حيث صُرّح به |
| `a2a_preview` (prod → maint) | غير منقول | لا مكافئ؛ يمكن لاحقاً عبر `subagents` بوكلاء LibreChat حقيقيين |

`az-agent-codex` مخفي من القائمة (`showInMenu: false`) لأن تعيين النشر `az-model-codex` غير مؤكد.

## خوادم MCP

| الخادم | المصدر | الحالة |
| --- | --- | --- |
| `kb-az-knowledge` | تعريف Foundry | يحتاج التحقق من الاتصال بالمفتاح |
| `uberfix-apim` | تعريف Foundry (az-agent-project) | يحتاج التحقق من مصادقة APIM |
| `frappe` | `az-codex/mcp/frappe-bench.mjs` عبر البوابة | أدواته كاتبة (migrate/backup/build) — شغّله بـ `FRAPPE_BENCH_READONLY=1` ما لم تلزم الكتابة |
| `daftra` `magicplan` `uberfix` | OpenAPI في الحزمة، مُقدَّمة عبر `mcp.alazab.com` | كل الخوادم `startup: false` حتى التحقق |

كل الخوادم بـ `startup: false`: لا يُهيَّأ أيٌّ منها عند الإقلاع حتى يُتحقق منه، فلا يعطّل فشل أحدها الباقي.

## ما استُبعد عمداً

- **إضافة WhatsApp (`openclaw.plugin.json`)**: قناة OpenClaw تربط حساب واتساب ويب عادياً عبر المحاكاة. ليست خادم MCP
  ولا واجهة Meta الرسمية (WhatsApp Business Cloud API)، وتخالف شروط واتساب في الإنتاج. المسار `/whatsApp` على
  البوابة يبقى مسجّلاً، ويُفضَّل أن يكون خلفه Cloud API الرسمي (انظر `mcp/whatsapp/meta_whatsapp.md` في الحزمة).
- **ملفات `.env`**: احتوت الحزمة على ملفين فيهما مفاتيح حقيقية (OpenAI وWEBUI_API_KEY). لم تُنسخ، ويجب تدويرها.
- **مواصفات OpenAPI الكبيرة** (Daftra ≈ 3.3 MB، magicplan ≈ 220 KB) وكتالوج المعرفة (≈ 1.7 MB): تُخدَّم عبر
  البوابة أو تُرفع كملفات معرفة للوكيل (RAG)، ولا تُحفظ في المستودع.
- **`az-codex-ts` و`codex-webui`**: تطبيقات واجهة مستقلة (Svelte/React/NestJS) لا علاقة لها بتكامل LibreChat.

## قبل التفعيل

1. تحقق من أسماء النشر في Azure، ومن `az-model-codex`.
2. اختبر كل خادم MCP يدوياً ثم غيّر `startup` إلى `true` (أو احذفه).
3. اضبط مزود `webSearch` في LibreChat، وإلا لن تعمل أداة البحث رغم تفعيلها في الوكلاء.
4. راجع موافقات الأدوات الكاتبة (frappe, daftra, whatsapp) — `docs/tool-approval-modes.md`.
