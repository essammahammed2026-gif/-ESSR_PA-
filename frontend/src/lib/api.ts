export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export function getApiUrl(path: string): string {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${cleanPath}`;
}

/** Centralized fetch for backend API paths (fix.md Phase 2.5). */
export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(getApiUrl(path), init);
}

/** POST a FormData body and parse the JSON response. */
export async function postForm<T>(path: string, form: FormData): Promise<T> {
  const res = await apiFetch(path, { method: "POST", body: form });
  return res.json() as Promise<T>;
}

const activeDownloads = new Set<string>();

/**
 * POST/GET a request, download the response blob as a file, and revoke the
 * object URL. Replaces the copy-pasted anchor-click blocks across studios.
 * Includes in-flight deduplication to prevent burst duplicate downloads.
 */
export async function downloadBlob(
  path: string,
  filename: string,
  init?: RequestInit
): Promise<void> {
  const downloadKey = `${path}::${filename}`;
  if (activeDownloads.has(downloadKey)) {
    console.warn(`[downloadBlob] Download already in progress or duplicate caught for: ${downloadKey}`);
    return;
  }
  activeDownloads.add(downloadKey);

  try {
    const res = await apiFetch(path, init);
    if (!res.ok) throw new Error(`Download failed: ${res.status}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } finally {
    // Hold deduplication lock briefly to swallow any rapid in-flight burst triggers
    setTimeout(() => {
      activeDownloads.delete(downloadKey);
    }, 2500);
  }
}
