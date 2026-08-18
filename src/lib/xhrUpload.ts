"use client";

/* `fetch` cannot say how much of a request body has been sent.
 *
 * Which is the whole difficulty behind an honest progress bar: the browser knows
 * exactly how many bytes have gone, and the modern API does not expose it.
 * `XMLHttpRequest` does, through `xhr.upload.onprogress`, and that single event
 * is the reason this file exists. Everything else here is the smallest wrapper
 * that turns it back into a promise.
 *
 * Streaming a `fetch` body with `duplex: 'half'` would be the current way to do
 * it, and it is unshipped in Safari and in Firefox — on a site where most files
 * arrive from a phone, that is the majority of the uploads.
 */

/**
 * The request never completed: no response, no status, nothing stored. Separate
 * from an ordinary refusal because it is the one failure a caller may safely
 * retry by another route — see `uploadToSignedUrlWithProgress`.
 */
export class UploadTransportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UploadTransportError";
  }
}

export interface XhrUploadResult {
  status: number;
  body: string;
}

export interface XhrUploadOptions {
  url: string;
  method?: "POST" | "PUT";
  body: FormData | Blob;
  headers?: Record<string, string>;
  /** Called with 0–100 as the bytes leave, when the browser can measure them. */
  onProgress?: (percent: number) => void;
}

/**
 * Sends `body` and resolves with whatever the server answered — any status,
 * including a refusal. Only a transfer that produced no answer at all rejects,
 * and it rejects with `UploadTransportError`.
 */
export function xhrUpload({
  url,
  method = "POST",
  body,
  headers,
  onProgress,
}: XhrUploadOptions): Promise<XhrUploadResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url, true);

    for (const [name, value] of Object.entries(headers ?? {})) {
      xhr.setRequestHeader(name, value);
    }

    if (onProgress) {
      xhr.upload.onprogress = (event) => {
        /* A body of unknown length reports no total. Leaving the figure where it
           is beats inventing one — the window shows an indeterminate bar until a
           measurable event arrives. */
        if (event.lengthComputable && event.total > 0) {
          onProgress((event.loaded / event.total) * 100);
        }
      };
    }

    xhr.onload = () => resolve({ status: xhr.status, body: xhr.responseText });
    xhr.onerror = () => reject(new UploadTransportError("تعذّر الاتصال أثناء رفع الملف"));
    xhr.ontimeout = () => reject(new UploadTransportError("انتهت مهلة رفع الملف"));
    xhr.onabort = () => reject(new UploadTransportError("أُلغي رفع الملف"));

    xhr.send(body);
  });
}

/** The JSON in a response body, or null when it is not JSON. */
export function parseJsonBody<T>(body: string): T | null {
  try {
    return JSON.parse(body) as T;
  } catch {
    return null;
  }
}
