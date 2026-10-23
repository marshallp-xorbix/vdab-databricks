# VDAB Process Diagrams

> **Legacy SaaS architecture diagrams:** These diagrams document the former application flows and are not the standalone Node/Databricks architecture. See the [active Node architecture](standards/node-databricks-app-architecture.md) and [transition plan](databricks-app-transition/README.md).

Six architectural process diagrams showing how key systems work in the Visual Databricks App Builder.

---

## 1. Storing App Components

How components are saved from the builder canvas to the database and loaded back.

```mermaid
flowchart TD
    subgraph Frontend ["Frontend (React)"]
        A["User drops/edits component on Canvas"]
        B["VdabComponent state updated (id, codeName, type, props, bindings, children, layout)"]
        C["Canvas calls upsertAppComponents API"]
        L["Canvas loads: GET /api/AppComponent/app/{appId}"]
        M["Components organized intocontext groups (page_1, modals)"]
    end

    subgraph Server ["Server (.NET)"]
        D["AppComponentController receives UpsertAppComponentRequest"]
        E["AppComponentService.UpsertAppComponentAsync()"]
        F{"Component has existing ID?"}
        G["Validate: AppId exists, ComponentType valid, Properties JSON not empty, Layout JSON valid"]
        H["UPDATE existing AppComponent entity"]
        I["CREATE new AppComponent entity"]
        J["AppComponentRepository .AddAsync() / .UpdateAsync()"]
        N["GetComponentsByContextAsync() DFS traversal for modal ownership"]
    end

    subgraph Database ["SQL Server"]
        K[("AppComponents table PkId, AppId, CodeName, ComponentType, Properties, Bindings, Children, Layout")]
    end

    A --> B --> C --> D --> G --> E --> F
    F -- "Yes (Id > 0)" --> H --> J --> K
    F -- "No (new)" --> I --> J
    L --> N --> K
    K --> M
```

> [!NOTE]
> **Batch upsert**: The canvas typically uses `UpsertAppComponentsBatchAsync()` in `Xorbix-Visual-Databricks-App-Builder.Services/AppComponentService.cs`, which iterates over each component calling the single upsert. Failed items are logged but don't block the batch.

---

## 2. Layout System

How components are positioned on the canvas using a Streamlit-style vertical layout strategy.

```mermaid
flowchart TD
    subgraph Strategy ["Layout Strategy"]
        A["Streamlit-style: non-absolute, inline vertical layout"]
        B["No absolute coordinates (no x/y pixel positioning)"]
        C["Container components (Columns, Rows, Tabs, Expander) manage child positioning"]
    end

    subgraph LayoutData ["Layout JSON on AppComponent"]
        D["Stored as JSON string: e.g. {\'y\': 3} or {\'tabIndex\': 1, \'y\': 0}"]
        E["LayoutJsonHelper .ParseLayoutY() Returns y position or MaxValue"]
        F["LayoutJsonHelper .ParseTabIndex() Returns tab pane index or 0"]
    end

    subgraph Containers ["Container Components"]
        G["Columns: splits into N columns children distributed by layout JSON"]
        H["Rows: vertical stack of children"]
        I["Tabs: children grouped by tabIndex from layout JSON, rendered per pane"]
        J["Expander: collapsible section children rendered inside"]
        K["Form: groups children with submit button"]
        L["Modal: children shown in overlay dialog (separate context)"]
    end

    subgraph Rendering ["Rendering Flow"]
        M["CanvasRenderer reads component tree top-down"]
        N["componentRendererFactory .getRenderer(component.Type)"]
        O["Container renderers recursively render their children[]"]
        P["Children sorted by y position using LayoutJsonHelper"]
    end

    A --> B
    B --> C
    C --> G & H & I & J & K & L
    D --> E & F
    M --> N --> O --> P
    E --> P
    F --> I
```

---

## 3. Deployment

End-to-end flow from builder canvas to a running Databricks App (Streamlit).

```mermaid
flowchart TD
    subgraph Frontend ["Frontend"]
        A["User clicks Deploy"]
        B["Send SimpleDeployRequest (appId, databricksAppName, targetPath, formComponents, workflowDefinition)"]
    end

    subgraph DeployService ["DeployService"]
        C["SimpleDeployAsync()"]
        D["Load App → get WorkspaceConnectionId"]
        E["Load DatabricksConnection → get WorkspaceUrl"]
        F["Validate codeName uniqueness & format"]
    end

    subgraph CodeGen ["Code Generation"]
        G["StreamlitTemplateService .GenerateStreamlitAppFromVdabComponents()"]
        H["Each IComponentService .GenerateStreamlitCode()"]
        I["Generate app.py (Streamlit Python code)"]
        J["Generate requirements.txt"]
        K["Generate app.yaml"]
        L["Generate .streamlit/config.toml (theme from App.Theme)"]
    end

    subgraph Upload ["Upload to Databricks Workspace"]
        M["Create workspace folders POST /api/2.0/workspace/mkdirs"]
        N["Delete existing files POST /api/2.0/workspace/delete"]
        O["Upload each artifact POST /api/2.0/workspace/import (Base64 encoded content)"]
    end

    subgraph Deploy ["Deploy as Databricks App"]
        P["POST /api/2.0/apps/{appName}/deployments mode: SNAPSHOT source_code_path: uploadPath"]
        Q["Return DeployAppFromFolderResult (appUrl, deploymentId)"]
    end

    A --> B --> C --> D --> E --> F
    F --> G --> H --> I
    G --> J & K & L
    I --> M --> N --> O
    O --> P --> Q
```

