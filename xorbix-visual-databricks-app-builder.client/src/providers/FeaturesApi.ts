import FeatureManagement from "../models/FeatureManagement";
import { BaseApi } from "./BaseApi";

/**
 * API client for feature flag checks. The backend exposes one endpoint per
 * feature under `/api/Features/{FeatureName}`; route names are PascalCase
 * (matching `FeatureManagementNames` constants), while the TS keys on
 * {@link FeatureManagement} are camelCase, so keys are capitalized on the way out.
 */
export class FeaturesApi extends BaseApi {
  async getFeatureGate(feature: string): Promise<boolean> {
    try {
      return await this.get<boolean>(`/api/Features/${feature}`);
    } catch {
      return false;
    }
  }

  async getFeatureGates(): Promise<FeatureManagement> {
    const featureManagement = new FeatureManagement();
    const keys = FeatureManagement.getKeys(featureManagement);
    const tasks = keys.map(async (key) => {
      const route = key.charAt(0).toUpperCase() + key.slice(1);
      featureManagement[key] = await this.getFeatureGate(route);
    });
    await Promise.all(tasks);
    featureManagement.isLoaded = true;
    return featureManagement;
  }
}

export const featuresApi = new FeaturesApi();
