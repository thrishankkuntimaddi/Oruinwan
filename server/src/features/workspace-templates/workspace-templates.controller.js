// server/src/features/workspace-templates/workspace-templates.controller.js
const WorkspaceTemplate = require('../../models/WorkspaceTemplate');
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

// ─────────────────────────────────────────────────────────────────────────────
// COMMUNITY: Public template marketplace
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/workspace-templates/public
 * No authentication required — returns all platform-level public templates.
 * Paginated: ?page=1&limit=20
 */
exports.listPublicTemplates = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const skip = (page - 1) * limit;
    const { category, q } = req.query;

    const query = { isActive: true, isPublic: true };
    if (category) query.category = category;
    if (q) query.$text = { $search: q };

    const [templates, total] = await Promise.all([
      WorkspaceTemplate.find(query)
        .select('name description icon color category usageCount createdAt')
        .sort({ usageCount: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      WorkspaceTemplate.countDocuments(query)
    ]);

    return res.json({
      templates,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    });
  } catch (err) {
    return handleError(res, err, 'LIST PUBLIC TEMPLATES ERROR');
  }
};

/**
 * POST /api/workspace-templates/:id/import
 * Auth required. Clones a public template's channel structure into the caller's target workspace.
 * Body: { workspaceId }
 */
exports.importTemplate = async (req, res) => {
  try {
    const userId = req.user?.sub;
    const { workspaceId } = req.body;

    if (!workspaceId) {
      return res.status(400).json({ message: 'workspaceId is required' });
    }

    const template = await WorkspaceTemplate.findById(req.params.id).lean();
    if (!template || !template.isActive) {
      return res.status(404).json({ message: 'Template not found' });
    }

    // Allow import of: platform public templates OR own company templates
    const companyId = req.user?._dbUser?.companyId || null;
    const isOwn = template.company && companyId && String(template.company) === String(companyId);
    if (!template.isPublic && !isOwn) {
      return res.status(403).json({ message: 'Template is not publicly available' });
    }

    // Verify caller is a member of the target workspace
    const Workspace = require('../../../models/Workspace');
    const ws = await Workspace.findOne({ _id: workspaceId, 'members.user': userId }).lean();
    if (!ws) return res.status(403).json({ message: 'You are not a member of the target workspace' });

    // Create channels from template's defaultChannels list
    let createdCount = 0;
    if (template.defaultChannels && template.defaultChannels.length > 0) {
      const workspaceCompanyId = ws.company || null;
      for (const ch of template.defaultChannels) {
        try {
          const exists = await Channel.findOne({ workspace: workspaceId, name: ch.name }).lean();
          if (!exists) {
            await Channel.create({
              workspace: workspaceId,
              company: workspaceCompanyId,
              name: ch.name,
              description: ch.description || '',
              isPrivate: ch.isPrivate || false,
              isDefault: ch.isDefault || false,
              isDiscoverable: !ch.isPrivate,
              createdBy: userId,
              members: [{ user: userId, joinedAt: new Date() }],
              admins: [userId]
            });
            createdCount++;
          }
        } catch (chErr) {
          // Non-fatal: skip duplicate/error channel
          console.error('[TEMPLATE IMPORT] Channel create error:', chErr.message);
        }
      }
    }

    // Increment usage count on the template (non-blocking)
    WorkspaceTemplate.findByIdAndUpdate(template._id, { $inc: { usageCount: 1 } }).catch(() => {});

    return res.json({
      message: `Template imported. ${createdCount} channel(s) created.`,
      createdCount
    });
  } catch (err) {
    return handleError(res, err, 'IMPORT TEMPLATE ERROR');
  }
};

