import {
  ConnectionMode,
  EdgeLookup,
  getEdgePosition,
  NodeLookup,
  pointToRendererPoint,
  Position,
  Rect,
  Transform,
} from '@xyflow/system';

// This is used to detect which edges are inside a selection rectangle
// It only supports flows with all bezier edges
export default function getEdgesInside(
  rect: Rect,
  [tx, ty, tScale]: Transform = [0, 0, 1],
  edgeLookup: EdgeLookup,
  nodeLookup: NodeLookup
) {
  // Convert the selection rectangle coordinates to flow coordinates
  const paneRect = {
    ...pointToRendererPoint(rect, [tx, ty, tScale]),
    width: rect.width / tScale,
    height: rect.height / tScale,
  };

  return [...edgeLookup.values()]
    .filter((edge) => edge.selectable !== false)
    .filter((edge) => {
      // Get the nodes connected to the edge
      const sourceNode = nodeLookup.get(edge.source);
      const targetNode = nodeLookup.get(edge.target);

      if (!sourceNode || !targetNode) {
        return false;
      }

      // Get the edge position details
      const edgePosition = getEdgePosition({
        id: edge.id,
        sourceNode: sourceNode,
        sourceHandle: edge.sourceHandle || null,
        targetNode: targetNode,
        targetHandle: edge.targetHandle || null,
        connectionMode: ConnectionMode.Loose,
        onError: undefined,
      });

      if (!edgePosition) {
        return false;
      }

      const { sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition } = edgePosition;

      // Get the control point for the bezier path
      const [sourceControlX, sourceControlY] = getControl(sourcePosition, sourceX, sourceY, targetX, targetY);

      const [targetControlX, targetControlY] = getControl(targetPosition, targetX, targetY, sourceX, sourceY);

      // Check if the bezier path intersects with the selection rectangle
      return bezierIntersectsRect(
        sourceX,
        sourceY,
        sourceControlX,
        sourceControlY,
        targetX,
        targetY,
        targetControlX,
        targetControlY,
        paneRect.x,
        paneRect.y,
        paneRect.x + paneRect.width,
        paneRect.y + paneRect.height
      );
    });
}

// Gets the control point for a bezier curve based on the position
function getControl(pos: Position, x1: number, y1: number, x2: number, y2: number): [number, number] {
  const c = 0.25; // default curvature

  function calculateControlOffset(distance: number, curvature: number): number {
    if (distance >= 0) {
      return 0.5 * distance;
    }

    return curvature * 25 * Math.sqrt(-distance);
  }

  switch (pos) {
    case Position.Left:
      return [x1 - calculateControlOffset(x1 - x2, c), y1];
    case Position.Right:
      return [x1 + calculateControlOffset(x2 - x1, c), y1];
    case Position.Top:
      return [x1, y1 - calculateControlOffset(y1 - y2, c)];
    case Position.Bottom:
      return [x1, y1 + calculateControlOffset(y2 - y1, c)];
  }
}

// Checks if a cubic Bézier curve intersects with a rectangle
function bezierIntersectsRect(
  sourceX: number,
  sourceY: number,
  sourceControlX: number,
  sourceControlY: number,
  targetX: number,
  targetY: number,
  targetControlX: number,
  targetControlY: number,
  rectStartX: number,
  rectStartY: number,
  rectEndX: number,
  rectEndY: number
): boolean {
  // Computes a point along a cubic Bézier curve at parameter t (0 to 1)
  function cubic(t: number, a: number, b: number, c: number, d: number): number {
    const mt = 1 - t;
    return mt ** 3 * a + 3 * mt ** 2 * t * b + 3 * mt * t ** 2 * c + t ** 3 * d;
  }

  // Checks if a point is inside the given rectangle
  function pointInRect(x: number, y: number): boolean {
    return x >= rectStartX && x <= rectEndX && y >= rectStartY && y <= rectEndY;
  }

  // Checks if two axis-aligned rectangles intersect
  function rectsIntersect(
    ax1: number,
    ay1: number,
    ax2: number,
    ay2: number,
    bx1: number,
    by1: number,
    bx2: number,
    by2: number
  ): boolean {
    return ax1 <= bx2 && ax2 >= bx1 && ay1 <= by2 && ay2 >= by1;
  }

  // Checks if two line segments intersect (p1–p2 vs p3–p4)
  function lineIntersects(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    x3: number,
    y3: number,
    x4: number,
    y4: number
  ): boolean {
    const det = (x2 - x1) * (y4 - y3) - (y2 - y1) * (x4 - x3);
    if (det === 0) return false; // lines are parallel

    const ua = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / det;
    const ub = ((x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3)) / det;

    return ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1;
  }

  // Early acceptance if either end of the bezier is inside the rectangle
  if (pointInRect(sourceX, sourceY) || pointInRect(targetX, targetY)) return true;

  // Compute the bounding box of the bezier using its control and end points
  const bezMinX = Math.min(sourceX, targetX, sourceControlX, targetControlX);
  const bezMaxX = Math.max(sourceX, targetX, sourceControlX, targetControlX);
  const bezMinY = Math.min(sourceY, targetY, sourceControlY, targetControlY);
  const bezMaxY = Math.max(sourceY, targetY, sourceControlY, targetControlY);

  console.log('checking bezier bounding box');

  // Early rejection if bezier bounding box does not intersect the rectangle
  if (!rectsIntersect(bezMinX, bezMinY, bezMaxX, bezMaxY, rectStartX, rectStartY, rectEndX, rectEndY)) return false;

  // Define the four edges of the rectangle as line segments
  const edges = [
    [rectStartX, rectStartY, rectEndX, rectStartY], // top
    [rectEndX, rectStartY, rectEndX, rectEndY], // right
    [rectEndX, rectEndY, rectStartX, rectEndY], // bottom
    [rectStartX, rectEndY, rectStartX, rectStartY], // left
  ];

  // Step through the bezier curve and check each line segment against the rectangle edges
  let prevX = sourceX;
  let prevY = sourceY;

  // Number of straight-line segments to approximate the bezier curve
  const steps = 5;

  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const x = cubic(t, sourceX, sourceControlX, targetControlX, targetX);
    const y = cubic(t, sourceY, sourceControlY, targetControlY, targetY);

    for (const [ex1, ey1, ex2, ey2] of edges) {
      if (lineIntersects(prevX, prevY, x, y, ex1, ey1, ex2, ey2)) return true;
    }

    prevX = x;
    prevY = y;
  }

  console.log('no intersection found');

  // No intersection found
  return false;
}
