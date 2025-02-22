import type { AbstractBlock, AbstractNode, Block, Document, Extensions, Section } from '@asciidoctor/core';
import type { EventTree, EventTreeNode } from '$lib/event_tree/event_tree';
import he from 'he';

export interface AsciidoctorTreeNode extends EventTreeNode<AbstractBlock> {
  node: AbstractBlock;
  address: string;
  title: string;
  content?: string;
  parent?: AsciidoctorTreeNode;
  children: AsciidoctorTreeNode[];
}

export default class AsciidoctorTree implements EventTree<AbstractBlock> {
  private root?: AsciidoctorTreeNode;
  private nodes: Map<string, AsciidoctorTreeNode> = new Map();
  private contextCounters: Map<string, number> = new Map();
  private eventToContextMap: Map<string, string> = new Map();
  private eventToKindMap: Map<string, number> = new Map();
  private pubkey: string;

  constructor(pubkey: string) {
    this.pubkey = pubkey;
  }

  // #region EventTree Implementation

  public getRootNode(): AsciidoctorTreeNode {
    if (this.root == null) {
      throw new Error('Root node not set.');
    }

    return this.root;
  }

  public getNodeByAddress(address: string): AsciidoctorTreeNode {
    return this.nodes.get(address)!;
  }

  public addNode<NodeType extends AbstractBlock>(
    node: NodeType,
    parentNode: AsciidoctorTreeNode
  ): void {
    const address = this.generateAddress(node);

    // Prevent duplicates.
    if (this.nodes.has(address)) {
      return;
    }

    const treeNode: AsciidoctorTreeNode = {
      node,
      address: address,
      title: node.getTitle()!,
      children: [],
    };

    this.nodes.set(address, treeNode);
    this.getNodeByAddress(parentNode.address).children.push(treeNode);
  }

  public clear(): void {
    this.nodes.clear();
  }

  // #endregion

  // #region Asciidoctor Tree Processing

  public processAST(treeProcessor: Extensions.TreeProcessor, document: Document): void {
    const rootAddress = this.generateAddress(document);
    this.root = {
      node: document,
      address: rootAddress,
      title: document.getTitle()!,
      children: [],
    };
    this.nodes.set(rootAddress, this.root);
    this.eventToKindMap.set(rootAddress, 30040);

    // FIFO queue (uses `Array.push()` and `Array.shift()`).
    const nodeQueue: AbstractNode[] = document.getBlocks();

    while (nodeQueue.length > 0) {
      const block = nodeQueue.shift();
      if (!block) {
        continue;
      }

      if (block.getContext() === 'section') {
        const children = this.processSection(block as Section);
        nodeQueue.push(...children);
      } else {
        this.processBlock(block as Block);
      }
    }

    // this.buildEventsByLevelMap(this.eventTree?.getRootNode().address!, 0);
  }

  private processSection(section: Section): AbstractNode[] {
    const address = this.generateAddress(section);
    const parentSection = section.getParent();

    let parentAddress = parentSection != null
      ? this.generateAddress(parentSection as AbstractBlock)
      : this.root!.address;

    const parentNode = this.getNodeByAddress(parentAddress);
    this.addNode(section, parentNode);
    this.eventToKindMap.set(address, 30040);

    return section.getBlocks();
  }

  private processBlock(block: Block): void {
    const address = this.generateAddress(block);
    const parentBlock = block.getParent();
    const parentAddress = parentBlock != null
      ? this.generateAddress(parentBlock as AbstractBlock)
      : this.root!.address;

    const parentNode = this.getNodeByAddress(parentAddress);
    this.addNode(block, parentNode);
    this.eventToKindMap.set(address, 30041);
  }

  // #endregion

  // #region Iterable<EventTreeNode> Implementation

