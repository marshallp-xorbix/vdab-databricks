using FluentResults;
using System.Text;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Workflow;
using Xorbix_Visual_Databricks_App_Builder.Models.Workflow;
using Xorbix_Visual_Databricks_App_Builder.Models.Workflow.Actions;
using Xorbix_Visual_Databricks_App_Builder.Models.Workflow.SharedReferences;
using Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.Components;
using Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.Components.Genie;
using Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.Components.Model;
using Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.StreamlitGeneration;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults;
using Xorbix_Visual_Databricks_App_Builder.Services.Deployment;
using Xorbix_Visual_Databricks_App_Builder.Services.Workflow;
using Xorbix_Visual_Databricks_App_Builder.Services.Workflow.Parsing;
using Xorbix_Visual_Databricks_App_Builder.Services.Workflow.Validation;

namespace Xorbix_Visual_Databricks_App_Builder.Services
{
    public partial class StreamlitTemplateService : IStreamlitTemplateService
    {
        private readonly IStreamlitGenerationService _generationService;
        private readonly IWorkflowTemplateHelper _workflowTemplateHelper;

        public StreamlitTemplateService(IStreamlitGenerationService generationService, IWorkflowTemplateHelper workflowTemplateHelper)
        {
            _generationService = generationService;
            _workflowTemplateHelper = workflowTemplateHelper;
        }

        public Result<string> GenerateStreamlitAppFromVdabComponents(
            List<VdabComponentDto> components,
            string appName,
            WorkflowDefinitionDto workflowDefinition,
            int pageWidth = PageWidthBounds.DefaultPixels)
        {
            try
            {
                int resolvedPageWidth = PageWidthBounds.Clamp(pageWidth);
                StringBuilder sb = new();
                _generationService.SetWorkflowDefinition(workflowDefinition);
                Result workflowValidationResult = _workflowTemplateHelper.Validate(components, workflowDefinition);
                if (workflowValidationResult.IsFailed)
                {
                    return Result.Fail<string>(workflowValidationResult.Errors);
                }

                Result<WorkflowDefinitionModel> parsedWorkflowResult = WorkflowDefinitionParser.Parse(workflowDefinition);
                if (parsedWorkflowResult.IsFailed)
                {
                    return Result.Fail<string>(parsedWorkflowResult.Errors);
                }

                WorkflowDefinitionModel parsedWorkflowDefinition = parsedWorkflowResult.Value;

                StreamlitFeatureUsage featureUsage = AnalyzeFeatureUsage(components, parsedWorkflowDefinition, workflowDefinition);

                // Standard imports
                sb.AppendLine("import streamlit as st");
                // set_page_config must be the first Streamlit command executed on the page.
                string escapedAppName = (appName ?? string.Empty).Replace("\\", "\\\\").Replace("'", "\\'");
                sb.AppendLine($"st.set_page_config(page_title='{escapedAppName}', layout='wide')");
                sb.AppendLine();
                sb.AppendLine("import pandas as pd");
                sb.AppendLine("import numpy as np");
                sb.AppendLine("import re");
                if (featureUsage.HasDateOrTimeComponents)
                {
                    sb.AppendLine("from datetime import datetime");
                }

                if (featureUsage.HasPlotlyCharts)
                {
                    sb.AppendLine("import plotly.graph_objects as go");
                }
                
                // Add os import when env-backed resources are needed
                if (featureUsage.HasAnyLakebaseUsage
                    || featureUsage.HasGenieChatComponents
                    || featureUsage.HasModelChatComponents
                    || featureUsage.NeedsSqlConnector)
                {
                    sb.AppendLine("import os");
                }

                // Add Databricks SQL connector imports if needed
                if (featureUsage.NeedsSqlConnector)
                {
                    sb.AppendLine("from databricks import sql");
                    sb.AppendLine("from databricks.sdk.core import Config");
                }
                else if (featureUsage.NeedsWorkspaceClient)
                {
                    sb.AppendLine("from databricks.sdk.core import Config");
                }

                if (featureUsage.NeedsWorkspaceClient)
                {
                    sb.AppendLine("from databricks.sdk import WorkspaceClient");
                }

                if (featureUsage.HasAnyLakebaseUsage)
                {
                    sb.AppendLine("from sqlalchemy import create_engine, event, text");
                    sb.AppendLine("import json");
                    sb.AppendLine("import urllib.error");
                    sb.AppendLine("import urllib.request");
                }

                if (featureUsage.HasDashboardEmbedComponents || featureUsage.HasCustomHtmlStoryComponents)
                {
                    sb.AppendLine("import streamlit.components.v1 as components");
                }

                if (featureUsage.HasCustomHtmlStoryComponents && !featureUsage.HasAnyLakebaseUsage)
                {
                    sb.AppendLine("import json");
                }

                AppendPrebuiltModulesImportIfNeeded(sb, parsedWorkflowDefinition);
                sb.AppendLine("import custom_modules");
                sb.AppendLine();

                // Partner attribution constants for Databricks WAF telemetry
                if (featureUsage.NeedsSqlConnector || featureUsage.NeedsWorkspaceClient)
                {
                    sb.AppendLine("PARTNER_NAME = 'Xorbix_VisualDataAppBuilder'");
                    sb.AppendLine("PARTNER_VERSION = '1.0'");
                    sb.AppendLine("PARTNER_USER_AGENT = f'{PARTNER_NAME}/{PARTNER_VERSION}'");
                    sb.AppendLine();
                }

                // Add SQL connection helper functions if needed
                if (featureUsage.NeedsSqlConnector)
                {
                    AppendSqlConnectionHelpers(sb);
                }

                if (featureUsage.HasAnyLakebaseUsage)
                {
                    AppendLakebaseConnectionHelpers(sb);
                }

                if (featureUsage.HasGenieChatComponents)
                {
                    AppendGenieChatRuntimeHelpers(sb);
                }

                if (featureUsage.HasModelChatComponents)
                {
                    AppendModelChatRuntimeHelpers(sb);
                }

                sb.AppendLine("st.markdown(");
                sb.AppendLine("    \"\"\"");
                sb.AppendLine("<style>");
                sb.AppendLine($"  .block-container {{ max-width: {resolvedPageWidth}px; }}");
                sb.AppendLine("</style>");
                sb.AppendLine("\"\"\",");
                sb.AppendLine("    unsafe_allow_html=True,");
                sb.AppendLine(")");
                sb.AppendLine();

                if (components?.Any() == true)
                {
                    _workflowTemplateHelper.AppendRuntime(sb, workflowDefinition, components);
                    sb.AppendLine("_vdab_flush_toasts()");
                    sb.AppendLine();

                    // @st.dialog openers must be defined before any top-level widget runs; otherwise a button
                    // can call a workflow that invokes show_* before Python has executed the modal's def.
                    foreach (VdabComponentDto modal in components
                        .Where(component => component.Type == ComponentType.Modal)
                        .OrderBy(component => component.CodeName ?? string.Empty, StringComparer.Ordinal))
                    {
                        string modalCode = _generationService.GenerateComponentCode(modal, string.Empty, components);
                        sb.AppendLine(modalCode);
                        sb.AppendLine();
                    }

                    // Remaining UI: roots only (modals emitted above; other components stay under layout parents)
                    List<VdabComponentDto> rootComponents = components.Where(c =>
                        c.Type != ComponentType.Modal &&
                        !components.Any(parent => parent.Children != null && parent.Children.Contains(c.Id))
                    )
                    .OrderBy(component => component.Type == ComponentType.Modal ? 1 : 0)
                    .ThenBy(component => LayoutJsonHelper.ParseLayoutY(component.Layout))
                    .ToList();

                    // Render all root components in sequence
                    foreach (VdabComponentDto component in rootComponents)
                    {
                        string code = _generationService.GenerateComponentCode(component, "", components);
                        sb.AppendLine(code);
                        sb.AppendLine();
                    }

                    sb.AppendLine("_vdab_flush_toasts()");
                    sb.AppendLine();
                }
                else
                {
                    sb.AppendLine("st.info('No components defined. Use the app builder to add components!')");
                }

                return Result.Ok(sb.ToString());
            }
            catch (Exception ex)
            {
                return Result.Fail<string>($"Failed to generate Streamlit app: {ex.Message}");
            }
        }

