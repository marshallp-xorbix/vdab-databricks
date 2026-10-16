# Embedded Dashboard Component QA

These steps will walk a user through the proces of adding an Embedded Databricks Dashboard into their VDAB app.

## 1. Setting the Correct Permissions

To embed a dashboard, the proper Workspace permissions must be set, so that published Dashboards can have their embedding link accessable.

1. A Databricks Workspace Admin will need to navigate to Workspace `Settings`, and under `Workspace admin`, click `Security`.
2. Under `External Access`, for `Embed dashboards and Genie spaces`, set it to `Allow approved domains`.
3. Finally, click `Manage`, and add `*.databricksapps.com` as a domain and click `Save` (this is because most deployed Databricks apps are on `https://<app-name>-<workspaceId>.aws.databricksapps.com/`).

## 2. Publishing a Dashboard

After enabling the proper Workspace permissions, you must publish a dashboard so that it can be embedded into a VDAB app.

1. On Databricks, navigate to the `Dashboards` tab (located under the `SQL` subsection)
2. Create (or import) a dashboard, and when it is finished, select the `Publish` button in the top right of the screen.
3. When published, the `Share` screen should automatically open, but if it doesn't, navigate to this screen by selecting the `Share` button manually
4. Select the `< > Embed dashboard` button and then select the `Iframe` tab
5. Copy the link within the double quotes `"<link>"`:
    - Example: 
    ```
    <iframe
        src="https://<instanceURL>.cloud.databricks.com/embed/dashboardsv3/<dashboardId>?o=<workspaceId>"
        width="100%"
        height="600"
        frameborder="0">
    </iframe>
    ```

    - copy `https://<instanceURL>.cloud.databricks.com/embed/dashboardsv3/<dashboardId>?o=<workspaceId>`

Now that you have the embedding link, you need to create an Embedded Dashboard component within a VDAB app and supply the link

## 3. Adding the Dashboard Component

1. Now, on VDAB, open an app and a modal then Drag & Drop a `Dashboard Embed` component onto the canvas
2. Select the component to open the `Dashboard Embed Properties` tab
3. Paste the Embedding Link from Part 2 (Ex. `https://<instanceURL>.cloud.databricks.com/embed/dashboardsv3/<dashboardId>?o=<workspaceId>`) into the `Embed URL` property field
4. Save and Deploy your app on VDAB

This completes all of the steps to implement an Embedded Dashboard into a VDAB application. For any issues, refer to the below `Troubleshooting` sections


# Troubleshooting

### 1. Error Message: `Embedding dashboards is not available in this workspace.`

This message can appear in multiple scenarios:

#### 1. In the Dashboard preview on the VDAB canvas when an `Embed URL` is pasted into the properties field for an Embedded Dashboard component.
- This requires adding Permissions to VDAB itself to display the dashboards
- These permissions are currently only set for the Deployed apps using the steps above in Section 1
- Apply the proper permissions for your VDAB canvas URL
    - For example, if the URL for VDAB is: `http://<vdab-url>/apps/<appInt>?name=<app%20name>`, maybe provide permissions for `http://<vdab-url>/apps/` so a preview of the Dashboard can be viewed in the VDAB canvas

#### 2. In the Deployed App itself where the Embedded Dashboard should be
- This means that the permissions step from Section 1 did not properly allow the Viewing permissions for Embedded Dashboards
- Re-read and complete the steps from Section 1, applying the correct permissions for the correct domain(s) for deployed apps