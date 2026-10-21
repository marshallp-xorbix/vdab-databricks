import streamlit as st
import html

st.set_page_config(page_title='Preview O\'Brien', layout='wide')
st.title('Preview O\'Brien')

ui_overrides = {'labels': {}}

vdab_maincolumns = st.columns(3)
with vdab_maincolumns[0]:

    _vdab_lbl_vdab_saverecord = ui_overrides.get('labels', {}).get('saveRecord', None)
    _vdab_disp_lbl_vdab_saverecord = _vdab_lbl_vdab_saverecord if _vdab_lbl_vdab_saverecord is not None else 'Save record'
    vdab_saverecord = st.button(
        label=_vdab_disp_lbl_vdab_saverecord,
        key='vdab_saverecord',
        type='primary',
        disabled=False,
    )
with vdab_maincolumns[1]:

    _vdab_lbl_vdab_statuslabel = ui_overrides.get('labels', {}).get('statusLabel', None)
    _vdab_disp_lbl_vdab_statuslabel = _vdab_lbl_vdab_statuslabel if _vdab_lbl_vdab_statuslabel is not None else 'Ready <now>'
    st.markdown(
        f'<p style="font-size: 16px; font-weight: normal; margin: 0;">{html.escape(str(_vdab_disp_lbl_vdab_statuslabel))}</p>',
        unsafe_allow_html=True,
    )
with vdab_maincolumns[2]:

    _vdab_lbl_vdab_recordname = ui_overrides.get('labels', {}).get('recordName', None)
    _vdab_disp_lbl_vdab_recordname = _vdab_lbl_vdab_recordname if _vdab_lbl_vdab_recordname is not None else 'Record name'
    if 'vdab_recordname' not in st.session_state:
        st.session_state['vdab_recordname'] = ''
    vdab_recordname = st.text_input(
        label=_vdab_disp_lbl_vdab_recordname,
        placeholder='Name',
        key='vdab_recordname'
    )