        /// <inheritdoc/>
        public string GenerateRequirementsFile(List<VdabComponentDto>? components, WorkflowDefinitionDto workflowDefinition)
        {
            List<string> requirements =
            [
                "streamlit>=1.56.0",
                "pandas>=2.3.3",
                "numpy>=2.4.3"
            ];

            Result<WorkflowDefinitionModel> parsedWorkflowResult = WorkflowDefinitionParser.Parse(workflowDefinition);
            WorkflowDefinitionModel parsedWorkflowDefinition = parsedWorkflowResult.IsSuccess
                ? parsedWorkflowResult.Value
                : new WorkflowDefinitionModel();

            if (components?.Any() == true)
            {
                List<string> componentTypes = components.Select(c => c.Type.ToString().ToLowerInvariant()).Distinct().ToList();
                StreamlitFeatureUsage featureUsage = AnalyzeFeatureUsage(components, parsedWorkflowDefinition, workflowDefinition);

                void AddRequirement(string requirement)
                {
                    if (!requirements.Contains(requirement))
                    {
                        requirements.Add(requirement);
                    }
                }

                if (featureUsage.NeedsSqlConnector)
                {
                    AddRequirement("databricks-sdk>=0.99.0");
                    AddRequirement("databricks-sql-connector>=4.2.5");
                }

                if (componentTypes.Any(t => t != null && (t == "barchart" || t == "linechart" || t == "piechart" || t == "donutchart")))
                {
                    AddRequirement("plotly>=6.6.0");
                }

                if (featureUsage.HasAnyLakebaseUsage)
                {
                    AddRequirement("databricks-sdk>=0.99.0");
                    AddRequirement("psycopg[binary]");
                    AddRequirement("sqlalchemy>=2.0.48");
                }

                if (featureUsage.HasStartDatabricksJobAction)
                {
                    AddRequirement("databricks-sdk>=0.99.0");
                }

                if (componentTypes.Any(t => t != null && t == "fileupload"))
                {
                    AddRequirement("databricks-sdk>=0.99.0");
                }

                if (featureUsage.HasGenieChatComponents || featureUsage.HasModelChatComponents)
                {
                    AddRequirement("databricks-sdk>=0.99.0");
                }
            }

            return string.Join("\n", requirements) + "\n";
        }

        private static bool HasAction(WorkflowDefinitionModel workflowDefinition, WorkflowActionKind actionKind)
        {
            return workflowDefinition.Workflows
                .SelectMany(workflow => workflow.Nodes)
                .Any(node => node.ActionType == actionKind);
        }

