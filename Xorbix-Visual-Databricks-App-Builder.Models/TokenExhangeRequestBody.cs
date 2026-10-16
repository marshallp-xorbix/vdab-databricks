namespace Xorbix_Visual_Databricks_App_Builder.Models
{
    using System.Text.Json.Serialization;
    

    public record class TokenExchangeRequestBody
    {
        public TokenExchangeRequestBody() {}
        public TokenExchangeRequestBody(string clientId, string clientSecret, string grantType, string redirectUri, string codeVerifier, string code, string scope)
        {
            ClientId = clientId;
            ClientSecret = clientSecret;
            GrantType = grantType;
            RedirectUri = redirectUri;
            CodeVerifier = codeVerifier;
            Code = code;
            Scope = scope;
        }

        [JsonPropertyName("client_id")]
        public string ClientId { get; set; } = string.Empty;

        [JsonPropertyName("client_secret")]
        public string ClientSecret { get; set; } = string.Empty;

        [JsonPropertyName("grant_type")]
        public string GrantType { get; set; } = "authorization_code";

        [JsonPropertyName("redirect_uri")]
        public string RedirectUri { get; set; } = string.Empty;

        [JsonPropertyName("code_verifier")]
        public string CodeVerifier { get; set; } = string.Empty;

        [JsonPropertyName("code")]
        public string Code { get; set; } = string.Empty;

        [JsonPropertyName("scope")]
        public string Scope { get; set; } = "all-apis offline_access";
    }

}
