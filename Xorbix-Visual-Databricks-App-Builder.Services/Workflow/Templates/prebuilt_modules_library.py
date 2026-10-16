# VDAB prebuilt workflow code modules

def change_text(ctx, component, new_label):
    """Set the display label for a component by code name.

    component: target component code name (typically supports controls with labels).
    new_label: text to show as the label.
    """
    ctx.set_label(component, new_label)
    return {"ok": True}