        private static void AppendPrebuiltModulesImportIfNeeded(StringBuilder sb, WorkflowDefinitionModel parsedWorkflowDefinition)
        {
            List<CallPrebuiltModuleActionModel> prebuiltNodes = GetActions<CallPrebuiltModuleActionModel>(parsedWorkflowDefinition);
            if (prebuiltNodes.Count == 0)
            {
                return;
            }

            HashSet<string> names = new(StringComparer.Ordinal);
            foreach (CallPrebuiltModuleActionModel node in prebuiltNodes)
            {
                if (!CustomModuleFunctionNameSyntax.IsValid(node.FunctionName))
                {
                    continue;
                }

                names.Add(node.FunctionName.Trim());
            }

            if (names.Count == 0)
            {
                return;
            }

            List<string> sorted = names.OrderBy(name => name, StringComparer.Ordinal).ToList();
            sb.AppendLine($"from {PrebuiltModulesLibrary.ModuleName} import {string.Join(", ", sorted)}");
        }

        private static List<TActionModel> GetActions<TActionModel>(WorkflowDefinitionModel workflowDefinition)
            where TActionModel : WorkflowActionNodeModel
        {
            return workflowDefinition.Workflows
                .SelectMany(workflow => workflow.Nodes)
                .OfType<TActionModel>()
                .ToList();
        }

        private static bool HasRunSqlActionWithSourceKind(WorkflowDefinitionModel workflowDefinition, WorkflowSqlSourceKind sqlSourceKind)
        {
            foreach (WorkflowModel workflow in workflowDefinition.Workflows)
            {
                Dictionary<string, WorkflowActionNodeModel> nodesById = workflow.Nodes
                    .Where(node => !string.IsNullOrWhiteSpace(node.Id))
                    .ToDictionary(node => node.Id, StringComparer.Ordinal);

                foreach (RunSqlActionModel runSqlNode in workflow.Nodes.OfType<RunSqlActionModel>())
                {
                    if (!nodesById.TryGetValue(runSqlNode.Statement.NodeId, out WorkflowActionNodeModel? sourceNode) ||
                        sourceNode is not BuildSqlActionModel buildSqlNode)
                    {
                        continue;
                    }

                    if (buildSqlNode.SqlSourceKind == sqlSourceKind)
                    {
                        return true;
                    }
                }
            }

            return false;
        }

        private static StreamlitFeatureUsage AnalyzeFeatureUsage(
            List<VdabComponentDto>? components,
            WorkflowDefinitionModel workflowDefinition,
            WorkflowDefinitionDto workflowDefinitionDto)
        {
            bool hasPlotlyCharts = components?.Any(c =>
                c.Type == ComponentType.BarChart ||
                c.Type == ComponentType.LineChart ||
                c.Type == ComponentType.PieChart ||
                c.Type == ComponentType.DonutChart) ?? false;

            bool hasDateOrTimeComponents = components?.Any(c =>
                c.Type == ComponentType.DatePicker ||
                c.Type == ComponentType.TimePicker) ?? false;

            bool hasLakebaseBindings = components?.Any(c =>
                c.Bindings != null
                && (c.Bindings.ContainsKey(WorkflowParserTokens.SqlSourceKind.LakebaseProvisionedDatabase)
                    || c.Bindings.ContainsKey(WorkflowParserTokens.SqlSourceKind.LakebaseAutoscaling))) ?? false;

            bool hasFileUploadComponents = components?.Any(c => c.Type == ComponentType.FileUpload) ?? false;

            bool hasDashboardEmbedComponents = components?.Any(c => c.Type == ComponentType.DashboardEmbed) ?? false;

            bool hasCustomHtmlStoryComponents = components?.Any(c =>
                c.Type == ComponentType.AmoebaStory ||
                c.Type == ComponentType.NetworkWebStory ||
                c.Type == ComponentType.TerrainStory ||
                c.Type == ComponentType.HeatMapStory ||
                c.Type == ComponentType.PulseWaveStory ||
                c.Type == ComponentType.FlowFieldStory ||
                c.Type == ComponentType.HoneycombStory ||
                c.Type == ComponentType.SpiralStory) ?? false;

            bool hasGenieChatComponents = components?.Any(c => c.Type == ComponentType.GenieChat) ?? false;

            bool hasModelChatComponents = components?.Any(c => c.Type == ComponentType.ModelChat) ?? false;

            List<SaveToTableActionModel> saveToTableNodes = GetActions<SaveToTableActionModel>(workflowDefinition);
            bool hasLakebaseSaveToTableAction = saveToTableNodes.Any(node =>
                node.TargetTable is LakebaseTableRef or LakebaseAutoscalingTableRef);
            bool hasLakebaseRunSqlAction =
                HasRunSqlActionWithSourceKind(workflowDefinition, WorkflowSqlSourceKind.LakebaseProvisionedDatabase)
                || HasRunSqlActionWithSourceKind(workflowDefinition, WorkflowSqlSourceKind.LakebaseAutoscaling);
            bool hasStartDatabricksJobAction = HasAction(workflowDefinition, WorkflowActionKind.StartDatabricksJob);
            bool hasCallPrebuiltModuleAction = HasAction(workflowDefinition, WorkflowActionKind.CallPrebuiltModule);

            bool hasAnyLakebaseUsage = hasLakebaseBindings || hasLakebaseSaveToTableAction || hasLakebaseRunSqlAction;

            return new StreamlitFeatureUsage
            {
                HasDateOrTimeComponents = hasDateOrTimeComponents,
                HasPlotlyCharts = hasPlotlyCharts,
                HasDashboardEmbedComponents = hasDashboardEmbedComponents,
                HasCustomHtmlStoryComponents = hasCustomHtmlStoryComponents,
                HasGenieChatComponents = hasGenieChatComponents,
                HasModelChatComponents = hasModelChatComponents,
                HasStartDatabricksJobAction = hasStartDatabricksJobAction,
                HasCallPrebuiltModuleAction = hasCallPrebuiltModuleAction,
                HasAnyLakebaseUsage = hasAnyLakebaseUsage,
                NeedsSqlConnector = SqlWarehouseDeploymentValidator.RequiresUnitySqlWarehouse(components, workflowDefinition),
                NeedsWorkspaceClient = hasFileUploadComponents || hasAnyLakebaseUsage || hasStartDatabricksJobAction || hasGenieChatComponents || hasModelChatComponents
            };
        }

