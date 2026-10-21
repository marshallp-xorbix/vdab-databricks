import streamlit as st
import html

st.set_page_config(page_title='Preview O\'Brien', layout='wide')
st.title('Preview O\'Brien')

ui_overrides = {'labels': {}}

with st.expander('Owner\'s details\nMore information', expanded=True):

    _vdab_lbl_vdab_detailslabel = ui_overrides.get('labels', {}).get('detailsLabel', None)
    _vdab_disp_lbl_vdab_detailslabel = _vdab_lbl_vdab_detailslabel if _vdab_lbl_vdab_detailslabel is not None else 'Details <summary>'
    st.markdown(
        f'<p style="font-size: 28px; font-weight: bold; margin: 0;">{html.escape(str(_vdab_disp_lbl_vdab_detailslabel))}</p>',
        unsafe_allow_html=True,
    )

    _vdab_lbl_vdab_additionalnotes = ui_overrides.get('labels', {}).get('additionalNotes', None)
    _vdab_disp_lbl_vdab_additionalnotes = _vdab_lbl_vdab_additionalnotes if _vdab_lbl_vdab_additionalnotes is not None else 'Additional notes'
    if 'vdab_additionalnotes' not in st.session_state:
        st.session_state['vdab_additionalnotes'] = ''
    vdab_additionalnotes = st.text_area(
        label=_vdab_disp_lbl_vdab_additionalnotes,
        placeholder='Add context',
        help='Optional details.',
        height=240,
        key='vdab_additionalnotes'
    )

    _vdab_lbl_vdab_savedetails = ui_overrides.get('labels', {}).get('saveDetails', None)
    _vdab_disp_lbl_vdab_savedetails = _vdab_lbl_vdab_savedetails if _vdab_lbl_vdab_savedetails is not None else 'Save details'
    vdab_savedetails = st.button(
        label=_vdab_disp_lbl_vdab_savedetails,
        key='vdab_savedetails',
        type='primary',
        disabled=False,
    )
