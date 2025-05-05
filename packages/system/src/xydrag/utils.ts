import { type NodeDragItem, type XYPosition, InternalNodeBase, NodeBase } from '../types';

export function hasSelector(target: Element | EventTarget | null, selector: string, domNode: Element): boolean {
  let current = target as Partial<Element> | null | undefined;

  do {
    if (current?.matches?.(selector)) return true;
    if (current === domNode) return false;
    current = current?.parentElement;
  } while (current);

  return false;
}

export function getDragItems<NodeType extends NodeBase>(
  nodeLookup: Map<string, InternalNodeBase<NodeType>>,
  nodesDraggable: boolean,
  mousePos: XYPosition,
  nodeId?: string
): Map<string, NodeDragItem> {
  function parentDragReplacementOrNode(node: InternalNodeBase<NodeType>): InternalNodeBase<NodeType> {
    if (node.parentId && node.dragParent) {
      const parentNode = nodeLookup.get(node.parentId);
      if (parentNode) {
        return parentDragReplacementOrNode(parentNode);
      }
    }
    return node;
  }

  const nodesToDragIds: string[] = Array.from(nodeLookup.values())
    .filter((node) => node.selected || node.id === nodeId)
    .map((node) => parentDragReplacementOrNode(node))
    .flatMap((node) => [node.id, ...(node.dragChildrenIds || [])]);

  const dragItems = new Map<string, NodeDragItem>();

  for (const [id, node] of nodeLookup) {
    if (
      nodesToDragIds.includes(id) &&
      (!node.parentId || !nodesToDragIds.includes(node.parentId)) &&
      (node.draggable || (nodesDraggable && typeof node.draggable === 'undefined'))
    ) {
      const internalNode = nodeLookup.get(id);

      if (internalNode) {
        dragItems.set(id, {
          id,
          position: internalNode.position || { x: 0, y: 0 },
          distance: {
            x: mousePos.x - internalNode.internals.positionAbsolute.x,
            y: mousePos.y - internalNode.internals.positionAbsolute.y,
          },
          extent: internalNode.extent,
          parentId: internalNode.parentId,
          origin: internalNode.origin,
          expandParent: internalNode.expandParent,
          internals: {
            positionAbsolute: internalNode.internals.positionAbsolute || { x: 0, y: 0 },
          },
          measured: {
            width: internalNode.measured.width ?? 0,
            height: internalNode.measured.height ?? 0,
          },
        });
      }
    }
  }

  return dragItems;
}

/*
 * returns two params:
 * 1. the dragged node (or the first of the list, if we are dragging a node selection)
 * 2. array of selected nodes (for multi selections)
 */
export function getEventHandlerParams<NodeType extends InternalNodeBase>({
  nodeId,
  dragItems,
  nodeLookup,
  dragging = true,
}: {
  nodeId?: string;
  dragItems: Map<string, NodeDragItem>;
  nodeLookup: Map<string, NodeType>;
  dragging?: boolean;
}): [NodeBase, NodeBase[]] {
  const nodesFromDragItems: NodeBase[] = [];

  for (const [id, dragItem] of dragItems) {
    const node = nodeLookup.get(id)?.internals.userNode;

    if (node) {
      nodesFromDragItems.push({
        ...node,
        position: dragItem.position,
        dragging,
      });
    }
  }

  if (!nodeId) {
    return [nodesFromDragItems[0], nodesFromDragItems];
  }

  const node = nodeLookup.get(nodeId)?.internals.userNode;

  return [
    !node
      ? nodesFromDragItems[0]
      : {
          ...node,
          position: dragItems.get(nodeId)?.position || node.position,
          dragging,
        },
    nodesFromDragItems,
  ];
}