        private sealed class StreamlitFeatureUsage
        {
            public bool HasDateOrTimeComponents { get; init; }

            public bool HasPlotlyCharts { get; init; }

            public bool HasDashboardEmbedComponents { get; init; }

            public bool HasCustomHtmlStoryComponents { get; init; }

            public bool HasGenieChatComponents { get; init; }

            public bool HasModelChatComponents { get; init; }

            public bool HasStartDatabricksJobAction { get; init; }

            public bool HasCallPrebuiltModuleAction { get; init; }

            public bool HasAnyLakebaseUsage { get; init; }

            public bool NeedsSqlConnector { get; init; }

            public bool NeedsWorkspaceClient { get; init; }
        }

        /// <inheritdoc/>
        public string GenerateStreamlitConfig(StreamlitThemeConfig theme)
        {
            return $@"[theme]
    primaryColor = ""{theme.PrimaryColor}""
    backgroundColor = ""{theme.BackgroundColor}""
    secondaryBackgroundColor = ""{theme.SecondaryBackgroundColor}""
    textColor = ""{theme.TextColor}""

";
        }

        /// <inheritdoc/>
        public string GenerateAppYamlFile(
            List<VdabComponentDto>? components,
            WorkflowDefinitionDto workflowDefinition,
            string? sqlWarehouseResourceKey = null)
        {
            Result<WorkflowDefinitionModel> parsedWorkflowResult = WorkflowDefinitionParser.Parse(workflowDefinition);
            WorkflowDefinitionModel parsedWorkflowDefinition = parsedWorkflowResult.IsSuccess
                ? parsedWorkflowResult.Value
                : new WorkflowDefinitionModel();

            StreamlitFeatureUsage featureUsage = AnalyzeFeatureUsage(components, parsedWorkflowDefinition, workflowDefinition);

            StringBuilder yaml = new StringBuilder();
            if (featureUsage.HasAnyLakebaseUsage)
            {
                yaml.AppendLine("# Lakebase: attach Lakebase database resources in App Settings. Workflow BuildSql nodes");
                yaml.AppendLine("# select a resource; app.yaml uses valueFrom for host (provisioned) or endpoint path (autoscaling).");
                yaml.AppendLine("# Database name matches bindings: use platform PGDATABASE (not builder db-compat ids). VDAB_LB_* omits DB literal.");
                yaml.AppendLine();
            }

            if (featureUsage.HasGenieChatComponents)
            {
                yaml.AppendLine("# Genie: add matching genie_space resources in App Settings; valueFrom is the resource name/key.");
                yaml.AppendLine("# See https://docs.databricks.com/aws/en/dev-tools/databricks-apps/genie");
                yaml.AppendLine();
            }

            if (featureUsage.HasModelChatComponents)
            {
                yaml.AppendLine("# Model Chat: add matching serving_endpoint resources in App Settings; valueFrom resolves to the endpoint name.");
                yaml.AppendLine("# See https://docs.databricks.com/aws/en/dev-tools/databricks-apps/environment-variables");
                yaml.AppendLine();
            }

            yaml.AppendLine("command: [");
            yaml.AppendLine(" \"streamlit\",");
            yaml.AppendLine(" \"run\",");
            yaml.AppendLine(" \"app.py\"");
            yaml.AppendLine("]");
            yaml.AppendLine();
            yaml.AppendLine("env:");
            if (featureUsage.NeedsSqlConnector)
            {
                string warehouseKey = string.IsNullOrWhiteSpace(sqlWarehouseResourceKey)
                    ? DatabricksAppsSqlWarehouseResource.DefaultResourceKey
                    : sqlWarehouseResourceKey.Trim();
                yaml.AppendLine(" - name: \"DATABRICKS_WAREHOUSE_ID\"");
                yaml.AppendLine($"   valueFrom: \"{EscapeYamlDoubleQuoted(warehouseKey)}\"");
            }

            if (featureUsage.HasGenieChatComponents)
            {
                foreach (string resourceKey in EnumerateDistinctGenieSpaceResourceKeys(components))
                {
                    string envName = GenieChatEnvNaming.EnvironmentVariableName(resourceKey);
                    string escapedKey = EscapeYamlDoubleQuoted(resourceKey);
                    string escapedEnv = EscapeYamlDoubleQuoted(envName);
                    yaml.AppendLine($@" - name: ""{escapedEnv}""");
                    yaml.AppendLine($@"   valueFrom: ""{escapedKey}""");
                }
            }

            if (featureUsage.HasModelChatComponents)
            {
                foreach (string resourceKey in EnumerateDistinctServingEndpointResourceKeys(components))
                {
                    string envName = ModelChatEnvNaming.EnvironmentVariableName(resourceKey);
                    string escapedKey = EscapeYamlDoubleQuoted(resourceKey);
                    string escapedEnv = EscapeYamlDoubleQuoted(envName);
                    yaml.AppendLine($@" - name: ""{escapedEnv}""");
                    yaml.AppendLine($@"   valueFrom: ""{escapedKey}""");
                }
            }

            foreach (BuildSqlLakebaseAppYamlBinding binding in EnumerateDistinctBuildSqlLakebaseYamlBindings(parsedWorkflowDefinition))
            {
                string escapedResourceKey = EscapeYamlDoubleQuoted(binding.ResourceName);
                if (binding.SqlSourceKind == WorkflowSqlSourceKind.LakebaseProvisionedDatabase)
                {
                    string hostEnv = LakebaseWorkflowEnvNaming.ProvisionedHostEnvironmentVariableName(binding.ResourceName);
                    yaml.AppendLine($@" - name: ""{EscapeYamlDoubleQuoted(hostEnv)}""");
                    yaml.AppendLine($@"   valueFrom: ""{escapedResourceKey}""");
                }
                else
                {
                    string epEnv = LakebaseWorkflowEnvNaming.AutoscalingEndpointEnvironmentVariableName(binding.ResourceName);
                    yaml.AppendLine($@" - name: ""{EscapeYamlDoubleQuoted(epEnv)}""");
                    yaml.AppendLine($@"   valueFrom: ""{escapedResourceKey}""");
                }
            }

            yaml.AppendLine(" - name: STREAMLIT_BROWSER_GATHER_USAGE_STATS");
            yaml.Append("   value: \"false\"");
            return yaml.ToString();
        }

