export interface AddComponentOptions {
  parentId?: string;
  childIndex?: number;
  /** Only used when parent is a Tabs component */
  tabIndex?: number;
  onComplete?: () => void;
}
