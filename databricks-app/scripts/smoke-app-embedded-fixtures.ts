/** Builds a deterministic fixture for the packaged standalone app smoke. */
export function createSmokeEmbeddedFixtures(): unknown[] {
  const dashboardEmbedDefinition = {
    key: "smoke-dashboard-embed",
    type: "DashboardEmbed",
    schemaVersion: 1,
    componentVersion: 1,
    codeName: "smokeDashboardEmbed",
    description: null,
    properties: {
      src: "https://former-workspace.cloud.databricks.com/embed/dashboardsv3/customer_dashboard?o=123456&fullscreenWidget=page_1~widget_2",
      height: 720,
      scrolling: false,
    },
    bindings: null,
    children: [],
    layout: null,
  };
  const genieChatDefinition = {
    key: "smoke-genie-chat",
    type: "GenieChat",
    schemaVersion: 1,
    componentVersion: 1,
    codeName: "smokeGenieChat",
    description: null,
    properties: {
      genieSpaceId: "0123456789abcdef0123456789abcdef",
      genieSpaceTitle: "Sample Genie Space",
      title: "Workspace Genie",
      showBorder: true,
      chatTotalHeightPixels: 600,
    },
    bindings: null,
    children: [],
    layout: null,
  };
  const modelChatDefinition = {
    key: "smoke-model-chat",
    type: "ModelChat",
    schemaVersion: 1,
    componentVersion: 1,
    codeName: "smokeModelChat",
    description: null,
    properties: {
      servingEndpointName: "sample-chat-endpoint",
      title: "Workspace model chat",
      showBorder: true,
      chatTotalHeightPixels: 600,
    },
    bindings: null,
    children: [],
    layout: null,
  };
  return [
    dashboardEmbedDefinition,
    genieChatDefinition,
    modelChatDefinition,
  ];
}