        /// <inheritdoc/>
        public string GenerateCustomModulesFile(string? customModulesCode)
        {
            return CustomModulesTemplate.ResolveContent(customModulesCode);
        }

        private static IEnumerable<string> EnumerateDistinctGenieSpaceResourceKeys(List<VdabComponentDto>? components)
        {
            if (components == null)
            {
                yield break;
            }

            HashSet<string> seen = new(StringComparer.OrdinalIgnoreCase);
            foreach (VdabComponentDto component in components)
            {
                if (component is not GenieChatComponentDto genie)
                {
                    continue;
                }

                string name = genie.Props?.GenieSpaceAppResourceName?.Trim() ?? string.Empty;
                if (string.IsNullOrEmpty(name) || !seen.Add(name))
                {
                    continue;
                }

                yield return name;
            }
        }

        private static IEnumerable<string> EnumerateDistinctServingEndpointResourceKeys(List<VdabComponentDto>? components)
        {
            if (components == null)
            {
                yield break;
            }

            HashSet<string> seen = new(StringComparer.OrdinalIgnoreCase);
            foreach (VdabComponentDto component in components)
            {
                if (component is not ModelChatComponentDto modelChat)
                {
                    continue;
                }

                string name = modelChat.Props?.ServingEndpointAppResourceName?.Trim() ?? string.Empty;
                if (string.IsNullOrEmpty(name) || !seen.Add(name))
                {
                    continue;
                }

                yield return name;
            }
        }

        private static string EscapeYamlDoubleQuoted(string value)
        {
            return value.Replace("\\", "\\\\", StringComparison.Ordinal).Replace("\"", "\\\"", StringComparison.Ordinal);
        }

        private readonly record struct BuildSqlLakebaseAppYamlBinding(string ResourceName, WorkflowSqlSourceKind SqlSourceKind);

        private static List<BuildSqlLakebaseAppYamlBinding> EnumerateDistinctBuildSqlLakebaseYamlBindings(WorkflowDefinitionModel workflowDefinition)
        {
            Dictionary<string, BuildSqlLakebaseAppYamlBinding> deduped = new(StringComparer.OrdinalIgnoreCase);

            foreach (WorkflowModel workflow in workflowDefinition.Workflows)
            {
                foreach (WorkflowActionNodeModel node in workflow.Nodes)
                {
                    if (node is not BuildSqlActionModel buildSql)
                    {
                        continue;
                    }

                    if (buildSql.SqlSourceKind != WorkflowSqlSourceKind.LakebaseProvisionedDatabase &&
                        buildSql.SqlSourceKind != WorkflowSqlSourceKind.LakebaseAutoscaling)
                    {
                        continue;
                    }

                    string resourceName = buildSql.LakebaseAppResourceName?.Trim() ?? string.Empty;
                    if (string.IsNullOrEmpty(resourceName))
                    {
                        continue;
                    }

                    string dedupeKey = $"{resourceName}|{buildSql.SqlSourceKind}";
                    if (!deduped.ContainsKey(dedupeKey))
                    {
                        deduped[dedupeKey] = new BuildSqlLakebaseAppYamlBinding(resourceName, buildSql.SqlSourceKind);
                    }
                }
            }

            return deduped.Values.ToList();
        }

