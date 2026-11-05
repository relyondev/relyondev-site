import type { CollectionConfig, GlobalConfig } from 'payload';
import { APIError } from 'payload';
import { documentText, locales, type Target } from '../services/contentDocuments.ts';
import { enqueue, removeTarget } from '../services/vectorStore.ts';

export function withEmbeddings(config: CollectionConfig): CollectionConfig {
  return { ...config, hooks: { ...config.hooks,
    beforeChange: [...(config.hooks?.beforeChange || []), ({ data, originalDoc, context }) => {
      // Opt-in legacy updates must match the revision exported by the caller.
      if (context.syncExpectedUpdatedAt && originalDoc?.updatedAt !== context.syncExpectedUpdatedAt) {
        throw new APIError('Content changed since export; review the CMS edit before importing.', 409);
      }
      return data;
    }],
    afterChange: [...(config.hooks?.afterChange || []), ({ doc, previousDoc, req }) => {
      if (previousDoc && documentText(config.slug, doc) === documentText(config.slug, previousDoc)) return doc;
      try {
        // Queue all locales; the worker reads the full authoritative entry after commit.
        for (const locale of locales) enqueue({ kind: 'collection', slug: config.slug, id: String(doc.id), locale });
      } catch { req.payload.logger.error('Semantic queue unavailable; reconciliation will retry.'); }
      return doc;
    }],
    afterDelete: [...(config.hooks?.afterDelete || []), ({ doc, req }) => {
      try { for (const locale of locales) removeTarget({ kind: 'collection', slug: config.slug, id: String(doc.id), locale }); }
      catch { req.payload.logger.error('Semantic cleanup delayed; reconciliation will retry.'); }
      return doc;
    }],
  } };
}
export function withGlobalEmbeddings(config: GlobalConfig): GlobalConfig {
  return { ...config, hooks: { ...config.hooks, afterChange: [...(config.hooks?.afterChange || []), ({ doc, previousDoc, req }) => {
    if (!previousDoc || documentText(config.slug, doc) !== documentText(config.slug, previousDoc)) {
      try { for (const locale of locales) enqueue({ kind: 'global', slug: config.slug, id: config.slug, locale } as Target); }
      catch { req.payload.logger.error('Semantic queue unavailable; reconciliation will retry.'); }
    }
    return doc;
  }] } };
}
