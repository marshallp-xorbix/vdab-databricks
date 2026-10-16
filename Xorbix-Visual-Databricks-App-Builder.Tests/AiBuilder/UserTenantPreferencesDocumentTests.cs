using Xorbix_Visual_Databricks_App_Builder.Models;

namespace Xorbix_Visual_Databricks_App_Builder.Tests.AiBuilder;

public class UserTenantPreferencesDocumentTests
{
    [Fact]
    public void SetIntOrRemove_AddAndRemoveKey_UpdatesJson()
    {
        string json = UserTenantPreferencesDocument.SetIntOrRemove(
            "{}",
            UserTenantPreferenceKeys.AiBuilderSelectedModelId,
            7);

        Assert.Equal(7, UserTenantPreferencesDocument.GetInt(json, UserTenantPreferenceKeys.AiBuilderSelectedModelId));

        string cleared = UserTenantPreferencesDocument.SetIntOrRemove(
            json,
            UserTenantPreferenceKeys.AiBuilderSelectedModelId,
            null);

        Assert.Equal("{}", cleared);
        Assert.Null(UserTenantPreferencesDocument.GetInt(cleared, UserTenantPreferenceKeys.AiBuilderSelectedModelId));
    }

    [Fact]
    public void ContainsIntValue_MatchesStoredValue()
    {
        string json = UserTenantPreferencesDocument.SetIntOrRemove(
            "{}",
            UserTenantPreferenceKeys.AiBuilderSelectedModelId,
            3);

        Assert.True(UserTenantPreferencesDocument.ContainsIntValue(
            json,
            UserTenantPreferenceKeys.AiBuilderSelectedModelId,
            3));
        Assert.False(UserTenantPreferencesDocument.ContainsIntValue(
            json,
            UserTenantPreferenceKeys.AiBuilderSelectedModelId,
            4));
    }
}
