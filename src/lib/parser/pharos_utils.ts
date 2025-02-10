import type { NDKEvent } from '@nostr-dev-kit/ndk';
import type PublicationTree from '../publication_tree/publication_tree';
import type NDK from '@nostr-dev-kit/ndk';
import { zettelKinds } from '$lib/consts';
import Pharos from './pharos';

/**
 * Retrieves the content of a section of a publication.  A section forms a subtree of a publication
 * tree.
 * @param root The root event of the section, or the root event's ID or address.
 * @param tree The publication tree from which to retrieve the subtree contents.
 * @returns The content of the subtree starting at the given root event, formatted as an AsciiDoc
 * document.
 */
export async function getSectionContent(
  root: Readonly<NDKEvent | string>,
  tree: Readonly<PublicationTree>,
): Promise<string> {
  const rootNode = tree.getNode(root);

  if (rootNode == null) {
    throw new Error('Root event not found.');
  }

  const depth = tree.getNodeDepth(root);

  // Format title into AsciiDoc header.
  let content: string = '';
  const title = rootNode.event.getMatchingTags('title')[0][1];
  let titleLevel = '';
  for (let i = 0; i <= depth; i++) {
    titleLevel += '=';
  }
  content += `${titleLevel} ${title}\n\n`;

  // Base case: The event is a zettel.
  // In this case, simply return the content.
  if (zettelKinds.includes(rootNode.event.kind ?? -1)) {
    content += rootNode.event.content;
    return content;
  }

  // Recursive case: The event is an index.
  // In this case, recursively get the content of the children.
  const children = tree.getChildren(rootNode.event);
  for (const child of children) {
    content += await getSectionContent(child.event, tree);
  }

  return content;
}
