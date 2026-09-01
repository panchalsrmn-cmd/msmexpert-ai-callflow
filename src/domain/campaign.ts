import type { LeadStatus } from './types';
export type RetryReason='NO_ANSWER'|'PROVIDER_TIMEOUT'|'NETWORK_ERROR'|'REJECTED'|'DO_NOT_CALL'|'WRONG_NUMBER';
export function canRetry(status:LeadStatus, reason:RetryReason, attempt:number, maxAttempts:number){
  return attempt<maxAttempts && !['DO_NOT_CALL','WRONG_NUMBER','NOT_INTERESTED'].includes(status) && ['NO_ANSWER','PROVIDER_TIMEOUT','NETWORK_ERROR'].includes(reason);
}
export class CapacityGate {
  private active=new Set<string>();
  constructor(private readonly capacity:number) { if(capacity<1) throw new Error('Campaign capacity must be at least one.'); }
  claim(callId:string){ if(this.active.has(callId)) return true; if(this.active.size>=this.capacity) return false; this.active.add(callId); return true; }
  release(callId:string){this.active.delete(callId)}
  get activeCount(){return this.active.size}
}
