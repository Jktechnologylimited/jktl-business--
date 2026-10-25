/** Server-only grant exchange. Each application creates its own authorized CMS session. */
export async function exchangeJktlGrant({code,projectId,apiKey,portalOrigin='https://business.jktl.com.ng',fetchImpl=fetch}){
 if(typeof window!=='undefined')throw Error('JKTL CMS exchange is server-only');
 if(!/^[a-f0-9]{64}$/.test(code)||!/^[a-f0-9-]{36}$/.test(projectId)||!/^[a-f0-9]{64}$/.test(apiKey))throw Error('Invalid integration configuration');
 const origin=new URL(portalOrigin);if(origin.origin!=='https://business.jktl.com.ng')throw Error('Unexpected JKTL issuer');
 const r=await fetchImpl(new URL('/api/custom/cms/exchange',origin),{method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},body:JSON.stringify({code,projectId}),cache:'no-store',redirect:'error',signal:AbortSignal.timeout(8000)});
 if(!r.ok)throw Error('JKTL grant was rejected or expired');const identity=await r.json();
 if(identity.issuer!==origin.origin||identity.audience!==projectId||typeof identity.subject!=='string'||typeof identity.organizationId!=='string'||!Array.isArray(identity.scope)||identity.scope.some(s=>!['content:read','content:write','content:publish'].includes(s)))throw Error('Invalid JKTL identity');
 return Object.freeze({userId:identity.subject,organizationId:identity.organizationId,email:identity.email,name:identity.name,scope:Object.freeze(identity.scope)});
}
/** Publish through the site's existing CMS transaction, then invalidate that site's caches. */
export async function publishJktlContent({identity,resource,content,authorize,saveWithAudit,revalidate}){
 if(!identity?.scope?.includes('content:publish')||!await authorize(identity,resource))throw Error('Content publishing is not permitted');
 // The application supplies schema validation, tenant checks, durable content + audit transaction.
 const result=await saveWithAudit({identity,resource,content});await revalidate(resource);return result;
}
