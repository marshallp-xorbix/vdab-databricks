# Story Visualization Components QA Steps

To start, you will need to **start** and open your QA app, go to the settings, into the resource tab, then add 2 new resources:
1. Autoscaling Lakebase: 
    - `vdab-autoscale-lakebase`
    - `br-sweet-dew-d2sqihlr`
    - `databricks_postgres`

2. SQL Warehouse:
    - `Serverless Starter Warehouse`

Make sure you save the app and deploy it once to instanciate the PGUSER environment variable for your app, which you need to grant SQL permissions to your app so it can query to produce the visuals. The SQL query to grant the permissions for each type of binding (Autoscaling Lakebase or Unity Catalog) is located in their respective section. To find the PGUSER variable, go on databricks to your app page, then to the Environment tab. Scroll down and find the PGUSER value and note it down.

For the second half, you will have to run similar queries but with minor syntax changes, still using your PGUSER.

## Visualizations v1 (First 4)

For the First 4 visualizations: Amoeba Story, Network Web Story, Terrain Story, and Heat Map, they will all use Autoscaling Lakebase table bindings. They all follow the same structure within the lakebase `vdab-autoscale-lakebase`: 

`databricks_postgres.dbdemos.<table_name>`

You will have to go to your SQL editor, connect to the lakebase, and then grant the following permissions for each of the following tables for your PGUSER (quotes around PGUSER matter):

Tables: `amoeba_story`, `network_web_story`, `terrain_story`, and `heat_map_story`

```sql
GRANT CONNECT ON DATABASE databricks_postgres TO "<PGUSER>";
GRANT USAGE ON SCHEMA dbdemos TO "<PGUSER>";
GRANT SELECT ON TABLE dbdemos.<table_name> TO "<PGUSER>";
```

### Amoeba Story

Before starting, ensure the SQL query above was run for the `amoeba_story` table for your app's PGUSER.

1. Open an app, and drag the `Amoeba Story` component onto the canvas.
2. Select the `Amoeba Story` component to open the right side properties panel.
3. Select add binding, autoscaling lakebase, then fill in the respective fields (`databricks_postgres` / `dbdemos` / `amoeba_story`).
4. Then head to the Field Mappings panel below this and map the corresponding fields from the data table to the fields on the panel:

| Field mapping | Data column |
| --- | --- |
| Entity ID | `customer_id` |
| Entity label | `customer_name` |
| Category | `segment` |
| Size metric | `revenue` |
| X metric | `growth_pct` |
| Y metric | `risk_score` |
| Change metric | `change_pct` |
| Time field (optional) | `snapshot_date` |
| Health score (optional) | `health_score` |
| Risk score (optional) | `risk_score` |

5. Play around with any General/Visual Settings in the properties as well to make sure things there work (layout mode, size scale, color by, pulse by, label mode, animation).
6. Save and deploy the app once all mappings are in place.


### Network Web Story

Before starting, ensure the SQL grant was run for the `network_web_story` table for your app's PGUSER.

1. Open an app, and drag the `Network Web Story` component onto the canvas.
2. Select the `Network Web Story` component to open the right side properties panel.
3. Select add binding, autoscaling lakebase, then fill in the respective fields (`databricks_postgres` / `dbdemos` / `network_web_story`).
4. Then head to the Field Mappings panel below this and map the corresponding fields from the data table to the fields on the panel:

| Field mapping | Data column |
| --- | --- |
| Source entity ID | `source_entity_id` |
| Source entity label | `source_entity_label` |
| Target entity ID | `target_entity_id` |
| Target entity label | `target_entity_label` |
| Relationship type | `relationship_type` |
| Relationship weight | `relationship_weight` |
| Time field (optional) | `snapshot_date` |
| Direction (optional) | `direction` |
| Edge value (optional) | `edge_value` |
| Frequency (optional) | `frequency` |
| Edge risk score (optional) | `edge_risk_score` |
| Edge status (optional) | `edge_status` |
| Source category (optional) | `source_category` |
| Target category (optional) | `target_category` |
| Source value (optional) | `source_value` |
| Target value (optional) | `target_value` |
| Source health (optional) | `source_health_score` |
| Target health (optional) | `target_health_score` |
| Source risk (optional) | `source_risk_score` |
| Target risk (optional) | `target_risk_score` |

