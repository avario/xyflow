import {
  ConnectionLookup,
  ConnectionMode,
  EdgeLookup,
  getEdgePosition,
  NodeLookup,
  pointToRendererPoint,
  Position,
  Rect,
  Transform,
} from '@xyflow/system';
import { EdgeTypeSelectionFunctions } from '../../types';

// This is used to detect which edges are inside a selection rectangle
// It only supports flows with all bezier edges
export default function getEdgesInside(
  rect: Rect,
  [tx, ty, tScale]: Transform = [0, 0, 1],
  edgeLookup: EdgeLookup,
  nodeLookup: NodeLookup,
  edgeTypeSelectionFunctions: EdgeTypeSelectionFunctions | undefined
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
      const edgeType = edge.type;
      const selectionFunction = edgeType ? edgeTypeSelectionFunctions?.[edgeType] : undefined;

      if (selectionFunction) {
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

        return selectionFunction(edgePosition, paneRect);
      } else {
        return false;
      }
    });
}
