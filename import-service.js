import { randomUUID } from 'node:crypto';
// Host-only import bridge: chat content the user sends to DSH arrives through a
// native tool, is validated and queued verbatim, then an authenticated
// connection route hands the raw material to the relationship workspace.
const LIMITS = {
  field: 100,
  timestamp: 200,
  text: 50000,
  messages: 500,
  queue: 20,
  request: 4000,
};

class InputError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

function invalid() {
  throw new InputError('导入内容不完整或格式不正确。');
}

function plain(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

// Strict records keep the native tool contract identical to the reply routes:
// unknown fields are rejected instead of silently forwarded.
function shape(value, allowed, required) {
  if (!plain(value)) invalid();
  const keys = Object.keys(value);
  if (keys.some(key => !allowed.includes(key)) || required.some(key => !(key in value))) invalid();
  return value;
}

function text(value, max, required = false) {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) invalid();
  return value;
}

function identity(value) {
  const name = text(value, LIMITS.field, true).trim();
  return name;
}

function validate(input) {
  shape(input, ['self', 'target', 'messages'], ['self', 'target', 'messages']);
  const self = identity(input.self);
  const target = identity(input.target);
  if (self === target) throw new InputError('请选择两个不同的发言人。');
  if (!Array.isArray(input.messages) || input.messages.length > LIMITS.messages) invalid();
  const messages = [];
  let size = 0;
  for (const message of input.messages) {
    shape(message, ['sender', 'text', 'timestamp'], ['sender', 'text']);
    const sender = identity(message.sender);
    if (sender !== self && sender !== target) throw new InputError('聊天记录只能包含所选两人的发言。');
    text(message.text, LIMITS.text, true);
    if ('timestamp' in message) text(message.timestamp, LIMITS.timestamp);
    size += message.text.length;
    if (size > 2 * 1024 * 1024) throw new InputError('聊天记录超过 2 MiB，请分段导入。');
    messages.push({ ...message, sender });
  }
  if (!messages.some(message => message.sender === self) || !messages.some(message => message.sender === target)) throw new InputError('记录中需要有双方的发言，请核对身份。');
  return { self, target, messages };
}

// FNV-1a: stable fingerprint of one conversation, cheap and dependency free.
function fingerprint(value) {
  const source = JSON.stringify(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

function enqueue(state, value) {
  const snapshot = JSON.parse(JSON.stringify({
    self: value.self,
    target: value.target,
    messages: value.messages,
  }));
  // Content fingerprint keeps the version stable for the same material; the
  // per-instance sequence keeps repeated imports of that material unique.
  state.sequence += 1;
  const version = `${state.instanceId}-${fingerprint(snapshot)}-${state.sequence}`;
  state.queue.push({ ...snapshot, version });
  while (state.queue.length > LIMITS.queue) state.queue.shift();
  return snapshot.messages.length;
}

export function createImportTool(state) {
  return {
    name: 'relationship_notes_import',
    description: '当用户明确要求把其提供的聊天记录导入关系手记时，调用本工具导入。按原文拆分双方消息并确认双方身份；不能编造或修改内容，身份不明确时先向用户询问。工具只接收双方原文，不发送给联系人。',
    parameters: {
      type: 'object',
      additionalProperties: false,
      required: ['self', 'target', 'messages'],
      properties: {
        self: { type: 'string', description: '用户自己的发言人名称，必须出现在 messages 的 sender 中。' },
        target: { type: 'string', description: '联系人的发言人名称，必须出现在 messages 的 sender 中。' },
        messages: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['sender', 'text'],
            properties: {
              sender: { type: 'string', description: '发言人名称，只能是 self 或 target。' },
              text: { type: 'string', description: '消息原文，保持用户提供的原样。' },
              timestamp: { type: 'string', description: '可选的时间标记。' },
            },
          },
        },
      },
    },
    output: {
      schema: { type:'object', properties:{count:{type:'number'}}, required:['count'], additionalProperties:false },
      render: (_input, output) => [{type:'text',text:`已将 ${output.count} 条聊天记录发送到关系手记的导入队列。`}],
    },
    async execute(input) {
      return { count: enqueue(state, validate(input)) };
    },
  };
}

export function createReadHandler(state) {
  return async request => {
    try {
      if (request.method !== 'POST') throw new InputError('仅支持 POST。', 405);
      const raw = await request.text();
      if (raw.length > LIMITS.request) throw new InputError('请求内容过长。', 413);
      let body = {};
      if (raw.trim()) {
        try { body = JSON.parse(raw); }
        catch { throw new InputError('读取接口只接受空 JSON 对象。'); }
      }
      if (!plain(body) || Object.keys(body).length) throw new InputError('读取接口不接受参数。');
      return Response.json({ ok: true, values: state.queue.map(entry => ({ ...entry })) });
    } catch (error) {
      const known = error instanceof InputError;
      return Response.json({
        ok: false,
        error: known ? error.message : '暂时无法读取待导入队列，请稍后重试。',
      }, { status: known ? error.status : 500 });
    }
  };
}

export function createAckHandler(state) {
  return async request => {
    try {
      if (request.method !== 'POST') throw new InputError('仅支持 POST。', 405);
      const raw = await request.text();
      if (raw.length > LIMITS.request) throw new InputError('请求内容过长。', 413);
      let body;
      try { body = JSON.parse(raw); }
      catch { throw new InputError('确认接口需要版本号列表。'); }
      shape(body, ['versions'], ['versions']);
      if (!Array.isArray(body.versions) || body.versions.length < 1 || body.versions.length > LIMITS.queue || body.versions.some(version => typeof version !== 'string' || !version || version.length > 200) || new Set(body.versions).size !== body.versions.length) invalid();
      const acknowledged = new Set(body.versions);
      state.queue = state.queue.filter(entry => !acknowledged.has(entry.version));
      return Response.json({ ok: true, remaining: state.queue.length });
    } catch (error) {
      const known = error instanceof InputError;
      return Response.json({ ok: false, error: known ? error.message : '暂时无法确认导入记录，请稍后重试。' }, { status: known ? error.status : 500 });
    }
  };
}

export function apply(ctx) {
  return ctx.inject(['connection', 'tools'], scoped => {
    const state = { queue: [], sequence: 0, instanceId: randomUUID() };
    scoped.connection.fetch.register({
      path: '/api/relationship-notes/import/read',
      methods: ['POST'],
      requestBody: 'buffered',
      fetch: createReadHandler(state),
    });
    scoped.connection.fetch.register({
      path: '/api/relationship-notes/import/ack',
      methods: ['POST'],
      requestBody: 'buffered',
      fetch: createAckHandler(state),
    });
    scoped.tools.register(createImportTool(state));
  });
}

