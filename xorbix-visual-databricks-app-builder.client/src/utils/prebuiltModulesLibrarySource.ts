/** Prebuilt functions available to workflow actions in generated child apps. */
export const PREBUILT_MODULES_LIBRARY_SOURCE = `# VDAB prebuilt workflow code modules

def change_text(ctx, component, new_label):
    """Set the display label for a component by code name."""
    ctx.set_label(component, new_label)
    return {"ok": True}
`;
