#!/usr/bin/env node
/**
 * catalog-server.mjs — Alazab Domain Knowledge MCP Server (stdio, JSON-RPC 2.0)
 * خادم بروتوكول سياق النموذج (MCP) لكتالوج بنود ومواصفات منظومة العزب.
 * يتيح للوكلاء والمدراء والفنيين البحث اللحظي في 720 بنداً ومواصفة وخامة وسعر معتمد.
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CATALOG_PATH = path.join(__dirname, 'alazab_catalog.json');

// تحميل الكتالوج
let catalogData = { items: [], categories: {} };
if (fs.existsSync(CATALOG_PATH)) {
  try {
    catalogData = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
  } catch (err) {
    process.stderr.write(`[alazab-catalog] Error loading catalog: ${err.message}\n`);
  }
}

function normalizeArabic(text) {
  if (!text) return '';
  return String(text)
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[\u064B-\u065F]/g, '')
    .trim()
    .toLowerCase();
}

const SERVER_INFO = {
  name: 'alazab-catalog',
  version: '1.0.0',
};

const TOOLS = [
  {
    name: 'search_alazab_catalog',
    description: 'البحث المباشر الدقيق في كتالوج بنود ومواصفات وخامات وأسعار مؤسسة العزب (يشمل التكييف، السباكة، الدهانات، الأرضيات، الأمن والمراقبة، المشتريات، والمحاسبة). يُرجع البنود المطابقة مع الوحدة والمواصفة والسعر التقديري.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'نص البحث أو الكلمات المفتاحية للبند أو الخامة (مثال: "طفاية حريق", "مواسير تغذية", "تكييف كونسيلد", "سيراميك أرضيات")',
        },
        category: {
          type: 'string',
          description: 'المجال التخصصي لتصفية النتائج: accounting | flooring | hvac | painting | plumbing | purchases | security | other_specs (اختياري، الافتراضي: الكل)',
          enum: ['accounting', 'flooring', 'hvac', 'painting', 'plumbing', 'purchases', 'security', 'other_specs'],
        },
        limit: {
          type: 'integer',
          description: 'الحد الأقصى لعدد النتائج المسترجعة (الافتراضي: 10، وبحد أقصى 50)',
          default: 10,
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_catalog_categories',
    description: 'عرض كافة المجالات والقطاعات المتاحة في كتالوج منظومة العزب مع إحصائيات البنود في كل مجال.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'get_catalog_item',
    description: 'جلب التفاصيل الكاملة لبند محدد باستخدام معرّف البند الموحد (مثل AZ-HVA-0001 أو رقم المعرف الداخلي).',
    inputSchema: {
      type: 'object',
      properties: {
        identifier: {
          type: 'string',
          description: 'معرف البند الموحد UID (مثل AZ-SEC-0183) أو رقم المعرف ID (مثل 183)',
        },
      },
      required: ['identifier'],
    },
  },
];

function executeSearch(query, category, limit = 10) {
  const normQuery = normalizeArabic(query);
  const tokens = normQuery.split(/\s+/).filter(Boolean);
  const maxLimit = Math.min(Math.max(1, limit || 10), 50);

  let pool = catalogData.items || [];
  if (category) {
    pool = pool.filter(item => item.domain === category);
  }

  const scored = [];
  for (const item of pool) {
    const searchTarget = item.searchTokens || normalizeArabic(`${item.item} ${item.category} ${item.original}`);
    let score = 0;

    // مطابقة تامة للنص
    if (searchTarget.includes(normQuery)) {
      score += 100;
    }

    // مطابقة الكلمات المنفردة
    for (const token of tokens) {
      if (searchTarget.includes(token)) {
        score += 20;
      }
    }

    if (score > 0) {
      scored.push({
        score,
        uid: item.uid,
        domain: item.domain,
        domainTitle: item.domainTitle,
        item: item.item,
        unit: item.unit,
        price: item.price !== null ? `${item.price} ج.م` : 'حسب المقايسة',
        category: item.category,
        action: item.action,
        original: item.original,
      });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return {
    query,
    category: category || 'all',
    totalMatches: scored.length,
    returned: Math.min(scored.length, maxLimit),
    results: scored.slice(0, maxLimit),
  };
}

function executeGetCategories() {
  const cats = catalogData.categories || {};
  const list = Object.entries(cats).map(([key, val]) => ({
    key,
    title: val.title,
    icon: val.icon,
    itemCount: val.itemCount,
  }));
  return {
    organization: catalogData.organization || 'منظومة العزب',
    totalCategories: list.length,
    totalItems: catalogData.totalItems || 0,
    categories: list,
  };
}

function executeGetItem(identifier) {
  const cleanId = String(identifier).trim();
  const found = (catalogData.items || []).find(
    i => i.uid?.toLowerCase() === cleanId.toLowerCase() || String(i.id) === cleanId
  );

  if (!found) {
    return { found: false, message: `لم يتم العثور على بند بالمعرف: ${cleanId}` };
  }

  return {
    found: true,
    item: {
      uid: found.uid,
      id: found.id,
      domain: found.domain,
      domainTitle: found.domainTitle,
      name: found.item,
      originalText: found.original,
      unit: found.unit,
      price: found.price !== null ? `${found.price} ج.م` : 'حسب المقايسة',
      category: found.category,
      action: found.action,
      source: found.source,
    },
  };
}

function handleRpc(msg) {
  const { id, method, params } = msg;

  if (method === 'initialize') {
    return {
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: '2024-11-05',
        serverInfo: SERVER_INFO,
        capabilities: {
          tools: {},
        },
      },
    };
  }

  if (method === 'notifications/initialized') {
    return null; // No response needed
  }

  if (method === 'tools/list') {
    return {
      jsonrpc: '2.0',
      id,
      result: {
        tools: TOOLS,
      },
    };
  }

  if (method === 'tools/call') {
    const toolName = params?.name;
    const args = params?.arguments || {};

    let toolResult;
    try {
      if (toolName === 'search_alazab_catalog') {
        toolResult = executeSearch(args.query, args.category, args.limit);
      } else if (toolName === 'get_catalog_categories') {
        toolResult = executeGetCategories();
      } else if (toolName === 'get_catalog_item') {
        toolResult = executeGetItem(args.identifier);
      } else {
        return {
          jsonrpc: '2.0',
          id,
          error: { code: -32601, message: `Tool not found: ${toolName}` },
        };
      }

      return {
        jsonrpc: '2.0',
        id,
        result: {
          content: [
            {
              type: 'text',
              text: JSON.stringify(toolResult, null, 2),
            },
          ],
        },
      };
    } catch (err) {
      return {
        jsonrpc: '2.0',
        id,
        error: { code: -32000, message: err.message },
      };
    }
  }

  if (method === 'ping') {
    return { jsonrpc: '2.0', id, result: {} };
  }

  return {
    jsonrpc: '2.0',
    id,
    error: { code: -32601, message: `Method not found: ${method}` },
  };
}

// Stdio Line-by-line interface
const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
});

rl.on('line', line => {
  const trimmed = line.trim();
  if (!trimmed) return;
  try {
    const req = JSON.parse(trimmed);
    const res = handleRpc(req);
    if (res) {
      process.stdout.write(JSON.stringify(res) + '\n');
    }
  } catch (err) {
    process.stderr.write(`[alazab-catalog] Parse error: ${err.message}\n`);
  }
});

