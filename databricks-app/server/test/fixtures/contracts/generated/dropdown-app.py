import streamlit as st

st.set_page_config(page_title='Preview O\'Brien', layout='wide')
st.title('Preview O\'Brien')

st.markdown("""<style>
  .block-container { max-width: 730px; }
</style>""", unsafe_allow_html=True)

ui_overrides = {'labels': {}}

_vdab_lbl_vdab_dropdown1 = ui_overrides.get('labels', {}).get('dropdown1', None)
_vdab_disp_lbl_vdab_dropdown1 = _vdab_lbl_vdab_dropdown1 if _vdab_lbl_vdab_dropdown1 is not None else 'Select an option'
if 'vdab_dropdown1' not in st.session_state:
    st.session_state['vdab_dropdown1'] = '1'
vdab_dropdown1 = st.selectbox(
    label=_vdab_disp_lbl_vdab_dropdown1,
    options=['1', '2'],
    placeholder='Select an option',
    disabled=False,
    key='vdab_dropdown1'
)

_vdab_lbl_vdab_categories = ui_overrides.get('labels', {}).get('categories', None)
_vdab_disp_lbl_vdab_categories = _vdab_lbl_vdab_categories if _vdab_lbl_vdab_categories is not None else 'Categories'
if 'vdab_categories' not in st.session_state:
    st.session_state['vdab_categories'] = ['2']
vdab_categories = st.multiselect(
    label=_vdab_disp_lbl_vdab_categories,
    options=['1', '2'],
    placeholder='Select categories',
    help='Choose one or more.',
    disabled=True,
    key='vdab_categories'
)
