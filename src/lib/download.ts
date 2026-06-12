/** Browser download helpers — single place for the create-anchor dance. */

/** Serialize `data` as pretty JSON and download it as `filename`. */
export function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  triggerDownload(url, filename)
  URL.revokeObjectURL(url)
}

/** Download an existing URL (e.g. a file served from /public). */
export function downloadUrl(url: string, filename: string): void {
  triggerDownload(url, filename)
}

function triggerDownload(href: string, download: string): void {
  const a = document.createElement('a')
  a.href = href
  a.download = download
  a.click()
}