  /**
   * Iterates over the leaf nodes of the tree in depth-first order.
   */
  *[Symbol.iterator](): IterableIterator<EventTreeNode<AbstractBlock>> {
    const stack: AsciidoctorTreeNode[] = [this.root!];

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

  /**
   * Generates an address for the given block.
   * @param block The block to generate an address for.
   * @returns The address for the given block.
   * @effect Updates the `id` property of the given block.
   */
  public generateAddress(block: AbstractBlock): string {
    let blockId: string | null = this.normalizeId(block.getId());

    if (blockId != null && blockId.length > 0) {
      return blockId;
    }

    blockId = this.normalizeId(block.getTitle());
    let isIndex = false;

    // Use the provided title, if possible.
    if (blockId != null && blockId.length > 0) {
      return blockId;
    }

    // In an `a` tag, as defined in NIP-01, the `d` tag identifier is the third segment of the
    // address.
    const documentDTag = this.getRootNode().address.split(':')[2];
    let blockNumber: number;

    const context = block.getContext();
    switch (context) {
    case 'admonition':
      blockNumber = this.contextCounters.get('admonition') ?? 0;
      blockId = `${documentDTag}-admonition-${blockNumber++}`;
      this.contextCounters.set('admonition', blockNumber);
      break;

    case 'audio':
      blockNumber = this.contextCounters.get('audio') ?? 0;
      blockId = `${documentDTag}-audio-${blockNumber++}`;
      this.contextCounters.set('audio', blockNumber);
      break;

    case 'colist':
      blockNumber = this.contextCounters.get('colist') ?? 0;
      blockId = `${documentDTag}-colist-${blockNumber++}`;
      this.contextCounters.set('colist', blockNumber);
      break;

    case 'dlist':
      blockNumber = this.contextCounters.get('dlist') ?? 0;
      blockId = `${documentDTag}-dlist-${blockNumber++}`;
      this.contextCounters.set('dlist', blockNumber);
      break;

    case 'document':
      blockNumber = this.contextCounters.get('document') ?? 0;
      blockId = `${documentDTag}-document-${blockNumber++}`;
      this.contextCounters.set('document', blockNumber);
      break;

    case 'example':
      blockNumber = this.contextCounters.get('example') ?? 0;
      blockId = `${documentDTag}-example-${blockNumber++}`;
      this.contextCounters.set('example', blockNumber);
      break;

    case 'floating_title':
      blockNumber = this.contextCounters.get('floating_title') ?? 0;
      blockId = `${documentDTag}-floating-title-${blockNumber++}`;
      this.contextCounters.set('floating_title', blockNumber);
      break;

    case 'image':
      blockNumber = this.contextCounters.get('image') ?? 0;
      blockId = `${documentDTag}-image-${blockNumber++}`;
      this.contextCounters.set('image', blockNumber);
      break;

    case 'list_item':
      blockNumber = this.contextCounters.get('list_item') ?? 0;
      blockId = `${documentDTag}-list-item-${blockNumber++}`;
      this.contextCounters.set('list_item', blockNumber);
      break;

    case 'listing':
      blockNumber = this.contextCounters.get('listing') ?? 0;
      blockId = `${documentDTag}-listing-${blockNumber++}`;
      this.contextCounters.set('listing', blockNumber);
      break;

    case 'literal':
      blockNumber = this.contextCounters.get('literal') ?? 0;
      blockId = `${documentDTag}-literal-${blockNumber++}`;
      this.contextCounters.set('literal', blockNumber);
      break;

    case 'olist':
      blockNumber = this.contextCounters.get('olist') ?? 0;
      blockId = `${documentDTag}-olist-${blockNumber++}`;
      this.contextCounters.set('olist', blockNumber);
      break;

    case 'open':
      blockNumber = this.contextCounters.get('open') ?? 0;
      blockId = `${documentDTag}-open-${blockNumber++}`;
      this.contextCounters.set('open', blockNumber);
      break;

    case 'page_break':
      blockNumber = this.contextCounters.get('page_break') ?? 0;
      blockId = `${documentDTag}-page-break-${blockNumber++}`;
      this.contextCounters.set('page_break', blockNumber);
      break;

    case 'paragraph':
      blockNumber = this.contextCounters.get('paragraph') ?? 0;
      blockId = `${documentDTag}-paragraph-${blockNumber++}`;
      this.contextCounters.set('paragraph', blockNumber);
      break;

    case 'pass':
      blockNumber = this.contextCounters.get('pass') ?? 0;
      blockId = `${documentDTag}-pass-${blockNumber++}`;
      this.contextCounters.set('pass', blockNumber);
      break;

    case 'preamble':
      blockNumber = this.contextCounters.get('preamble') ?? 0;
      blockId = `${documentDTag}-preamble-${blockNumber++}`;
      this.contextCounters.set('preamble', blockNumber);
      break;

    case 'quote':
      blockNumber = this.contextCounters.get('quote') ?? 0;
      blockId = `${documentDTag}-quote-${blockNumber++}`;
      this.contextCounters.set('quote', blockNumber);
      break;

    case 'section':
      isIndex = true;
      blockNumber = this.contextCounters.get('section') ?? 0;
      blockId = `${documentDTag}-section-${blockNumber++}`;
      this.contextCounters.set('section', blockNumber);
      break;

    case 'sidebar':
      blockNumber = this.contextCounters.get('sidebar') ?? 0;
      blockId = `${documentDTag}-sidebar-${blockNumber++}`;
      this.contextCounters.set('sidebar', blockNumber);
      break;

    case 'table':
      blockNumber = this.contextCounters.get('table') ?? 0;
      blockId = `${documentDTag}-table-${blockNumber++}`;
      this.contextCounters.set('table', blockNumber);
      break;

    case 'table_cell':
      blockNumber = this.contextCounters.get('table_cell') ?? 0;
      blockId = `${documentDTag}-table-cell-${blockNumber++}`;
      this.contextCounters.set('table_cell', blockNumber);
      break;

    case 'thematic_break':
      blockNumber = this.contextCounters.get('thematic_break') ?? 0;
      blockId = `${documentDTag}-thematic-break-${blockNumber++}`;
      this.contextCounters.set('thematic_break', blockNumber);
      break;

    case 'toc':
      blockNumber = this.contextCounters.get('toc') ?? 0;
      blockId = `${documentDTag}-toc-${blockNumber++}`;
      this.contextCounters.set('toc', blockNumber);
      break;

    case 'ulist':
      blockNumber = this.contextCounters.get('ulist') ?? 0;
      blockId = `${documentDTag}-ulist-${blockNumber++}`;
      this.contextCounters.set('ulist', blockNumber);
      break;

    case 'verse':
      blockNumber = this.contextCounters.get('verse') ?? 0;
      blockId = `${documentDTag}-verse-${blockNumber++}`;
      this.contextCounters.set('verse', blockNumber);
      break;

    case 'video':
      blockNumber = this.contextCounters.get('video') ?? 0;
      blockId = `${documentDTag}-video-${blockNumber++}`;
      this.contextCounters.set('video', blockNumber);
      break;

    default:
      blockNumber = this.contextCounters.get('block') ?? 0;
      blockId = `${documentDTag}-block-${blockNumber++}`;
      this.contextCounters.set('block', blockNumber);
      break;
    }

    if (isIndex) {
      this.eventToKindMap.set(blockId, 30040);
      blockId = `30040:${this.pubkey}:${blockId}`;
    } else {
      this.eventToKindMap.set(blockId, 30041);
      blockId = `30041:${this.pubkey}:${blockId}`;
    }

    block.setId(blockId);
    this.eventToContextMap.set(blockId, context);

    return blockId;
  }

  // #endregion
}
