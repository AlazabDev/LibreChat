import { createClient } from 'npm:@supabase/supabase-js@2'

/** AZ Auth MCP — Streamable HTTP, compatible with legacy initialize clients.
 * Shared MCP bearer authenticates the calling SERVICE only.
 * A separately verified Supabase user JWT is mandatory for account operations.
 */
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-az-user-authorization, x-client-info, apikey, content-type, mcp-protocol-version, mcp-session-id, last-event-id',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, DELETE',
  'Access-Control-Expose-Headers': 'Mcp-Session-Id, MCP-Protocol-Version',
  'Cache-Control': 'no-store',
  'Vary': 'Origin',
}
const VERSION = '2025-03-26'
const NAME = 'az-auth-mcp'
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const SECRET = Deno.env.get('MCP_SECRET_TOKEN') ?? ''
const encoder = new TextEncoder()

type JsonRpcId = string | number | null
type Rpc = { jsonrpc: '2.0'; id?: JsonRpcId; method?: string; params?: Record<string, unknown> }
type Params = Record<string, unknown>

const toolDefs = [
  {
    name: 'check_account',
    description: 'فحص حساب المستخدم الذي أثبت هويته فقط؛ لا يكشف حسابات الآخرين.',
    inputSchema: { type: 'object', properties: { identifier: { type: 'string', description: 'البريد أو الهاتف الخاص بالمستخدم الحالي' } }, required: ['identifier'], additionalProperties: false },
  },
  {
    name: 'send_auth_otp',
    description: 'إرسال OTP لقناة المستخدم المؤكدة فقط بعد التحقق من هويته.',
    inputSchema: { type: 'object', properties: { target: { type: 'string' }, channel: { type: 'string', enum: ['email', 'whatsapp'] } }, required: ['target', 'channel'], additionalProperties: false },
  },
  {
    name: 'create_auth_conflict',
    description: 'تسجيل تعارض مصادقة خاص بالمستخدم الحالي.',
    inputSchema: { type: 'object', properties: { email: { type: 'string' }, conflict_type: { type: 'string' }, details: { type: 'string' } }, required: ['email', 'conflict_type'], additionalProperties: false },
  },
  {
    name: 'open_support_ticket',
    description: 'إنشاء تذكرة دعم لمشكلة مصادقة المستخدم الحالي.',
    inputSchema: { type: 'object', properties: { user_identifier: { type: 'string' }, subject: { type: 'string' }, description: { type: 'string' }, priority: { type: 'string', enum: ['low', 'normal', 'high', 'urgent'] } }, required: ['user_identifier', 'subject', 'description'], additionalProperties: false },
  },
  {
    name: 'get_allowed_apps',
    description: 'يتطلب ربط صلاحيات التطبيقات بهوية المستخدم؛ غير مفعل حتى إعداد ACL.',
    inputSchema: { type: 'object', properties: { user_id: { type: 'string' } }, required: ['user_id'], additionalProperties: false },
  },
] as const

function json(payload: unknown, status = 200, extra: HeadersInit = {}): Response {
  return new Response(JSON.stringify(payload), {
    status, headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8', ...extra },
  })
}
function rpcResult(id: JsonRpcId, result: unknown) { return json({ jsonrpc: '2.0', id, result }) }
function rpcError(id: JsonRpcId, code: number, message: string, status = 200) {
  return json({ jsonrpc: '2.0', id, error: { code, message } }, status)
}
function asString(value: unknown, max = 256): string | null {
  if (typeof value !== 'string') return null
  const v = value.trim()
  return v.length > 0 && v.length <= max ? v : null
}
function sameIdentifier(a: string, b?: string | null) {
  return !!b && a.trim().toLowerCase() === b.trim().toLowerCase()
}
function validName(name: string) { return toolDefs.some(t => t.name === name) }

