import type { ConversationState, CustomerIntent, Transition } from './types';

const fallback='Sir, main galat information dena nahi chahungi. Main aapki query note kar leti hoon aur hamari team aapko confirm karke batayegi.';
export const groundedFallback=fallback;
export function transition(state:ConversationState, signal:CustomerIntent):Transition {
  if(signal.intent==='DO_NOT_CALL') return {nextState:'DO_NOT_CALL',leadStatus:'DO_NOT_CALL',suppress:true,responseKey:'opt_out'};
  if(signal.intent==='WRONG_NUMBER') return {nextState:'COMPLETE',leadStatus:'WRONG_NUMBER',responseKey:'wrong_number'};
  if(signal.intent==='NOT_INTERESTED') return {nextState:'NOT_INTERESTED',leadStatus:'NOT_INTERESTED',responseKey:'not_interested'};
  if(signal.intent==='CALLBACK_REQUEST'||signal.intent==='BUSY') return {nextState:'CALLBACK',leadStatus:'CALLBACK',createCallback:true,responseKey:'callback'};
  if(signal.intent==='ASK_HUMAN') return {nextState:'TRANSFER',requestTransfer:true,responseKey:'transfer'};
  if(state==='INTRO' && signal.intent==='YES') return {nextState:'QUALIFY_UDYAM',leadStatus:'CONTACTED',responseKey:'qualify_udyam'};
  if(state==='QUALIFY_UDYAM' && signal.intent==='YES') return {nextState:'QUALIFY_ZED',responseKey:'qualify_zed'};
  if(state==='QUALIFY_ZED' && signal.intent==='YES') return {nextState:'DISCOVERY',leadStatus:'INTERESTED',responseKey:'discovery'};
  if(signal.intent==='INTERESTED') return {nextState:'DISCOVERY',leadStatus:'INTERESTED',responseKey:'discovery'};
  return {nextState:state,responseKey:'clarify'};
}
export function requiresGroundedAnswer(intent:CustomerIntent){return ['ASK_PRICE','ASK_DOCUMENTS','ASK_ELIGIBILITY','ASK_ZED','ASK_SUBSIDY'].includes(intent.intent)}
