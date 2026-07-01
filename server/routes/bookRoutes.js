const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');
const c = require('../controllers/bookController');

// IMPORTANT: literal path segments (like `/annotations` and `/reading-state`)
// MUST be declared BEFORE the `/:id` catch-all routes, otherwise Express
// matches "annotations" / "reading-state" as an :id value and tries to
// cast it into a Mongo ObjectId.

// ── Taxonomy (any auth user) ──
router.get('/taxonomy',                    auth, c.getTaxonomy);
router.get('/:id/knowledge',               auth, c.getKnowledge);

// ── Annotations (user-scoped) — declare before /:id routes ──
router.post('/annotations',                auth, c.createAnnotation);
router.post('/annotations/bulk',           auth, c.createAnnotationsBulk);
router.post('/annotations/bulk-delete',    auth, c.deleteAnnotationsBulk);
router.get('/annotations',                 auth, c.listAnnotations);
router.delete('/annotations/:id',          auth, c.deleteAnnotation);

// ── Reading state (bookmarks + progress) — declare before /:id routes ──
router.post('/reading-state',              auth, c.upsertReadingState);
router.get('/reading-state',               auth, c.getReadingState);
router.delete('/reading-state/bookmark/:id', auth, c.removeBookmark);

// ── Browse (any auth user) — /:id routes LAST so they don't shadow literals ──
router.get('/',                            auth, c.listBooks);
router.get('/:id',                         auth, c.getBookDetail);
router.get('/:id/chapters',                auth, c.listChapters);
router.get('/:id/chapters/:cid/pdf',       auth, c.streamChapterPdf);
router.get('/:id/chapters/:cid',           auth, c.getChapterMeta);

// ── Teacher only ──
router.post('/',                           auth, upload.single('pdf'), c.createBook);
// router.post('/:id/chapters',            auth, upload.single('pdf'), c.addChapter); // Disabled per request
router.put('/:id',                         auth, c.updateBook);
router.delete('/:id',                      auth, c.deleteBook);
// router.delete('/:id/chapters/:cid',     auth, c.deleteChapter); // Disabled per request

module.exports = router;
