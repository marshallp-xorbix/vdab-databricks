namespace Xorbix_Visual_Databricks_App_Builder.Models

{

    public class OAuthCodeExchangeRequest

    {

        public string WorkspaceUrl { get; set; } = string.Empty;

        public string Code { get; set; } = string.Empty;

        public string CodeVerifier { get; set; } = string.Empty;

        public string RedirectUri { get; set; } = string.Empty;

    }

}