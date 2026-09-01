import {describe,it,expect} from 'vitest';
import {createCampaignInput,createLeadInput,ValidationError} from './validation';
describe('API validation',()=>{it('normalizes lead input at the boundary',()=>expect(createLeadInput({phone:'98765 43210',name:' Anil '})).toEqual({phone:'+919876543210',name:'Anil',companyName:undefined,source:undefined}));it('prevents unsafe campaign capacity',()=>expect(()=>createCampaignInput({name:'August',callingNumber:'9876543210',maxConcurrentCalls:0})).toThrow(ValidationError))});
