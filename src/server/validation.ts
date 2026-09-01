import { normalizeIndianPhone } from '../domain/phone';
export class ValidationError extends Error { constructor(message:string){super(message);this.name='ValidationError'} }
export function createLeadInput(input:unknown){
  if(!input || typeof input!=='object') throw new ValidationError('Request body must be an object.');
  const raw=input as Record<string,unknown>;
  if(typeof raw.phone!=='string') throw new ValidationError('Phone is required.');
  return {name:typeof raw.name==='string'?raw.name.trim()||undefined:undefined,phone:normalizeIndianPhone(raw.phone),companyName:typeof raw.companyName==='string'?raw.companyName.trim()||undefined:undefined,source:typeof raw.source==='string'?raw.source.trim()||undefined:undefined};
}
export function createCampaignInput(input:unknown){
  if(!input || typeof input!=='object') throw new ValidationError('Request body must be an object.'); const v=input as Record<string,unknown>;
  if(typeof v.name!=='string'||!v.name.trim()) throw new ValidationError('Campaign name is required.');
  if(typeof v.callingNumber!=='string') throw new ValidationError('A verified calling number is required.');
  const capacity=Number(v.maxConcurrentCalls); if(!Number.isInteger(capacity)||capacity<1||capacity>100) throw new ValidationError('Max concurrent calls must be between 1 and 100.');
  return {name:v.name.trim(),callingNumber:normalizeIndianPhone(v.callingNumber),maxConcurrentCalls:capacity,recordingEnabled:v.recordingEnabled===true};
}
