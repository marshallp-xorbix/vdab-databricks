using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Xorbix_Visual_Databricks_App_Builder.Models.EF
{
    /// <summary>
    /// Represents an app in VDAB.
    /// </summary>
    public class App : TrackableEntity
    {
        /// <summary>
        /// Primary key for the app record.
        /// </summary>
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int PkId { get; set; }

        /// <summary>
        /// Foreign key referencing the ApplicationUser who owns this app.
        /// </summary>

        public Guid OwnerId { get; set; }

        /// <summary>
        /// Navigation property for the associated user.
        /// </summary>
        /// 

        [ForeignKey(nameof(OwnerId))]
        public virtual ApplicationUser? User { get; set; }

        /// <summary>
        /// The display name or identifier for the app.
        /// </summary>
        [Required]
        [MaxLength(255)]
        public required string AppName { get; set; }

        /// <summary>
        /// The name of the app in Databricks.
        /// </summary>
        [MaxLength(255)]
        public string? DatabricksAppName { get; set; }

        /// <summary>
        /// The description of the app.
        /// </summary>
        [MaxLength(255)]
        public string? Description { get; set; }

        /// <summary>
        /// The tenant ID of the app. This is nullable for right now.
        /// </summary>
        public Guid? TenantId { get; set; }

        /// <summary>
        /// Foreign Key referencing the DatabricksConnection that this app is associated with.
        /// </summary>
        public int WorkspaceConnectionId { get; set; }

        /// <summary>
        /// Navigation property for the associated workspace connection.
        /// </summary>
        [ForeignKey(nameof(WorkspaceConnectionId))]
        public virtual DatabricksConnection? WorkspaceConnection { get; set; }

        /// <summary>
        /// The path to the workspace where the app files are uploaded..
        /// </summary>
        [MaxLength(2048)]
        public string? WorkspacePath { get; set; }

        /// <summary>
        /// The version of the app.
        /// </summary>
        public int Version { get; set; }

        /// <summary>
        /// Timestamp for last published version.
        /// </summary>
        public DateTime? LastPublishedAt { get; set; }

        /// <summary>
        /// The JSON theme of colors.
        /// </summary>
        public string? Theme { get; set; }

        /// <summary>
        /// The app-level workflow definition document.
        /// </summary>
        public string WorkflowDefinition { get; set; } = "{\"version\":1,\"workflows\":[]}";

        /// <summary>
        /// User-editable Python module (<c>custom_modules.py</c>) uploaded alongside generated Streamlit artifacts.
        /// </summary>
        public string? CustomModulesCode { get; set; }

    }
}
