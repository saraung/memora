export interface ThreadableComment {
  id: string;
  parent_id: string | null;
  created_at: string;
}

export interface CommentThread<T> {
  comment: T;
  replies: T[];
}

/**
 * Group a flat, newest-first comment list into one level of threads.
 *
 * A comment is a root when its `parent_id` is null or its parent isn't part of
 * the loaded page; otherwise it's nested under its top-most loaded ancestor.
 * Replies are ordered oldest-first so a thread reads top-to-bottom.
 */
export function threadComments<T extends ThreadableComment>(
  items: T[],
): CommentThread<T>[] {
  const byId = new Map(items.map((c) => [c.id, c]));
  const roots: CommentThread<T>[] = [];
  const rootById = new Map<string, CommentThread<T>>();

  const topAncestor = (comment: T): T => {
    let cursor = comment;
    const seen = new Set<string>([comment.id]);
    while (
      cursor.parent_id &&
      byId.has(cursor.parent_id) &&
      !seen.has(cursor.parent_id)
    ) {
      cursor = byId.get(cursor.parent_id)!;
      seen.add(cursor.id);
    }
    return cursor;
  };

  for (const comment of items) {
    if (topAncestor(comment).id === comment.id) {
      const node = { comment, replies: [] as T[] };
      rootById.set(comment.id, node);
      roots.push(node);
    }
  }

  for (const comment of items) {
    if (rootById.has(comment.id)) continue;
    const root = rootById.get(topAncestor(comment).id);
    if (root) root.replies.push(comment);
  }

  for (const node of roots) {
    node.replies.sort((a, b) => a.created_at.localeCompare(b.created_at));
  }

  return roots;
}
