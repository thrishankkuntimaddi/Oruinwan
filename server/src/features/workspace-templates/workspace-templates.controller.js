const WorkspaceTemplate = require('../../models/WorkspaceTemplate');
const identity = require('../../identity');
const { hydrate } = require('../../identity/hydrate');

const CREATOR = { createdBy: { type: 'user', fields: ['username', 'profilePicture'] } };
const Channel = require('../channels/channel.model');
const { handleError } = require('../../../utils/responseHelpers');

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
      .sort({ usageCount: -1, createdAt: -1 })
      .lean();
    await hydrate(templates, CREATOR);

    return res.json({ templates });
  } catch (err) {
    return handleError(res, err, 'LIST TEMPLATES ERROR');
  }
};

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
      fromWorkspaceId 
    } = req.body;

    if (!name) return res.status(400).json({ message: 'Template name is required' });

    let channels = defaultChannels || [];
    let templateSettings = settings || {};

    
    if (fromWorkspaceId) {
      const source = await identity.workspaces.findById(fromWorkspaceId);
      if (!source) return res.status(404).json({ message: 'Source workspace not found' });

      
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

exports.getTemplate = async (req, res) => {
  try {
    const template = await WorkspaceTemplate.findById(req.params.id).lean();
    if (template) await hydrate(template, CREATOR);

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

    
    const companyId = req.user?._dbUser?.companyId || null;
    const isOwn = template.company && companyId && String(template.company) === String(companyId);
    if (!template.isPublic && !isOwn) {
      return res.status(403).json({ message: 'Template is not publicly available' });
    }

    const ws = await identity.workspaces.findById(workspaceId);
    if (!ws || !ws.members.some(m => String(m.user) === String(userId) && m.status !== 'removed')) return res.status(403).json({ message: 'You are not a member of the target workspace' });

    // Channels (with encryption keys), settings and feature toggles.
    const before = await Channel.countDocuments({ workspace: workspaceId });
    await require('../workspace-os/workspace-os.service').applyTemplate({ workspace: ws, templateId: template._id, userId, companyId });
    const createdCount = (await Channel.countDocuments({ workspace: workspaceId })) - before;

    return res.json({
      message: `Template imported. ${createdCount} channel(s) created.`,
      createdCount
    });
  } catch (err) {
    return handleError(res, err, 'IMPORT TEMPLATE ERROR');
  }
};
