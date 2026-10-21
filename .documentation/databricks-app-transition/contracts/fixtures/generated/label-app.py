import streamlit as st
import html

st.set_page_config(page_title='Preview O\'Brien', layout='wide')
st.title('Preview O\'Brien')

ui_overrides = {'labels': {}}

_vdab_lbl_vdab_revenuelabel = ui_overrides.get('labels', {}).get('revenueLabel', None)
_vdab_disp_lbl_vdab_revenuelabel = _vdab_lbl_vdab_revenuelabel if _vdab_lbl_vdab_revenuelabel is not None else 'Revenue <img src=x onerror=alert(1)>'
st.markdown(
    f'<p style="font-size: 28px; font-weight: bold; margin: 0;">{html.escape(str(_vdab_disp_lbl_vdab_revenuelabel))}</p>',
    unsafe_allow_html=True,
)
