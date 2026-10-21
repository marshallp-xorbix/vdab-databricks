import streamlit as st

st.set_page_config(page_title='Preview O\'Brien', layout='wide')
st.title('Preview O\'Brien')

ui_overrides = {'labels': {}}

_vdab_lbl_vdab_completion = ui_overrides.get('labels', {}).get('completion', None)
_vdab_disp_lbl_vdab_completion = _vdab_lbl_vdab_completion if _vdab_lbl_vdab_completion is not None else 'Completion'
vdab_completion = st.slider(
    label=_vdab_disp_lbl_vdab_completion,
    min_value=0,
    max_value=100,
    value=50,
    step=1,
    disabled=False,
    help='Choose completion.',
    key='vdab_completion'
)

_vdab_lbl_vdab_budgetrange = ui_overrides.get('labels', {}).get('budgetRange', None)
_vdab_disp_lbl_vdab_budgetrange = _vdab_lbl_vdab_budgetrange if _vdab_lbl_vdab_budgetrange is not None else 'Budget range'
vdab_budgetrange = st.slider(
    label=_vdab_disp_lbl_vdab_budgetrange,
    min_value=0,
    max_value=100,
    value=(25, 75),
    step=5,
    disabled=True,
    help='Set the budget range.',
    format='percent',
    key='vdab_budgetrange'
)
