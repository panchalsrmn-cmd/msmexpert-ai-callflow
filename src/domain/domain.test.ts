import { describe, expect, it } from 'vitest';
import { normalizeIndianPhone, InvalidPhoneNumberError } from './phone';
import { SuppressionRegistry } from './compliance';
import { transition, requiresGroundedAnswer } from './conversation';
import { CapacityGate, canRetry } from './campaign';
import { IdempotencyStore } from './idempotency';

describe('phone normalization',()=>{it('accepts common Indian mobile formats',()=>expect(normalizeIndianPhone('098 765-43210')).toBe('+919876543210'));it('rejects invalid phone numbers',()=>expect(()=>normalizeIndianPhone('1234')).toThrow(InvalidPhoneNumberError))});
describe('compliance',()=>{it('makes opt out durable and idempotent',()=>{const registry=new SuppressionRegistry(); registry.suppress('9876543210','CUSTOMER_OPT_OUT','call-1');registry.suppress('+91 9876543210','CUSTOMER_OPT_OUT','call-2');expect(registry.isSuppressed('9876543210')).toBe(true)})});
describe('conversation transitions',()=>{it('suppresses a caller who opts out',()=>expect(transition('DISCOVERY',{intent:'DO_NOT_CALL',confidence:.99,entities:{}})).toMatchObject({nextState:'DO_NOT_CALL',suppress:true,leadStatus:'DO_NOT_CALL'}));it('requires grounding for policy facts',()=>expect(requiresGroundedAnswer({intent:'ASK_SUBSIDY',confidence:.9,entities:{}})).toBe(true))});
describe('campaign safety',()=>{it('does not retry explicit rejection',()=>expect(canRetry('DO_NOT_CALL','NETWORK_ERROR',1,3)).toBe(false));it('enforces concurrency',()=>{const g=new CapacityGate(1);expect(g.claim('a')).toBe(true);expect(g.claim('b')).toBe(false);g.release('a');expect(g.claim('b')).toBe(true)})});
describe('idempotency',()=>{it('returns the original result for replayed webhooks',()=>{let count=0;const s=new IdempotencyStore<number>();expect(s.execute('provider-event-1',()=>++count)).toMatchObject({value:1,replayed:false});expect(s.execute('provider-event-1',()=>++count)).toMatchObject({value:1,replayed:true})})});
