using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents
{
    public class ModalProps
    {
        public string Title { get; set; } = "Modal Title";
        public int? Width { get; set; } = null;
        public int? Height { get; set; } = null;
    }

    public class ModalComponentDto : VdabComponentDto
    {
        public required ModalProps Props { get; set; }
    }
}
