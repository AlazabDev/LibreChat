#!/usr/bin/env node
/**
 * build-catalog.mjs
 * يجمع ملفات كتالوج العزب من mcp/alazab-catalog/categories/*.json
 * ويولد:
 * 1. alazab_catalog.json (الكتالوج الموحد المفهرس)
 * 2. docs/ مصفوفة وثائق Markdown المجهزة للبحث المعرفي والـ RAG
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CATEGORIES_DIR = path.join(__dirname, 'categories');
const OUTPUT_CATALOG = path.join(__dirname, 'alazab_catalog.json');
const DOCS_DIR = path.join(__dirname, 'docs');

const DOMAIN_METADATA = {
  accounting: { title: 'المحاسبة والمالية', order: 1, icon: '📊' },
  flooring: { title: 'الأرضيات والتشطيبات', order: 2, icon: '🏗️' },
  hvac: { title: 'التكييف والتهوية الميكانيكية', order: 3, icon: '❄️' },
  painting: { title: 'الدهانات والديكور والتشطيبات', order: 4, icon: '🎨' },
  plumbing: { title: 'السباكة والشبكات والمحابس', order: 5, icon: '🚰' },
  purchases: { title: 'المشتريات والتوريدات وجداول الأسعار', order: 6, icon: '📦' },
  security: { title: 'الأمن والسلامة وإنذار الحريق والمراقبة', order: 7, icon: '📹' },
  other_specs: { title: 'المواصفات الفنية والهندسية التكميلية', order: 8, icon: '📋' },
};

function normalizeArabic(text) {
  if (!text) return '';
  return text
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[\u064B-\u065F]/g, '') // remove tashkeel
    .trim()
    .toLowerCase();
}

function run() {
  if (!fs.existsSync(CATEGORIES_DIR)) {
    console.error(`Categories directory not found: ${CATEGORIES_DIR}`);
    process.exit(1);
  }

  if (!fs.existsSync(DOCS_DIR)) {
    fs.mkdirSync(DOCS_DIR, { recursive: true });
  }

  const categoryFiles = fs.readdirSync(CATEGORIES_DIR).filter(f => f.endsWith('.json'));
  console.log(`Found ${categoryFiles.length} category files.`);

  const masterCatalog = {
    schemaVersion: '1.0.0',
    generatedAt: new Date().toISOString(),
    organization: 'منظومة العزب (Alazab AI)',
    totalCategories: categoryFiles.length,
    totalItems: 0,
    categories: {},
    items: [],
  };

  let masterMarkdown = `# الكتالوج المرجعي الموحد لمنظومة العزب (Alazab Master Knowledge Catalog)
**تاريخ التوليد:** ${new Date().toLocaleDateString('ar-EG')}
**الجهة:** منظومة العزب للتطوير والمقاولات والصيانة وإدارة الأعمال
**الوصف:** الدليل المعرفي المؤسسي الموحد للبنود والمواصفات والخامات والأسعار المعتمدة لقطاعات الصيانة والمقاولات والتشغيل.

---

## الفهرس العام للمجالات
`;

  categoryFiles.sort().forEach((file, idx) => {
    const domainKey = path.basename(file, '.json');
    const meta = DOMAIN_METADATA[domainKey] || { title: domainKey, order: idx + 1, icon: '📁' };
    const filePath = path.join(CATEGORIES_DIR, file);
    const rawData = fs.readFileSync(filePath, 'utf8');
    const items = JSON.parse(rawData);

    masterCatalog.categories[domainKey] = {
      title: meta.title,
      icon: meta.icon,
      itemCount: items.length,
      file: `categories/${file}`,
    };

    masterMarkdown += `- [${meta.icon} ${meta.title} (${items.length} بند)](#${domainKey})\n`;

    // Category Markdown Document
    let categoryMd = `# ${meta.icon} ${meta.title} — كتالوج بنود ومواصفات منظومة العزب
- **المجال:** \`${domainKey}\`
- **إجمالي البنود:** ${items.length} بند
- **المصدر المؤسسي:** منظومة العزب (Alazab AI)

---

| المعرف (ID) | اسم البند / المواصفة | الوحدة | التصنيف | السعر التقديري | الإجراء المعتمد |
| :---: | :--- | :---: | :---: | :---: | :---: |
`;

    items.forEach((item, itemIdx) => {
      const unifiedId = `AZ-${domainKey.toUpperCase().substring(0, 3)}-${String(item.id || itemIdx + 1).padStart(4, '0')}`;
      const normalizedItem = {
        uid: unifiedId,
        id: item.id || itemIdx + 1,
        domain: domainKey,
        domainTitle: meta.title,
        item: item.item || item.original || '',
        original: item.original || item.item || '',
        category: item.category || meta.title,
        unit: item.unit || 'وحدة',
        price: item.price !== undefined ? item.price : null,
        action: item.action || 'توريد وتركيب',
        source: item.source || 'alazab_specs',
        searchTokens: normalizeArabic(`${item.item || ''} ${item.category || ''} ${item.original || ''}`),
      };

      masterCatalog.items.push(normalizedItem);

      const priceDisplay = normalizedItem.price !== null ? `${normalizedItem.price} ج.م` : 'حسب المقايسة';
      const cleanItemDesc = (normalizedItem.item || '').replace(/\|/g, '-').replace(/\n/g, ' ');
      categoryMd += `| \`${unifiedId}\` | ${cleanItemDesc} | ${normalizedItem.unit} | ${normalizedItem.category} | ${priceDisplay} | ${normalizedItem.action} |\n`;
    });

    const docFileName = `${String(meta.order).padStart(2, '0')}_${domainKey}.md`;
    fs.writeFileSync(path.join(DOCS_DIR, docFileName), categoryMd, 'utf8');
    console.log(`Generated doc: docs/${docFileName} (${items.length} items)`);
  });

  masterCatalog.totalItems = masterCatalog.items.length;

  // Master Markdown compilation
  masterMarkdown += `\n---\n\n## تفاصيل البنود والمواصفات حسب المجال\n\n`;
  categoryFiles.sort().forEach(file => {
    const domainKey = path.basename(file, '.json');
    const docFileName = `${String(DOMAIN_METADATA[domainKey]?.order || 99).padStart(2, '0')}_${domainKey}.md`;
    const docContent = fs.readFileSync(path.join(DOCS_DIR, docFileName), 'utf8');
    masterMarkdown += `<a id="${domainKey}"></a>\n\n` + docContent + `\n\n---\n\n`;
  });

  fs.writeFileSync(OUTPUT_CATALOG, JSON.stringify(masterCatalog, null, 2), 'utf8');
  console.log(`Consolidated catalog saved to: ${OUTPUT_CATALOG} (Total: ${masterCatalog.totalItems} items)`);

  fs.writeFileSync(path.join(DOCS_DIR, 'alazab_master_catalog.md'), masterMarkdown, 'utf8');
  console.log(`Master Markdown knowledge base saved to: docs/alazab_master_catalog.md`);
}

run();

