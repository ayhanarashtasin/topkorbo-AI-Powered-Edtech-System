import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  HiChevronDown,
  HiChevronRight,
  HiMiniArrowDown,
  HiMiniArrowUp,
  HiMiniPencilSquare,
  HiMiniPlus,
  HiMiniTrash
} from 'react-icons/hi2';
import AdminActionButton from '../components/AdminActionButton';
import AdminBadge from '../components/AdminBadge';
import AdminConfirmModal from '../components/AdminConfirmModal';
import AdminEmptyState from '../components/AdminEmptyState';
import AdminLoadingState from '../components/AdminLoadingState';
import AdminPageHeader from '../components/AdminPageHeader';
import {
  archiveAdminTaxonomyNode,
  createAdminTaxonomyNode,
  fetchAdminAcademicTaxonomy,
  reorderAdminTaxonomyNode,
  updateAdminTaxonomyNode
} from '../services/adminApi';

const TYPE_CONFIG = {
  subject: { label: 'Subject', plural: 'subjects', childType: 'paper' },
  paper: { label: 'Paper', plural: 'papers', childType: 'chapter' },
  chapter: { label: 'Chapter', plural: 'chapters', childType: 'topic' },
  topic: { label: 'Topic', plural: 'topics', childType: null }
};

function statusTone(status) {
  return status === 'active' ? 'success' : 'neutral';
}

function countLabel(value, label) {
  return `${value} ${label}${value === 1 ? '' : 's'}`;
}

function filterTree(nodes, searchTerm) {
  if (!searchTerm.trim()) return nodes;
  const query = searchTerm.trim().toLowerCase();

  return nodes
    .map((node) => {
      const children = filterTree(node.children || [], searchTerm);
      const matches =
        String(node.name || '').toLowerCase().includes(query) ||
        String(node.typeLabel || '').toLowerCase().includes(query) ||
        String(node.pathLabel || '').toLowerCase().includes(query);

      if (!matches && !children.length) return null;
      return { ...node, children };
    })
    .filter(Boolean);
}

function collectExpandableIds(nodes, bucket = new Set()) {
  for (const node of nodes) {
    if ((node.children || []).length) {
      bucket.add(node.id);
      collectExpandableIds(node.children, bucket);
    }
  }
  return bucket;
}

