import "server-only";
import {
  GO54_BASE_URL,
  configuredGo54Credentials,
  go54Form,
  go54Headers,
  type Go54Credentials,
  type FormValue,
} from "./go54";
import { sanitizeGo54Payload, type Go54Diagnostic } from "./go54-diagnostics";

/** Published request contracts, inspected 2026-10-28. The articles do not
 * document response fields. Never turn this reply into ACTIVE/paid/success by
 * guessing `success`, `result`, `status`, EPP, expiry or transaction fields. */
export type Go54Operation =
  | "register"
  | "renew"
  | "transfer"
  | "nameservers.read"
  | "nameservers.update"
  | "lock.read"
  | "lock.update"
  | "epp.read"
  | "domain.sync"
  | "transfer.sync"
  | "contacts.read"
  | "pricing.read";
export type Go54UnverifiedReply = {
  operation: Go54Operation;
  verification: "RESPONSE_SCHEMA_UNVERIFIED";
  payload: unknown;
  httpStatus: number;
  diagnostic: Go54Diagnostic;
};
export type Go54Contact = {
  firstname: string;
  lastname: string;
  fullname: string;
  companyname: string;
  email: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  zipcode: string;
  country: string;
  phonenumber: string;
};
export type Go54Contacts = Record<
  "registrant" | "tech" | "billing" | "admin",
  Go54Contact
>;
export type Go54Addons = {
  dnsmanagement?: 0 | 1;
  emailforwarding?: 0 | 1;
  idprotection?: 0 | 1;
};
export type Go54Registration = {
  domain: string;
  regperiod: number;
  nameservers: string[];
  contacts: Go54Contacts;
  domainfields?: string;
  addons?: Go54Addons;
};
export type Go54Transfer = Omit<Go54Registration, "domainfields"> & {
  eppcode: string;
};
export type Go54Renewal = {
  domain: string;
  regperiod: number;
  addons?: Go54Addons;
};

/** No runtime setting or caller argument can enable live POSTs in this release. */
export const GO54_LIVE_POSTS_ENABLED = false;
export class Go54RequestError extends Error {
  readonly operation: Go54Operation;
  readonly requestMayHaveReachedRegistrar: boolean;
  readonly diagnostic?: Go54Diagnostic;
  constructor(
    operation: Go54Operation,
    sent: boolean,
    message: string,
    diagnostic?: Go54Diagnostic,
  ) {
    super(message);
    this.name = "Go54RequestError";
    this.operation = operation;
    this.requestMayHaveReachedRegistrar = sent;
    this.diagnostic = diagnostic;
  }
}

export function configuredGo54ReadMethods() {
  const read = (name: string): "GET" | "POST" => {
    const method = process.env[name] || "GET";
    if (method !== "GET" && method !== "POST")
      throw Error("Invalid GO54 retrieval method configuration.");
    return method;
  };
  return {
    nameservers: read("GO54_NAMESERVERS_READ_METHOD"),
    lock: read("GO54_LOCK_READ_METHOD"),
    epp: read("GO54_EPP_READ_METHOD"),
    contacts: read("GO54_CONTACTS_READ_METHOD"),
  };
}

