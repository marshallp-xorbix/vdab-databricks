import {
  closestCenter,
  pointerWithin,
  rectIntersection,
  type Collision,
  type CollisionDetection,
} from "@dnd-kit/core";

/** Prefers the smallest eligible layout when nested drop zones overlap. */
function preferLayoutCollisions(
  collisions: Collision[],
  droppableContainers: Parameters<CollisionDetection>[0]["droppableContainers"],
): Collision[] {
  if (collisions.length <= 1) return collisions;

  const layoutCollisions = collisions.filter((collision) => {
    const container = droppableContainers.find(
      (candidate) => candidate.id === collision.id,
    );
    return container?.data.current?.dropType === "layout";
  });
  if (layoutCollisions.length === 0) return collisions;

  const smallestLayoutCollision = layoutCollisions
    .map((collision) => {
      const container = droppableContainers.find(
        (candidate) => candidate.id === collision.id,
      );
      const rectangle = container?.rect.current;
      return {
        collision,
        area: rectangle ? rectangle.width * rectangle.height : Number.MAX_SAFE_INTEGER,
      };
    })
    .sort((left, right) => left.area - right.area)[0];

  return smallestLayoutCollision ? [smallestLayoutCollision.collision] : collisions;
}

/** Matches SaaS nested-container collision behavior for canvas dragging. */
export const nestedLayoutFirstCollisionDetection: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);
  if (pointerCollisions.length > 0) {
    return preferLayoutCollisions(pointerCollisions, args.droppableContainers);
  }

  const intersectCollisions = rectIntersection(args);
  if (intersectCollisions.length > 0) {
    return preferLayoutCollisions(intersectCollisions, args.droppableContainers);
  }

  return closestCenter(args);
};
