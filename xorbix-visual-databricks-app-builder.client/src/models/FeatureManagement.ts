/**
 * Interface for FeatureManagement, add each feature as a boolean property (e.g. placeholder: boolean)
 */
export interface IFeatureManagement {
  isLoaded: boolean; // Not a feature flag, but indicates whether the feature flags have been loaded
  enablePreRelease: boolean;
}

export default class FeatureManagement implements IFeatureManagement {
  public isLoaded: boolean = false;
  public enablePreRelease: boolean = false;

  constructor(args?: Partial<IFeatureManagement>) {
    if (args) {
      Object.assign(this, args);
    }
  }

  /**
   * Get the keys of the FeatureManagement instance, excluding 'isLoaded'.
   * @returns Array of keys excluding 'isLoaded'.
   */
  static getKeys(instance?: FeatureManagement): Array<keyof FeatureManagement> {
    instance ??= new FeatureManagement();
    return Object.keys(instance).filter((key) => key !== "isLoaded") as Array<
      keyof FeatureManagement
    >;
  }
}