function domainName(value: unknown): string {
  if (typeof value !== "string" || value.length > 253)
    throw Error("Enter a valid registrar domain.");
  const name = value.trim().toLowerCase();
  if (!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(name))
    throw Error("Enter a valid registrar domain.");
  return name;
}
function period(value: unknown): number {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 1 ||
    value > 10
  )
    throw Error("Choose a valid registrar period.");
  // This is an input bound, not a claim that every TLD allows all ten years.
  // Actual TLD eligibility and current pricing still require verified preflight.
  return value;
}
function nameservers(input: unknown): string[] {
  if (!Array.isArray(input) || input.length < 2 || input.length > 5)
    throw Error("GO54 requires two to five nameservers.");
  const list = input.map((value) => {
    if (typeof value !== "string" || value.length > 253)
      throw Error("Enter valid nameserver hostnames.");
    const host = value.trim().toLowerCase().replace(/\.$/, "");
    if (!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(host))
      throw Error("Enter valid nameserver hostnames.");
    return host;
  });
  if (new Set(list).size !== list.length)
    throw Error("Nameservers must be distinct.");
  return list;
}
function addons(
  input: Go54Addons | undefined,
): Record<string, FormValue> | undefined {
  if (input === undefined) return undefined;
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw Error("Check the registrar addons.");
  const result: Record<string, FormValue> = {};
  for (const [key, value] of Object.entries(input)) {
    if (
      !["dnsmanagement", "emailforwarding", "idprotection"].includes(key) ||
      ![0, 1].includes(value)
    )
      throw Error("Check the registrar addons.");
    result[key] = value;
  }
  return result;
}
const contactFields = [
  "firstname",
  "lastname",
  "fullname",
  "companyname",
  "email",
  "address1",
  "address2",
  "city",
  "state",
  "zipcode",
  "country",
  "phonenumber",
] as const;
function contacts(input: Go54Contacts): Record<string, FormValue> {
  const roles = ["registrant", "tech", "billing", "admin"] as const;
  if (
    !input ||
    typeof input !== "object" ||
    Array.isArray(input) ||
    Object.keys(input).some(
      (key) => !roles.includes(key as (typeof roles)[number]),
    )
  )
    throw Error("Provide all four authorized contact roles.");
  const result: Record<string, FormValue> = {};
  for (const role of roles) {
    if (!Object.hasOwn(input, role))
      throw Error("Provide all four authorized contact roles.");
    const contact = input[role];
    if (
      !contact ||
      typeof contact !== "object" ||
      Array.isArray(contact) ||
      Object.keys(contact).some(
        (key) => !contactFields.includes(key as (typeof contactFields)[number]),
      )
    )
      throw Error("Provide all four authorized contact roles.");
    const normalized: Record<string, FormValue> = {};
    for (const field of contactFields) {
      if (!Object.hasOwn(contact, field))
        throw Error("Complete the registrar contact fields.");
      const value = contact[field];
      if (
        typeof value !== "string" ||
        value.length > 500 ||
        /[\x00-\x1f\x7f]/.test(value) ||
        (!["companyname", "address2"].includes(field) && !value.trim())
      )
        throw Error("Complete the registrar contact fields.");
      normalized[field] = value;
    }
    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email) ||
      !/^\+[0-9][0-9 .()-]{6,24}$/.test(contact.phonenumber)
    )
      throw Error("Check the registrar contact email and international phone.");
    // Caller supplies country text and explicit first/last names. Never invent
    // legal surnames or silently copy one contact into the other three roles.
    result[role] = normalized;
  }
  return result;
}

