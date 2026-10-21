import streamlit as st

st.set_page_config(page_title='Preview O\'Brien', layout='wide')
st.title('Preview O\'Brien')

ui_overrides = {'labels': {}}

_vdab_lbl_vdab_timepicker1 = ui_overrides.get('labels', {}).get('timePicker1', None)
_vdab_disp_lbl_vdab_timepicker1 = _vdab_lbl_vdab_timepicker1 if _vdab_lbl_vdab_timepicker1 is not None else 'Run time'
vdab_timepicker1 = st.time_input(
    label=_vdab_disp_lbl_vdab_timepicker1,
    value='08:30:00',
    step=300,
    disabled=False,
    help='Choose the time for the run.',
    key='vdab_timepicker1'
)
