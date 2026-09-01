/** Server-only adapter for Exotel's Voice Connect API. */
function required(name) { const value=process.env[name]; if(!value) throw new Error(`${name} is required for Exotel calling.`); return value; }
export function exotelEnabled() { return process.env.TELEPHONY_PROVIDER==='exotel'; }
export async function startExotelCall({to,callId}) {
  const accountSid=required('EXOTEL_ACCOUNT_SID'),apiKey=required('EXOTEL_API_KEY'),apiToken=required('EXOTEL_API_TOKEN'),callerId=required('EXOTEL_FROM_NUMBER');
  const apiDomain=(process.env.EXOTEL_API_DOMAIN||'https://api.exotel.com').replace(/\/$/,'');
  // Status callbacks are intentionally disabled for this initial integration.
  const form=new URLSearchParams({From:callerId,To:to,CallerId:callerId,CustomField:callId});
  const response=await fetch(`${apiDomain}/v1/Accounts/${encodeURIComponent(accountSid)}/Calls/connect.json`,{method:'POST',headers:{authorization:`Basic ${Buffer.from(`${apiKey}:${apiToken}`).toString('base64')}`,'content-type':'application/x-www-form-urlencoded',accept:'application/json'},body:form});
  const payload=await response.json().catch(()=>({})); if(!response.ok) throw new Error(payload?.RestException?.Message||payload?.message||`Exotel returned HTTP ${response.status}.`);
  const sid=payload?.Call?.Sid||payload?.Sid; if(!sid) throw new Error('Exotel did not return a call SID.'); return {providerCallId:sid,rawStatus:payload?.Call?.Status};
}
