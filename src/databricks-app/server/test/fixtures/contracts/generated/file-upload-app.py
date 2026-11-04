import streamlit as st
import hashlib
import os
import re
import urllib.error
import urllib.parse
import urllib.request

st.set_page_config(page_title='Preview O\'Brien', layout='wide')
st.title('Preview O\'Brien')

st.markdown("""<style>
  .block-container { max-width: 730px; }
</style>""", unsafe_allow_html=True)

ui_overrides = {'labels': {}}

_VDAB_HTTP_TIMEOUT_SECONDS = 30

class _VDABNoRedirectHandler(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request: urllib.request.Request, file_pointer: object, status_code: int, message: str, headers: object, new_url: str) -> urllib.request.Request | None:
        return None

def _vdab_open_no_redirect(request: urllib.request.Request) -> object:
    opener = urllib.request.build_opener(_VDABNoRedirectHandler())
    return opener.open(request, timeout=_VDAB_HTTP_TIMEOUT_SECONDS)


def _vdab_safe_upload_name(raw_name):
    safe_name = re.sub(r'[^A-Za-z0-9._ -]', '_', str(raw_name).replace('\\', '/').rsplit('/', 1)[-1]).strip(' .')
    if safe_name in ('', '.', '..'):
        raise ValueError('Unsafe file name')
    return safe_name[:255]

def _vdab_upload_signature(file_name, file_bytes):
    return f'{file_name}:{len(file_bytes)}:{hashlib.sha256(file_bytes).hexdigest()}'

def _vdab_upload_to_volume(file_bytes, volume_path, file_name):
    user_token = st.context.headers.get('x-forwarded-access-token')
    if not user_token:
        raise RuntimeError('The current viewer did not grant Databricks user authorization.')
    workspace_host = os.environ.get('DATABRICKS_HOST', '')
    parsed_host = urllib.parse.urlsplit(workspace_host)
    if parsed_host.scheme != 'https' or not parsed_host.netloc or parsed_host.username or parsed_host.password or parsed_host.path not in ('', '/') or parsed_host.query or parsed_host.fragment:
        raise RuntimeError('The Databricks workspace host is not configured safely.')
    path_parts = volume_path.split('/') + [file_name]
    encoded_path = '/'.join(urllib.parse.quote(part, safe='') for part in path_parts)
    request = urllib.request.Request(
        f'{parsed_host.scheme}://{parsed_host.netloc}/api/2.0/fs/files/{encoded_path}?overwrite=true',
        data=file_bytes,
        headers={'Authorization': f'Bearer {user_token}', 'Content-Type': 'application/octet-stream'},
        method='PUT',
    )
    try:
        with _vdab_open_no_redirect(request):
            return
    except urllib.error.HTTPError as error:
        if error.code in (401, 403):
            raise RuntimeError('Upload denied. Check the current viewer’s files scope and Volume write privileges.') from None
        raise RuntimeError(f'Databricks rejected the upload (HTTP {error.code}).') from None
    except urllib.error.URLError:
        raise RuntimeError('The Databricks file API could not be reached.') from None

_vdab_lbl_vdab_customerfiles = ui_overrides.get('labels', {}).get('customerFiles', None)
_vdab_disp_lbl_vdab_customerfiles = _vdab_lbl_vdab_customerfiles if _vdab_lbl_vdab_customerfiles is not None else 'Upload documents'
vdab_customerfiles = st.file_uploader(
    label=_vdab_disp_lbl_vdab_customerfiles,
    accept_multiple_files=True,
    key='vdab_customerfiles_uploader',
)
if 'vdab_customerfiles_processed_files' not in st.session_state:
    st.session_state['vdab_customerfiles_processed_files'] = []
if vdab_customerfiles:
    vdab_processed_vdab_customerfiles = st.session_state['vdab_customerfiles_processed_files']
    vdab_seen_names_vdab_customerfiles = set()
    vdab_uploaded_count_vdab_customerfiles = 0
    for vdab_file_vdab_customerfiles in vdab_customerfiles:
        try:
            vdab_name_vdab_customerfiles = _vdab_safe_upload_name(vdab_file_vdab_customerfiles.name)
        except ValueError:
            st.error("Upload skipped: a file name cannot be used safely.")
            continue
        if vdab_name_vdab_customerfiles in vdab_seen_names_vdab_customerfiles:
            st.error("Upload skipped: two files use the same destination name.")
            continue
        vdab_seen_names_vdab_customerfiles.add(vdab_name_vdab_customerfiles)
        vdab_bytes_vdab_customerfiles = vdab_file_vdab_customerfiles.getvalue()
        vdab_signature_vdab_customerfiles = _vdab_upload_signature(vdab_name_vdab_customerfiles, vdab_bytes_vdab_customerfiles)
        if vdab_signature_vdab_customerfiles in vdab_processed_vdab_customerfiles:
            continue
        try:
            _vdab_upload_to_volume(vdab_bytes_vdab_customerfiles, 'Volumes/main/landing/incoming/imports/2026', vdab_name_vdab_customerfiles)
        except RuntimeError as vdab_error_vdab_customerfiles:
            st.error(str(vdab_error_vdab_customerfiles))
            continue
        vdab_processed_vdab_customerfiles.append(vdab_signature_vdab_customerfiles)
        vdab_uploaded_count_vdab_customerfiles += 1
    st.session_state['vdab_customerfiles_processed_files'] = vdab_processed_vdab_customerfiles
    if vdab_uploaded_count_vdab_customerfiles > 0:
        st.success(f"Uploaded {vdab_uploaded_count_vdab_customerfiles} file(s) to the selected Volume.")
else:
    st.session_state.pop('vdab_customerfiles_processed_files', None)
