import { z } from 'zod';
import { leadFields } from '../domain/types.js';

const leadId = z.string().min(1).max(128);
const updateSchema = z.object({ leadId, fields: z.object(Object.fromEntries(leadFields.map(field => [field, z.string().max(200).optional()]))).strict() });
const callbackSchema = z.object({ leadId, requestedTime: z.string().min(3).max(160), reason: z.string().min(2).max(500) });
const dncSchema = z.object({ leadId, reason: z.string().min(2).max(500) });
const transferSchema = z.object({ leadId, reason: z.string().min(2).max(500) });
const knowledgeSchema = z.object({ query: z.string().min(2).max(600), category: z.string().max(80).optional() });

export const functionDeclarations = [
  { name: 'lookupKnowledge', description: 'Look up trusted MSMExpert, ZED, Udyam, pricing, scheme, eligibility or document information.', parametersJsonSchema: { type: 'object', properties: { query: { type: 'string' }, category: { type: 'string' } }, required: ['query'] } },
  { name: 'updateLead', description: 'Update only the approved lead fields after confirmation.', parametersJsonSchema: { type: 'object', properties: { leadId: { type: 'string' }, fields: { type: 'object' } }, required: ['leadId', 'fields'] } },
  { name: 'createCallback', description: 'Create a requested callback.', parametersJsonSchema: { type: 'object', properties: { leadId: { type: 'string' }, requestedTime: { type: 'string' }, reason: { type: 'string' } }, required: ['leadId','requestedTime','reason'] } },
  { name: 'markDoNotCall', description: 'Immediately suppress future calls after an opt-out.', parametersJsonSchema: { type: 'object', properties: { leadId: { type: 'string' }, reason: { type: 'string' } }, required: ['leadId','reason'] } },
  { name: 'requestHumanTransfer', description: 'Ask the backend to transfer to a human representative.', parametersJsonSchema: { type: 'object', properties: { leadId: { type: 'string' }, reason: { type: 'string' } }, required: ['leadId','reason'] } }
];

const schemas = { lookupKnowledge: knowledgeSchema, updateLead: updateSchema, createCallback: callbackSchema, markDoNotCall: dncSchema, requestHumanTransfer: transferSchema };
export function createToolExecutor(backend = {}) {
  const completed = new Map();
  return async (name, args, idempotencyKey) => {
    const parsed = schemas[name]?.safeParse(args);
    if (!parsed?.success) return { ok: false, error: 'Invalid tool arguments.' };
    if (idempotencyKey && completed.has(idempotencyKey)) return completed.get(idempotencyKey);
    const method = backend[name];
    const result = method ? await method(parsed.data, { idempotencyKey }) : { ok: true, queued: true, data: parsed.data };
    if (idempotencyKey) completed.set(idempotencyKey, result);
    return result;
  };
}
