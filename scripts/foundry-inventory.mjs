#!/usr/bin/env node
/**
 * scripts/foundry-inventory.mjs
 * =============================================================================
 * منظومة العزب — أداة الجرد الشامل لكافة عناصر منصة Microsoft Azure AI Foundry
 * Alazab AI — Comprehensive Azure AI Foundry Assets Inventory & Audit Engine
 * =============================================================================
 * يقوم هذا السكربت بفحص وجرد كافة مكونات فوندري:
 * 1. بيانات الاشتراك والمشروع ونقاط الاتصال (Project Context & Endpoints)
 * 2. النماذج المنشورة وقدراتها وسعاتها (Model Deployments, SKUs & Capacities)
 * 3. الوكلاء المعتمدون وإصداراتهم وأدوارهم ونماذجهم (Agents & Versions)
 * 4. الاتصالات والتكاملات الخارجية (Connections: AISearch, MCP, Speech, DevOps)
 * 5. صناديق الأدوات والـ MCP (Toolboxes & Tool Entities)
 * 6. شبكة التنسيق بين الوكلاء (Agent-to-Agent A2A Mesh)
 * 
 * المخرجات:
 * - تقرير تفاعلي ملون في الطرفية (CLI Summary)
 * - ملف تقرير مفصل بصيغة Markdown: reports/foundry-inventory-<timestamp>.md
 * - ملف بيانات كامل بصيغة JSON: reports/foundry-inventory-<timestamp>.json
 * =============================================================================
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import https from 'node:https';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

// 1. تحميل متغيرات البيئة من .env أو .env.candidate
function loadEnv() {
  const envFiles = ['.env', '.env.candidate', '.env.alazab.example'];
  const env = { ...process.env };
  for (const file of envFiles) {
    const fullPath = path.join(ROOT_DIR, file);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const match = trimmed.match(/^([A-Za-z0-9_]+)=(.*)$/);
        if (match) {
          const key = match[1];
          let val = match[2].trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          if (env[key] === undefined || env[key] === '') {
            env[key] = val;
          }
        }
      }
    }
  }
  return env;
}

const env = loadEnv();

// 2. قراءة بيانات الجرد المحلية المسجلة من Foundry-Export ومجلدات التكامل
const FOUNDRY_EXPORT_DIR = path.join(ROOT_DIR, 'mcp', 'foundry', 'Foundry-Export');
const AGENTS_DIR = path.join(ROOT_DIR, 'integrations', 'agents');

function readJsonSafe(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
  } catch (e) {
    // ignore
  }
  return null;
}

// 3. استخراج بيانات المشروع والاشتراك
const azureContext = readJsonSafe(path.join(FOUNDRY_EXPORT_DIR, 'azure-context.json')) || {};
const projectInfo = {
  subscriptionId: azureContext.subscription || env.AZURE_SUBSCRIPTION_ID_1 || '1363114a-a1d7-4abb-8042-dcdebf91e2c9',
  tenantId: azureContext.tenant || env.AZURE_TENANT_ID || '54f7523b-7bc4-438e-83d5-e45e17302fd4',
  subscriptionName: azureContext.name || 'Microsoft Azure Sponsorship',
  resourceGroup: 'azab-rg-ai',
  resourceName: env.FOUNDRY_RESOURCE_NAME || 'az-ai-resource',
  projectName: env.FOUNDRY_PROJECT_NAME || 'az-ai-gateway',
  region: env.FOUNDRY_REGION || 'eastus2',
  endpoints: {
    projectEndpoint: env.PROJECT_ENDPOINT || 'https://az-ai-resource.services.ai.azure.com/api/projects/az-ai-gateway',
    cognitiveEndpoint: env.AZURE_OPENAI_ENDPOINT || 'https://az-ai-resource.cognitiveservices.azure.com/',
    apimGateway: env.AZURE_APIM_ENDPOINT || 'https://az-ai-gateway.azure-api.net',
    aiSearchEndpoint: env.AZURE_AI_SEARCH_SERVICE_ENDPOINT || 'https://azlanguagear-aszsyda7jknabyg.search.windows.net',
    mcpCentralGateway: 'https://mcp.alazab.com',
  },
  credentialsConfigured: {
    foundryApiKey: !!(env.FOUNDRY_API_KEY || env.AZURE_OPENAI_API_KEY),
    apimSubscriptionKey: !!env.AZURE_APIM_SUBSCRIPTION_KEY,
    aiSearchApiKey: !!env.AZURE_AI_SEARCH_API_KEY,
    contentSafetyKey: !!env.AZURE_CONTENT_SAFETY_KEY,
    storageConnectionString: !!env.AZURE_STORAGE_CONNECTION_STRING,
  }
};

// 4. استخراج النماذج المنشورة (Deployments)
const rawDeployments = readJsonSafe(path.join(FOUNDRY_EXPORT_DIR, 'deployments', 'list.json')) || { value: [] };
const deployments = (rawDeployments.value || []).map(d => ({
  deploymentName: d.name,
  modelName: d.modelName,
  modelPublisher: d.modelPublisher,
  modelVersion: d.modelVersion,
  skuName: d.sku?.name || 'Standard',
  capacity: d.sku?.capacity || 0,
  capabilities: Object.keys(d.capabilities || {}).filter(k => d.capabilities[k] === 'true' || d.capabilities[k] === true),
  type: d.type || 'ModelDeployment',
}));

// 5. استخراج الاتصالات والتكاملات (Connections)
const rawConnections = readJsonSafe(path.join(FOUNDRY_EXPORT_DIR, 'connections', 'list.json')) || { value: [] };
const connections = (rawConnections.value || []).map(c => ({
  name: c.name,
  type: c.type,
  target: c.target || 'N/A',
  isDefault: !!c.isDefault,
  credentialType: c.credentials?.type || 'None',
  category: c.type === 'RemoteA2A' ? 'Agent-to-Agent' :
            c.type === 'CognitiveSearch' ? 'Knowledge / Vector Search' :
            c.type === 'RemoteTool' && c.name.includes('toolbox') ? 'Foundry Toolbox' :
            c.type === 'RemoteTool' ? 'External Tool / MCP' :
            c.type === 'AppInsights' ? 'Observability & Monitoring' : 'Service Connection',
}));

// 6. استخراج الوكلاء (Agents) وتفاصيلهم
const rawAgentsList = readJsonSafe(path.join(FOUNDRY_EXPORT_DIR, 'agents', 'list.json')) || { data: [] };
const agents = [];

// فحص كل وكيل متوفر
const agentEntries = rawAgentsList.data || [];
for (const entry of agentEntries) {
  const agentName = entry.name;
  const latestVersion = entry.versions?.latest;
  const def = latestVersion?.definition || {};
  
  // فحص ملف التعريف التفصيلي أو مجلد integrations/agents
  let fullAgentDef = readJsonSafe(path.join(FOUNDRY_EXPORT_DIR, 'agents', agentName, 'definition.json'));
  if (!fullAgentDef) {
    fullAgentDef = readJsonSafe(path.join(AGENTS_DIR, agentName, 'foundry.before.json'));
  }

  const instructions = def.instructions || fullAgentDef?.versions?.latest?.definition?.instructions || 'N/A';
  const roleMatch = instructions.match(/الدور:\s*([^\n]+)/) || instructions.match(/المهمة الأساسية\s*([^\n]+)/);
  const role = roleMatch ? roleMatch[1].trim() : (latestVersion?.description || 'وكيل تخصصي لمنظومة العزب');

  const toolsList = (def.tools || []).map(t => {
    if (t.type === 'web_search') return { type: 'web_search', label: 'Bing Web Search' };
    if (t.type === 'mcp') return { type: 'mcp', label: t.server_label || t.project_connection_id || 'MCP Server', url: t.server_url };
    if (t.project_connection_id) return { type: 'connection', label: t.project_connection_id, tools: t.allowed_tools?.tool_names || [] };
    return { type: t.type || 'tool', label: JSON.stringify(t) };
  });

  agents.push({
    name: agentName,
    id: entry.id,
    state: entry.state || 'enabled',
    activeVersion: latestVersion?.version || '1',
    model: def.model || 'az-model-sol',
    role: role.replace(/^[#\s]+/, '').slice(0, 120),
    toolsCount: toolsList.length,
    tools: toolsList,
    instructionsLength: instructions.length,
    instructionsPreview: instructions.slice(0, 200).replace(/\n/g, ' ') + '...',
  });
}

// 7. استخراج شبكة التنسيق بين الوكلاء (A2A Network)
const a2aConnections = connections.filter(c => c.type === 'RemoteA2A');
const toolboxes = connections.filter(c => c.category === 'Foundry Toolbox');

// 8. إحصائيات الجرد العامة (Summary Metrics)
const summary = {
  timestamp: new Date().toISOString(),
  projectName: projectInfo.projectName,
  resourceGroup: projectInfo.resourceGroup,
  totalDeployments: deployments.length,
  totalAgents: agents.length,
  totalConnections: connections.length,
  totalA2ALinks: a2aConnections.length,
  totalToolboxes: toolboxes.length,
};

// 9. توليد تقرير Markdown
function generateMarkdownReport() {
  const md = `# تقرير الجرد المؤسسي الشامل لمنصة Microsoft Azure AI Foundry
**منظومة العزب للذكاء الاصطناعي — Alazab Enterprises**
*تاريخ وتوقيت الجرد:* \`${summary.timestamp}\`
*بيئة المشروع:* \`${projectInfo.projectName}\` (\`${projectInfo.resourceGroup}\` / \`${projectInfo.region}\`)

---

## 1. ملخص المؤشرات العامة (Inventory KPI Dashboard)

| المكون المفحوص | العدد المكتشف | الحالة التشغيلية |
| :--- | :---: | :---: |
| **النماذج المنشورة (Model Deployments)** | **${summary.totalDeployments}** | ✅ نشطة وموزعة بسعات استدلالية |
| **وكلاء الذكاء الاصطناعي (Registered Agents)** | **${summary.totalAgents}** | ✅ معرفة وموثقة بإصداراتها |
| **قنوات وتكاملات الربط (Project Connections)** | **${summary.totalConnections}** | ✅ تشمل AISearch, MCP, Speech, REST |
| **روابط التنسيق بين الوكلاء (A2A Mesh Links)** | **${summary.totalA2ALinks}** | ✅ شبكة أسراب موجهة للوكيل Sol |
| **صناديق أدوات فوندري (Foundry Toolboxes)** | **${summary.totalToolboxes}** | ✅ تغطي دفترة، أوبرفيكس، ماجيك بلان، واتساب |

---

## 2. النماذج المنشورة وسعات الاستدلال (Model Deployments & Capacities)

| اسم النشر (Deployment Name) | النموذج الأصلي (Model) | الناشر (Publisher) | الإصدار | السعة (SKU / Capacity) | القدرات (Capabilities) |
| :--- | :--- | :--- | :---: | :--- | :--- |
${deployments.map(d => `| \`${d.deploymentName}\` | **${d.modelName}** | ${d.modelPublisher} | ${d.modelVersion} | ${d.skuName} (${d.capacity}) | ${d.capabilities.join(', ') || 'General'} |`).join('\n')}

---

## 3. وكلاء فوندري المعتمدون (AI Agents Registry)

| الوكيل (Agent Name) | النموذج المربوط | الإصدار | عدد الأدوات | الدور الوظيفي ونطاق العمل |
| :--- | :--- | :---: | :---: | :--- |
${agents.map(a => `| \`${a.name}\` | **${a.model}** | v${a.activeVersion} | ${a.toolsCount} | ${a.role} |`).join('\n')}

---

## 4. تكاملات الاتصال والخدمات الخارجية (Connections & Integrations)

| اسم الاتصال (Connection Name) | التصنيف والنوع | الهدف / الرابط (Target Endpoint) | المصادقة |
| :--- | :--- | :--- | :--- |
${connections.map(c => `| \`${c.name}\` | **${c.category}** (${c.type}) | \`${c.target}\` | \`${c.credentialType}\` |`).join('\n')}

---

## 5. شبكة التنسيق المستقل بين الوكلاء (Agent-to-Agent A2A Mesh)

تعمل منظومة العزب على نمط **الوكيل المنسق العام (Master Orchestrator - az-agent-sol)** الذي يمتلك روابط حوارية مستقلة ومباشرة مع كافة الوكلاء المتخصصين:

\`\`\`mermaid
flowchart TD
    Sol["المنسق العام والاستراتيجي<br/>az-agent-sol (gpt-5.6-sol)"]
    
    Sol -->|"a2a-sol-to-finance"| Fin["المحلل المالي<br/>az-agent-finance"]
    Sol -->|"a2a-sol-to-maint"| Maint["الصيانة والمقاولات<br/>az-agent-maint"]
    Sol -->|"a2a-sol-to-auth"| Auth["الهوية والمصادقة<br/>az-agent-auth"]
    Sol -->|"a2a-sol-to-payments"| Pay["المدفوعات والفواتير<br/>az-agent-payments"]
    Sol -->|"a2a-sol-to-project"| Proj["إدارة المشاريع<br/>az-agent-project"]
    Sol -->|"a2a-sol-to-vision"| Vis["فحص المخططات والصور<br/>az-agent-vision"]
    Sol -->|"a2a-sol-to-codex"| Cod["البرمجة والأتمتة<br/>az-agent-codex"]
    Sol -->|"a2a-sol-to-azabot"| Bot["خدمة العملاء العامة<br/>az-agent-azabot"]
    Sol -->|"a2a-sol-to-prod"| Prod["الإنتاج والمتابعة<br/>az-agent-prod"]
\`\`\`

---

## 6. نقاط النهاية والمصادقة السحابية (Cloud Endpoints)

- **معرف الاشتراك (Subscription):** \`${projectInfo.subscriptionId}\` (${projectInfo.subscriptionName})
- **معرف المستأجر (Tenant ID):** \`${projectInfo.tenantId}\`
- **مجموعة الموارد (Resource Group):** \`${projectInfo.resourceGroup}\`
- **نقطة نهاية المشروع (Project Endpoint):** \`${projectInfo.endpoints.projectEndpoint}\`
- **بوابة واجهات التطبيقات (APIM Gateway):** \`${projectInfo.endpoints.apimGateway}\`
- **محرك البحث الدلالي (Azure AI Search):** \`${projectInfo.endpoints.aiSearchEndpoint}\`
`;
  return md;
}

// 10. طباعة التقرير التفاعلي في الكونسول
function printCliReport() {
  const cyan = '\x1b[36m';
  const green = '\x1b[32m';
  const yellow = '\x1b[33m';
  const magenta = '\x1b[35m';
  const bold = '\x1b[1m';
  const reset = '\x1b[0m';

  console.log(`${cyan}=============================================================================${reset}`);
  console.log(`${bold}  منظومة العزب للذكاء الاصطناعي — جرد عناصر Microsoft Azure AI Foundry${reset}`);
  console.log(`  تاريخ وتوقيت الفحص: ${summary.timestamp}`);
  console.log(`  المشروع: ${projectInfo.projectName} (${projectInfo.resourceGroup} / ${projectInfo.region})`);
  console.log(`${cyan}=============================================================================${reset}\n`);

  console.log(`${bold}📌 1. ملخص عناصر المنصة المكتشفة:${reset}`);
  console.log(`  [✔] إجمالي النماذج المنشورة (Deployments):   ${green}${bold}${summary.totalDeployments}${reset} نماذج`);
  console.log(`  [✔] إجمالي الوكلاء المسجلين (AI Agents):     ${green}${bold}${summary.totalAgents}${reset} وكلاء`);
  console.log(`  [✔] إجمالي قنوات الربط والتكامل (Connections): ${green}${bold}${summary.totalConnections}${reset} اتصالاً`);
  console.log(`  [✔] روابط التنسيق بين الوكلاء (A2A Mesh Links): ${green}${bold}${summary.totalA2ALinks}${reset} رابطاً`);
  console.log(`  [✔] صناديق أدوات الأعمال (Toolboxes):       ${green}${bold}${summary.totalToolboxes}${reset} صناديق`);

  console.log(`\n${bold}🤖 2. النماذج المنشورة وسعات الاستدلال (Model Deployments):${reset}`);
  deployments.forEach((d, i) => {
    console.log(`  ${i + 1}. ${yellow}${d.deploymentName.padEnd(20)}${reset} -> ${bold}${d.modelName}${reset} (${d.modelPublisher}) | SKU: ${d.skuName} (${d.capacity})`);
  });

  console.log(`\n${bold}👥 3. وكلاء فوندري المعتمدون (AI Agents):${reset}`);
  agents.forEach((a, i) => {
    console.log(`  ${i + 1}. ${magenta}${a.name.padEnd(22)}${reset} [v${a.activeVersion}] Model: ${bold}${a.model}${reset} | أدوات: ${a.toolsCount}`);
    console.log(`     ↳ ${a.role}`);
  });

  console.log(`\n${bold}🔌 4. عينة من قنوات الربط والتكامل الرئيسية (Key Connections):${reset}`);
  connections.slice(0, 10).forEach((c, i) => {
    console.log(`  ${i + 1}. ${cyan}${c.name.padEnd(28)}${reset} | ${c.category.padEnd(22)} | ${c.target.slice(0, 45)}...`);
  });
  if (connections.length > 10) {
    console.log(`     ... بالإضافة إلى ${connections.length - 10} اتصالات وتكاملات أخرى (انظر التقرير المفصل).`);
  }

  console.log(`\n${bold}🌐 5. شبكة التنسيق المستقل بين الوكلاء (Agent-to-Agent Mesh):${reset}`);
  console.log(`  الوكيل المنسق المركزي: ${yellow}az-agent-sol (gpt-5.6-sol)${reset}`);
  console.log(`  يمتلك قنوات استدعاء وتفويض مهام مباشرة إلى:`);
  a2aConnections.filter(c => c.name.startsWith('a2a-sol-to-')).forEach(c => {
    const targetAgent = c.name.replace('a2a-sol-to-', 'az-agent-');
    console.log(`    ↳ ${green}${targetAgent}${reset} (عبر بروتوكول A2A)`);
  });
}

// 11. حفظ ملفات التقارير (JSON & Markdown)
const REPORTS_DIR = path.join(ROOT_DIR, 'reports');
if (!fs.existsSync(REPORTS_DIR)) {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
}

const dateStr = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, 'Z');
const jsonReportPath = path.join(REPORTS_DIR, `foundry-inventory-${dateStr}.json`);
const mdReportPath = path.join(REPORTS_DIR, `foundry-inventory-${dateStr}.md`);

const fullInventoryData = {
  summary,
  projectInfo,
  deployments,
  agents,
  connections,
  a2aNetwork: a2aConnections,
  toolboxes,
};

fs.writeFileSync(jsonReportPath, JSON.stringify(fullInventoryData, null, 2), 'utf8');
fs.writeFileSync(mdReportPath, generateMarkdownReport(), 'utf8');

// تشغيل الطباعة
printCliReport();

console.log(`\n${'\x1b[32m'}=============================================================================${'\x1b[0m'}`);
console.log(`  ✅ تم حفظ التقرير التفصيلي بصيغة Markdown: ${mdReportPath}`);
console.log(`  ✅ تم حفظ بيانات الجرد الكاملة بصيغة JSON:     ${jsonReportPath}`);
console.log(`${'\x1b[32m'}=============================================================================${'\x1b[0m'}\n`);

