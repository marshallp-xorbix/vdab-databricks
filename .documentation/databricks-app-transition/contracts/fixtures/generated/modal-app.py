import streamlit as st

st.set_page_config(page_title='Preview O\'Brien', layout='wide')
st.title('Preview O\'Brien')

ui_overrides = {'labels': {}}

@st.dialog('Review O\'Brien', width='medium', position='center', dismissible=True)
def show_reviewDialog():

    with st.expander('Details', expanded=True):

        _vdab_lbl_vdab_modalnote = ui_overrides.get('labels', {}).get('modalNote', None)
        _vdab_disp_lbl_vdab_modalnote = _vdab_lbl_vdab_modalnote if _vdab_lbl_vdab_modalnote is not None else 'Review note'
        if 'vdab_modalnote' not in st.session_state:
            st.session_state['vdab_modalnote'] = ''
        vdab_modalnote = st.text_input(
            label=_vdab_disp_lbl_vdab_modalnote,
            placeholder='Add a note',
            help='Describe the change.',
            key='vdab_modalnote'
        )
    if st.button('Close', key='vdab_reviewdialog_close'):
        st.rerun()

