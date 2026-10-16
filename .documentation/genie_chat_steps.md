# Genie Spaces and Genie Chat VDAB Component Walkthrough

Databricks Genie Spaces are chat spaces where a user can connect to a Data Table from a Warehouse or Lakebase and talk to an AI assistant about the data. This assistant is able to generate SQL to investigate or answer questons about the data, as well as provide meaningful insight into the data as well. In VDAB, the Genie Chat app component allows the user to add one of these chat spaces to their VDAB app. These step guide the user to setting up a Genie Space on Databricks, linking it as a resource to the VDAB app, and then adding the chat component. 

## 1. Creating a Genie Space

To start, the user will have to create a Genie Space on Databricks, which will be connected to through VDAB in order to talk about the selected data. 

1. On Databricks, locate the SQL menu section and select the `Genie` tab.
2. Then, select the `+ New` button on the top right of the screen and select the Catalog, Schema, and Table you want to make the space for and click `Create`
3. Open the newly created space on Databricks and note the `Name` of the space in the `About this space` section. 
4. This name can be changed by selecting the pencil icon within the `About this space` section.

Now the space is created, and it must be linked as a resource to a VDAB app next.

## 2. Add Genie Space Resource to VDAB app

1. Now, open up VDAB and navigate to the settings of the app where you want to eventually add a Genie Chat component, and select the `Resources` tab
2. Select `Edit`, then select `Genie space` under the `Resource type` field, and add it with the `+ Add resource` button
3. In the `Details` column of the new Genie Space resource row, select the Genie Space based on the default name or name you gave it
4. Click `Save resources` and remember the `Key` for the Genie Space resource for the next step (default is `genie-space`)

Now, the Genie Space is linked to the app, and needs to be set as the binding for a VDAB Genie Chat component

## 3. Add Genie Chat Component to VDAB App

1. Navigate to the Main Page or Modal where you want the Genie Chat
2. Drag & Drop the `Genie Chat` component (under the `Visualization` component tab) onto the canvas where you want it 
3. At the bottom of the properties tab for the Genie Chat, select the resource `Key` for the Genie Space to link to this component
4. Also, in the Genie Chat properties tab, you can check the `Border` box to outline the Genie Chat space in the deployed app, and you can also set the `Height` of the space (make a larger or smaller chat window)
5. Save the VDAB app and deploy

Now, the Databricks app is ready to be used with an embedded Genie Chat space

## 4. Using Genie Chat

1. Launch the deployed app, and navigated to the page or modal where the Genie Chat component is located
2. In the chat bar, ask a question about the data that corresponds to the Databricks Genie Space linked to this app and component
3. The question will appear in the conversation window, then an assistant response should appear; if the conversation gets too long, the space becomes scrollable.

