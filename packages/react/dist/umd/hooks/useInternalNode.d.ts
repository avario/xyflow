import type { InternalNode, Node } from '../types';
/**
 * This hook returns the internal representation of a specific node.
 * Components that use this hook will re-render **whenever the node changes**,
 * including when a node is selected or moved.
 *
 * @public
 * @param id - The ID of a node you want to observe.
 * @returns The `InternalNode` object for the node with the given ID.
 *
 * @example
 * ```tsx
 *import { useInternalNode } from '@xyflow/react';
 *
 *export default function () {
 *  const internalNode = useInternalNode('node-1');
 *  const absolutePosition = internalNode.internals.positionAbsolute;
 *
 *  return (
 *    <div>
 *      The absolute position of the node is at:
 *      <p>x: {absolutePosition.x}</p>
 *      <p>y: {absolutePosition.y}</p>
 *    </div>
 *  );
 *}
 *```
 */
export declare function useInternalNode<NodeType extends Node = Node>(id: string): InternalNode<NodeType> | undefined;
//# sourceMappingURL=useInternalNode.d.ts.map