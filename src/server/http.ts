export type ApiResult<T>={data:T}|{error:{code:string;message:string;requestId:string}};
export function apiError(error:unknown,requestId:string):ApiResult<never>{const message=error instanceof Error?error.message:'Unexpected error';const code=error instanceof Error&&error.name==='ValidationError'?'VALIDATION_ERROR':'INTERNAL_ERROR';return {error:{code,message,requestId}}}
