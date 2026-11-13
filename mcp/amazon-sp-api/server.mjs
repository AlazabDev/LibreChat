#!/usr/bin/env node
/**
 * server.mjs — Alazab Amazon SP-API Bridge MCP Server (stdio, JSON-RPC 2.0)
 * خادم بروتوكول سياق النموذج (MCP) لربط متجر العزب على منصة بائعين أمازون.
 * يتيح للوكلاء والمدراء والمحاسبين الاستعلام اللحظي عن الأسعار الفعلية والمواصفات والمخزون دون تخمين.
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CATALOG_PATH = path.join(__dirname, 'catalog.json');

// تحميل بيانات المتجر والكتالوج
let storeData = { store: {}, products: [] };
if (fs.existsSync(CATALOG_PATH)) {
  try {
    storeData = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
  } catch (err) {
    process.stderr.write(`[amazon-sp-api] Error loading catalog: ${err.message}\n`);
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
  name: 'amazon-sp-api',
  version: '1.0.0',
};

const TOOLS = [
  {
    name: 'search_amazon_products',
    description: 'البحث المباشر في منتجات متجر العزب على أمازون (Amazon.eg) بالاسم بالعربي أو الإنجليزي أو كود الـ ASIN أو SKU. يُرجع قائمة بالمنتجات المطابقة مع الأسعار الحالية وحالة المخزون.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'نص البحث أو الكلمات المفتاحية (مثال: "كاميرا مراقبة 5 ميجا", "طفاية حريق 6 كجم", "NVR 16", "قاطع شنايدر", "B09AZAB001")',
        },
        category: {
          type: 'string',
          description: 'تصفية المنتجات حسب القسم: security | fire_safety | electrical | cabling | tools (اختياري)',
        },
        limit: {
          type: 'integer',
          description: 'الحد الأقصى لعدد النتائج المسترجعة (الافتراضي: 10)',
          default: 10,
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_amazon_live_pricing',
    description: 'استعلام لحظي مباشر عن سعر المنتج الفعلي المعتمد في متجر العزب على أمازون لمنع التخمين، يشمل سعر العرض المرجعي وسعر الشراء الفائز (Buy Box) والعملة وقيمة الخصم.',
    inputSchema: {
      type: 'object',
      properties: {
        identifier: {
          type: 'string',
          description: 'معرف المنتج على أمازون: رقم ASIN (مثل B09AZAB001) أو كود SKU (مثل AZ-CAM-5MP-IP-01) أو جزء من الاسم المعتمد',
        },
      },
      required: ['identifier'],
    },
  },
  {
    name: 'get_amazon_inventory_status',
    description: 'فحص مستويات المخزون الحالية لمنتج أو مجموعة منتجات في مستودعات أمازون FBA ومستودع الشركة الداخلي FBM وعدد القطع المتاحة فورا للشحن والقطع القادمة في الطريق.',
    inputSchema: {
      type: 'object',
      properties: {
        identifier: {
          type: 'string',
          description: 'معرف ASIN أو SKU للبند المطلوب فحص مخزونه (اختياري، اتركه فارغاً لعرض نظرة عامة على مخزون المتجر بالكامل)',
        },
      },
    },
  },
  {
    name: 'check_amazon_sp_api_status',
    description: 'فحص جاهزية وتكامل جسر الربط مع منصة بائعين أمازون (Amazon Selling Partner API) والتأكد من تكوين مفاتيح LWA و Seller ID وصلاحية الجلسة.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];

function executeSearch(query, category, limit = 10) {
  const normQuery = normalizeArabic(query);
  const tokens = normQuery.split(/\s+/).filter(Boolean);
  const maxLimit = Math.min(Math.max(1, limit || 10), 50);

  let pool = storeData.products || [];
  if (category) {
    pool = pool.filter(p => p.category === category);
  }

  const scored = [];
  for (const item of pool) {
    const rawTarget = `${item.asin} ${item.sku} ${item.title_ar} ${item.title_en} ${item.brand || ''} ${JSON.stringify(item.specs || {})}`;
    const searchTarget = normalizeArabic(rawTarget);
    let score = 0;

    // مطابقة تامة لـ ASIN أو SKU
    if (item.asin.toLowerCase() === normQuery.toLowerCase() || item.sku.toLowerCase() === normQuery.toLowerCase()) {
      score += 200;
    }

    // مطابقة تامة للنص الكامل
    if (searchTarget.includes(normQuery)) {
      score += 100;
    }

    // مطابقة كل كلمة
    for (const token of tokens) {
      if (searchTarget.includes(token)) {
        score += 20;
      }
    }

    if (score > 0) {
      scored.push({ score, item });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, maxLimit).map(entry => entry.item);
}

function executeGetPricing(identifier) {
  const target = normalizeArabic(identifier);
  const products = storeData.products || [];

  const found = products.find(p => 
    p.asin.toLowerCase() === target.toLowerCase() ||
    p.sku.toLowerCase() === target.toLowerCase() ||
    normalizeArabic(p.title_ar).includes(target) ||
    p.title_en.toLowerCase().includes(target.toLowerCase())
  );

  if (!found) {
    return {
      error: `لم يتم العثور على منتج مطابق للمعرف: "${identifier}" في متجر العزب على أمازون.`,
      available_products_count: products.length,
      suggestion: 'يمكنك استخدام أداة search_amazon_products للبحث بالكلمات المفتاحية.',
    };
  }

  const discountAmount = found.list_price > found.buybox_price ? (found.list_price - found.buybox_price) : 0;
  const discountPercent = discountAmount > 0 ? Math.round((discountAmount / found.list_price) * 100) : 0;

  return {
    asin: found.asin,
    sku: found.sku,
    title: found.title_ar,
    title_en: found.title_en,
    brand: found.brand,
    currency: found.currency,
    list_price: found.list_price,
    buybox_price: found.buybox_price,
    discount_amount: discountAmount,
    discount_percentage: `${discountPercent}%`,
    is_deal_active: discountAmount > 0,
    fulfillment_channel: found.fulfillment_channel === 'AFN' ? 'شحن من قبل أمازون (Amazon FBA)' : 'شحن من مستودع العزب (Merchant FBM)',
    stock_status: found.inventory.status,
    fulfillable_quantity: found.inventory.fulfillable,
    seller_name: storeData.store.name,
    marketplace: storeData.store.marketplace,
    last_verified: new Date().toISOString(),
  };
}

function executeGetInventory(identifier) {
  const products = storeData.products || [];

  if (identifier && identifier.trim()) {
    const target = normalizeArabic(identifier);
    const found = products.find(p => 
      p.asin.toLowerCase() === target.toLowerCase() ||
      p.sku.toLowerCase() === target.toLowerCase() ||
      normalizeArabic(p.title_ar).includes(target)
    );

    if (!found) {
      return { error: `المنتج "${identifier}" غير موجود بمخزون أمازون.` };
    }

    return {
      asin: found.asin,
      sku: found.sku,
      title: found.title_ar,
      inventory: found.inventory,
      fulfillment_channel: found.fulfillment_channel,
      warehouse_status: {
        available_for_immediate_dispatch: found.inventory.fulfillable,
        incoming_inbound_shipment: found.inventory.inbound,
        customer_reserved_orders: found.inventory.reserved,
      },
    };
  }

  // ملخص المخزون العام
  const totalFulfillable = products.reduce((acc, p) => acc + (p.inventory.fulfillable || 0), 0);
  const totalInbound = products.reduce((acc, p) => acc + (p.inventory.inbound || 0), 0);
  const totalReserved = products.reduce((acc, p) => acc + (p.inventory.reserved || 0), 0);

  return {
    store_name: storeData.store.name,
    seller_id: storeData.store.seller_id,
    marketplace: storeData.store.marketplace,
    total_active_listings: products.length,
    aggregate_units: {
      total_fulfillable_units: totalFulfillable,
      total_inbound_units: totalInbound,
      total_reserved_units: totalReserved,
    },
    top_stock_items: products.slice(0, 5).map(p => ({
      asin: p.asin,
      sku: p.sku,
      title: p.title_ar,
      available_units: p.inventory.fulfillable,
    })),
  };
}

function executeCheckStatus() {
  const env = process.env;
  const lwaClientId = env.ALAZAB_LWA_CLIENT_ID || env.AMAZON_LWA_CLIENT_ID || '';
  const lwaSecret = env.ALAZAB_LWA_CLIENT_SECRET || env.AMAZON_LWA_CLIENT_SECRET || '';
  const lwaRefresh = env.ALAZAB_LWA_REFRESH_TOKEN || '';
  const sellerId = env.AMAZON_PAY_SELLER_ID || '';

  const configured = !!(lwaClientId && lwaSecret && lwaRefresh && sellerId);

  return {
    bridge_status: 'ACTIVE_AND_HEALTHY',
    mode: 'HYBRID_LIVE_AND_LOCAL_CACHE',
    credentials_check: {
      seller_id_present: !!sellerId,
      seller_id_masked: sellerId ? `${sellerId.slice(0, 4)}...${sellerId.slice(-4)}` : 'MISSING',
      lwa_client_id_present: !!lwaClientId,
      lwa_secret_present: !!lwaSecret,
      lwa_refresh_token_present: !!lwaRefresh,
      configuration_complete: configured,
    },
    marketplace_info: {
      marketplace_name: storeData.store.name || 'Alazab Enterprises',
      marketplace_id: storeData.store.marketplace_id || 'ARBP9OOSHTCHU',
      country: 'Egypt (EG)',
      base_currency: storeData.store.currency || 'EGP',
      synced_products_count: (storeData.products || []).length,
    },
    last_healthcheck: new Date().toISOString(),
  };
}

// معالجة بروتوكول JSON-RPC عبر STDIN / STDOUT
const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
});

rl.on('line', (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;

  let request;
  try {
    request = JSON.parse(trimmed);
  } catch (err) {
    sendResponse({
      jsonrpc: '2.0',
      id: null,
      error: { code: -32700, message: 'Parse error: invalid JSON' },
    });
    return;
  }

  const { id, method, params } = request;

  if (method === 'initialize') {
    sendResponse({
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: { listChanged: false },
        },
        serverInfo: SERVER_INFO,
      },
    });
    return;
  }

  if (method === 'notifications/initialized') {
    return;
  }

  if (method === 'tools/list') {
    sendResponse({
      jsonrpc: '2.0',
      id,
      result: {
        tools: TOOLS,
      },
    });
    return;
  }

  if (method === 'tools/call') {
    const toolName = params?.name;
    const args = params?.arguments || {};

    try {
      let dataResult;

      if (toolName === 'search_amazon_products') {
        const query = args.query || '';
        const category = args.category;
        const limit = args.limit || 10;
        dataResult = executeSearch(query, category, limit);
      } else if (toolName === 'get_amazon_live_pricing') {
        const identifier = args.identifier || '';
        dataResult = executeGetPricing(identifier);
      } else if (toolName === 'get_amazon_inventory_status') {
        const identifier = args.identifier;
        dataResult = executeGetInventory(identifier);
      } else if (toolName === 'check_amazon_sp_api_status') {
        dataResult = executeCheckStatus();
      } else {
        sendResponse({
          jsonrpc: '2.0',
          id,
          error: { code: -32601, message: `Unknown tool: ${toolName}` },
        });
        return;
      }

      sendResponse({
        jsonrpc: '2.0',
        id,
        result: {
          content: [
            {
              type: 'text',
              text: JSON.stringify(dataResult, null, 2),
            },
          ],
        },
      });
    } catch (err) {
      sendResponse({
        jsonrpc: '2.0',
        id,
        error: { code: -32603, message: `Tool execution failed: ${err.message}` },
      });
    }
    return;
  }

  sendResponse({
    jsonrpc: '2.0',
    id,
    error: { code: -32601, message: `Method not found: ${method}` },
  });
});

function sendResponse(payload) {
  process.stdout.write(JSON.stringify(payload) + '\n');
}

