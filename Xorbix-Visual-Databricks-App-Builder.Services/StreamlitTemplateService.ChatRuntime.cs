using System.Text;
using Xorbix_Visual_Databricks_App_Builder.Models;

namespace Xorbix_Visual_Databricks_App_Builder.Services;

public partial class StreamlitTemplateService
{
    private static void AppendGenieChatRuntimeHelpers(StringBuilder sb)
    {
        int heightDefault = ComponentHeightBounds.DefaultPixels;
        int heightMin = ComponentHeightBounds.MinPixels;
        int heightMax = ComponentHeightBounds.MaxPixels;

        sb.AppendLine("# Genie (AI/BI) chat — space id from Databricks Apps resource env (see app.yaml)");
        sb.AppendLine("_vdab_genie_w = None");
        sb.AppendLine();
        sb.AppendLine("def _vdab_genie_workspace_client():");
        sb.AppendLine("    global _vdab_genie_w");
        sb.AppendLine("    if _vdab_genie_w is None:");
        sb.AppendLine("        _vdab_genie_w = WorkspaceClient(product=PARTNER_NAME, product_version=PARTNER_VERSION)");
        sb.AppendLine("    return _vdab_genie_w");
        sb.AppendLine();
        sb.AppendLine("def _vdab_genie_query_df(w, statement_id: str):");
        sb.AppendLine("    result = w.statement_execution.get_statement(statement_id)");
        sb.AppendLine("    return pd.DataFrame(");
        sb.AppendLine("        result.result.data_array,");
        sb.AppendLine("        columns=[c.name for c in result.manifest.schema.columns],");
        sb.AppendLine("    )");
        sb.AppendLine();
        sb.AppendLine("def _vdab_genie_border_theme_css():");
        sb.AppendLine("    # Streamlit sets theme tokens on :root; default bordered blocks are often too faint.");
        sb.AppendLine("    return \"\"\"<style>");
        sb.AppendLine("div[data-testid=\"stVerticalBlockBorderWrapper\"] {");
        sb.AppendLine("    border-width: 2px !important;");
        sb.AppendLine("    border-style: solid !important;");
        sb.AppendLine("    border-color: var(--primary-color, #ff4b4b) !important;");
        sb.AppendLine("    border-radius: 0.5rem !important;");
        sb.AppendLine("    background-color: var(--secondary-background-color, #f0f2f6) !important;");
        sb.AppendLine("    padding: 0.35rem 0.5rem !important;");
        sb.AppendLine("}");
        sb.AppendLine("</style>\"\"\"");
        sb.AppendLine();
        sb.AppendLine("def _vdab_genie_thinking_bubbles_html():");
        sb.AppendLine("    return '''<style>");
        sb.AppendLine("@keyframes vdab_think_bounce {");
        sb.AppendLine("    0%, 80%, 100% { transform: translateY(0); opacity: 0.35; }");
        sb.AppendLine("    40% { transform: translateY(-7px); opacity: 1; }");
        sb.AppendLine("}");
        sb.AppendLine(".vdab-thinking-wrap { display: flex; align-items: center; gap: 0.45rem;");
        sb.AppendLine("    padding: 0.4rem 0 0.6rem 0; min-height: 1.5rem; flex-wrap: nowrap; }");
        sb.AppendLine(".vdab-thinking-dot {");
        sb.AppendLine("    width: 0.55rem; height: 0.55rem; border-radius: 9999px;");
        sb.AppendLine("    background: var(--primary-color, #ff4b4b);");
        sb.AppendLine("    animation: vdab_think_bounce 0.95s ease-in-out infinite;");
        sb.AppendLine("}");
        sb.AppendLine(".vdab-thinking-wrap .vdab-thinking-dot:nth-of-type(1) { animation-delay: 0s; }");
        sb.AppendLine(".vdab-thinking-wrap .vdab-thinking-dot:nth-of-type(2) { animation-delay: 0.18s; }");
        sb.AppendLine(".vdab-thinking-wrap .vdab-thinking-dot:nth-of-type(3) { animation-delay: 0.36s; }");
        sb.AppendLine("</style>");
        sb.AppendLine("<div class=\"vdab-thinking-wrap\" aria-hidden=\"true\">");
        sb.AppendLine("<span class=\"vdab-thinking-dot\"></span>");
        sb.AppendLine("<span class=\"vdab-thinking-dot\"></span>");
        sb.AppendLine("<span class=\"vdab-thinking-dot\"></span>");
        sb.AppendLine("</div>'''");
        sb.AppendLine();
        sb.AppendLine("def _vdab_genie_messages_horizontal_clip_css(container_key: str):");
        sb.AppendLine("    return f\"\"\"<style>");
        sb.AppendLine("div.st-key-{container_key} {{");
        sb.AppendLine("    overflow-x: hidden !important;");
        sb.AppendLine("    max-width: 100%;");
        sb.AppendLine("}}");
        sb.AppendLine("div.st-key-{container_key} pre {{");
        sb.AppendLine("    white-space: pre-wrap !important;");
        sb.AppendLine("    word-break: break-word;");
        sb.AppendLine("}}");
        sb.AppendLine("</style>\"\"\"");
        sb.AppendLine();
        sb.AppendLine("def _vdab_genie_assistant_parts_from_response(resp):");
        sb.AppendLine("    parts = []");
        sb.AppendLine("    qres = getattr(resp, \"query_result\", None)");
        sb.AppendLine("    stmt_id = getattr(qres, \"statement_id\", None) if qres is not None else None");
        sb.AppendLine("    for att in resp.attachments:");
        sb.AppendLine("        txt = getattr(att, \"text\", None)");
        sb.AppendLine("        if txt is not None and getattr(txt, \"content\", None):");
        sb.AppendLine("            parts.append({\"kind\": \"markdown\", \"body\": txt.content})");
        sb.AppendLine("        q = getattr(att, \"query\", None)");
        sb.AppendLine("        if q is not None and stmt_id:");
        sb.AppendLine("            parts.append({");
        sb.AppendLine("                \"kind\": \"sql\",");
        sb.AppendLine("                \"title\": getattr(q, \"description\", None) or \"Genie query\",");
        sb.AppendLine("                \"code\": getattr(q, \"query\", \"\") or \"\",");
        sb.AppendLine("                \"statement_id\": stmt_id,");
        sb.AppendLine("            })");
        sb.AppendLine("    return parts");
        sb.AppendLine();
        sb.AppendLine("def _vdab_genie_render_hist_entry(w, msg):");
        sb.AppendLine("    role = msg[\"role\"]");
        sb.AppendLine("    with st.chat_message(role):");
        sb.AppendLine("        if role == \"user\":");
        sb.AppendLine("            st.markdown(msg[\"text\"])");
        sb.AppendLine("        else:");
        sb.AppendLine("            for p in msg.get(\"parts\", []):");
        sb.AppendLine("                k = p.get(\"kind\")");
        sb.AppendLine("                if k == \"markdown\":");
        sb.AppendLine("                    st.markdown(p.get(\"body\") or \"\")");
        sb.AppendLine("                elif k == \"sql\":");
        sb.AppendLine("                    st.markdown(p.get(\"title\") or \"Genie query\")");
        sb.AppendLine("                    with st.expander(\"Generated SQL\"):");
        sb.AppendLine("                        st.code(p.get(\"code\") or \"\", language=\"sql\", wrap_lines=True)");
        sb.AppendLine("                    sid = p.get(\"statement_id\")");
        sb.AppendLine("                    if sid:");
        sb.AppendLine("                        try:");
        sb.AppendLine("                            st.dataframe(_vdab_genie_query_df(w, sid), use_container_width=True)");
        sb.AppendLine("                        except Exception:");
        sb.AppendLine("                            st.caption(\"Could not reload query result for this turn.\")");
        sb.AppendLine();
        sb.AppendLine($"def _vdab_render_genie_chat(state_key: str, genie_space_env_var: str, show_border: bool = False, total_height_px: int = {heightDefault}):");
        sb.AppendLine("    _vdab_input_reserve_px = 105");
        sb.AppendLine("    _vdab_messages_min_px = 180");
        sb.AppendLine("    _vdab_hist_cap = 200");
        sb.AppendLine("    try:");
        sb.AppendLine("        total_height_px = int(total_height_px)");
        sb.AppendLine("    except (TypeError, ValueError):");
        sb.AppendLine($"        total_height_px = {heightDefault}");
        sb.AppendLine($"    total_height_px = max({heightMin}, min({heightMax}, total_height_px))");
        sb.AppendLine("    messages_h = max(_vdab_messages_min_px, total_height_px - _vdab_input_reserve_px)");
        sb.AppendLine("    with st.container(border=show_border):");
        sb.AppendLine("        if show_border:");
        sb.AppendLine("            st.markdown(_vdab_genie_border_theme_css(), unsafe_allow_html=True)");
        sb.AppendLine("        conv_key = f\"vdab_genie_conversation_id_{state_key}\"");
        sb.AppendLine("        hist_key = f\"vdab_genie_hist_{state_key}\"");
        sb.AppendLine("        w = _vdab_genie_workspace_client()");
        sb.AppendLine("        try:");
        sb.AppendLine("            space_id = os.environ[genie_space_env_var]");
        sb.AppendLine("        except KeyError:");
        sb.AppendLine("            st.error(");
        sb.AppendLine("                f\"Missing environment variable {genie_space_env_var}. \"");
        sb.AppendLine("                \"Add the Genie space to App resources and redeploy.\"");
        sb.AppendLine("            )");
        sb.AppendLine("            return");
        sb.AppendLine("        if hist_key not in st.session_state:");
        sb.AppendLine("            st.session_state[hist_key] = []");
        sb.AppendLine("        pending_key = f\"vdab_genie_pending_{state_key}\"");
        sb.AppendLine("        msg_container_key = f\"vdab_genie_msgs_{state_key}\"");
        sb.AppendLine("        hist = st.session_state[hist_key]");
        sb.AppendLine("        with st.container(height=messages_h, border=False, key=msg_container_key, autoscroll=True):");
        sb.AppendLine("            st.markdown(_vdab_genie_messages_horizontal_clip_css(msg_container_key), unsafe_allow_html=True)");
        sb.AppendLine("            for msg in hist:");
        sb.AppendLine("                _vdab_genie_render_hist_entry(w, msg)");
        sb.AppendLine("            if st.session_state.get(pending_key) and hist and hist[-1].get(\"role\") == \"user\":");
        sb.AppendLine("                last_user_text = hist[-1][\"text\"]");
        sb.AppendLine("                parts = []");
        sb.AppendLine("                with st.chat_message(\"assistant\"):");
        sb.AppendLine("                    thinking_ph = st.empty()");
        sb.AppendLine("                    thinking_ph.markdown(_vdab_genie_thinking_bubbles_html(), unsafe_allow_html=True)");
        sb.AppendLine("                    try:");
        sb.AppendLine("                        if conv_key in st.session_state:");
        sb.AppendLine("                            resp = w.genie.create_message_and_wait(");
        sb.AppendLine("                                space_id=space_id,");
        sb.AppendLine("                                conversation_id=st.session_state[conv_key],");
        sb.AppendLine("                                content=last_user_text,");
        sb.AppendLine("                            )");
        sb.AppendLine("                        else:");
        sb.AppendLine("                            resp = w.genie.start_conversation_and_wait(space_id=space_id, content=last_user_text)");
        sb.AppendLine("                    except Exception as ex:");
        sb.AppendLine("                        thinking_ph.empty()");
        sb.AppendLine("                        parts = [{\"kind\": \"markdown\", \"body\": f\"**Error:** {ex}\"}]");
        sb.AppendLine("                    else:");
        sb.AppendLine("                        thinking_ph.empty()");
        sb.AppendLine("                        st.session_state[conv_key] = resp.conversation_id");
        sb.AppendLine("                        try:");
        sb.AppendLine("                            parts = _vdab_genie_assistant_parts_from_response(resp)");
        sb.AppendLine("                            if not parts:");
        sb.AppendLine("                                parts = [{\"kind\": \"markdown\", \"body\": \"_(No response content.)_\"}]");
        sb.AppendLine("                        except Exception as ex2:");
        sb.AppendLine("                            parts = [{\"kind\": \"markdown\", \"body\": f\"**Error:** {ex2}\"}]");
        sb.AppendLine("                st.session_state[pending_key] = False");
        sb.AppendLine("                hist.append({\"role\": \"assistant\", \"parts\": parts})");
        sb.AppendLine("                while len(hist) > _vdab_hist_cap:");
        sb.AppendLine("                    hist.pop(0)");
        sb.AppendLine("                st.rerun()");
        sb.AppendLine("            elif st.session_state.get(pending_key):");
        sb.AppendLine("                st.session_state[pending_key] = False");
        sb.AppendLine("        if prompt := st.chat_input(\"Ask a question…\", key=f\"vdab_genie_chat_input_{state_key}\"):");
        sb.AppendLine("            hist.append({\"role\": \"user\", \"text\": prompt})");
        sb.AppendLine("            st.session_state[pending_key] = True");
        sb.AppendLine("            while len(hist) > _vdab_hist_cap:");
        sb.AppendLine("                hist.pop(0)");
        sb.AppendLine("            st.rerun()");
        sb.AppendLine();
    }