        /// <summary>
        /// Appends the SQL connection helper functions for Databricks SQL Connector.
        /// Uses the Databricks App service principal (M2M), matching Lakebase auth.
        /// </summary>
        private static void AppendSqlConnectionHelpers(StringBuilder sb)
        {
            sb.AppendLine("# Databricks SQL Connection Setup (app service principal)");
            sb.AppendLine("cfg = Config()");
            sb.AppendLine();
            AppendSqlHostnameHelper(sb);
            AppendRequireSqlAppContextHelper(sb);
            AppendSqlErrorHelpers(sb);
            AppendSqlQueryDfHelper(sb);
            AppendSqlExecuteHelper(sb);
        }

        private static void AppendSqlHostnameHelper(StringBuilder sb)
        {
            sb.AppendLine("def _sql_server_hostname() -> str:");
            sb.AppendLine("    # sql.connect expects a bare hostname; Config.host may include https://");
            sb.AppendLine("    raw_host = str(cfg.host or os.environ.get('DATABRICKS_HOST') or '').strip()");
            sb.AppendLine("    return raw_host.replace('https://', '').replace('http://', '').strip('/')");
            sb.AppendLine();
        }

        private static void AppendRequireSqlAppContextHelper(StringBuilder sb)
        {
            sb.AppendLine("def _require_sql_app_context():");
            sb.AppendLine("    warehouse_id = cfg.warehouse_id or os.environ.get('DATABRICKS_WAREHOUSE_ID')");
            sb.AppendLine("    if not warehouse_id:");
            sb.AppendLine("        raise RuntimeError(");
            sb.AppendLine("            \"DATABRICKS_WAREHOUSE_ID is not set. In VDAB App Settings → App resources, add a SQL warehouse \"");
            sb.AppendLine($"            \"(resource key '{DatabricksAppsSqlWarehouseResource.DefaultResourceKey}' recommended), save, and redeploy.\"");
            sb.AppendLine("        )");
            sb.AppendLine("    server_hostname = _sql_server_hostname()");
            sb.AppendLine("    if not server_hostname:");
            sb.AppendLine("        raise RuntimeError(");
            sb.AppendLine("            \"Databricks host is not set. DATABRICKS_HOST should be injected by the Databricks Apps runtime.\"");
            sb.AppendLine("        )");
            sb.AppendLine("    return server_hostname, str(warehouse_id)");
            sb.AppendLine();
        }

        private static void AppendSqlErrorHelpers(StringBuilder sb)
        {
            sb.AppendLine("def _raise_sql_connect_error(exc: Exception, server_hostname: str, warehouse_id: str) -> None:");
            sb.AppendLine("    detail = str(exc).strip() or repr(exc)");
            sb.AppendLine("    cause = getattr(exc, '__cause__', None)");
            sb.AppendLine("    if cause is not None:");
            sb.AppendLine("        detail = f\"{detail} | cause={cause}\"");
            sb.AppendLine("    raise RuntimeError(");
            sb.AppendLine("        \"Failed to open Databricks SQL session as the app service principal. \"");
            sb.AppendLine("        f\"host={server_hostname!r}, warehouse_id={warehouse_id!r}. \"");
            sb.AppendLine("        f\"Detail: {detail}. \"");
            sb.AppendLine("        \"Confirm the SQL warehouse resource is bound in App Settings and the warehouse is running.\"");
            sb.AppendLine("    ) from exc");
            sb.AppendLine();
            sb.AppendLine("def _raise_sql_execute_error(exc: Exception) -> None:");
            sb.AppendLine("    detail = str(exc).strip() or repr(exc)");
            sb.AppendLine("    raise RuntimeError(");
            sb.AppendLine("        \"Failed to execute Databricks SQL as the app service principal. \"");
            sb.AppendLine("        f\"Detail: {detail}. \"");
            sb.AppendLine("        \"Confirm the app service principal has the required Unity Catalog privileges on the queried objects.\"");
            sb.AppendLine("    ) from exc");
            sb.AppendLine();
        }

        private static void AppendSqlQueryDfHelper(StringBuilder sb)
        {
            sb.AppendLine("def sql_query_df(query: str) -> pd.DataFrame:");
            sb.AppendLine("    \"\"\"Execute a SQL query as the app service principal and return a pandas DataFrame.\"\"\"");
            sb.AppendLine("    server_hostname, warehouse_id = _require_sql_app_context()");
            sb.AppendLine("    try:");
            sb.AppendLine("        connection = sql.connect(");
            sb.AppendLine("            server_hostname=server_hostname,");
            sb.AppendLine("            http_path=f'/sql/1.0/warehouses/{warehouse_id}',");
            sb.AppendLine("            credentials_provider=lambda: cfg.authenticate,");
            sb.AppendLine("            _user_agent_entry=PARTNER_USER_AGENT");
            sb.AppendLine("        )");
            sb.AppendLine("    except Exception as exc:");
            sb.AppendLine("        _raise_sql_connect_error(exc, server_hostname, warehouse_id)");
            sb.AppendLine("    try:");
            sb.AppendLine("        with connection:");
            sb.AppendLine("            with connection.cursor() as cursor:");
            sb.AppendLine("                cursor.execute(query)");
            sb.AppendLine("                return cursor.fetchall_arrow().to_pandas()");
            sb.AppendLine("    except Exception as exc:");
            sb.AppendLine("        _raise_sql_execute_error(exc)");
            sb.AppendLine();
        }