/** Constant-time comparison over fixed-length SHA-256 digests. */
async function authorized(header: string | null): Promise<boolean> {
  if (!SECRET) return false
  const expected = encoder.encode(`Bearer ${SECRET}`)
  const actual = encoder.encode(header ?? '')
  const [a, b] = await Promise.all([
    crypto.subtle.digest('SHA-256', expected),
    crypto.subtle.digest('SHA-256', actual),
  ])
  const x = new Uint8Array(a), y = new Uint8Array(b)
  let different = 0
  for (let i = 0; i < x.length; i++) different |= x[i] ^ y[i]
  return different === 0
}

function adminClient() {
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

async function verifiedUser(req: Request) {
  const h = req.headers.get('x-az-user-authorization') ?? ''
  const match = /^Bearer\s+(\S+)$/i.exec(h)
  if (!match) return null
  const admin = adminClient()
  const { data, error } = await admin.auth.getUser(match[1])
  return error ? null : (data.user ?? null)
}

function content(value: unknown, isError = false) {
  return { content: [{ type: 'text', text: JSON.stringify(value, null, 2) }], isError }
}

async function callTool(req: Request, name: string, args: Params) {
  const user = await verifiedUser(req)
  if (!user) return content({ code: 'USER_AUTH_REQUIRED', message: 'Requires a verified end-user JWT in X-Az-User-Authorization.' }, true)
  const email = user.email ?? null
  const phone = user.phone ?? null
  const owns = (value: string) => sameIdentifier(value, email) || sameIdentifier(value, phone)
  const admin = adminClient()

  switch (name) {
    case 'check_account': {
      const identifier = asString(args.identifier)
      if (!identifier || !owns(identifier)) return content({ code: 'FORBIDDEN', message: 'Account lookup limited to verified current user.' }, true)
      return content({ exists: true, user_id: user.id, has_email: !!email, has_phone: !!phone,
        email_confirmed: !!user.email_confirmed_at, phone_confirmed: !!user.phone_confirmed_at })
    }
    case 'send_auth_otp': {
      const target = asString(args.target)
      const channel = args.channel
      if (!target || !owns(target) || !['email', 'whatsapp'].includes(String(channel)))
        return content({ code: 'FORBIDDEN', message: 'OTP allowed only for a verified user contact.' }, true)
      if (channel === 'email' && (!sameIdentifier(target, email) || !user.email_confirmed_at))
        return content({ code: 'FORBIDDEN', message: 'A confirmed email is required.' }, true)
      if (channel === 'whatsapp' && (!sameIdentifier(target, phone) || !user.phone_confirmed_at))
        return content({ code: 'FORBIDDEN', message: 'A confirmed phone is required.' }, true)
      // OTP delivery channels differ by Supabase Auth provider configuration.
      const { error } = channel === 'email'
        ? await admin.auth.signInWithOtp({ email: target, options: { shouldCreateUser: false } })
        : await admin.auth.signInWithOtp({ phone: target, options: { channel: 'whatsapp', shouldCreateUser: false } })
      if (error) return content({ code: 'DELIVERY_FAILED', message: error.message }, true)
      return content({ success: true, message: 'OTP delivery requested.' })
    }
    case 'create_auth_conflict': {
      const target = asString(args.email)
      const kind = asString(args.conflict_type, 80)
      const details = args.details === undefined ? '' : asString(args.details, 2000)
      if (!target || !sameIdentifier(target, email) || !kind || details === null)
        return content({ code: 'INVALID_OR_FORBIDDEN', message: 'Conflict must belong to verified email.' }, true)
      const { data, error } = await admin.from('audit_logs').insert({
        action: 'auth_conflict_detected', user_email: email,
        details: { type: kind, notes: details, user_id: user.id }, severity: 'warning',
      }).select('id').single()
      return error ? content({ code: 'DATABASE_ERROR', message: 'Unable to record conflict.' }, true)
        : content({ success: true, conflict_id: data.id })
    }
    case 'open_support_ticket': {
      const identifier = asString(args.user_identifier)
      const subject = asString(args.subject, 200)
      const description = asString(args.description, 4000)
      const priority = args.priority ?? 'normal'
      if (!identifier || !owns(identifier) || !subject || !description || !['low', 'normal', 'high', 'urgent'].includes(String(priority)))
        return content({ code: 'INVALID_OR_FORBIDDEN', message: 'A verified user and valid ticket fields are required.' }, true)
      const { data, error } = await admin.from('support_tickets').insert({
        requester: identifier, subject, body: description, priority, category: 'authentication',
      }).select('id').single()
      return error ? content({ code: 'DATABASE_ERROR', message: 'Unable to create ticket.' }, true)
        : content({ success: true, ticket_id: data.id })
    }
    case 'get_allowed_apps':
      return content({ code: 'ACL_NOT_CONFIGURED', message: 'Application entitlements require an authoritative user-to-app mapping.' }, true)
    default:
      return content({ code: 'UNKNOWN_TOOL', message: 'Tool not found.' }, true)
  }
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  if (!SUPABASE_URL || !SERVICE_KEY || !SECRET)
    return rpcError(null, -32000, 'Service not configured', 503)
  if (!(await authorized(req.headers.get('authorization'))))
    return rpcError(null, -32000, 'Unauthorized', 401)
  if (req.method === 'GET') return new Response(null, { status: 405, headers: { ...CORS, Allow: 'POST, OPTIONS' } })
  if (req.method === 'DELETE') return new Response(null, { status: 405, headers: { ...CORS, Allow: 'POST, OPTIONS' } })
  if (req.method !== 'POST') return new Response(null, { status: 405, headers: { ...CORS, Allow: 'POST, OPTIONS' } })
  const ctype = req.headers.get('content-type') ?? ''
  if (!ctype.toLowerCase().includes('application/json')) return rpcError(null, -32600, 'Content-Type must be application/json', 415)
  let body: unknown
  try { body = await req.json() } catch { return rpcError(null, -32700, 'Parse error', 400) }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return rpcError(null, -32600, 'Invalid Request', 400)
  const msg = body as Partial<Rpc>
  if (msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') return rpcError(msg.id ?? null, -32600, 'Invalid Request', 400)
  const id = msg.id ?? null
  const notification = msg.id === undefined
  if (notification) return new Response(null, { status: 202, headers: CORS })
  if (msg.id !== null && typeof msg.id !== 'number' && typeof msg.id !== 'string') return rpcError(null, -32600, 'Invalid id', 400)
  const p = msg.params && typeof msg.params === 'object' && !Array.isArray(msg.params) ? msg.params : {}
  switch (msg.method) {
    case 'initialize': {
      const proposed = asString(p.protocolVersion, 40)
      if (proposed && !['2025-03-26', '2025-06-18', '2025-11-25'].includes(proposed))
        return rpcError(id, -32602, 'Unsupported protocol version', 400)
      return rpcResult(id, { protocolVersion: VERSION,
        capabilities: { tools: { listChanged: false } }, serverInfo: { name: NAME, version: '1.1.0' } })
    }
    case 'ping': return rpcResult(id, {})
    case 'tools/list': return rpcResult(id, { tools: toolDefs })
    case 'tools/call': {
      const name = asString(p.name, 100)
      if (!name || !validName(name)) return rpcError(id, -32602, 'Unknown tool name', 400)
      const args = p.arguments
      if (args !== undefined && (!args || typeof args !== 'object' || Array.isArray(args)))
        return rpcError(id, -32602, 'Invalid tool arguments', 400)
      try { return rpcResult(id, await callTool(req, name, (args ?? {}) as Params)) }
      catch (error) { console.error('MCP tool execution error:', error instanceof Error ? error.name : 'Unknown')
        return rpcResult(id, content({ code: 'TOOL_EXECUTION_FAILED', message: 'Tool execution failed.' }, true)) }
    }
    default: return rpcError(id, -32601, 'Method not found', 404)
  }
})
