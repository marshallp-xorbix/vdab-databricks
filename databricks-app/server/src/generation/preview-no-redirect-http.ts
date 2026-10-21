/** Appends a redirect-blocking HTTP helper for viewer-authorized workspace APIs. */
export function appendNoRedirectHttpHelpers(lines: string[]): void {
  lines.push(
    "",
    "_VDAB_HTTP_TIMEOUT_SECONDS = 30",
    "",
    "class _VDABNoRedirectHandler(urllib.request.HTTPRedirectHandler):",
    "    def redirect_request(self, request: urllib.request.Request, file_pointer: object, status_code: int, message: str, headers: object, new_url: str) -> urllib.request.Request | None:",
    "        return None",
    "",
    "def _vdab_open_no_redirect(request: urllib.request.Request) -> object:",
    "    opener = urllib.request.build_opener(_VDABNoRedirectHandler())",
    "    return opener.open(request, timeout=_VDAB_HTTP_TIMEOUT_SECONDS)",
    "",
  );
}
