# Model Chat VDAB Component Walkthrough

Model Chat lets a VDAB app include a chat UI backed by an existing Databricks Model Serving endpoint. The endpoint must implement the Databricks Responses API contract: it accepts `{"input": [{"role", "content"}, …]}` and returns a ResponsesAgent-style `output[]` whose assistant message content items have `type: "output_text"`. Chat-completions (`{"messages": […]}` → `choices[]`), embedding, and custom instances endpoints are not supported.

## 1. Prepare a Model Serving endpoint

1. In Databricks, create or identify a Model Serving endpoint that serves a ResponsesAgent (e.g. an mlflow.pyfunc ResponsesAgent), not a messages-only ChatModel/ChatAgent endpoint.
2. Confirm the endpoint is ready before using it in a deployed app.
3. Note the endpoint name. VDAB references existing endpoints; it does not create endpoints for you.

## 2. Add the Serving endpoint resource to the VDAB app

1. Open the VDAB app and go to App Settings.
2. Select the Resources tab.
3. Select Edit.
4. Choose Serving endpoint as the resource type and add it.
5. Pick the Databricks endpoint in the Details column.
6. Set permission to CAN_QUERY or CAN_MANAGE. CAN_QUERY is the recommended least-privilege option for chat.
7. Save resources and note the resource Key, such as `sales-agent-endpoint`.

## 3. Add the Model Chat component

1. Navigate to the canvas where the chat should appear.
2. Drag the Model Chat component from the Visualization palette onto the canvas.
3. In the properties panel, select the Serving endpoint app resource Key.
4. Optionally set a designer title, border, and chat height.
5. Save and deploy the app.

## 4. Use the deployed chat

1. Launch the deployed Databricks app.
2. Open the page or modal containing Model Chat.
3. Ask a question in the chat input.
4. The app sends the conversation history to the configured serving endpoint using the Databricks SDK.

## Notes

- Model Chat is a deployed-app runtime feature. The VDAB builder shows a static design-time preview only.
- Model Chat issues a single non-streaming POST per turn and renders the full reply when it returns; on failure it shows an error in the chat area. Streaming and automatic retry are not implemented.
- Non-ResponsesAgent endpoints such as chat-completions, embeddings, or custom `instances` payloads are not supported by this component.
