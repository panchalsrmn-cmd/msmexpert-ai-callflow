import pg from 'pg';

let pool;
const db = () => {
  if (!process.env.DATABASE_URL) return null;
  pool ||= new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false } });
  return pool;
};

export async function initialiseCrm() {
  const client = db();
  if (!client) return false;
  await client.query(`
    CREATE TABLE IF NOT EXISTS crm_leads (
      id UUID PRIMARY KEY, phone TEXT UNIQUE NOT NULL, status TEXT NOT NULL DEFAULT 'NEW',
      fields JSONB NOT NULL DEFAULT '{}'::jsonb, last_contacted_at TIMESTAMPTZ,
      next_callback_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS crm_calls (
      id UUID PRIMARY KEY, lead_id UUID NOT NULL, provider_call_id TEXT UNIQUE NOT NULL,
      status TEXT NOT NULL, recording_url TEXT, provider_disposition TEXT, duration_seconds INTEGER,
      started_at TIMESTAMPTZ, ended_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS crm_events (
      id UUID PRIMARY KEY, lead_id UUID NOT NULL, call_id UUID, type TEXT NOT NULL,
      actor TEXT NOT NULL, payload JSONB NOT NULL DEFAULT '{}'::jsonb, occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS crm_callbacks (
      id UUID PRIMARY KEY, lead_id UUID NOT NULL, call_id UUID, scheduled_for TIMESTAMPTZ NOT NULL,
      timezone TEXT NOT NULL, reason TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'PENDING', created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS crm_suppressions (
      phone TEXT PRIMARY KEY, reason TEXT NOT NULL, call_id UUID, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS crm_transcripts (
      id UUID PRIMARY KEY, call_id UUID NOT NULL, speaker TEXT NOT NULL, text TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    ALTER TABLE crm_calls ADD COLUMN IF NOT EXISTS recording_url TEXT;
    ALTER TABLE crm_calls ADD COLUMN IF NOT EXISTS provider_disposition TEXT;
    ALTER TABLE crm_calls ADD COLUMN IF NOT EXISTS duration_seconds INTEGER;
  `);
  return true;
}

const id = () => crypto.randomUUID();
const asDate = value => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date(Date.now() + 24 * 60 * 60 * 1000) : parsed;
};

export async function startCrmCall({ phone, providerCallId }) {
  const client = db();
  if (!client || !phone) return { lead: { id: `phone:${phone || 'unknown'}`, phone }, call: null };
  const leadId = id();
  const leadResult = await client.query(
    `INSERT INTO crm_leads (id, phone, status, last_contacted_at)
     VALUES ($1, $2, 'CALLING', now())
     ON CONFLICT (phone) DO UPDATE SET status = 'CALLING', last_contacted_at = now(), updated_at = now()
     RETURNING id, phone`, [leadId, phone]
  );
  const lead = leadResult.rows[0];
  const callId = id();
  const callResult = await client.query(
    `INSERT INTO crm_calls (id, lead_id, provider_call_id, status, started_at)
     VALUES ($1, $2, $3, 'ANSWERED', now())
     ON CONFLICT (provider_call_id) DO UPDATE SET status = 'ANSWERED' RETURNING id`,
    [callId, lead.id, providerCallId]
  );
  await client.query(`INSERT INTO crm_events (id, lead_id, call_id, type, actor, payload) VALUES ($1, $2, $3, 'CALL_ANSWERED', 'AI', $4)`, [id(), lead.id, callResult.rows[0].id, JSON.stringify({ providerCallId })]);
  return { lead, call: callResult.rows[0] };
}