5. Play around with any General/Visual Settings in the properties as well to make sure things there work (layout algorithm, node size/color, edge width/color, show arrows, max nodes/edges).
6. Save and deploy the app once all mappings are in place.


### Terrain Story

Before starting, ensure the SQL grant was run for the `terrain_story` table for your app's PGUSER.

1. Open an app, and drag the `Terrain Story` component onto the canvas.
2. Select the `Terrain Story` component to open the right side properties panel.
3. Select add binding, autoscaling lakebase, then fill in the respective fields (`databricks_postgres` / `dbdemos` / `terrain_story`).
4. Then head to the Field Mappings panel below this and map the corresponding fields from the data table to the fields on the panel:

| Field mapping | Data column |
| --- | --- |
| X dimension | `report_month` |
| Y dimension | `product_family` |
| Height metric | `output_units` |
| Time field (optional) | `report_month` |
| Terrain category (optional) | `region` |
| Risk score (optional) | `quality_risk_score` |
| Target value (optional) | `target_output_units` |
| Baseline value (optional) | `prior_period_output_units` |
| Forecast value (optional) | `forecast_output_units` |
| Volume metric (optional) | `scrap_units` |
| Status (optional) | `line_status` |
| Event name (optional) | `incident_name` |
| Event date (optional) | `incident_date` |
| Callout text (optional) | `notes` |

Alternate layout (also valid): X = `plant_name`, Y = `product_family`, Time = `report_month`.

5. Play around with any General/Visual Settings in the properties as well to make sure things there work (terrain mode, aggregation, height scale, interpolation, grid resolution, color by, peak/valley labels).
6. Save and deploy the app once all mappings are in place.


### Heat Map Story

Before starting, ensure the SQL grant was run for the `heat_map_story` table for your app's PGUSER.

1. Open an app, and drag the `Heat Map Story` component onto the canvas.
2. Select the `Heat Map Story` component to open the right side properties panel.
3. Select add binding, autoscaling lakebase, then fill in the respective fields (`databricks_postgres` / `dbdemos` / `heat_map_story`).
4. Then head to the Field Mappings panel below this and map the corresponding fields from the data table to the fields on the panel:

| Field mapping | Data column |
| --- | --- |
| Geographic area | `state_code` |
| Metric value | `revenue` |
| Time field (optional) | `order_month` |
| Secondary metric (optional) | `customer_count` |
| Change % (optional) | `yoy_growth_pct` |
| Target value (optional) | `target_revenue` |
| Risk score (optional) | `risk_score` |
| Category / segment (optional) | `region` |
| Forecast value (optional) | `forecast_revenue` |
| Notes (optional) | `notes` |

5. Play around with any General/Visual Settings in the properties as well to make sure things there work (aggregation method, color scale, show labels, show legend). Confirm map scope stays USA / state for this sample.
6. Save and deploy the app once all mappings are in place.



## Visualizations v2 (Last 4)

The Last 4 visualizations include the Pulse Wave Story, Flow Field Story, Honeycomb Story, and Spiral Story. For these visualizations, they will use UC Catalog bindings, not lakebase. They are all located in the UC at `dbdemos.vdab.<table_name>`.

You will have to go to your SQL editor, connect to the `Serverless Starter Warehouse`, and then grant the following permissions for each of the following tables for your PGUSER (backticks around PGUSER matter):

Tables: `pulse_wave_story`, `flow_field_story`, `honeycomb_story`, and `spiral_story`.

```sql
GRANT USE CATALOG ON CATALOG dbdemos TO `<PGUSER>`;
GRANT USE SCHEMA ON SCHEMA dbdemos.vdab TO `<PGUSER>`;
GRANT SELECT ON TABLE dbdemos.vdab.<table_name> TO `<PGUSER>`;
```

### Pulse Wave Story

Before starting, ensure the SQL grant was run for the `pulse_wave_story` table for your app's PGUSER.

1. Open an app, and drag the `Pulse Wave Story` component onto the canvas.
2. Select the `Pulse Wave Story` component to open the right side properties panel.
3. Select add binding, Unity Catalog table, then fill in the respective fields (`dbdemos` / `vdab` / `pulse_wave_story`).
4. Then head to the Field Mappings panel below this and map the corresponding fields from the data table to the fields on the panel:

