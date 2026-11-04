import streamlit as st

st.set_page_config(page_title='Preview O\'Brien', layout='wide')
st.title('Preview O\'Brien')

st.markdown("""<style>
  .block-container { max-width: 730px; }
</style>""", unsafe_allow_html=True)

ui_overrides = {'labels': {}}

_vdab_lbl_vdab_button1 = ui_overrides.get('labels', {}).get('button1', None)
_vdab_disp_lbl_vdab_button1 = _vdab_lbl_vdab_button1 if _vdab_lbl_vdab_button1 is not None else 'Save changes'
vdab_button1 = st.button(
    label=_vdab_disp_lbl_vdab_button1,
    key='vdab_button1',
    type='secondary',
    disabled=False,
    help='Save the current draft.',
)