type ClientOptions = {
  mock: boolean;
  transport: typeof fetch;
  credentials: () => Go54Credentials;
  clock: () => Date;
};
function client(options: ClientOptions) {
  async function request(
    operation: Go54Operation,
    method: "GET" | "POST",
    path: string,
    params: Record<string, FormValue> = {},
  ): Promise<Go54UnverifiedReply> {
    if (method === "POST" && !options.mock && !GO54_LIVE_POSTS_ENABLED)
      throw new Go54RequestError(
        operation,
        false,
        "Live GO54 operations are disabled pending contract validation and explicit live-test approval.",
      );
    const credentials = options.credentials();
    const headers: Record<string, string> = go54Headers(
      credentials,
      options.clock(),
    );
    const secrets = [credentials.apiKey, credentials.email, headers.token];
    const privateFields = (value: FormValue) => {
      if (typeof value === "string") secrets.push(value);
      else if (Array.isArray(value)) value.forEach(privateFields);
      else if (value && typeof value === "object")
        Object.values(value).forEach(privateFields);
    };
    if (params.contacts) privateFields(params.contacts);
    if (typeof params.eppcode === "string") secrets.push(params.eppcode);
    const init: RequestInit = {
      method,
      headers,
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    };
    if (method === "POST") {
      headers["Content-Type"] = "application/x-www-form-urlencoded";
      init.body = go54Form(params);
    }
    let response: Response;
    try {
      response = await options.transport(GO54_BASE_URL + path, init);
    } catch {
      throw new Go54RequestError(
        operation,
        true,
        "Registrar transport outcome is unknown. Reconcile before retrying an operation.",
      );
    }
    // No retry, hour-boundary fallback, POST-on-GET-error fallback, or invented
    // interpretation of HTTP errors as proof that an operation did not apply.
    const base = {
      operation,
      method,
      httpStatus: response.status,
      observedAt: new Date().toISOString(),
    };
    const reader = response.body?.getReader();
    if (!reader)
      throw new Go54RequestError(
        operation,
        true,
        "Registrar response requires verification.",
        {
          ...base,
          jsonValid: false,
          payload: { _jktlDiagnostic: "EMPTY_RESPONSE" },
        },
      );
    let payload: unknown;
    try {
      const chunks: Uint8Array[] = [];
      let size = 0;
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > 1048576) {
            await reader.cancel();
            throw Error();
          }
          chunks.push(value);
        }
      } finally {
        reader.releaseLock();
      }
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.length;
      }
      payload = JSON.parse(
        new TextDecoder("utf-8", { fatal: true }).decode(bytes),
      );
      // Valid JSON scalars and HTTP-error JSON also remain unknown; neither
      // their shape nor HTTP 200 is a provider success contract.
    } catch {
      throw new Go54RequestError(
        operation,
        true,
        "Registrar JSON outcome requires verification. Do not repeat a mutation blindly.",
        {
          ...base,
          jsonValid: false,
          payload: { _jktlDiagnostic: "INVALID_OR_OVERSIZED_JSON" },
        },
      );
    }
    // No raw response cache/logging, particularly for contacts and EPP.
    return {
      operation,
      verification: "RESPONSE_SCHEMA_UNVERIFIED",
      payload,
      httpStatus: response.status,
      diagnostic: {
        ...base,
        jsonValid: true,
        payload: sanitizeGo54Payload(payload, operation, secrets),
      },
    };
  }
  const path = (domain: string, suffix: string) =>
    `/domains/${encodeURIComponent(domain)}/${suffix}`;
  return {
    register(input: Go54Registration) {
      const domain = domainName(input.domain),
        ns = nameservers(input.nameservers);
      if (
        input.domainfields !== undefined &&
        (typeof input.domainfields !== "string" ||
          input.domainfields.length > 4000)
      )
        throw Error("Check the documented domainfields value.");
      return request("register", "POST", "/order/domains/register", {
        domain,
        regperiod: period(input.regperiod),
        nameservers: Object.fromEntries(
          ns.map((host, i) => [`ns${i + 1}`, host]),
        ),
        contacts: contacts(input.contacts),
        domainfields: input.domainfields,
        addons: addons(input.addons),
      });
    },
    renew(input: Go54Renewal) {
      return request("renew", "POST", "/order/domains/renew", {
        domain: domainName(input.domain),
        regperiod: period(input.regperiod),
        addons: addons(input.addons),
      });
    },
    transfer(input: Go54Transfer) {
      if (
        typeof input.eppcode !== "string" ||
        !input.eppcode.trim() ||
        input.eppcode.length > 256 ||
        /[\x00-\x1f\x7f]/.test(input.eppcode)
      )
        throw Error("Provide the authorized transfer EPP code.");
      return request("transfer", "POST", "/order/domains/transfer", {
        domain: domainName(input.domain),
        regperiod: period(input.regperiod),
        eppcode: input.eppcode,
        nameservers: nameservers(input.nameservers),
        contacts: contacts(input.contacts),
        addons: addons(input.addons),
      });
    },
    getNameservers(value: string) {
      const domain = domainName(value);
      return request(
        "nameservers.read",
        configuredGo54ReadMethods().nameservers,
        path(domain, "nameservers"),
        { domain },
      );
    },
    updateNameservers(value: string, list: string[]) {
      const domain = domainName(value);
      return request(
        "nameservers.update",
        "POST",
        path(domain, "nameservers"),
        { domain, nameservers: nameservers(list) },
      );
    },
    getLock(value: string) {
      const domain = domainName(value);
      return request(
        "lock.read",
        configuredGo54ReadMethods().lock,
        path(domain, "lock"),
        { domain },
      );
    },
    updateLock(value: string, locked: boolean) {
      if (typeof locked !== "boolean")
        throw Error("Choose a registrar lock state.");
      const domain = domainName(value);
      return request("lock.update", "POST", path(domain, "lock"), {
        domain,
        lockstatus: locked ? "true" : "false",
      });
    },
    getEpp(value: string) {
      const domain = domainName(value);
      return request(
        "epp.read",
        configuredGo54ReadMethods().epp,
        path(domain, "eppcode"),
        { domain },
      );
    },
    getContacts(value: string) {
      const domain = domainName(value);
      return request(
        "contacts.read",
        configuredGo54ReadMethods().contacts,
        path(domain, "contact"),
        { domain },
      );
    },
    syncDomain(value: string) {
      const domain = domainName(value);
      return request("domain.sync", "POST", path(domain, "sync"), { domain });
    },
    syncTransfer(value: string) {
      const domain = domainName(value);
      return request("transfer.sync", "POST", path(domain, "transfersync"), {
        domain,
      });
    },
    getPricing() {
      return request("pricing.read", "GET", "/tlds/pricing");
    },
  };
}
export type Go54Client = ReturnType<typeof client>;
export function createGo54Client(): Go54Client {
  return client({
    mock: false,
    transport: globalThis.fetch,
    credentials: configuredGo54Credentials,
    clock: () => new Date(),
  });
}
/** Explicit local-test seam. No production option can select this mode. */
export function createMockGo54Client(
  transport: typeof fetch,
  credentials: Go54Credentials,
  clock: () => Date = () => new Date(),
): Go54Client {
  if (
    process.env.NODE_ENV !== "test" ||
    typeof transport !== "function" ||
    transport === globalThis.fetch
  )
    throw Error("Mock registrar transport is restricted to explicit tests.");
  return client({
    mock: true,
    transport,
    credentials: () => credentials,
    clock,
  });
}
