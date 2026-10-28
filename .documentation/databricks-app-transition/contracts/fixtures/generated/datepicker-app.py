import streamlit as st

st.set_page_config(page_title='Preview O\'Brien', layout='wide')
st.title('Preview O\'Brien')

st.markdown("""<style>
  .block-container { max-width: 730px; }
</style>""", unsafe_allow_html=True)

ui_overrides = {'labels': {}}

_vdab_lbl_vdab_datepicker1 = ui_overrides.get('labels', {}).get('datePicker1', None)
_vdab_disp_lbl_vdab_datepicker1 = _vdab_lbl_vdab_datepicker1 if _vdab_lbl_vdab_datepicker1 is not None else 'Launch date'
vdab_datepicker1 = st.date_input(
    label=_vdab_disp_lbl_vdab_datepicker1,
    value='today',
    min_value='2025-01-01',
    max_value='2025-12-31',
    format='DD/MM/YYYY',
    disabled=True,
    help='Choose a launch date.',
    key='vdab_datepicker1'
)
