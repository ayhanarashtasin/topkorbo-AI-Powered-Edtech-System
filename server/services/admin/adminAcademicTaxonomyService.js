const mongoose = require('mongoose');
const AcademicTaxonomy = require('../../models/AcademicTaxonomy');
const Book = require('../../models/Book');
const BookKnowledge = require('../../models/BookKnowledge');
const Contest = require('../../models/Contest');
const Question = require('../../models/Question');
const { createAdminAuditLog } = require('./adminAuditService');

const TAXONOMY_TYPES = ['subject', 'paper', 'chapter', 'topic'];
const TYPE_LABELS = {
  subject: 'Subject',
  paper: 'Paper',
  chapter: 'Chapter',
  topic: 'Topic'
};
const PARENT_TYPE_BY_CHILD = {
  paper: 'subject',
  chapter: 'paper',
  topic: 'chapter'
};
const CHILD_TYPE_BY_PARENT = {
  subject: 'paper',
  paper: 'chapter',
  chapter: 'topic'
};

function normalizeName(value = '') {
  return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function escapeRegex(value = '') {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function toObjectId(value) {
  if (!value) return null;
  return mongoose.Types.ObjectId.isValid(value) ? new mongoose.Types.ObjectId(value) : null;
}

function pluralToType(pluralType = '') {
  return String(pluralType || '').replace(/s$/, '');
}

function typeToPlural(type = '') {
  return `${type}s`;
}

function buildPathLabel(pathNodes = []) {
  return pathNodes.map((item) => item.name).filter(Boolean).join(' / ');
}

async function findNodeOrThrow(nodeId) {
  if (!mongoose.Types.ObjectId.isValid(nodeId)) {
    const err = new Error('Taxonomy item not found');
    err.statusCode = 404;
    throw err;
  }

  const node = await AcademicTaxonomy.findById(nodeId);
  if (!node) {
    const err = new Error('Taxonomy item not found');
    err.statusCode = 404;
    throw err;
  }

  return node;
}

async function getParentNodeForType(type, parentId) {
  const expectedParentType = PARENT_TYPE_BY_CHILD[type];
  if (!expectedParentType) return null;

  if (!mongoose.Types.ObjectId.isValid(parentId)) {
    const err = new Error(`${TYPE_LABELS[type]} must be created under a valid ${expectedParentType}`);
    err.statusCode = 400;
    throw err;
  }

  const parent = await AcademicTaxonomy.findById(parentId);
  if (!parent) {
    const err = new Error(`${TYPE_LABELS[expectedParentType]} parent not found`);
    err.statusCode = 404;
    throw err;
  }
  if (parent.type !== expectedParentType) {
    const err = new Error(`${TYPE_LABELS[type]} must be created under a ${expectedParentType}`);
    err.statusCode = 400;
    throw err;
  }
  if (parent.status !== 'active') {
    const err = new Error(`Cannot add ${type} under an archived ${parent.type}`);
    err.statusCode = 409;
    throw err;
  }

  return parent;
}

async function ensureUniqueActiveName({ type, parentId = null, normalizedName, excludeId = null }) {
  const existing = await AcademicTaxonomy.findOne({
    type,
    parentId,
    normalizedName,
    status: 'active',
    ...(excludeId ? { _id: { $ne: excludeId } } : {})
  }).lean();

  if (existing) {
    const err = new Error(`An active ${type} with this name already exists under the same parent`);
    err.statusCode = 409;
    throw err;
  }
}

async function resolvePath(node) {
  const pathNodes = [];
  let current = node;

  while (current) {
    pathNodes.unshift({
      id: String(current._id),
      type: current.type,
      name: current.name
    });
    current = current.parentId ? await AcademicTaxonomy.findById(current.parentId).select('_id type name parentId').lean() : null;
  }

  return pathNodes;
}

async function ensureNode({ type, name, parentId = null, order = 0 }) {
  const trimmedName = String(name || '').trim().replace(/\s+/g, ' ');
  if (!trimmedName) return null;

  const normalizedName = normalizeName(trimmedName);
  const parentObjectId = parentId ? toObjectId(parentId) : null;
  const archivedMatch = await AcademicTaxonomy.findOne({
    type,
    parentId: parentObjectId,
    normalizedName
  });

  if (archivedMatch) {
    if (archivedMatch.status !== 'active') {
      archivedMatch.status = 'active';
      archivedMatch.archivedAt = null;
      archivedMatch.archivedBy = null;
    }
    archivedMatch.name = trimmedName;
    archivedMatch.order = Number.isFinite(order) ? order : archivedMatch.order;
    archivedMatch.source = archivedMatch.source || 'legacy_sync';
    await archivedMatch.save();
    return archivedMatch;
  }

  return AcademicTaxonomy.create({
    type,
    name: trimmedName,
    normalizedName,
    parentId: parentObjectId,
    order: Number.isFinite(order) ? order : 0,
    source: 'legacy_sync'
  });
}

async function syncLegacyTaxonomy() {
  const [questions, books, knowledgeDocs, contests] = await Promise.all([
    Question.find({})
      .select('subject paper chapter topic')
      .lean(),
    Book.find({})
      .select('subject paper chapters')
      .lean(),
    BookKnowledge.find({ status: 'completed' })
      .select('bookId chapters')
      .lean(),
    Contest.find({})
      .select('subjects questions selectionMeta')
      .lean()
  ]);

  const subjectMap = new Map();

  async function ensureSubject(subjectName) {
    const key = normalizeName(subjectName);
    if (!key) return null;
    if (!subjectMap.has(key)) {
      const node = await ensureNode({
        type: 'subject',
        name: subjectName,
        order: subjectMap.size
      });
      subjectMap.set(key, node);
    }
    return subjectMap.get(key);
  }

  for (const question of questions) {
    const subjectNode = await ensureSubject(question.subject);
    if (!subjectNode) continue;

    const paperNode = await ensureNode({
      type: 'paper',
      parentId: subjectNode._id,
      name: question.paper,
      order: question.paper === '2nd' ? 1 : 0
    });
    const chapterNode = await ensureNode({
      type: 'chapter',
      parentId: paperNode?._id || null,
      name: question.chapter
    });
    await ensureNode({
      type: 'topic',
      parentId: chapterNode?._id || null,
      name: question.topic
    });
  }

  for (const book of books) {
    const subjectNode = await ensureSubject(book.subject);
    if (!subjectNode) continue;

    const paperNode = await ensureNode({
      type: 'paper',
      parentId: subjectNode._id,
      name: book.paper,
      order: book.paper === '2nd' ? 1 : 0
    });
    for (const chapter of book.chapters || []) {
      await ensureNode({
        type: 'chapter',
        parentId: paperNode?._id || null,
        name: chapter.title,
        order: Number(chapter.order) || 0
      });
    }
  }

  const bookMap = new Map(books.map((book) => [String(book._id), book]));
  for (const knowledge of knowledgeDocs) {
    const book = bookMap.get(String(knowledge.bookId));
    if (!book) continue;

    const subjectNode = await ensureSubject(book.subject);
    if (!subjectNode) continue;
    const paperNode = await ensureNode({
      type: 'paper',
      parentId: subjectNode._id,
      name: book.paper,
      order: book.paper === '2nd' ? 1 : 0
    });

    for (const chapter of knowledge.chapters || []) {
      const chapterNode = await ensureNode({
        type: 'chapter',
        parentId: paperNode?._id || null,
        name: chapter.title,
        order: Number(chapter.order) || 0
      });

      for (const topic of chapter.topics || []) {
        await ensureNode({
          type: 'topic',
          parentId: chapterNode?._id || null,
          name: topic.title,
          order: Number(topic.order) || 0
        });
      }
    }
  }

  for (const contest of contests) {
    for (const subjectName of contest.subjects || []) {
      await ensureSubject(subjectName);
    }

    for (const contestQuestion of contest.questions || []) {
      const subjectNode = await ensureSubject(contestQuestion.subject || contestQuestion.selectionMeta?.subject);
      if (!subjectNode) continue;

      const paperNode = await ensureNode({
        type: 'paper',
        parentId: subjectNode._id,
        name: contestQuestion.paper || contestQuestion.selectionMeta?.paper,
        order: contestQuestion.paper === '2nd' ? 1 : 0
      });
      const chapterNode = await ensureNode({
        type: 'chapter',
        parentId: paperNode?._id || null,
        name: contestQuestion.chapter || contestQuestion.selectionMeta?.chapter
      });
      await ensureNode({
        type: 'topic',
        parentId: chapterNode?._id || null,
        name: contestQuestion.topic || contestQuestion.selectionMeta?.topic
      });
    }
  }
}

async function getUsageSummary(node) {
  const subjectRegex = new RegExp(`^${escapeRegex(node.name)}$`, 'i');
  if (node.type === 'subject') {
    const [questions, books, contests] = await Promise.all([
      Question.countDocuments({ subject: subjectRegex }),
      Book.countDocuments({ subject: subjectRegex }),
      Contest.countDocuments({
        $or: [
          { subjects: subjectRegex },
          { 'questions.subject': subjectRegex },
          { 'questions.selectionMeta.subject': subjectRegex }
        ]
      })
    ]);
    return { questions, books, contests, total: questions + books + contests };
  }

  const parent = await AcademicTaxonomy.findById(node.parentId).lean();
  if (!parent) return { questions: 0, books: 0, contests: 0, total: 0 };

  if (node.type === 'paper') {
    const [questions, books, contests] = await Promise.all([
      Question.countDocuments({ subject: new RegExp(`^${escapeRegex(parent.name)}$`, 'i'), paper: subjectRegex }),
      Book.countDocuments({ subject: new RegExp(`^${escapeRegex(parent.name)}$`, 'i'), paper: subjectRegex }),
      Contest.countDocuments({
        $or: [
          {
            questions: {
              $elemMatch: {
                subject: new RegExp(`^${escapeRegex(parent.name)}$`, 'i'),
                paper: subjectRegex
              }
            }
          },
          {
            questions: {
              $elemMatch: {
                'selectionMeta.subject': parent.name,
                'selectionMeta.paper': node.name
              }
            }
          }
        ]
      })
    ]);
    return { questions, books, contests, total: questions + books + contests };
  }

  const grandParent = parent.parentId ? await AcademicTaxonomy.findById(parent.parentId).lean() : null;
  if (!grandParent) return { questions: 0, books: 0, contests: 0, total: 0 };

  if (node.type === 'chapter') {
    const [questions, books, contests] = await Promise.all([
      Question.countDocuments({
        subject: new RegExp(`^${escapeRegex(grandParent.name)}$`, 'i'),
        paper: new RegExp(`^${escapeRegex(parent.name)}$`, 'i'),
        chapter: subjectRegex
      }),
      Book.countDocuments({
        subject: new RegExp(`^${escapeRegex(grandParent.name)}$`, 'i'),
        paper: new RegExp(`^${escapeRegex(parent.name)}$`, 'i'),
        chapters: { $elemMatch: { title: subjectRegex } }
      }),
      Contest.countDocuments({
        $or: [
          {
            questions: {
              $elemMatch: {
                subject: new RegExp(`^${escapeRegex(grandParent.name)}$`, 'i'),
                paper: new RegExp(`^${escapeRegex(parent.name)}$`, 'i'),
                chapter: subjectRegex
              }
            }
          },
          {
            questions: {
              $elemMatch: {
                'selectionMeta.subject': grandParent.name,
                'selectionMeta.paper': parent.name,
                'selectionMeta.chapter': node.name
              }
            }
          }
        ]
      })
    ]);
    return { questions, books, contests, total: questions + books + contests };
  }

  const paperNode = await AcademicTaxonomy.findById(parent.parentId).lean();
  const subjectNode = paperNode?.parentId ? await AcademicTaxonomy.findById(paperNode.parentId).lean() : null;
  if (!paperNode || !subjectNode) return { questions: 0, books: 0, contests: 0, total: 0 };

  const [questions, contests] = await Promise.all([
    Question.countDocuments({
      subject: new RegExp(`^${escapeRegex(subjectNode.name)}$`, 'i'),
      paper: new RegExp(`^${escapeRegex(paperNode.name)}$`, 'i'),
      chapter: new RegExp(`^${escapeRegex(parent.name)}$`, 'i'),
      topic: subjectRegex
    }),
    Contest.countDocuments({
      $or: [
        {
          questions: {
            $elemMatch: {
              subject: new RegExp(`^${escapeRegex(subjectNode.name)}$`, 'i'),
              paper: new RegExp(`^${escapeRegex(paperNode.name)}$`, 'i'),
              chapter: new RegExp(`^${escapeRegex(parent.name)}$`, 'i'),
              topic: subjectRegex
            }
          }
        },
        {
          questions: {
            $elemMatch: {
              'selectionMeta.subject': subjectNode.name,
              'selectionMeta.paper': paperNode.name,
              'selectionMeta.chapter': parent.name,
              'selectionMeta.topic': node.name
            }
          }
        }
      ]
    })
  ]);

  let books = 0;
  const relatedBooks = await Book.find({
    subject: new RegExp(`^${escapeRegex(subjectNode.name)}$`, 'i'),
    paper: new RegExp(`^${escapeRegex(paperNode.name)}$`, 'i')
  }).select('_id').lean();
  if (relatedBooks.length) {
    const knowledgeDocs = await BookKnowledge.find({
      bookId: { $in: relatedBooks.map((item) => item._id) }
    }).select('chapters').lean();

    for (const knowledge of knowledgeDocs) {
      const chapter = (knowledge.chapters || []).find((entry) => normalizeName(entry.title) === normalizeName(parent.name));
      if (chapter && (chapter.topics || []).some((entry) => normalizeName(entry.title) === normalizeName(node.name))) {
        books += 1;
      }
    }
  }

  return { questions, books, contests, total: questions + books + contests };
}

function buildTree(items) {
  const map = new Map();
  items.forEach((item) => {
    map.set(String(item._id), {
      id: String(item._id),
      type: item.type,
      typeLabel: TYPE_LABELS[item.type],
      name: item.name,
      status: item.status,
      order: Number(item.order) || 0,
      parentId: item.parentId ? String(item.parentId) : null,
      source: item.source || 'manual',
      createdAt: item.createdAt || null,
      updatedAt: item.updatedAt || null,
      children: [],
      childCount: 0,
      canCreateChild: Boolean(CHILD_TYPE_BY_PARENT[item.type]),
      childType: CHILD_TYPE_BY_PARENT[item.type] || null,
      supportsReorder: ['chapter', 'topic'].includes(item.type)
    });
  });

  const roots = [];
  for (const node of map.values()) {
    if (node.parentId && map.has(node.parentId)) {
      map.get(node.parentId).children.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortNodes = (nodes, path = []) => {
    nodes.sort((a, b) => {
      if (a.order !== b.order) return a.order - b.order;
      return a.name.localeCompare(b.name);
    });

    nodes.forEach((node) => {
      const nextPath = [...path, { id: node.id, type: node.type, name: node.name }];
      node.childCount = node.children.length;
      node.path = nextPath;
      node.pathLabel = buildPathLabel(nextPath);
      sortNodes(node.children, nextPath);
    });
  };

  sortNodes(roots);
  return roots;
}

async function getTaxonomyTree() {
  await syncLegacyTaxonomy();

  const items = await AcademicTaxonomy.find({})
    .sort({ type: 1, parentId: 1, order: 1, name: 1 })
    .lean();

  const tree = buildTree(items);
  const stats = TAXONOMY_TYPES.reduce((acc, type) => {
    acc[type] = items.filter((item) => item.type === type && item.status === 'active').length;
    return acc;
  }, {});

  return {
    tree,
    stats: {
      ...stats,
      totalActive: items.filter((item) => item.status === 'active').length,
      totalArchived: items.filter((item) => item.status === 'archived').length
    },
    supportsSubtopics: false
  };
}

async function getPublicTaxonomy() {
  await syncLegacyTaxonomy();

  const items = await AcademicTaxonomy.find({ status: 'active' })
    .sort({ type: 1, parentId: 1, order: 1, name: 1 })
    .lean();

  return {
    tree: buildTree(items),
    supportsSubtopics: false
  };
}

async function validateTaxonomySelection({ subject, paper, chapter, topic }) {
  await syncLegacyTaxonomy();

  const subjectName = String(subject || '').trim();
  const paperName = String(paper || '').trim();
  const chapterName = String(chapter || '').trim();
  const topicName = String(topic || '').trim();

  const subjectNode = await AcademicTaxonomy.findOne({
    type: 'subject',
    normalizedName: normalizeName(subjectName),
    status: 'active'
  }).lean();
  if (!subjectNode) {
    const err = new Error('Selected subject is not available in the academic taxonomy');
    err.statusCode = 400;
    throw err;
  }

  const paperNode = await AcademicTaxonomy.findOne({
    type: 'paper',
    parentId: subjectNode._id,
    normalizedName: normalizeName(paperName),
    status: 'active'
  }).lean();
  if (!paperNode) {
    const err = new Error('Selected paper is not available under the chosen subject');
    err.statusCode = 400;
    throw err;
  }

  const chapterNode = await AcademicTaxonomy.findOne({
    type: 'chapter',
    parentId: paperNode._id,
    normalizedName: normalizeName(chapterName),
    status: 'active'
  }).lean();
  if (!chapterNode) {
    const err = new Error('Selected chapter is not available under the chosen paper');
    err.statusCode = 400;
    throw err;
  }

  const topicNode = await AcademicTaxonomy.findOne({
    type: 'topic',
    parentId: chapterNode._id,
    normalizedName: normalizeName(topicName),
    status: 'active'
  }).lean();
  if (!topicNode) {
    const err = new Error('Selected topic is not available under the chosen chapter');
    err.statusCode = 400;
    throw err;
  }

  return {
    subject: subjectNode.name,
    paper: paperNode.name,
    chapter: chapterNode.name,
    topic: topicNode.name
  };
}

async function createTaxonomyNode({ adminUser, type, payload = {} }) {
  if (!TAXONOMY_TYPES.includes(type)) {
    const err = new Error('Unsupported taxonomy type');
    err.statusCode = 400;
    throw err;
  }

  const name = String(payload.name || '').trim().replace(/\s+/g, ' ');
  if (!name) {
    const err = new Error(`${TYPE_LABELS[type]} name is required`);
    err.statusCode = 400;
    throw err;
  }

  const parent = await getParentNodeForType(type, payload.parentId);
  const parentId = parent ? parent._id : null;
  const normalizedName = normalizeName(name);
  await ensureUniqueActiveName({ type, parentId, normalizedName });

  const node = await AcademicTaxonomy.create({
    type,
    name,
    normalizedName,
    parentId,
    order: Number(payload.order) || 0,
    source: 'manual',
    createdBy: adminUser.id,
    updatedBy: adminUser.id
  });

  const pathNodes = await resolvePath(node);
  await createAdminAuditLog({
    adminId: adminUser.id,
    actionType: `${type.toUpperCase()}_CREATED`,
    targetEntityId: String(node._id),
    targetEntityType: type,
    targetEntityName: node.name,
    previousValue: null,
    newValue: {
      type: node.type,
      name: node.name,
      status: node.status,
      order: node.order,
      parentId: node.parentId ? String(node.parentId) : null,
      path: buildPathLabel(pathNodes)
    }
  });

  return {
    node: {
      id: String(node._id),
      type: node.type,
      name: node.name,
      status: node.status,
      order: node.order,
      parentId: node.parentId ? String(node.parentId) : null,
      path: pathNodes,
      pathLabel: buildPathLabel(pathNodes)
    }
  };
}

async function updateTaxonomyNode({ adminUser, type, nodeId, payload = {} }) {
  const node = await findNodeOrThrow(nodeId);
  if (node.type !== type) {
    const err = new Error('Taxonomy type mismatch');
    err.statusCode = 400;
    throw err;
  }

  const previousValue = {
    name: node.name,
    status: node.status,
    order: node.order
  };

  if (Object.prototype.hasOwnProperty.call(payload, 'name')) {
    const nextName = String(payload.name || '').trim().replace(/\s+/g, ' ');
    if (!nextName) {
      const err = new Error(`${TYPE_LABELS[type]} name is required`);
      err.statusCode = 400;
      throw err;
    }
    const normalizedName = normalizeName(nextName);
    await ensureUniqueActiveName({
      type,
      parentId: node.parentId || null,
      normalizedName,
      excludeId: node._id
    });
    node.name = nextName;
    node.normalizedName = normalizedName;
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'order')) {
    node.order = Number(payload.order) || 0;
  }

  node.updatedBy = adminUser.id;
  await node.save();

  const pathNodes = await resolvePath(node);
  await createAdminAuditLog({
    adminId: adminUser.id,
    actionType: `${type.toUpperCase()}_UPDATED`,
    targetEntityId: String(node._id),
    targetEntityType: type,
    targetEntityName: node.name,
    previousValue,
    newValue: {
      name: node.name,
      status: node.status,
      order: node.order,
      path: buildPathLabel(pathNodes)
    }
  });

  return {
    node: {
      id: String(node._id),
      type: node.type,
      name: node.name,
      status: node.status,
      order: node.order,
      parentId: node.parentId ? String(node.parentId) : null,
      path: pathNodes,
      pathLabel: buildPathLabel(pathNodes)
    }
  };
}

async function archiveTaxonomyNode({ adminUser, type, nodeId }) {
  const node = await findNodeOrThrow(nodeId);
  if (node.type !== type) {
    const err = new Error('Taxonomy type mismatch');
    err.statusCode = 400;
    throw err;
  }
  if (node.status === 'archived') {
    return { id: String(node._id), status: node.status };
  }

  const activeChildren = await AcademicTaxonomy.countDocuments({
    parentId: node._id,
    status: 'active'
  });
  if (activeChildren > 0) {
    const err = new Error(`Archive child ${typeToPlural(CHILD_TYPE_BY_PARENT[node.type] || 'item')} before archiving this ${node.type}`);
    err.statusCode = 409;
    throw err;
  }

  const usage = await getUsageSummary(node);
  const previousValue = {
    name: node.name,
    status: node.status,
    usage
  };

  node.status = 'archived';
  node.archivedAt = new Date();
  node.archivedBy = adminUser.id;
  node.updatedBy = adminUser.id;
  await node.save();

  const pathNodes = await resolvePath(node);
  await createAdminAuditLog({
    adminId: adminUser.id,
    actionType: `${type.toUpperCase()}_ARCHIVED`,
    targetEntityId: String(node._id),
    targetEntityType: type,
    targetEntityName: node.name,
    previousValue,
    newValue: {
      name: node.name,
      status: node.status,
      archivedAt: node.archivedAt,
      path: buildPathLabel(pathNodes)
    }
  });

  return {
    id: String(node._id),
    status: node.status,
    usage
  };
}

async function reorderTaxonomyNode({ adminUser, type, nodeId, direction }) {
  if (!['chapter', 'topic'].includes(type)) {
    const err = new Error('Reordering is currently supported for chapters and topics only');
    err.statusCode = 400;
    throw err;
  }
  if (!['up', 'down'].includes(direction)) {
    const err = new Error('Direction must be up or down');
    err.statusCode = 400;
    throw err;
  }

  const node = await findNodeOrThrow(nodeId);
  if (node.type !== type) {
    const err = new Error('Taxonomy type mismatch');
    err.statusCode = 400;
    throw err;
  }

  const siblings = await AcademicTaxonomy.find({
    type,
    parentId: node.parentId || null
  }).sort({ order: 1, name: 1 });

  const currentIndex = siblings.findIndex((item) => String(item._id) === String(node._id));
  if (currentIndex === -1) {
    const err = new Error('Taxonomy item not found in sibling list');
    err.statusCode = 404;
    throw err;
  }

  const swapIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
  if (swapIndex < 0 || swapIndex >= siblings.length) {
    return { id: String(node._id), unchanged: true };
  }

  const swapNode = siblings[swapIndex];
  const previousValue = {
    order: node.order,
    swappedWith: {
      id: String(swapNode._id),
      name: swapNode.name,
      order: swapNode.order
    }
  };

  const tempOrder = node.order;
  node.order = swapNode.order;
  swapNode.order = tempOrder;
  node.updatedBy = adminUser.id;
  swapNode.updatedBy = adminUser.id;
  await Promise.all([node.save(), swapNode.save()]);

  await createAdminAuditLog({
    adminId: adminUser.id,
    actionType: `${type.toUpperCase()}_UPDATED`,
    targetEntityId: String(node._id),
    targetEntityType: type,
    targetEntityName: node.name,
    previousValue,
    newValue: {
      order: node.order,
      direction
    }
  });

  return {
    id: String(node._id),
    order: node.order,
    direction
  };
}

module.exports = {
  pluralToType,
  getTaxonomyTree,
  getPublicTaxonomy,
  validateTaxonomySelection,
  createTaxonomyNode,
  updateTaxonomyNode,
  archiveTaxonomyNode,
  reorderTaxonomyNode
};
