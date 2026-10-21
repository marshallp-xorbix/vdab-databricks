import streamlit as st

st.set_page_config(page_title='Preview O\'Brien', layout='wide')
st.title('Preview O\'Brien')

ui_overrides = {'labels': {}}

with st.form(
    key='vdab_mainform',
    clear_on_submit=True,
    enter_to_submit=False,
    border=False,
    width=720,
    height='content',
):

    _vdab_lbl_vdab_recordname = ui_overrides.get('labels', {}).get('recordName', None)
    _vdab_disp_lbl_vdab_recordname = _vdab_lbl_vdab_recordname if _vdab_lbl_vdab_recordname is not None else 'Record name'
    if 'vdab_recordname' not in st.session_state:
        st.session_state['vdab_recordname'] = ''
    vdab_recordname = st.text_input(
        label=_vdab_disp_lbl_vdab_recordname,
        placeholder='Name',
        help='Enter a name.',
        key='vdab_recordname'
    )

    _vdab_lbl_vdab_approved = ui_overrides.get('labels', {}).get('approved', None)
    _vdab_disp_lbl_vdab_approved = _vdab_lbl_vdab_approved if _vdab_lbl_vdab_approved is not None else 'Approved'
    if 'vdab_approved' not in st.session_state:
        st.session_state['vdab_approved'] = True
    vdab_approved = st.checkbox(
        label=_vdab_disp_lbl_vdab_approved,
        help='Confirm this record.',
        disabled=False,
        key='vdab_approved'
    )
    submitted = st.form_submit_button('Save O\'Brien')

if submitted:
    st.toast('Form submitted successfully!')
