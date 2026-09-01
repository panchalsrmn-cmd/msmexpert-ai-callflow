import type { LeadRepository } from '../contracts';
import { createLeadInput } from '../validation';
export class LeadService {
  constructor(private readonly leads:LeadRepository){}
  async create(raw:unknown, requestId:string){const input=createLeadInput(raw); const prior=await this.leads.findByPhone(input.phone); if(prior) return {id:prior.id,created:false}; const lead=await this.leads.create(input);await this.leads.appendEvent({leadId:lead.id,type:'LEAD_CREATED',actor:'USER',metadata:{requestId}});return {id:lead.id,created:true}}
}
