using Microsoft.AspNetCore.DataProtection;
using Microsoft.Extensions.Configuration;
using System.Security.Cryptography;
using System.Text;

namespace Xorbix_Visual_Databricks_App_Builder.DataAccess;

public class EncryptionHelper : IEncryptionHelper
{
    private readonly IDataProtector _protector;
    private readonly string _legacyKey;
    private readonly string _legacyIv;

    public EncryptionHelper(IDataProtectionProvider provider, IConfiguration configuration)
    {
        // Purpose string must be consistent to decrypt data later
        _protector = provider.CreateProtector("Xorbix.Databricks.Connection.Encryption");
        _legacyKey = configuration["Encryption:LegacyKey"] ?? string.Empty;
        _legacyIv = configuration["Encryption:LegacyIv"] ?? string.Empty;
    }

    /// <inheritdoc />
    public string Encrypt(string plainText)
    {
        if (string.IsNullOrEmpty(plainText)) return string.Empty;
        return _protector.Protect(plainText);
    }

    /// <inheritdoc />
    public string Decrypt(string cipherText)
    {
        if (string.IsNullOrEmpty(cipherText)) return string.Empty;
        try
        {
            return _protector.Unprotect(cipherText);
        }
        catch
        {
            // Decryption failed (e.g. invalid key, tampered data, or old format)
            return string.Empty;
        }
    }

    /// <inheritdoc />
    public string EncryptAes(string plainText)
    {
        if (string.IsNullOrEmpty(plainText)) return string.Empty;
        if (string.IsNullOrEmpty(_legacyKey) || string.IsNullOrEmpty(_legacyIv)) return string.Empty;

        using var aes = Aes.Create();
        aes.Key = Encoding.UTF8.GetBytes(_legacyKey);
        aes.IV = Encoding.UTF8.GetBytes(_legacyIv);

        var encryptor = aes.CreateEncryptor(aes.Key, aes.IV);

        using var ms = new MemoryStream();
        using (var cs = new CryptoStream(ms, encryptor, CryptoStreamMode.Write))
        using (var sw = new StreamWriter(cs))
        {
            sw.Write(plainText);
        }

        return Convert.ToBase64String(ms.ToArray());
    }

    /// <inheritdoc />
    public string DecryptAes(string cipherText)
    {
        if (string.IsNullOrEmpty(cipherText)) return string.Empty;
        if (string.IsNullOrEmpty(_legacyKey) || string.IsNullOrEmpty(_legacyIv)) return string.Empty;

        try
        {
            using var aes = Aes.Create();
            aes.Key = Encoding.UTF8.GetBytes(_legacyKey);
            aes.IV = Encoding.UTF8.GetBytes(_legacyIv);

            var decryptor = aes.CreateDecryptor(aes.Key, aes.IV);

            using var ms = new MemoryStream(Convert.FromBase64String(cipherText));
            using var cs = new CryptoStream(ms, decryptor, CryptoStreamMode.Read);
            using var sr = new StreamReader(cs);

            return sr.ReadToEnd();
        }
        catch
        {
            return string.Empty;
        }
    }
}
