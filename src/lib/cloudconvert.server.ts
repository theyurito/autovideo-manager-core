const CLOUDCONVERT_BASE_URL = "https://api.cloudconvert.com/v2";

export class CloudConvertError extends Error {
  constructor(
    public status: number,
    public responseText: string,
  ) {
    super(`CloudConvert ${status}: ${responseText}`);
    this.name = "CloudConvertError";
  }
}

export async function cloudConvertRequest<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const apiKey = process.env["CLOUDCONVERT_API_KEY"];
  if (!apiKey) {
    throw new Error("CLOUDCONVERT_API_KEY não configurada no ambiente server-side.");
  }

  const url = `${CLOUDCONVERT_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });

  if (!response.ok) {
    throw new CloudConvertError(response.status, await response.text());
  }

  return response.json() as Promise<T>;
}
