import streamlit as st

st.set_page_config(page_title='Preview O\'Brien', layout='wide')
st.title('Preview O\'Brien')

st.markdown("""<style>
  .block-container { max-width: 730px; }
</style>""", unsafe_allow_html=True)

ui_overrides = {'labels': {}}

_vdab_lbl_vdab_checkbox1 = ui_overrides.get('labels', {}).get('checkbox1', None)
_vdab_disp_lbl_vdab_checkbox1 = _vdab_lbl_vdab_checkbox1 if _vdab_lbl_vdab_checkbox1 is not None else 'Approved'
if 'vdab_checkbox1' not in st.session_state:
    st.session_state['vdab_checkbox1'] = True
vdab_checkbox1 = st.checkbox(
    label=_vdab_disp_lbl_vdab_checkbox1,
    help='Mark this record approved.',
    disabled=False,
    key='vdab_checkbox1'
)
