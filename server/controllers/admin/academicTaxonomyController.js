const ApiResponse = require('../../utils/apiResponse');
const adminAcademicTaxonomyService = require('../../services/admin/adminAcademicTaxonomyService');

async function getTaxonomyTree(req, res, next) {
  try {
    const data = await adminAcademicTaxonomyService.getTaxonomyTree();
    return ApiResponse.success(res, data, 'Academic taxonomy loaded successfully.');
  } catch (err) {
    return next(err);
  }
}

async function createTaxonomyNode(req, res, next) {
  try {
    const data = await adminAcademicTaxonomyService.createTaxonomyNode({
      adminUser: req.user,
      type: adminAcademicTaxonomyService.pluralToType(req.params.type),
      payload: req.body || {}
    });
    return ApiResponse.success(res, data, 'Academic taxonomy item created successfully.', 201);
  } catch (err) {
    return next(err);
  }
}

async function updateTaxonomyNode(req, res, next) {
  try {
    const data = await adminAcademicTaxonomyService.updateTaxonomyNode({
      adminUser: req.user,
      type: adminAcademicTaxonomyService.pluralToType(req.params.type),
      nodeId: req.params.nodeId,
      payload: req.body || {}
    });
    return ApiResponse.success(res, data, 'Academic taxonomy item updated successfully.');
  } catch (err) {
    return next(err);
  }
}

async function archiveTaxonomyNode(req, res, next) {
  try {
    const data = await adminAcademicTaxonomyService.archiveTaxonomyNode({
      adminUser: req.user,
      type: adminAcademicTaxonomyService.pluralToType(req.params.type),
      nodeId: req.params.nodeId
    });
    return ApiResponse.success(res, data, 'Academic taxonomy item archived successfully.');
  } catch (err) {
    return next(err);
  }
}

async function reorderTaxonomyNode(req, res, next) {
  try {
    const data = await adminAcademicTaxonomyService.reorderTaxonomyNode({
      adminUser: req.user,
      type: adminAcademicTaxonomyService.pluralToType(req.params.type),
      nodeId: req.params.nodeId,
      direction: req.body.direction
    });
    return ApiResponse.success(res, data, 'Academic taxonomy item reordered successfully.');
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  getTaxonomyTree,
  createTaxonomyNode,
  updateTaxonomyNode,
  archiveTaxonomyNode,
  reorderTaxonomyNode
};
