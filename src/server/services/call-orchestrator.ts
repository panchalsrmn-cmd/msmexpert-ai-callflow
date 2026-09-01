import { CapacityGate, canRetry, type RetryReason } from '../../domain/campaign';
import type { TelephonyProvider, JobQueue } from '../contracts';
export class CallOrchestrator {
  constructor(private readonly telephony:TelephonyProvider,private readonly queue:JobQueue,private readonly capacity:CapacityGate){}
  async initiate(input:{callId:string;campaignId:string;from:string;to:string;webhookUrl:string}){
    if(!this.capacity.claim(input.callId)) return {started:false as const,reason:'CAPACITY_REACHED' as const};
    try { const call=await this.telephony.initiateCall(input); return {started:true as const,providerCallId:call.providerCallId}; }
    catch(error){this.capacity.release(input.callId);throw error}
  }
  async complete(input:{callId:string;leadStatus:any;reason:RetryReason;attempt:number;maxAttempts:number;retryAt?:Date}){
    this.capacity.release(input.callId);if(canRetry(input.leadStatus,input.reason,input.attempt,input.maxAttempts))await this.queue.enqueue('retry-call',{callId:input.callId},{idempotencyKey:`retry:${input.callId}:${input.attempt}`,runAt:input.retryAt});
  }
}