export function createCrmBackend({ leadId, callId }) {
  const client = db();
  const active = () => Boolean(client && leadId && !leadId.startsWith('phone:'));
  return {
    async lookupKnowledge({ query, category }) { return { ok: true, source: 'approved-demo-knowledge', query, category, answer: 'Trusted knowledge lookup is connected to the MSMExpert backend adapter. Replace this adapter with your approved knowledge service before production.' }; },
    async updateLead({ fields }) {
      if (!active()) return { ok: true, queued: true, updated: fields };
      const status = fields.interestLevel === 'high' ? 'INTERESTED' : 'CONTACTED';
      await client.query(`UPDATE crm_leads SET fields = fields || $2::jsonb, status = $3, updated_at = now() WHERE id = $1`, [leadId, JSON.stringify(fields), status]);
      await client.query(`INSERT INTO crm_events (id, lead_id, call_id, type, actor, payload) VALUES ($1, $2, $3, 'MEERA_LEAD_UPDATED', 'AI', $4)`, [id(), leadId, callId || null, JSON.stringify(fields)]);
      return { ok: true, updated: fields };
    },
    async createCallback({ requestedTime, reason }) {
      if (!active()) return { ok: true, queued: true };
      const scheduledFor = asDate(requestedTime);
      const followUpReason = reason || 'Customer requested more information';
      await client.query(`INSERT INTO crm_callbacks (id, lead_id, call_id, scheduled_for, timezone, reason) VALUES ($1, $2, $3, $4, 'Asia/Kolkata', $5)`, [id(), leadId, callId || null, scheduledFor, followUpReason]);
      await client.query(`UPDATE crm_leads SET status = 'CALLBACK', next_callback_at = $2, updated_at = now() WHERE id = $1`, [leadId, scheduledFor]);
      await client.query(`INSERT INTO crm_events (id, lead_id, call_id, type, actor, payload) VALUES ($1, $2, $3, 'MORE_INFORMATION_REQUESTED', 'AI', $4)`, [id(), leadId, callId || null, JSON.stringify({ requestedTime: scheduledFor.toISOString(), reason: followUpReason })]);
      return { ok: true };
    },
    async markDoNotCall({ reason }) {
      if (!active()) return { ok: true, queued: true };
      const lead = await client.query(`UPDATE crm_leads SET status = 'DO_NOT_CALL', updated_at = now() WHERE id = $1 RETURNING phone`, [leadId]);
      await client.query(`INSERT INTO crm_suppressions (phone, reason, call_id) VALUES ($1, $2, $3) ON CONFLICT (phone) DO UPDATE SET reason = EXCLUDED.reason, call_id = EXCLUDED.call_id`, [lead.rows[0].phone, reason, callId || null]);
      await client.query(`INSERT INTO crm_events (id, lead_id, call_id, type, actor, payload) VALUES ($1, $2, $3, 'DO_NOT_CALL', 'AI', $4)`, [id(), leadId, callId || null, JSON.stringify({ reason })]);
      return { ok: true, suppressed: true };
    },
    async requestHumanTransfer({ reason }) {
      if (!active()) return { ok: true, queued: true };
      await client.query(`UPDATE crm_leads SET status = 'TRANSFERRED', updated_at = now() WHERE id = $1`, [leadId]);
      await client.query(`INSERT INTO crm_events (id, lead_id, call_id, type, actor, payload) VALUES ($1, $2, $3, 'HUMAN_TRANSFER_REQUESTED', 'AI', $4)`, [id(), leadId, callId || null, JSON.stringify({ reason })]);
      return { ok: true, transferRequested: true };
    },
  };
}

export async function finishCrmCall({ callId }) {
  const client = db();
  if (client && callId) await client.query(`UPDATE crm_calls SET status = 'COMPLETED', ended_at = now() WHERE id = $1`, [callId]);
}

export async function saveTranscript({ callId, speaker, text }) {
  const client = db();
  const cleanText = String(text || '').trim();
  if (client && callId && cleanText) {
    await client.query(`INSERT INTO crm_transcripts (id, call_id, speaker, text) VALUES ($1, $2, $3, $4)`, [id(), callId, speaker === 'MEERA' ? 'MEERA' : 'CUSTOMER', cleanText]);
  }
}

export async function saveRecording({ providerCallId, recordingUrl, disposition, durationSeconds }) {
  const client = db();
  if (!client || !providerCallId) return false;
  await client.query(
    `UPDATE crm_calls SET recording_url = COALESCE($2, recording_url), provider_disposition = COALESCE($3, provider_disposition), duration_seconds = COALESCE($4, duration_seconds) WHERE provider_call_id = $1`,
    [providerCallId, recordingUrl || null, disposition || null, Number.isFinite(Number(durationSeconds)) ? Number(durationSeconds) : null]
  );
  return true;
}

export async function getCrmReport() {
  const client = db();
  if (!client) return { calls: [], callbacks: [] };
  const [calls, callbacks] = await Promise.all([
    client.query(`
      SELECT c.id, c.provider_call_id, c.status, c.recording_url, c.provider_disposition,
             c.duration_seconds, c.started_at, c.ended_at, l.phone, l.status AS lead_status,
             COALESCE((SELECT string_agg(t.speaker || ': ' || t.text, E'\\n' ORDER BY t.created_at)
                       FROM crm_transcripts t WHERE t.call_id = c.id), '') AS conversation
      FROM crm_calls c JOIN crm_leads l ON l.id = c.lead_id
      ORDER BY c.started_at DESC NULLS LAST LIMIT 100
    `),
    client.query(`
      SELECT cb.id, cb.scheduled_for, cb.reason, cb.status, l.phone
      FROM crm_callbacks cb JOIN crm_leads l ON l.id = cb.lead_id
      WHERE cb.status = 'PENDING' ORDER BY cb.scheduled_for ASC LIMIT 100
    `),
  ]);
  return { calls: calls.rows, callbacks: callbacks.rows };
}
