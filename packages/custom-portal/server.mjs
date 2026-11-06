import { createHash, createHmac, randomBytes } from 'node:crypto';
/** Import from server code only. Authenticate/authorize the local user before calling. */
export function createProjectPortal({ projectId, key, origin = 'https://business.jktl.com.ng', fetcher = fetch }) {
 if (!/^[a-f0-9-]{36}$/.test(projectId) || !/^jktl_proj_[a-f0-9-]{36}\.[a-f0-9]{64}$/.test(key)) throw Error('Configure a valid JKTL project integration.');
 const base = new URL(origin);
 if (base.protocol !== 'https:' || base.username || base.password || base.pathname !== '/' || base.search || base.hash) throw Error('Use an HTTPS JKTL API origin.');
 return async function request(subject, path, { method = 'GET', body } = {}) {
  if (!subject || /[\r\n]/.test(subject) || subject.length > 200 || !/^\/(billing|invoices|payments|support|earn)(\/[A-Za-z0-9-]+)*$/.test(path) || !['GET','POST'].includes(method)) throw Error('Invalid project request.');
  const url = new URL(`/api/v1/custom-projects/${projectId}${path}`, base);
  const raw = body === undefined ? '' : JSON.stringify(body);
  const timestamp = String(Date.now()), nonce = randomBytes(24).toString('hex');
  const bodyHash = createHash('sha256').update(raw).digest('hex');
  const signature = createHmac('sha256', key).update([method,url.pathname,subject,timestamp,nonce,bodyHash].join('\n')).digest('hex');
  const result = await fetcher(url, { method, body: method === 'POST' ? raw : undefined, redirect:'error', cache:'no-store', signal:AbortSignal.timeout(20000), headers: { authorization:`Bearer ${key}`,'content-type':'application/json','x-jktl-user':subject,'x-jktl-timestamp':timestamp,'x-jktl-nonce':nonce,'x-jktl-signature':signature } });
  return result;
 };
}
