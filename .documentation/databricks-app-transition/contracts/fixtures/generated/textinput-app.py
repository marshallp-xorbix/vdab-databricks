import streamlit as st

st.set_page_config(page_title='Preview O\'Brien', layout='wide')
st.title('Preview O\'Brien')

ui_overrides = {'labels': {}}

_vdab_lbl_vdab_customername = ui_overrides.get('labels', {}).get('customerName', None)
_vdab_disp_lbl_vdab_customername = _vdab_lbl_vdab_customername if _vdab_lbl_vdab_customername is not None else 'Customer name'
if 'vdab_customername' not in st.session_state:
    st.session_state['vdab_customername'] = 'Ada'
vdab_customername = st.text_input(
    label=_vdab_disp_lbl_vdab_customername,
    placeholder='Enter a name',
    help='Shown on the customer record.',
    key='vdab_customername'
)
