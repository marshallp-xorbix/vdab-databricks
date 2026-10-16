using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;

namespace Xorbix_Visual_Databricks_App_Builder.Models.EF
{
    /// <summary>
    /// Represents an app component in an app in VDAB.
    /// </summary>
    public class AppComponent : TrackableEntity
    {
        /// <summary>
        /// Primary key for the app component record.
        /// </summary>
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int PkId { get; set; }

        /// <summary>
        /// Foreign key referencing the App that this component is associated with.
        /// </summary>
        
        public int AppId { get; set; }

        /// <summary>
        /// Navigation property for the associated app.
        /// </summary>
        /// 

        [ForeignKey(nameof(AppId))] 
        public virtual App? App { get; set; }

        /// <summary>
        /// The description of the app component.
        /// </summary>
        [MaxLength(255)]
        public string? Description { get; set; }

        /// <summary>
        /// The user-editable and persisted code name of the app component.
        /// </summary>
        [MaxLength(255)]
        public string? CodeName { get; set; }

        /// <summary>
        /// The type of the app component.
        /// </summary>
        public ComponentType ComponentType { get; set; }

        /// <summary>
        /// The version of the app component.
        /// </summary>
        public int ComponentVersion { get; set; }

        /// <summary>
        /// The JSON properties of the app component.
        /// </summary>
        /// 
        public required string Properties { get; set; }

        /// <summary>
        /// The JSON bindings of the app component.
        /// </summary>
        public string? Bindings { get; set; }

        /// <summary>
        /// The JSON children of the app component.
        /// </summary>
        public string? Children { get; set; }

        /// <summary>
        /// The JSON layout metadata of the app component (e.g., {"y": 3}).
        /// </summary>
        public string? Layout { get; set; }

    }
}
