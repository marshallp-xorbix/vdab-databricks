import streamlit as st
import html
import json
import os
import urllib.error
import urllib.parse
import urllib.request

st.set_page_config(page_title='Support assistant', layout='wide')
st.title('Support assistant')

st.markdown("""<style>
  .block-container { max-width: 730px; }
</style>""", unsafe_allow_html=True)

ui_overrides = {'labels': {}}
_VDAB_MODEL_CHAT_MAX_HISTORY = 40
_VDAB_MODEL_CHAT_MAX_CONTEXT_MESSAGES = 20
_VDAB_MODEL_CHAT_MAX_CONTEXT_CHARS = 40000
_VDAB_MODEL_CHAT_MAX_INPUT_CHARS = 8000
_VDAB_MODEL_CHAT_MAX_OUTPUT_CHARS = 100000
_VDAB_MODEL_CHAT_MAX_RESPONSE_BYTES = 300000
_VDAB_MODEL_CHAT_REQUEST_TIMEOUT_SECONDS = 60

class _VDABModelChatNoRedirectHandler(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request: urllib.request.Request, file_pointer: object, status_code: int, message: str, headers: object, new_url: str) -> urllib.request.Request | None:
        return None

_VDAB_MODEL_CHAT_OPENER = urllib.request.build_opener(_VDABModelChatNoRedirectHandler())

def _vdab_model_chat_context(history: list[dict[str, str]]) -> list[dict[str, str]]:
    context: list[dict[str, str]] = []
    context_char_count = 0
    for message in reversed(history):
        role = message.get('role')
        content = message.get('content')
        if role not in ('user', 'assistant') or not isinstance(content, str):
            continue
        bounded_content = content[:_VDAB_MODEL_CHAT_MAX_INPUT_CHARS]
        if len(context) >= _VDAB_MODEL_CHAT_MAX_CONTEXT_MESSAGES:
            break
        if context_char_count + len(bounded_content) > _VDAB_MODEL_CHAT_MAX_CONTEXT_CHARS:
            break
        context.append({'role': role, 'content': bounded_content})
        context_char_count += len(bounded_content)
    context.reverse()
    return context

def _vdab_model_chat_request(endpoint_name: str, messages: list[dict[str, str]]) -> tuple[str | None, str | None]:
    workspace_host = os.environ.get('DATABRICKS_HOST', '').strip()
    access_token = st.context.headers.get('x-forwarded-access-token', '')
    if workspace_host == '' or access_token == '':
        return None, 'Open this app through Databricks and sign in before using ModelChat.'
    parsed_workspace_host = urllib.parse.urlsplit(workspace_host)
    if parsed_workspace_host.scheme != 'https' or not parsed_workspace_host.hostname or parsed_workspace_host.username or parsed_workspace_host.password or parsed_workspace_host.path not in ('', '/') or parsed_workspace_host.query or parsed_workspace_host.fragment:
        return None, 'The installed workspace address is not configured safely.'
    endpoint_path = urllib.parse.quote(endpoint_name, safe='')
    endpoint_url = f'{parsed_workspace_host.scheme}://{parsed_workspace_host.netloc}/serving-endpoints/{endpoint_path}/invocations'
    request_body = json.dumps({'messages': messages, 'temperature': 0.2, 'max_tokens': 1024, 'stream': False}, ensure_ascii=False).encode('utf-8')
    request = urllib.request.Request(endpoint_url, data=request_body, headers={'Authorization': f'Bearer {access_token}', 'Content-Type': 'application/json', 'Accept': 'application/json'}, method='POST')
    try:
        with _VDAB_MODEL_CHAT_OPENER.open(request, timeout=_VDAB_MODEL_CHAT_REQUEST_TIMEOUT_SECONDS) as response:
            response_bytes = response.read(_VDAB_MODEL_CHAT_MAX_RESPONSE_BYTES + 1)
        if len(response_bytes) > _VDAB_MODEL_CHAT_MAX_RESPONSE_BYTES:
            return None, 'The serving endpoint response was too large to display.'
        response_body = json.loads(response_bytes.decode('utf-8'))
    except urllib.error.HTTPError as error:
        if error.code == 401:
            return None, 'Databricks sign-in expired. Refresh this app and sign in again.'
        if error.code == 403:
            return None, 'This viewer cannot query the endpoint. Confirm the model-serving scope and this viewer’s endpoint permission.'
        if error.code == 429:
            return None, 'The serving endpoint is rate limited. Try again shortly.'
        return None, f'The serving endpoint request failed (HTTP {error.code}). Confirm that the endpoint is ready and supports chat requests.'
    except urllib.error.URLError:
        return None, 'The serving endpoint could not be reached. Try again after checking workspace access.'
    except (TimeoutError, OSError):
        return None, 'The serving endpoint request timed out. Try again shortly.'
    except (UnicodeDecodeError, ValueError):
        return None, 'The serving endpoint returned an invalid chat response.'
    if not isinstance(response_body, dict):
        return None, 'The selected endpoint did not return a compatible chat response.'
    choices = response_body.get('choices')
    if not isinstance(choices, list) or not choices or not isinstance(choices[0], dict):
        return None, 'The selected endpoint did not return a compatible chat response.'
    message = choices[0].get('message')
    if not isinstance(message, dict) or not isinstance(message.get('content'), str):
        return None, 'The selected endpoint did not return a compatible chat response.'
    answer = message['content']
    if len(answer) > _VDAB_MODEL_CHAT_MAX_OUTPUT_CHARS:
        return None, 'The serving endpoint response exceeded the display limit.'
    return answer, None

def _vdab_render_model_chat(component_key: str, endpoint_name: str) -> None:
    history_key = f'_vdab_model_chat_{component_key}'
    history = st.session_state.get(history_key, [])
    if not isinstance(history, list):
        history = []
    history = [message for message in history if isinstance(message, dict) and message.get('role') in ('user', 'assistant') and isinstance(message.get('content'), str)][-_VDAB_MODEL_CHAT_MAX_HISTORY:]
    for message in history:
        with st.chat_message(message['role']):
            st.markdown(message['content'])
    prompt = st.chat_input('Send a message', key=f'{component_key}_input', max_chars=_VDAB_MODEL_CHAT_MAX_INPUT_CHARS)
    if prompt:
        user_message = prompt.strip()[:_VDAB_MODEL_CHAT_MAX_INPUT_CHARS]
        if user_message == '':
            st.info('Enter a message to start the conversation.')
            return
        history.append({'role': 'user', 'content': user_message})
        with st.chat_message('user'):
            st.markdown(user_message)
        with st.chat_message('assistant'):
            with st.spinner('Thinking…'):
                answer, error_message = _vdab_model_chat_request(endpoint_name, _vdab_model_chat_context(history))
            if error_message:
                st.error(error_message)
            elif answer is not None:
                st.markdown(answer)
                history.append({'role': 'assistant', 'content': answer})
        st.session_state[history_key] = history[-_VDAB_MODEL_CHAT_MAX_HISTORY:]

with st.container(height=720, border=True):
    st.markdown('**' + html.escape('Support chat') + '**')
    if 'support-chat' == '':
        st.info('Select a serving endpoint from this workspace in the builder, then save and regenerate this app.')
    else:
        _vdab_render_model_chat('vdab_modelchat1', 'support-chat')
