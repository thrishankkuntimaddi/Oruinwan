// server/src/features/workspace-templates/workspace-templates.controller.js
const WorkspaceTemplate = require('../../../models/WorkspaceTemplate');
const Workspace = require('../../../models/Workspace');
const Channel = require('../channels/channel.model');
const { handleError } = require('../../../utils/responseHelpers');

/**
 * GET /api/workspace-templates
 * List all templates visible to the current user:
 *   - All public platform templates (company: null, isPublic: true)
 *   - All templates belonging to this user's company
 */
exports.listTemplates = async (req, res) => {
  try {
    const userId = req.user?.sub;
    const companyId = req.user?._dbUser?.companyId || null;

    const query = {
      isActive: true,
      $or: [
        { company: null, isPublic: true },
        ...(companyId ? [{ company: companyId }] : [])
      ]
    };

    const templates = await WorkspaceTemplate.find(query)
      .populate('createdBy', 'username profilePicture')
      .sort({ usageCount: -1, createdAt: -1 })
      .lean();

    return res.json({ templates });
  } catch (err) {
    return handleError(res, err, 'LIST TEMPLATES ERROR');
  }
};

/**
 * POST /api/workspace-templates
 * Create a new workspace template (from scratch or from an existing workspace).
 */
exports.createTemplate = async (req, res) => {
  try {
    const userId = req.user?.sub;
    const companyId = req.user?._dbUser?.companyId || null;

    const {
      name,
      description,
      icon,
      color,
      category,
      defaultChannels,
      settings,
      featureToggles,
      isPublic,
      fromWorkspaceId // optional: snapshot an existing workspace structure
    } = req.body;

    if (!name) return res.status(400).json({ message: 'Template name is required' });

    let channels = defaultChannels || [];
    let templateSettings = settings || {};

    // If cloning from an existing workspace
    if (fromWorkspaceId) {
      const source = await Workspace.findById(fromWorkspaceId);
      if (!source) return res.status(404).json({ message: 'Source workspace not found' });

      // Tenant-safety check
      if (companyId && String(source.company) !== String(companyId)) {
        return res.status(403).json({ message: 'Access denied to source workspace' });
      }

      const sourceChannels = await Channel.find({ workspace: fromWorkspaceId, isDefault: false })
        .select('name description isPrivate')
        .lean();

      channels = sourceChannels.map(c => ({
        name: c.name,
        description: c.description || '',
        isPrivate: c.isPrivate,
        isDefault: false
      }));

      templateSettings = source.settings || {};
    }

    const template = await WorkspaceTemplate.create({
      name: name.trim(),
      description: description || '',
      icon: icon || '📁',
      color: color || '#2563eb',
      category: category || 'general',
      defaultChannels: channels,
      settings: templateSettings,
      featureToggles: featureToggles || {},
      isPublic: !!isPublic,
      company: companyId,
      createdBy: userId
    });

    return res.status(201).json({ message: 'Template created', template });
  } catch (err) {
    return handleError(res, err, 'CREATE TEMPLATE ERROR');
  }
};

/**
 * GET /api/workspace-templates/:id
 * Get a single template.
 */
exports.getTemplate = async (req, res) => {
  try {
    const template = await WorkspaceTemplate.findById(req.params.id)
      .populate('createdBy', 'username profilePicture')
      .lean();

    if (!template || !template.isActive) {
      return res.status(404).json({ message: 'Template not found' });
    }

    const companyId = req.user?._dbUser?.companyId || null;
    const isOwn = template.company && companyId && String(template.company) === String(companyId);
    if (!template.isPublic && !isOwn) {
      return res.status(403).json({ message: 'Access denied' });
    }

    return res.json({ template });
  } catch (err) {
    return handleError(res, err, 'GET TEMPLATE ERROR');
  }
};

/**
 * PUT /api/workspace-templates/:id
 * Update a workspace template (company admin only, own templates).
 */
exports.updateTemplate = async (req, res) => {
  try {
    const companyId = req.user?._dbUser?.companyId || null;

    const template = await WorkspaceTemplate.findById(req.params.id);
    if (!template || !template.isActive) {
      return res.status(404).json({ message: 'Template not found' });
    }

    if (!companyId || String(template.company) !== String(companyId)) {
      return res.status(403).json({ message: 'Cannot edit this template' });
    }

    const allowed = ['name', 'description', 'icon', 'color', 'category', 'defaultChannels', 'settings', 'featureToggles', 'isPublic'];
    allowed.forEach(k => {
      if (req.body[k] !== undefined) template[k] = req.body[k];
    });

    await template.save();
    return res.json({ message: 'Template updated', template });
  } catch (err) {
    return handleError(res, err, 'UPDATE TEMPLATE ERROR');
  }
};

/**
 * DELETE /api/workspace-templates/:id
 * Soft-delete a workspace template.
 */
exports.deleteTemplate = async (req, res) => {
  try {
    const companyId = req.user?._dbUser?.companyId || null;

    const template = await WorkspaceTemplate.findById(req.params.id);
    if (!template) return res.status(404).json({ message: 'Template not found' });

    if (!companyId || String(template.company) !== String(companyId)) {
      return res.status(403).json({ message: 'Cannot delete this template' });
    }

    template.isActive = false;
    await template.save();
    return res.json({ message: 'Template deleted' });
  } catch (err) {
    return handleError(res, err, 'DELETE TEMPLATE ERROR');
  }
};
