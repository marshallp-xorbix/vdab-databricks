export interface IProjectCollaborator {
  userId: string;
  role: "editor";
  grantedBy: string;
  createdAt: string;
}

export class ProjectCollaborator implements IProjectCollaborator {
  userId: string;
  role: "editor";
  grantedBy: string;
  createdAt: string;

  constructor(source: IProjectCollaborator) {
    this.userId = source.userId;
    this.role = source.role;
    this.grantedBy = source.grantedBy;
    this.createdAt = source.createdAt;
  }
}