| Field mapping | Data column |
| --- | --- |
| Time period | `period` |
| Metric value | `revenue` |
| Baseline / target | `target_revenue` |
| Event name (optional) | `event_name` |
| Event type (optional) | `event_type` |
| Impact score (optional) | `impact_score` |

5. Play around with any General/Visual Settings in the properties as well to make sure things there work (metric name, aggregation method, show baseline, show events, show anomaly markers, fill under wave).
6. Save and deploy the app once all mappings are in place.


### Flow Field Story

Before starting, ensure the SQL grant was run for the `flow_field_story` table for your app's PGUSER.

1. Open an app, and drag the `Flow Field Story` component onto the canvas.
2. Select the `Flow Field Story` component to open the right side properties panel.
3. Select add binding, Unity Catalog table, then fill in the respective fields (`dbdemos` / `vdab` / `flow_field_story`).
4. Then head to the Field Mappings panel below this and map the corresponding fields from the data table to the fields on the panel:

| Field mapping | Data column |
| --- | --- |
| Source stage | `source_stage` |
| Destination stage | `destination_stage` |
| Flow volume | `flow_volume` |
| Stage order | `stage_order` |
| Time field (optional) | `period` |
| Conversion % (optional) | `conversion_pct` |
| Drop-off count (optional) | `drop_off_count` |
| Avg time in stage (optional) | `avg_days_in_stage` |
| Status (optional) | `status` |

5. Play around with any General/Visual Settings in the properties as well to make sure things there work (show drop-offs, show labels). Hover streams to confirm tooltips and drop-off leakage when mapped.
6. Save and deploy the app once all mappings are in place.


### Honeycomb Story

Before starting, ensure the SQL grant was run for the `honeycomb_story` table for your app's PGUSER.

1. Open an app, and drag the `Honeycomb Story` component onto the canvas.
2. Select the `Honeycomb Story` component to open the right side properties panel.
3. Select add binding, Unity Catalog table, then fill in the respective fields (`dbdemos` / `vdab` / `honeycomb_story`).
4. Then head to the Field Mappings panel below this and map the corresponding fields from the data table to the fields on the panel:

| Field mapping | Data column |
| --- | --- |
| Item name | `item_name` |
| Impact score | `impact_score` |
| Priority level | `priority_level` |
| Progress % | `progress_pct` |
| Category / pillar | `category` |
| Time field (optional) | `snapshot_date` |
| Trend (optional) | `trend` |
| Risk score (optional) | `risk_score` |
| Owner (optional) | `owner` |
| Due date (optional) | `due_date` |
| Investment (optional) | `investment` |
| Benefit value (optional) | `benefit_value` |
| Notes (optional) | `notes` |
| Status (optional) | `status` |

5. Play around with any General/Visual Settings in the properties as well to make sure things there work (show labels, show risk borders, show trend arrows). Pan/zoom and hover hexes to confirm tips.
6. Save and deploy the app once all mappings are in place.


### Spiral Story

Before starting, ensure the SQL grant was run for the `spiral_story` table for your app's PGUSER.

1. Open an app, and drag the `Spiral Story` component onto the canvas.
2. Select the `Spiral Story` component to open the right side properties panel.
3. Select add binding, Unity Catalog table, then fill in the respective fields (`dbdemos` / `vdab` / `spiral_story`).
4. Then head to the Field Mappings panel below this and map the corresponding fields from the data table to the fields on the panel:

| Field mapping | Data column |
| --- | --- |
| Journey name | `journey_name` |
| Stage / milestone | `stage` |
| Timeline field | `milestone_date` |
| Progress % | `progress_pct` |
| Metric value | `metric_value` |
| Target date (optional) | `target_date` |
| Actual date (optional) | `actual_date` |
| Status (optional) | `status` |
| Risk score (optional) | `risk_score` |
| Owner (optional) | `owner` |
| Key achievement (optional) | `key_achievement` |
| Cost (optional) | `stage_cost` |

5. Play around with any General/Visual Settings in the properties as well to make sure things there work (show labels, show risk glow, show schedule variance, space by timeline).
6. After deploy, confirm the Journey dropdown appears when multiple journeys exist (sample has Expand APAC + Partner Portal), and that switching journeys redraws the spiral. Toggle Space by timeline on/off and confirm marker spacing changes.
7. Save and deploy the app once all mappings are in place.
