export class InvalidPhoneNumberError extends Error { readonly code='INVALID_PHONE_NUMBER' }

/** Normalizes Indian mobile numbers to E.164. Landlines need an explicit country code. */
export function normalizeIndianPhone(raw:string):string {
  const clean=raw.replace(/[\s().-]/g,'');
  const local=clean.replace(/^\+91/,'').replace(/^0091/,'').replace(/^91(?=\d{10}$)/,'').replace(/^0(?=[6-9]\d{9}$)/,'');
  if (!/^[6-9]\d{9}$/.test(local)) throw new InvalidPhoneNumberError('Enter a valid 10 digit Indian mobile number.');
  return `+91${local}`;
}