function TaxonomyModal({ open, mode, parentNode, node, onClose, onSubmit, saving }) {
  const itemType = mode === 'create' ? parentNode?.childType || 'subject' : node?.type;
  const config = TYPE_CONFIG[itemType] || TYPE_CONFIG.subject;
  const [name, setName] = useState(() => (mode === 'edit' ? node?.name || '' : ''));
  const [order, setOrder] = useState(() => String(mode === 'edit' ? node?.order ?? 0 : 0));

  if (!open) return null;

  return (
    <div className="admin-modal-backdrop" onClick={onClose}>
      <div className="admin-modal" onClick={(event) => event.stopPropagation()}>
        <h3>{mode === 'create' ? `Create ${config.label}` : `Edit ${config.label}`}</h3>
        <p>
          {mode === 'create'
            ? parentNode
              ? `Add a new ${config.label.toLowerCase()} under ${parentNode.name}.`
              : 'Create a new top-level subject for the academic hierarchy.'
            : `Update the ${config.label.toLowerCase()} details without breaking existing question or book records.`}
        </p>

        <div className="admin-modal-form-grid">
          <label className="admin-field">
            <span>{config.label} name</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={`Enter ${config.label.toLowerCase()} name`}
            />
          </label>

          <label className="admin-field">
            <span>Order</span>
            <input
              type="number"
              value={order}
              onChange={(event) => setOrder(event.target.value)}
              placeholder="0"
            />
          </label>
        </div>

        {parentNode ? (
          <div className="admin-inline-note">
            Parent: <strong>{parentNode.pathLabel || parentNode.name}</strong>
          </div>
        ) : null}

        {itemType === 'topic' ? (
          <div className="admin-inline-note">
            Subtopics are not enabled as first-class admin items in the current schema, so this phase stops at topic level.
          </div>
        ) : null}

        <div className="admin-modal__actions">
          <button type="button" className="admin-button admin-button--ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="admin-button"
            disabled={saving || !name.trim()}
            onClick={() =>
              onSubmit({
                type: itemType,
                name: name.trim(),
                order: Number(order) || 0
              })
            }
          >
            {saving ? 'Saving...' : mode === 'create' ? 'Create item' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

function TaxonomyNode({
  node,
  expandedIds,
  onToggle,
  onCreate,
  onEdit,
  onArchive,
  onReorder
}) {
  const isExpanded = expandedIds.has(node.id);
  const hasChildren = (node.children || []).length > 0;
  const isSystemNode = node.type === 'system';

  return (
    <div className="admin-taxonomy-node">
      <div className={`admin-taxonomy-node__card ${node.status !== 'active' ? 'admin-taxonomy-node__card--archived' : ''}`}>
        <div className="admin-taxonomy-node__main">
          <button
            type="button"
            className={`admin-taxonomy-node__toggle ${hasChildren ? '' : 'admin-taxonomy-node__toggle--empty'}`}
            onClick={() => hasChildren && onToggle(node.id)}
            aria-label={hasChildren ? `${isExpanded ? 'Collapse' : 'Expand'} ${node.name}` : `${node.name} has no children`}
          >
            {hasChildren ? (isExpanded ? <HiChevronDown /> : <HiChevronRight />) : <span />}
          </button>

          <div className="admin-taxonomy-node__content">
            <div className="admin-taxonomy-node__heading">
              <strong>{node.name}</strong>
              <AdminBadge tone="info" size="sm">{node.typeLabel}</AdminBadge>
              {!isSystemNode ? <AdminBadge tone={statusTone(node.status)} size="sm">{node.status}</AdminBadge> : null}
              {node.childCount ? <AdminBadge tone="neutral" size="sm">{countLabel(node.childCount, 'child')}</AdminBadge> : null}
            </div>
            <div className="admin-taxonomy-node__meta">
              <span>{node.pathLabel}</span>
              {!isSystemNode ? <span>Order {node.order}</span> : null}
              {!isSystemNode ? <span>{node.source === 'legacy_sync' ? 'Synced from existing data' : 'Created in admin'}</span> : null}
              {isSystemNode ? <span>Legacy items missing a valid parent are grouped here for review.</span> : null}
            </div>
          </div>
        </div>

        {!isSystemNode ? <div className="admin-taxonomy-node__actions">
          {node.canCreateChild && node.status === 'active' ? (
            <AdminActionButton variant="ghost" onClick={() => onCreate(node)}>
              <HiMiniPlus />
              Add {TYPE_CONFIG[node.childType]?.label || 'Child'}
            </AdminActionButton>
          ) : null}
          <AdminActionButton variant="ghost" onClick={() => onEdit(node)}>
            <HiMiniPencilSquare />
            Edit
          </AdminActionButton>
          {node.supportsReorder && node.status === 'active' ? (
            <>
              <AdminActionButton variant="ghost" onClick={() => onReorder(node, 'up')}>
                <HiMiniArrowUp />
                Up
              </AdminActionButton>
              <AdminActionButton variant="ghost" onClick={() => onReorder(node, 'down')}>
                <HiMiniArrowDown />
                Down
              </AdminActionButton>
            </>
          ) : null}
          {node.status === 'active' ? (
            <AdminActionButton tone="danger" variant="ghost" onClick={() => onArchive(node)}>
              <HiMiniTrash />
              Archive
            </AdminActionButton>
          ) : null}
        </div> : null}
      </div>

      {hasChildren && isExpanded ? (
        <div className="admin-taxonomy-node__children">
          {node.children.map((child) => (
            <TaxonomyNode
              key={child.id}
              node={child}
              expandedIds={expandedIds}
              onToggle={onToggle}
              onCreate={onCreate}
              onEdit={onEdit}
              onArchive={onArchive}
              onReorder={onReorder}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function AdminAcademicTaxonomyPage() {
  const [taxonomy, setTaxonomy] = useState([]);
  const [stats, setStats] = useState({ subject: 0, paper: 0, chapter: 0, topic: 0, totalActive: 0, totalArchived: 0 });
  const [supportsSubtopics, setSupportsSubtopics] = useState(false);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedIds, setExpandedIds] = useState(new Set());
  const [modalState, setModalState] = useState({ open: false, mode: 'create', parentNode: null, node: null });
  const [archiveTarget, setArchiveTarget] = useState(null);
  const [saving, setSaving] = useState(false);

  async function loadTaxonomy() {
    try {
      setLoading(true);
      setError('');
      const data = await fetchAdminAcademicTaxonomy();
      setTaxonomy(data?.tree || []);
      setStats(data?.stats || { subject: 0, paper: 0, chapter: 0, topic: 0, totalActive: 0, totalArchived: 0 });
      setSupportsSubtopics(Boolean(data?.supportsSubtopics));
      setExpandedIds((prev) => (prev.size ? prev : collectExpandableIds(data?.tree || [])));
    } catch (err) {
      setError(err.message || 'Failed to load academic taxonomy');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      loadTaxonomy();
    }, 0);
    return () => clearTimeout(timeoutId);
  }, []);

  const filteredTree = useMemo(() => filterTree(taxonomy, search), [taxonomy, search]);
  const visibleExpandedIds = useMemo(
    () => (search.trim() ? collectExpandableIds(filteredTree) : expandedIds),
    [expandedIds, filteredTree, search]
  );

  function handleToggle(nodeId) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  }

  async function handleModalSubmit(payload) {
    try {
      setSaving(true);
      if (modalState.mode === 'create') {
        await createAdminTaxonomyNode(TYPE_CONFIG[payload.type].plural, {
          name: payload.name,
          order: payload.order,
          parentId: modalState.parentNode?.id || null
        });
        toast.success(`${TYPE_CONFIG[payload.type]?.label || 'Item'} created`);
      } else {
        await updateAdminTaxonomyNode(TYPE_CONFIG[payload.type].plural, modalState.node.id, {
          name: payload.name,
          order: payload.order
        });
        toast.success(`${TYPE_CONFIG[payload.type]?.label || 'Item'} updated`);
      }

      setModalState({ open: false, mode: 'create', parentNode: null, node: null });
      await loadTaxonomy();
    } catch (err) {
      toast.error(err.message || 'Failed to save taxonomy item');
    } finally {
      setSaving(false);
    }
  }

  async function handleArchiveConfirm(reason) {
    try {
      setSaving(true);
      await archiveAdminTaxonomyNode(TYPE_CONFIG[archiveTarget.type].plural, archiveTarget.id, { reason });
      toast.success(`${TYPE_CONFIG[archiveTarget.type].label} archived`);
      setArchiveTarget(null);
      await loadTaxonomy();
    } catch (err) {
      toast.error(err.message || 'Failed to archive taxonomy item');
    } finally {
      setSaving(false);
    }
  }

  async function handleReorder(node, direction) {
    try {
      await reorderAdminTaxonomyNode(TYPE_CONFIG[node.type].plural, node.id, { direction });
      await loadTaxonomy();
    } catch (err) {
      toast.error(err.message || 'Failed to reorder taxonomy item');
    }
  }

  if (loading) {
    return <AdminLoadingState label="Loading academic taxonomy..." />;
  }

  if (error) {
    return (
      <section className="admin-page">
        <AdminPageHeader
          title="Academic Taxonomy"
          description="Manage the subject, paper, chapter, and topic hierarchy used across academic content."
          badge={{ label: 'Sync error', tone: 'danger' }}
        />
        <div className="admin-page-error">
          <div className="admin-page-error__card">
            <h3>Taxonomy data could not be loaded</h3>
            <p>{error}</p>
            <button type="button" onClick={loadTaxonomy}>Retry</button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="admin-page">
      <AdminPageHeader
        title="Academic Taxonomy"
        description="Govern subjects, papers, chapters, and topics from one hierarchy manager while reusing existing question and book data."
        badge={{ label: `${stats.totalActive || 0} active items`, tone: 'info' }}
        actions={
          <AdminActionButton onClick={() => setModalState({ open: true, mode: 'create', parentNode: null, node: null })}>
            <HiMiniPlus />
            Create Subject
          </AdminActionButton>
        }
      />

      <section className="admin-panels-grid">
        <div className="admin-panel">
          <div className="admin-panel__header">
            <div>
              <h3>Hierarchy Manager</h3>
              <p className="admin-panel__subtext">
                Expand the tree, inspect item status, and add or archive nodes without rewriting earlier admin flows.
              </p>
            </div>
            <div className="admin-chip-row">
              <AdminBadge tone="info" size="sm">{countLabel(stats.subject || 0, 'subject')}</AdminBadge>
              <AdminBadge tone="info" size="sm">{countLabel(stats.paper || 0, 'paper')}</AdminBadge>
              <AdminBadge tone="info" size="sm">{countLabel(stats.chapter || 0, 'chapter')}</AdminBadge>
              <AdminBadge tone="info" size="sm">{countLabel(stats.topic || 0, 'topic')}</AdminBadge>
            </div>
          </div>

          <div className="admin-toolbar admin-toolbar--taxonomy">
            <label className="admin-field admin-field--search">
              <span>Search taxonomy</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by name, type, or full path"
              />
            </label>

            <div className="admin-taxonomy-toolbar__actions">
              <AdminActionButton variant="ghost" onClick={() => setExpandedIds(collectExpandableIds(filteredTree))}>
                Expand all
              </AdminActionButton>
              <AdminActionButton variant="ghost" onClick={() => setExpandedIds(new Set())}>
                Collapse all
              </AdminActionButton>
              <AdminActionButton variant="ghost" onClick={loadTaxonomy}>
                Refresh tree
              </AdminActionButton>
            </div>
          </div>

          {filteredTree.length ? (
            <div className="admin-taxonomy-tree">
              {filteredTree.map((node) => (
                <TaxonomyNode
                  key={node.id}
                  node={node}
                  expandedIds={visibleExpandedIds}
                  onToggle={handleToggle}
                  onCreate={(parentNode) => setModalState({ open: true, mode: 'create', parentNode, node: null })}
                  onEdit={(selectedNode) => setModalState({ open: true, mode: 'edit', parentNode: null, node: selectedNode })}
                  onArchive={(selectedNode) => setArchiveTarget(selectedNode)}
                  onReorder={handleReorder}
                />
              ))}
            </div>
          ) : (
            <AdminEmptyState
              title={search.trim() ? 'No matching taxonomy items' : 'No taxonomy items available'}
              description={
                search.trim()
                  ? 'Try a broader search term or refresh the tree to sync current book and question data.'
                  : 'Create the first subject or refresh to sync existing question and book content into the taxonomy tree.'
              }
              actionLabel={search.trim() ? 'Clear search' : 'Create Subject'}
              onAction={() => {
                if (search.trim()) setSearch('');
                else setModalState({ open: true, mode: 'create', parentNode: null, node: null });
              }}
            />
          )}
        </div>

        <aside className="admin-panel">
          <div className="admin-panel__header">
            <div>
              <h3>Rules & Status</h3>
              <p className="admin-panel__subtext">This phase focuses on the real hierarchy and safe administration behavior.</p>
            </div>
          </div>

          <ul className="admin-list admin-list--compact">
            <li>
              <div>
                <strong>Archive safety</strong>
                <span>Items with active child nodes must be archived from the bottom up.</span>
              </div>
              <AdminBadge tone="warning" size="sm">Protected</AdminBadge>
            </li>
            <li>
              <div>
                <strong>Duplicate prevention</strong>
                <span>Active items cannot reuse the same name under the same parent.</span>
              </div>
              <AdminBadge tone="success" size="sm">Enabled</AdminBadge>
            </li>
            <li>
              <div>
                <strong>Reordering</strong>
                <span>Chapters and topics support safe up/down ordering controls.</span>
              </div>
              <AdminBadge tone="info" size="sm">Available</AdminBadge>
            </li>
            <li>
              <div>
                <strong>Subtopics</strong>
                <span>
                  {supportsSubtopics
                    ? 'Subtopic management is enabled.'
                    : 'Subtopics exist only in derived book knowledge data, not as first-class admin records.'}
                </span>
              </div>
              <AdminBadge tone={supportsSubtopics ? 'success' : 'neutral'} size="sm">
                {supportsSubtopics ? 'Enabled' : 'Not in scope'}
              </AdminBadge>
            </li>
            <li>
              <div>
                <strong>Archived items</strong>
                <span>{stats.totalArchived || 0} items are archived and remain visible for auditability.</span>
              </div>
              <AdminBadge tone="neutral" size="sm">{stats.totalArchived || 0}</AdminBadge>
            </li>
          </ul>
        </aside>
      </section>

      <TaxonomyModal
        key={`${modalState.mode}-${modalState.node?.id || modalState.parentNode?.id || 'root'}-${modalState.open ? 'open' : 'closed'}`}
        open={modalState.open}
        mode={modalState.mode}
        parentNode={modalState.parentNode}
        node={modalState.node}
        onClose={() => setModalState({ open: false, mode: 'create', parentNode: null, node: null })}
        onSubmit={handleModalSubmit}
        saving={saving}
      />

      <AdminConfirmModal
        open={Boolean(archiveTarget)}
        title={archiveTarget ? `Archive ${TYPE_CONFIG[archiveTarget.type]?.label}` : ''}
        description={
          archiveTarget
            ? `Archive ${archiveTarget.name}? Existing question, book, and contest references stay intact, but this item will no longer be active for future taxonomy management.`
            : ''
        }
        confirmLabel={saving ? 'Archiving...' : 'Archive item'}
        onClose={() => setArchiveTarget(null)}
        onConfirm={handleArchiveConfirm}
      />
    </section>
  );
}
