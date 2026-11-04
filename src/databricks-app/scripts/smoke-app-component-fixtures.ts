import { createSmokeControlFixtures } from "./smoke-app-control-fixtures.ts";
import { createSmokeDataFixtures } from "./smoke-app-data-fixtures.ts";
import { createSmokeStoryFixturesOne } from "./smoke-app-story-fixtures-one.ts";
import { createSmokeStoryFixturesTwo } from "./smoke-app-story-fixtures-two.ts";
import { createSmokeStoryFixturesThree } from "./smoke-app-story-fixtures-three.ts";
import { createSmokeEmbeddedFixtures } from "./smoke-app-embedded-fixtures.ts";

/** Ordered component fixture used to exercise every supported editor category. */
const dataFixtures = createSmokeDataFixtures();

export const SMOKE_COMPONENTS = [
  ...createSmokeControlFixtures(),
  ...dataFixtures.components,
  ...createSmokeStoryFixturesOne(dataFixtures.chartBindings),
  ...createSmokeStoryFixturesTwo(dataFixtures.chartBindings),
  ...createSmokeStoryFixturesThree(dataFixtures.chartBindings),
  ...createSmokeEmbeddedFixtures(),
];
