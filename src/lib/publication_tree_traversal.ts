import type NDK from '@nostr-dev-kit/ndk';
import type { PublicationTreeNode } from './publication_tree';
import type { NDKEvent } from '@nostr-dev-kit/ndk';
import type PublicationTree from './publication_tree';

/**
 * Performs a depth-first search of a publication tree for a given event, adding missing nodes to
 * the tree as they are discovered.
 * @param targetId The ID of the event to find.
 * @param tree The publication tree to search.
 * @param ndk The NDK instance to use for fetching events.
 * @returns The target event if found, null otherwise.
 * @effects The publication tree is mutated by adding nodes as they are discovered.
 */
export async function depthFirstFindEvent(
  target: Readonly<NDKEvent> | string,
  tree: PublicationTree,
  ndk: Readonly<NDK>
): Promise<NDKEvent | null> {
  const targetId = typeof target === 'string'
    ? target
    : target.id;

  // If the target is already in the tree, return immediately.
  const existingNode = tree.getNode(targetId);
  if (existingNode) {
    return existingNode.event;
  }

  // Initialize the traversal stack with the root node.
  const stack: PublicationTreeNode[] = [tree.rootNode];

  while (stack.length > 0) {
    const currentNode = stack.pop()!;
    
    // Children are referenced as `a` tag addresses or `e` tag IDs.
    const childAddresses = currentNode.event.tags
      .filter(tag => tag[0] === 'a' || tag[0] === 'e')
      .map(tag => tag[1]);
    if (childAddresses.length === 0) continue;

    // Fetch any children that are not already in the tree.
    const unfetchedChildAddresses = childAddresses.filter(address => !tree.getNode(address));
    (await fetchEventsByAddresses(unfetchedChildAddresses, ndk))
      .forEach(event => {
        if (event) tree.addNode(event, currentNode.event.id);
      });

    // Return if the target is found.
    if (tree.getNode(targetId)) {
      return tree.getNode(targetId)!.event;
    }

    // Add all children to the stack.
    const children = tree.getChildren(currentNode.event);
    stack.push(...children);
  }

  // If we get here, we the target is not in the tree.
  return null;
}

async function fetchEventsByAddresses(
  addresses: string[],
  ndk: NDK
): Promise<Array<NDKEvent | null>> {
  const fetchPromises = addresses.map(address => {
    const segments = address.split(':');
    // TODO: Handle fetch options and relay selection.
    switch (segments.length) {
      case 1: {
        const [id] = segments;
        return ndk.fetchEvent(id);
      }
      case 2: {
        const [kind, pubkey] = segments;
        return ndk.fetchEvent({
          kinds: [Number(kind)],
          authors: [pubkey],
        });
      }
      case 3: {
        const [kind, pubkey, dTag] = segments;
        return ndk.fetchEvent({
          kinds: [Number(kind)],
          authors: [pubkey],
          '#d': [dTag],
        });
      }
      default: {
        throw new Error(`Address ${address} is in an unsupported format.`);
      }
    }
  });

  return Promise.all(fetchPromises);
}
