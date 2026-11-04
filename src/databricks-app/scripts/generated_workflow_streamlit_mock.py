"""Small Streamlit-compatible fake used by generated-app offline tests."""

from __future__ import annotations

import types
from collections.abc import Callable
from typing import cast

from generated_workflow_test_support import ACCESS_TOKEN, TEXT_INPUT_VALUE

class FakeStreamlit:
    """Record generated UI callbacks and side effects without Streamlit."""

    def __init__(self, *, submit_form: bool = False) -> None:
        self.module = types.ModuleType("streamlit")
        self.module.__path__ = []
        self.module.session_state = {}
        self.module.context = types.SimpleNamespace(
            headers={
                "x-forwarded-access-token": ACCESS_TOKEN,
                "x-forwarded-email": "viewer@example.com",
            }
        )
        self.module.set_page_config = self._noop
        self.module.title = self._noop
        self.module.subheader = self._noop
        self.module.write = self._noop
        self.module.info = self._info
        self.module.markdown = self._noop
        self.module.caption = self._noop
        self.module.error = self._error
        self.module.toast = self._toast
        self.module.dataframe = self._noop
        self.module.form = self._form
        self.module.form_submit_button = self._form_submit_button
        self.module.button = self._button
        self.module.text_input = self._text_input
        self.module.dialog = self._dialog
        self.module.rerun = self._noop
        self.module.__getattr__ = self._missing_streamlit_attribute
        self.components_module = types.ModuleType("streamlit.components")
        self.components_module.__path__ = []
        self.components_v1_module = types.ModuleType("streamlit.components.v1")
        self.components_v1_module.html = self._noop
        self.components_v1_module.iframe = self._noop
        self.components_module.v1 = self.components_v1_module
        self.submit_form = submit_form
        self.buttons: list[dict[str, object]] = []
        self.toasts: list[dict[str, object]] = []
        self.errors: list[str] = []
        self.infos: list[str] = []
        self.dialog_calls: list[str] = []

    def _noop(self, *arguments: object, **keywords: object) -> None:
        del arguments, keywords

    def _missing_streamlit_attribute(self, name: str) -> Callable[..., object]:
        context_attributes = {"columns", "container", "expander", "tabs"}
        value_attributes = {
            "checkbox",
            "chat_input",
            "date_input",
            "file_uploader",
            "multiselect",
            "number_input",
            "radio",
            "selectbox",
            "slider",
            "text_area",
            "time_input",
            "toggle",
        }
        if name in context_attributes:
            return self._layout_context
        if name in value_attributes:
            return self._widget_value
        if name in {"spinner", "chat_message"}:
            return self._context_or_decorator
        if name in {"text", "success", "warning", "vega_lite_chart", "data_editor"}:
            return self._noop
        raise AttributeError(f"The workflow smoke mock does not support st.{name}.")

    def _layout_context(
        self,
        columns: object = 1,
        *arguments: object,
        **keywords: object,
    ) -> object:
        del arguments, keywords
        column_count = columns if isinstance(columns, int) else len(columns) if isinstance(columns, list) else 1
        if column_count > 1:
            return [_NullContext() for _ in range(column_count)]
        return _NullContext()

    def _widget_value(self, *arguments: object, **keywords: object) -> object:
        del arguments
        key = keywords.get("key")
        default = keywords.get("value", keywords.get("default"))
        if isinstance(key, str):
            state = cast(dict[str, object], self.module.session_state)
            return state.setdefault(key, default)
        return default

    def _context_or_decorator(
        self,
        *arguments: object,
        **keywords: object,
    ) -> object:
        del arguments, keywords
        return _NullContext()

    def _error(self, message: object, *arguments: object, **keywords: object) -> None:
        del arguments, keywords
        self.errors.append(str(message))

    def _info(self, message: object, *arguments: object, **keywords: object) -> None:
        del arguments, keywords
        self.infos.append(str(message))

    def _toast(self, body: object, **keywords: object) -> None:
        self.toasts.append({"body": str(body), **keywords})

    def _form(self, *arguments: object, **keywords: object) -> object:
        del arguments, keywords
        return _NullContext()

    def _form_submit_button(
        self,
        *arguments: object,
        **keywords: object,
    ) -> bool:
        del arguments, keywords
        return self.submit_form

    def _button(
        self,
        label: object,
        *,
        key: object = None,
        on_click: object = None,
        args: object = (),
        **keywords: object,
    ) -> bool:
        del keywords
        if callable(on_click):
            self.buttons.append({
                "label": str(label),
                "key": key,
                "callback": on_click,
                "args": args,
            })
        return False

    def _text_input(self, *arguments: object, **keywords: object) -> str:
        del arguments
        key = keywords.get("key")
        if not isinstance(key, str):
            raise AssertionError("Generated text input did not include a widget key.")
        state = cast(dict[str, object], self.module.session_state)
        value = state.get(key, keywords.get("value", "")) or TEXT_INPUT_VALUE
        state[key] = value
        return str(value)

    def _dialog(self, title: str, **keywords: object) -> Callable[..., object]:
        del keywords

        def decorate(function: Callable[..., object]) -> Callable[..., object]:
            def invoke(*arguments: object, **call_keywords: object) -> object:
                self.dialog_calls.append(title)
                return function(*arguments, **call_keywords)

            return invoke

        return decorate

class _NullContext:
    """Context manager for generated Streamlit Form blocks."""

    def __enter__(self) -> _NullContext:
        return self

    def __exit__(
        self,
        exception_type: type[BaseException] | None,
        exception: BaseException | None,
        traceback: object,
    ) -> bool:
        return False
