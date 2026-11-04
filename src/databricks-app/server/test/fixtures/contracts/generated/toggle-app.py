import streamlit as st

st.set_page_config(page_title='Preview O\'Brien', layout='wide')
st.title('Preview O\'Brien')

st.markdown("""<style>
  .block-container { max-width: 730px; }
</style>""", unsafe_allow_html=True)

ui_overrides = {'labels': {}}

_vdab_lbl_vdab_toggle1 = ui_overrides.get('labels', {}).get('toggle1', None)
_vdab_disp_lbl_vdab_toggle1 = _vdab_lbl_vdab_toggle1 if _vdab_lbl_vdab_toggle1 is not None else 'Notifications'
if 'vdab_toggle1' not in st.session_state:
    st.session_state['vdab_toggle1'] = False
vdab_toggle1 = st.toggle(
    label=_vdab_disp_lbl_vdab_toggle1,
    help='Send update notifications.',
    disabled=True,
    key='vdab_toggle1'
)
