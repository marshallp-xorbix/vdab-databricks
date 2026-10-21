import streamlit as st
import streamlit.components.v1 as components
import os
import urllib.parse

st.set_page_config(page_title='Quarterly overview', layout='wide')
st.title('Quarterly overview')

ui_overrides = {'labels': {}}
_vdab_dashboard_workspace_host = os.environ.get('DATABRICKS_HOST', '')
_vdab_dashboard_workspace = urllib.parse.urlsplit(_vdab_dashboard_workspace_host)
_vdab_dashboard_workspace_id = os.environ.get('DATABRICKS_WORKSPACE_ID', '')
if (_vdab_dashboard_workspace.scheme != 'https' or not _vdab_dashboard_workspace.hostname or _vdab_dashboard_workspace.username or _vdab_dashboard_workspace.password or _vdab_dashboard_workspace.path not in ('', '/') or _vdab_dashboard_workspace.query or _vdab_dashboard_workspace.fragment or not _vdab_dashboard_workspace_id.isascii() or not _vdab_dashboard_workspace_id.isdigit() or len(_vdab_dashboard_workspace_id) > 32):
    st.error('Dashboard embedding requires valid Databricks workspace runtime configuration.')
else:
    _vdab_dashboard_query = {'o': _vdab_dashboard_workspace_id}
    _vdab_dashboard_query['fullscreenWidget'] = 'page_1~widget_2'
    _vdab_dashboard_src = urllib.parse.urlunsplit(('https', _vdab_dashboard_workspace.netloc, '/embed/dashboardsv3/dashboard_12', urllib.parse.urlencode(_vdab_dashboard_query), ''))
    components.iframe(_vdab_dashboard_src, height=720, scrolling=False)
st.caption('Use a published dashboard embed link. Viewers need dashboard access. For per-viewer data access, publish with individual data permissions; shared data permissions use the publisher credentials. A workspace admin must allow this app domain for dashboard embedding.')
