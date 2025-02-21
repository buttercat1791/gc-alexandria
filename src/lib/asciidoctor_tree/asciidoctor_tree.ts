import type { AbstractNode } from '@asciidoctor/core';
import type { AbstractBlock } from 'asciidoctor';
import type { EventTree, EventTreeNode } from '$lib/event_tree/event_tree';
import he from 'he';

export interface AsciidoctorTreeNode extends EventTreeNode {
  node: AbstractNode;
  dTag: string;
  title: string;
  content?: string;
  parent?: AsciidoctorTreeNode;
  children: AsciidoctorTreeNode[];
}

export default class AsciidoctorTree implements EventTree {
  private root: AsciidoctorTreeNode;
  private nodes: Map<string, AsciidoctorTreeNode> = new Map();

  constructor(root: AbstractNode) {
    this.root = {
      node: root,
      dTag: this.normalizeId(root.getId())!,
      title: (root as AbstractBlock).getTitle()!,
      children: [],
    };
  }

  // #region EventTree Implementation

  getRootNode(): AsciidoctorTreeNode {
    return this.root;
  }

  getNodeByDTag(dTag: string): AsciidoctorTreeNode {
    return this.nodes.get(dTag)!;
  }

  addNode(node: AsciidoctorTreeNode, parentNode: AsciidoctorTreeNode): void {
    this.nodes.set(node.dTag!, node);
    this.getNodeByDTag(parentNode.dTag!).children.push(node);
  }

  clear(): void {
    this.nodes.clear();
  }

  // #endregion

  // #region Iterable<EventTreeNode> Implementation

  /**
   * Iterates over the leaf nodes of the tree in depth-first order.
   */
  *[Symbol.iterator](): IterableIterator<EventTreeNode> {
    const stack: AsciidoctorTreeNode[] = [this.root];

    while (stack.length > 0) {
      const node = stack.pop()!;

      // Base case: the node is a leaf, so we yield it.
      if (node.children.length === 0) {
        yield node;
        continue;
      }

      // Recursive case: the node is not a leaf, so we push its children onto the stack.
      // We push the children in LIFO order to ensure that the children are visited in the correct
      // order.
      for (let i = node.children.length - 1; i >= 0; i--) {
        stack.push(node.children[i]);
      }
    }
  }

  // #endregion

  // #region Private Helpers

  private normalizeId(input?: string): string | null {
    if (input == null || input.length === 0) {
      return null;
    }

    return he.decode(input)
      .toLowerCase()
      .replace(/[_]/g, ' ')  // Replace underscores with spaces.
      .trim()
      .replace(/\s+/g, '-')  // Replace spaces with dashes.
      .replace(/[^a-z0-9\-]/g, '');  // Remove non-alphanumeric characters except dashes.
  }

  // #endregion
}
