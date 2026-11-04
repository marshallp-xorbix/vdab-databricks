import { ApplicationError } from "../application-error.ts";
import type { CallerIdentity } from "../contracts.ts";
import type { ProjectComponentsService } from "../db/project-components-service.ts";
import type { ProjectService } from "../db/project-service.ts";
import type { ProjectWorkflowService } from "../db/project-workflow-service.ts";
import type { ProjectCustomModulesService } from "../db/project-custom-modules-service.ts";
import {
  ProjectPreviewGenerator,
  type ProjectPreview,
} from "./project-preview-generator.ts";
import {
  getProjectDeploymentRequirements,
  type ProjectDeploymentRequirements,
} from "./preview-deployment-requirements.ts";

/** Generated source plus its user-authorization scope contract. */
export interface ProjectDeploymentSource {
  preview: ProjectPreview;
  requirements: ProjectDeploymentRequirements;
}

/** Applies project ACLs and version consistency before generating a source preview. */
export class ProjectPreviewService {
  private readonly projectService: ProjectService;
  private readonly projectComponentsService: ProjectComponentsService;
  private readonly projectWorkflowService: ProjectWorkflowService;
  private readonly projectCustomModulesService:
    | ProjectCustomModulesService
    | undefined;
  private readonly generator: ProjectPreviewGenerator;
  private readonly defaultSqlWarehouseId: string | null;

  constructor(
    projectService: ProjectService,
    projectComponentsService: ProjectComponentsService,
    projectWorkflowService: ProjectWorkflowService,
    projectCustomModulesService?: ProjectCustomModulesService,
    generator = new ProjectPreviewGenerator(),
    defaultSqlWarehouseId: string | null = null,
  ) {
    this.projectService = projectService;
    this.projectComponentsService = projectComponentsService;
    this.projectWorkflowService = projectWorkflowService;
    this.projectCustomModulesService = projectCustomModulesService;
    this.generator = generator;
    this.defaultSqlWarehouseId = defaultSqlWarehouseId;
  }

  /** Generates source only for a project the caller may edit. */
  async generatePreview(
    caller: CallerIdentity,
    requestId: string,
    projectId: string,
  ): Promise<ProjectPreview> {
    return (await this.generateDeploymentSource(caller, requestId, projectId))
      .preview;
  }

  /** Generates source and least-privilege scopes for one saved child-App deploy. */
  async generateDeploymentSource(
    caller: CallerIdentity,
    requestId: string,
    projectId: string,
  ): Promise<ProjectDeploymentSource> {
    const project = await this.projectService.getProject(
      caller,
      requestId,
      projectId,
    );

    if (
      project.callerRole !== "owner" &&
      project.callerRole !== "editor" &&
      project.callerRole !== "installationAdmin"
    ) {
      throw new ApplicationError(
        403,
        "preview_edit_permission_required",
        "Project edit permission required",
        "Only project editors can generate a source preview.",
      );
    }

    const components = await this.projectComponentsService.getComponents(
      caller,
      requestId,
      projectId,
    );
    const workflows = await this.projectWorkflowService.getWorkflow(
      caller,
      requestId,
      projectId,
    );
    const customModules = this.projectCustomModulesService
      ? await this.projectCustomModulesService.getCustomModules(
          caller,
          requestId,
          projectId,
        )
      : undefined;

    if (
      project.version !== components.version ||
      project.version !== workflows.version
    ) {
      throw new ApplicationError(
        409,
        "project_version_conflict",
        "Project changed during preview",
        "The project changed while its preview was being generated. Reload and try again.",
      );
    }
    if (customModules && project.version !== customModules.version) {
      throw new ApplicationError(
        409,
        "project_version_conflict",
        "Project changed during preview",
        "The project changed while its preview was being generated. Reload and try again.",
      );
    }

    const preview = this.generator.generate(
      project,
      components,
      workflows.workflow,
      customModules?.source,
    );
    return {
      preview,
      requirements: getProjectDeploymentRequirements(
        components.components,
        workflows.workflow,
        this.defaultSqlWarehouseId,
      ),
    };
  }
}
