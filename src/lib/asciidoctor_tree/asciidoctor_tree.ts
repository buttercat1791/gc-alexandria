import type { AbstractNode } from '@asciidoctor/core';
import type { AbstractBlock } from 'asciidoctor';
import type { EventTree, EventTreeNode } from '$lib/parser/pharos';
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