        private static void AppendSqlExecuteHelper(StringBuilder sb)
        {
            sb.AppendLine("def sql_execute(query: str, parameters=None) -> None:");
            sb.AppendLine("    \"\"\"Execute a SQL statement as the app service principal (no result rows).\"\"\"");
            sb.AppendLine("    server_hostname, warehouse_id = _require_sql_app_context()");
            sb.AppendLine("    try:");
            sb.AppendLine("        connection = sql.connect(");
            sb.AppendLine("            server_hostname=server_hostname,");
            sb.AppendLine("            http_path=f'/sql/1.0/warehouses/{warehouse_id}',");
            sb.AppendLine("            credentials_provider=lambda: cfg.authenticate,");
            sb.AppendLine("            _user_agent_entry=PARTNER_USER_AGENT");
            sb.AppendLine("        )");
            sb.AppendLine("    except Exception as exc:");
            sb.AppendLine("        _raise_sql_connect_error(exc, server_hostname, warehouse_id)");
            sb.AppendLine("    try:");
            sb.AppendLine("        with connection:");
            sb.AppendLine("            with connection.cursor() as cursor:");
            sb.AppendLine("                if parameters is None:");
            sb.AppendLine("                    cursor.execute(query)");
            sb.AppendLine("                elif isinstance(parameters, list):");
            sb.AppendLine("                    cursor.executemany(query, parameters)");
            sb.AppendLine("                else:");
            sb.AppendLine("                    cursor.execute(query, parameters)");
            sb.AppendLine("    except Exception as exc:");
            sb.AppendLine("        _raise_sql_execute_error(exc)");
            sb.AppendLine();
        }

