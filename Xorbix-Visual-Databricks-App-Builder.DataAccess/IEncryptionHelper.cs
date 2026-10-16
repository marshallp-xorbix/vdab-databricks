namespace Xorbix_Visual_Databricks_App_Builder.DataAccess
{
    public interface IEncryptionHelper
    {
        /// <summary>
        /// Encrypts the provided plain text using ASP.NET Core Data Protection.
        /// </summary>
        /// <param name="plainText">The text to encrypt.</param>
        /// <returns>The encrypted text.</returns>
        string Encrypt(string plainText);

        /// <summary>
        /// Decrypts the provided cipher text using ASP.NET Core Data Protection.
        /// </summary>
        /// <param name="cipherText">The text to decrypt.</param>
        /// <returns>The decrypted text, or empty string if decryption fails.</returns>
        string Decrypt(string cipherText);

        /// <summary>
        /// Encrypts the provided plain text using AES with a static key (Legacy).
        /// </summary>
        /// <param name="plainText">The text to encrypt.</param>
        /// <returns>The encrypted text.</returns>
        string EncryptAes(string plainText);

        /// <summary>
        /// Decrypts the provided cipher text using AES with a static key (Legacy).
        /// </summary>
        /// <param name="cipherText">The text to decrypt.</param>
        /// <returns>The decrypted text, or empty string if decryption fails.</returns>
        string DecryptAes(string cipherText);
    }
}

