/** Server-only adapter for Exotel's Voice Connect API. */
function required(name) { const value=process.env[name]; if(!value) throw new Error(`${name} is required for Exotel calling.`); return value; }
export function exotelEnabled() { return process.env.TELEPHONY_PROVIDER==='exotel'; }
export async function startExotelCall({to,callId}) {
  const accountSid=required('EXOTEL_ACCOUNT_SID'),apiKey=required('EXOTEL_API_KEY'),apiToken=required('EXOTEL_API_TOKEN'),callerId=required('EXOTEL_FROM_NUMBER');
  const streamUrl=required('EXOTEL_STREAM_URL');
  const apiDomain=(process.env.EXOTEL_API_DOMAIN||'https://api.exotel.com').replace(/\/$/,'');
  // AgentStream connects the answered customer call directly to our VoiceBot WebSocket.
  const form=new URLSearchParams({from:to,callerid:callerId,streamurl:streamUrl,streamtype:'bidirectional',customfield:callId});
  const response=await fetch(`${apiDomain}/v1/accounts/${encodeURIComponent(accountSid)}/calls/connect`,{method:'POST',headers:{authorization:`Basic ${Buffer.from(`${apiKey}:${apiToken}`).toString('base64')}`,'content-type':'application/x-www-form-urlencoded',accept:'application/json'},body:form});
  const payload=await response.json().catch(()=>({})); if(!response.ok) throw new Error(payload?.RestException?.Message||payload?.message||`Exotel returned HTTP ${response.status}.`);
  const sid=payload?.Call?.Sid||payload?.Sid; if(!sid) throw new Error('Exotel did not return a call SID.'); return {providerCallId:sid,rawStatus:payload?.Call?.Status};
}