        /// <summary>
        /// Appends the Lakebase connection helper functions using Databricks App env vars
        /// </summary>
        private static void AppendLakebaseConnectionHelpers(StringBuilder sb)
        {
            sb.AppendLine("# Lakebase (Databricks Postgres) Connection Setup");
            sb.AppendLine("app_config = Config()");
            sb.AppendLine("workspace_client = WorkspaceClient(product=PARTNER_NAME, product_version=PARTNER_VERSION)");
            sb.AppendLine();
            sb.AppendLine("postgres_username = os.getenv('PGUSER') or app_config.client_id");
            sb.AppendLine("postgres_host = os.getenv('PGHOST')");
            sb.AppendLine("postgres_port = int(os.getenv('PGPORT', '5432'))");
            sb.AppendLine("postgres_database = os.getenv('PGDATABASE', 'databricks_postgres')");
            sb.AppendLine();
            sb.AppendLine("if not postgres_host or not postgres_database or not postgres_username:");
            sb.AppendLine("    raise ValueError(");
            sb.AppendLine("        'Lakebase is not configured: PGHOST/PGDATABASE/PGUSER are missing. '");
            sb.AppendLine("        'Add a Lakebase database resource to this Databricks app (see App resources), '");
            sb.AppendLine("        'then redeploy so the platform can inject Postgres connection settings.'");
            sb.AppendLine("    )");
            sb.AppendLine();
            sb.AppendLine("postgres_pool = create_engine(");
            sb.AppendLine("    f\"postgresql+psycopg://{postgres_username}:@{postgres_host}:{postgres_port}/{postgres_database}\"");
            sb.AppendLine(")");
            sb.AppendLine();
            sb.AppendLine("@event.listens_for(postgres_pool, 'do_connect')");
            sb.AppendLine("def provide_token(dialect, conn_rec, cargs, cparams):");
            sb.AppendLine("    \"\"\"Provide the App's OAuth token. Caching is managed by WorkspaceClient\"\"\"");
            sb.AppendLine("    cparams['password'] = workspace_client.config.oauth_token().access_token");
            sb.AppendLine();
            sb.AppendLine("def get_engine():");
            sb.AppendLine("    \"\"\"Return the shared SQLAlchemy engine for Lakebase.\"\"\"");
            sb.AppendLine("    return postgres_pool");
            sb.AppendLine();
            sb.AppendLine("def lakebase_query_df(query: str) -> pd.DataFrame:");
            sb.AppendLine("    \"\"\"Execute a query against Lakebase and return results as a DataFrame.\"\"\"");
            sb.AppendLine("    engine = get_engine()");
            sb.AppendLine("    return pd.read_sql_query(query, engine)");
            sb.AppendLine();
            sb.AppendLine("def lakebase_execute_sql(query: str) -> None:");
            sb.AppendLine("    \"\"\"Execute a non-query statement against Lakebase.\"\"\"");
            sb.AppendLine("    engine = get_engine()");
            sb.AppendLine("    with engine.begin() as conn:");
            sb.AppendLine("        conn.execute(text(query))");
            sb.AppendLine();
            sb.AppendLine("# Workflow RunSql: per BuildSql-selected Lakebase app resource (see app.yaml VDAB_LB_* env vars)");
            sb.AppendLine("_vdab_workflow_lakebase_engines = {}");
            sb.AppendLine();
            sb.AppendLine("def _vdab_resolve_postgres_endpoint_host(endpoint_path: str) -> str:");
            sb.AppendLine("    path = str(endpoint_path or '').strip().lstrip('/')");
            sb.AppendLine("    if not path:");
            sb.AppendLine("        raise ValueError('Lakebase autoscaling endpoint path is empty.')");
            sb.AppendLine("    base = str(workspace_client.config.host or '').rstrip('/')");
            sb.AppendLine("    url = f\"{base}/api/2.0/postgres/{path}\"");
            sb.AppendLine("    token = workspace_client.config.oauth_token().access_token");
            sb.AppendLine("    req = urllib.request.Request(url, headers={'Authorization': f'Bearer {token}'})");
            sb.AppendLine("    try:");
            sb.AppendLine("        with urllib.request.urlopen(req) as resp:");
            sb.AppendLine("            payload = json.load(resp)");
            sb.AppendLine("    except urllib.error.HTTPError as e:");
            sb.AppendLine("        raise ValueError(f\"Failed to resolve Lakebase endpoint host for '{path}': HTTP {e.code}\") from e");
            sb.AppendLine("    host = (((payload or {}).get('status') or {}).get('hosts') or {}).get('host')");
            sb.AppendLine("    if not host:");
            sb.AppendLine("        raise ValueError(f\"Databricks returned no host for Lakebase endpoint '{path}'.\")");
            sb.AppendLine("    return str(host).strip()");
            sb.AppendLine();
            sb.AppendLine("def _vdab_lakebase_sql_returns_rows(statement: str) -> bool:");
            sb.AppendLine("    import re");
            sb.AppendLine("    s = str(statement or '').strip()");
            sb.AppendLine("    if not s:");
            sb.AppendLine("        return False");
            sb.AppendLine("    head = s.lstrip()");
            sb.AppendLine("    if head.upper().startswith('WITH'):");
            sb.AppendLine("        return True");
            sb.AppendLine("    m = re.search(r'\\b([A-Za-z_]+)\\b', head)");
            sb.AppendLine("    if not m:");
            sb.AppendLine("        return False");
            sb.AppendLine("    w0 = m.group(1).upper()");
            sb.AppendLine("    return w0 in ('SELECT', 'SHOW', 'TABLE', 'EXPLAIN', 'VALUES', 'DESCRIBE', 'DESC')");
            sb.AppendLine();
            sb.AppendLine("def _vdab_get_workflow_lakebase_engine(sql_source_kind: str, connection_env: str, db_env: str):");
            sb.AppendLine("    cache_key = (sql_source_kind, connection_env, db_env)");
            sb.AppendLine("    if cache_key in _vdab_workflow_lakebase_engines:");
            sb.AppendLine("        return _vdab_workflow_lakebase_engines[cache_key]");
            sb.AppendLine("    db_name = (os.environ.get(db_env) or '').strip()");
            sb.AppendLine("    if not db_name:");
            sb.AppendLine("        db_name = os.getenv('PGDATABASE') or 'databricks_postgres'");
            sb.AppendLine("    conn_value = os.environ.get(connection_env) or ''");
            sb.AppendLine("    if not conn_value:");
            sb.AppendLine("        raise ValueError(");
            sb.AppendLine("            f'Missing Lakebase workflow env var {connection_env}. '");
            sb.AppendLine("            'Redeploy the app so app.yaml can inject VDAB_LB_HOST_* / VDAB_LB_EP_* for the selected resource.'");
            sb.AppendLine("        )");
            sb.AppendLine("    if sql_source_kind == 'lakebaseProvisionedDatabase':");
            sb.AppendLine("        postgres_host = conn_value");
            sb.AppendLine("    elif sql_source_kind == 'lakebaseAutoscaling':");
            sb.AppendLine("        postgres_host = _vdab_resolve_postgres_endpoint_host(conn_value)");
            sb.AppendLine("    else:");
            sb.AppendLine("        raise ValueError(f\"Unsupported workflow Lakebase sql_source_kind '{sql_source_kind}'.\")");
            sb.AppendLine("    postgres_username = os.getenv('PGUSER') or app_config.client_id");
            sb.AppendLine("    postgres_port = int(os.getenv('PGPORT', '5432'))");
            sb.AppendLine("    engine = create_engine(");
            sb.AppendLine("        f\"postgresql+psycopg://{postgres_username}:@{postgres_host}:{postgres_port}/{db_name}\"");
            sb.AppendLine("    )");
            sb.AppendLine();
            sb.AppendLine("    @event.listens_for(engine, 'do_connect')");
            sb.AppendLine("    def provide_token_workflow(dialect, conn_rec, cargs, cparams):");
            sb.AppendLine("        cparams['password'] = workspace_client.config.oauth_token().access_token");
            sb.AppendLine();
            sb.AppendLine("    _vdab_workflow_lakebase_engines[cache_key] = engine");
            sb.AppendLine("    return engine");
            sb.AppendLine();
            sb.AppendLine("def _vdab_lakebase_run_for_workflow(sql_source_kind: str, connection_env: str, db_env: str, statement: str):");
            sb.AppendLine("    engine = _vdab_get_workflow_lakebase_engine(sql_source_kind, connection_env, db_env)");
            sb.AppendLine("    if _vdab_lakebase_sql_returns_rows(statement):");
            sb.AppendLine("        return pd.read_sql_query(text(statement), engine)");
            sb.AppendLine("    with engine.begin() as conn:");
            sb.AppendLine("        result = conn.execute(text(statement))");
            sb.AppendLine("        rowcount = result.rowcount");
            sb.AppendLine("        return {'executed': True, 'rowsAffected': rowcount if rowcount is not None else -1}");
            sb.AppendLine();
        }
    }
}
