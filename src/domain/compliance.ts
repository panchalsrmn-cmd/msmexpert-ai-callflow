import { normalizeIndianPhone } from './phone';

export interface SuppressionEntry { phone:string; reason:'CUSTOMER_OPT_OUT'|'DND'|'ADMIN'; createdAt:Date; sourceCallId?:string }
export class SuppressionRegistry {
  private entries=new Map<string,SuppressionEntry>();
  suppress(phone:string, reason:SuppressionEntry['reason'], sourceCallId?:string):SuppressionEntry {
    const normalized=normalizeIndianPhone(phone); const existing=this.entries.get(normalized);
    if(existing) return existing;
    const entry={phone:normalized,reason,createdAt:new Date(),sourceCallId}; this.entries.set(normalized,entry); return entry;
  }
  isSuppressed(phone:string){ return this.entries.has(normalizeIndianPhone(phone)); }
}

export function isWithinCallingWindow(now:Date, startHour:number, endHour:number){
  const hour=now.getHours(); return hour>=startHour && hour<endHour;
}