> [!IMPORTANT]
> **Code preview** is also available via `PreviewGeneratedCodeAsync()` in `Xorbix-Visual-Databricks-App-Builder.Services/DeployService.cs` — same code generation pipeline but without the upload/deploy steps. Users can inspect `app.py`, `requirements.txt`, etc. before deploying.

---

## 4. Bindings

How components connect to Databricks data sources through the binding system.

```mermaid
flowchart TD
    subgraph Definition ["Binding Schema Definition (Backend)"]
        A["BindingDefinitionService registers available binding types"]
        B["unityCatalogTable Editor: UnityCatalogTableSelector Value: catalog.schema.table"]
        C["databricksVolume Editor: DatabricksVolumeSelector Value: catalog.schema.volume/filePath"]
        D["lakebaseProvisionedDatabase Editor: LakebaseProvisionedDatabaseSelector Value: database.schema.table"]
    end

    subgraph Registry ["Component Registry"]
        E["Each component declares supportedBindings[] e.g. ['unityCatalogTable']"]
        F["ComponentRegistryResponseDto includes BindingSchemas[]"]
        G["Frontend receives registry at app startup via ComponentRegistryContext"]
    end

    subgraph ComponentBinding ["Binding on a Component"]
        H["VdabComponent.bindings Record<string, Binding>"]
        I["Binding structure: bindingType: string source: BindingSource"]
        J["BindingSource: kind: resource | workflowOutput |        componentValue | triggerPayload | appState path?: string resource?: ResourceBindingSource"]
        K["ResourceBindingSource: type, catalog, schema, table, database, volume, filePath, columns"]
    end

    subgraph Persistence ["Storage & Code Generation"]
        L["Bindings serialized as JSON string on AppComponent"]
        M["During deployment, Streamlit code reads binding config to generate data loading code"]
    end

    A --> B & C & D
    E --> F --> G
    H --> I --> J --> K
    H --> L --> M
```

---

## 5. Properties

How component properties are defined, edited, and persisted throughout the system.

```mermaid
flowchart TD
    subgraph Registry ["Component Registry (Backend)"]
        A["Each IComponentService implements GetDefinition()"]
        B["Returns VdabComponentDto with: - Default props - PropSchema metadata - SupportedEvents - SupportedBindings"]
        C["BaseComponentService provides common prop defaults (label, description, etc.)"]
    end

    subgraph Frontend ["Frontend Property Flow"]
        D["ComponentRegistryContext fetches registry on startup GET /api/canvas/registry"]
        E["User drops component on canvas → creates VdabComponent with registry default props"]
        F["User selects component → PropertiesPanel opens"]
        G["PropertiesPanel renders prop editors based on registry propSchema"]
        H["User edits property → VdabComponent.props updated in state"]
    end

    subgraph Persistence ["Persistence"]
        I["Properties serialized as JSON string"]
        J["Upsert to AppComponent via AppComponentService"]
        K[("AppComponents.Properties column in SQL Server")]
    end

    subgraph CodeGen ["Code Generation"]
        L["StreamlitTemplateService reads props JSON"]
        M["IComponentService .GenerateStreamlitCode() translates props to Streamlit widget parameters"]
    end

    A --> B
    C --> A
    D --> E --> F --> G --> H
    H --> I --> J --> K
    I --> L --> M
```

> [!TIP]
> **Props are dynamic** — `Record<string, any>` validated by the registry schema at the frontend. Backend validates non-empty JSON but doesn't enforce individual property schemas beyond specific component-level validation (e.g., Tabs requires `≥1` tab, names `≤100` chars).

---

## 6. Databricks Connections

How users authenticate and maintain connections to Databricks workspaces.

```mermaid
flowchart TD
    subgraph Setup ["Connection Setup"]
        A["Admin creates connection: WorkspaceUrl, DisplayName, ClientId, ClientSecret, TokenTTL, RefreshLifespan"]
        B["DatabricksConnectionController POST /api/databricks-connection"]
        C["DatabricksConnectionService .AddOrUpdateConnectionAsync()"]
        D[("DatabricksConnections table PkId, TenantId, OwnerId, WorkspaceUrl, ClientId, ClientSecret (encrypted)")]
    end

    subgraph OAuth ["OAuth Flow"]
        E["User initiates OAuth → redirected to Databricks login page"]
        F["Databricks returns authorization code"]
        G["ExchangeTokenAsync() POST to Databricks /oidc/v1/token grant_type: authorization_code"]
        H["Receive access_token + refresh_token"]
        I["Store encrypted refresh_token in DatabricksUserTokens"]
    end

    subgraph TokenMgmt ["Token Management"]
        J["GetValidAccessTokenAsync() called before any API request"]
        K{"Cached access token available?"}
        L["DatabricksAccessTokenCache (in-memory with TTL)"]
        M["RefreshAccessTokenAsync() POST /oidc/v1/token grant_type: refresh_token"]
        N["Parse response: new access_token + optional rotated refresh_token"]
        O{"New refresh token returned?"}
        P["Rotate: save new refresh_token + update expiration"]
        Q["Cache new access_token with configured TTL"]
        R["Return valid access token"]
    end

    subgraph Concurrency ["Concurrency Control"]
        S["SemaphoreSlim per user:workspace pair prevents parallel token refreshes"]
    end

    A --> B --> C --> D
    E --> F --> G --> H --> I
    J --> K
    K -- "Yes" --> R
    K -- "No (cache miss)" --> M --> N --> O
    O -- "Yes" --> P --> Q --> R
    O -- "No" --> Q
    S --> J
```

> [!IMPORTANT]
> **Token lifecycle**: Access tokens are short-lived (configurable TTL via `AccessTokenTtlMinutes`). Refresh tokens can live up to 90 days (`RefreshTokenLifespanMinutes`). If a refresh token expires, the user must re-authenticate via OAuth.