    private static void AppendModelChatRuntimeHelpers(StringBuilder sb)
    {
        int heightDefault = ComponentHeightBounds.DefaultPixels;
        int heightMin = ComponentHeightBounds.MinPixels;
        int heightMax = ComponentHeightBounds.MaxPixels;

        string python = """"""

# Model Serving endpoint chat - endpoint name from Databricks Apps resource env (see app.yaml)
_vdab_model_w = None

def _vdab_model_workspace_client():
    global _vdab_model_w
    if _vdab_model_w is None:
        _vdab_model_w = WorkspaceClient(product=PARTNER_NAME, product_version=PARTNER_VERSION)
    return _vdab_model_w

def _vdab_model_border_theme_css():
    return """<style>
div[data-testid="stVerticalBlockBorderWrapper"] {
    border-width: 2px !important;
    border-style: solid !important;
    border-color: var(--primary-color, #2563eb) !important;
    border-radius: 0.5rem !important;
    background-color: var(--secondary-background-color, #f0f2f6) !important;
    padding: 0.35rem 0.5rem !important;
}
</style>"""

def _vdab_model_thinking_bubbles_html():
    return '''<style>
@keyframes vdab_model_think_bounce {
    0%, 80%, 100% { transform: translateY(0); opacity: 0.35; }
    40% { transform: translateY(-7px); opacity: 1; }
}
.vdab-model-thinking-wrap { display: flex; align-items: center; gap: 0.45rem;
    padding: 0.4rem 0 0.6rem 0; min-height: 1.5rem; flex-wrap: nowrap; }
.vdab-model-thinking-dot {
    width: 0.55rem; height: 0.55rem; border-radius: 9999px;
    background: var(--primary-color, #2563eb);
    animation: vdab_model_think_bounce 0.95s ease-in-out infinite;
}
.vdab-model-thinking-wrap .vdab-model-thinking-dot:nth-of-type(1) { animation-delay: 0s; }
.vdab-model-thinking-wrap .vdab-model-thinking-dot:nth-of-type(2) { animation-delay: 0.18s; }
.vdab-model-thinking-wrap .vdab-model-thinking-dot:nth-of-type(3) { animation-delay: 0.36s; }
</style>
<div class="vdab-model-thinking-wrap" aria-hidden="true">
<span class="vdab-model-thinking-dot"></span>
<span class="vdab-model-thinking-dot"></span>
<span class="vdab-model-thinking-dot"></span>
</div>'''

def _vdab_model_messages_horizontal_clip_css(container_key: str):
    return f"""<style>
div.st-key-{container_key} {{
    overflow-x: hidden !important;
    max-width: 100%;
}}
div.st-key-{container_key} pre {{
    white-space: pre-wrap !important;
    word-break: break-word;
}}
</style>"""

def _vdab_model_describe_response_shape(resp) -> str:
    try:
        if hasattr(resp, "as_dict"):
            resp = resp.as_dict()
        if isinstance(resp, dict):
            return f"top-level keys: {', '.join(str(key) for key in resp.keys())}"
        return f"response type: {type(resp).__name__}"
    except Exception:
        return f"response type: {type(resp).__name__}"

def _vdab_model_as_dict(value):
    if isinstance(value, dict):
        return value
    if hasattr(value, "as_dict"):
        return value.as_dict()
    return None

def _vdab_model_responses_agent_payload(resp):
    payload = _vdab_model_as_dict(resp)
    if not isinstance(payload, dict):
        return None
    if isinstance(payload.get("output"), list):
        return payload
    predictions = payload.get("predictions")
    if isinstance(predictions, dict) and isinstance(predictions.get("output"), list):
        return predictions
    if isinstance(predictions, list) and len(predictions) == 1:
        first_prediction = predictions[0]
        if isinstance(first_prediction, dict) and isinstance(first_prediction.get("output"), list):
            return first_prediction
    return None

def _vdab_model_extract_responses_agent_text(resp) -> str:
    payload = _vdab_model_responses_agent_payload(resp)
    if payload is None:
        raise ValueError(
            "Endpoint response did not match the ResponsesAgent schema "
            f"(expected output[]; {_vdab_model_describe_response_shape(resp)})."
        )

    text_parts = []
    for output_item in payload["output"]:
        if not isinstance(output_item, dict):
            continue
        if output_item.get("type") != "message" or output_item.get("role") != "assistant":
            continue
        content_items = output_item.get("content")
        if not isinstance(content_items, list):
            continue
        for content_item in content_items:
            if not isinstance(content_item, dict):
                continue
            if content_item.get("type") == "output_text" and isinstance(content_item.get("text"), str):
                text = content_item["text"].strip()
                if text:
                    text_parts.append(text)

    if not text_parts:
        raise ValueError(
            "Endpoint response matched ResponsesAgent output[], but did not contain "
            "assistant message content with type output_text and text."
        )

    return "\n".join(text_parts)

def _vdab_model_build_input(hist):
    endpoint_input = []
    for msg in hist:
        role = msg.get("role")
        content = msg.get("content")
        if role in ("user", "assistant") and content:
            endpoint_input.append({"role": role, "content": content})
    return endpoint_input

def _vdab_model_error_message(ex) -> str:
    error_type = type(ex).__name__
    error_text = str(ex).strip() or "No error details were returned."
    return f"Model serving endpoint query failed ({error_type}): {error_text}"

def _vdab_model_query_text(w, endpoint_name: str, endpoint_input) -> str:
    resp = w.api_client.do(
        method="POST",
        path=f"/serving-endpoints/{endpoint_name}/invocations",
        body={"input": endpoint_input},
    )
    return _vdab_model_extract_responses_agent_text(resp)

def _vdab_model_render_hist_entry(msg):
    role = msg.get("role")
    content = msg.get("content") or ""
    if role not in ("user", "assistant"):
        return
    with st.chat_message(role):
        st.markdown(content)

def _vdab_render_model_chat(
    state_key: str,
    serving_endpoint_env_var: str,
    show_border: bool = False,
    total_height_px: int = __HEIGHT_DEFAULT__,
):
    _vdab_input_reserve_px = 105
    _vdab_messages_min_px = 180
    _vdab_hist_cap = 200
    try:
        total_height_px = int(total_height_px)
    except (TypeError, ValueError):
        total_height_px = __HEIGHT_DEFAULT__
    total_height_px = max(__HEIGHT_MIN__, min(__HEIGHT_MAX__, total_height_px))
    messages_h = max(_vdab_messages_min_px, total_height_px - _vdab_input_reserve_px)
    with st.container(border=show_border):
        if show_border:
            st.markdown(_vdab_model_border_theme_css(), unsafe_allow_html=True)
        hist_key = f"vdab_model_hist_{state_key}"
        w = _vdab_model_workspace_client()
        try:
            endpoint_name = os.environ[serving_endpoint_env_var]
        except KeyError:
            st.error(
                f"Missing environment variable {serving_endpoint_env_var}. "
                "Add the serving endpoint to App resources with CAN_QUERY permission and redeploy."
            )
            return
        if hist_key not in st.session_state:
            st.session_state[hist_key] = []
        pending_key = f"vdab_model_pending_{state_key}"
        error_key = f"vdab_model_error_{state_key}"
        msg_container_key = f"vdab_model_msgs_{state_key}"
        hist = st.session_state[hist_key]
        with st.container(height=messages_h, border=False, key=msg_container_key, autoscroll=True):
            st.markdown(_vdab_model_messages_horizontal_clip_css(msg_container_key), unsafe_allow_html=True)
            for msg in hist:
                _vdab_model_render_hist_entry(msg)
            if st.session_state.get(error_key):
                st.error(st.session_state[error_key])
            if st.session_state.get(pending_key) and hist and hist[-1].get("role") == "user":
                endpoint_input = _vdab_model_build_input(hist)
                assistant_text = ""
                error_text = ""
                with st.chat_message("assistant"):
                    thinking_ph = st.empty()
                    thinking_ph.markdown(_vdab_model_thinking_bubbles_html(), unsafe_allow_html=True)
                    try:
                        assistant_text = _vdab_model_query_text(w, endpoint_name, endpoint_input)
                        thinking_ph.empty()
                        st.markdown(assistant_text)
                    except Exception as ex:
                        thinking_ph.empty()
                        error_text = _vdab_model_error_message(ex)
                st.session_state[pending_key] = False
                if error_text:
                    st.session_state[error_key] = error_text
                    if hist and hist[-1].get("role") == "user":
                        hist.pop()
                else:
                    st.session_state[error_key] = ""
                    hist.append({"role": "assistant", "content": assistant_text or "_(No response content.)_"})
                while len(hist) > _vdab_hist_cap:
                    hist.pop(0)
                st.rerun()
            elif st.session_state.get(pending_key):
                st.session_state[pending_key] = False
        if prompt := st.chat_input("Ask a question...", key=f"vdab_model_chat_input_{state_key}"):
            st.session_state[error_key] = ""
            hist.append({"role": "user", "content": prompt})
            st.session_state[pending_key] = True
            while len(hist) > _vdab_hist_cap:
                hist.pop(0)
            st.rerun()

"""""";
        python = python
            .Replace("__HEIGHT_DEFAULT__", heightDefault.ToString())
            .Replace("__HEIGHT_MIN__", heightMin.ToString())
            .Replace("__HEIGHT_MAX__", heightMax.ToString());
        sb.Append(python);
    }
}
