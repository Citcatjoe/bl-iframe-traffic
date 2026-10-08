/**
 * Appel SOAP « Traffic Situations » d'opentransportdata.swiss. Seul module qui touche le réseau.
 * Pas d'état : l'espacement minimal entre appels est garanti par l'appelant (poller).
 */

export const OTD_URL = "https://api.opentransportdata.swiss/TDP/Soap_Datex2/TrafficSituations/Pull";
export const OTD_SOAP_ACTION = "http://opentransportdata.swiss/TDP/Soap_Datex2/Pull/v1/pullTrafficMessages";

const SOAP_BODY = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <d2LogicalModel xmlns:xsd="http://www.w3.org/2001/XMLSchema"
                    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                    modelBaseVersion="2" xmlns="http://datex2.eu/schema/2/2_0">
      <exchange>
        <supplierIdentification><country>ch</country><nationalIdentifier>bl-iframe-traffic</nationalIdentifier></supplierIdentification>
        <subscription>
          <operatingMode>operatingMode1</operatingMode>
          <subscriptionStartTime>2025-01-01T00:00:00+00:00</subscriptionStartTime>
          <subscriptionState>active</subscriptionState>
          <updateMethod>singleElementUpdate</updateMethod>
          <target><address></address><protocol>http</protocol></target>
        </subscription>
      </exchange>
    </d2LogicalModel>
  </soap:Body>
</soap:Envelope>`;

/** code : NO_KEY | AUTH | RATE_LIMIT | HTTP | TIMEOUT | NETWORK */
export class OtdError extends Error {
  constructor(code, message, { status = null, cause } = {}) {
    super(message, { cause });
    this.name = "OtdError";
    this.code = code;
    this.status = status;
  }
}

/**
 * @param {{ apiKey: string, timeoutMs?: number }} opts
 * @returns {Promise<string>} XML SOAP brut
 */
export async function fetchTrafficSituationsXml({ apiKey, timeoutMs = 60_000 }) {
  if (!apiKey) {
    throw new OtdError("NO_KEY", "OTD_API_KEY manquante (.env). Clé gratuite sur https://api-manager.opentransportdata.swiss");
  }
  let res;
  try {
    res = await fetch(OTD_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        SOAPAction: OTD_SOAP_ACTION,
        Authorization: `Bearer ${apiKey}`,
      },
      body: SOAP_BODY,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e) {
    if (e.name === "TimeoutError") throw new OtdError("TIMEOUT", `Pas de réponse de l'API après ${timeoutMs / 1000} s.`, { cause: e });
    throw new OtdError("NETWORK", `Erreur réseau : ${e.cause?.code ?? e.message}`, { cause: e });
  }

  let body;
  try {
    body = await res.text();
  } catch (e) {
    if (e.name === "TimeoutError") throw new OtdError("TIMEOUT", `Réponse interrompue après ${timeoutMs / 1000} s.`, { cause: e });
    throw new OtdError("NETWORK", `Lecture de la réponse interrompue : ${e.message}`, { cause: e });
  }

  if (res.status === 401 || res.status === 403) {
    throw new OtdError(
      "AUTH",
      `HTTP ${res.status} : clé invalide, ou application non abonnée à « Road traffic – traffic situations ».`,
      { status: res.status },
    );
  }
  if (res.status === 429) {
    throw new OtdError("RATE_LIMIT", "HTTP 429 : quota de l'API dépassé (appels trop rapprochés). Nouvel essai au prochain relevé.", {
      status: 429,
    });
  }
  if (!res.ok) {
    throw new OtdError("HTTP", `HTTP ${res.status} : ${body.slice(0, 300).replace(/\s+/g, " ")}`, { status: res.status });
  }
  return body;
}
