// server/routes/departments.js
// TODO (Phase 2D): Create departments.controller.js and move inline logic
const express = require('express');
const router = express.Router();
const Department = require('../../../models/Department');
const Workspace = require('../../../models/Workspace');
const Channel = require("../channels/channel.model.js");
const requireAuth = require('../../../middleware/auth'); // Fixed: single default export
const { requireAdmin } = require('../../../middleware/permissionMiddleware');

// GET /api/departments/:companyId - Get all departments for a company
router.get('/:companyId', requireAuth, async (req, res) => {
    try {
        const { companyId } = req.params;



        const departments = await Department.find({ company: companyId })
            .populate('head', 'username email profilePicture')
            .populate('members', 'username email profilePicture')
            .populate('workspaces', 'name description')
            .sort({ name: 1 });



        res.json({ departments });
    } catch (error) {

        res.status(500).json({ message: 'Failed to fetch departments', error: error.message });
    }
});

// POST /api/departments - Create a new department
router.post('/', requireAuth, async (req, res) => {
    try {
        const { companyId, name, description, head } = req.body;



        const department = new Department({
            company: companyId,
            name,
            description,
            head,
            members: head ? [head] : []
        });

        await department.save();

        // --- HIERARCHY CREATION LOGIC ---
        // 1. Create Default Workspace for this Department
        const workspaceName = `${name}`; // E.g., "Engineering"
        const workspace = new Workspace({
            company: companyId,
            name: workspaceName,
            description: `${name} Team Workspace`,
            type: 'company',
            department: department._id,
            createdBy: head || req.user.sub, // Use HEAD if assigned, else creating admin
            members: head ? [{ user: head, role: 'owner' }] : [],
            settings: {
                isPrivate: false, // Department workspaces usually visible? Or private? Let's say private by default
                allowMemberInvite: true
            }
        });

        // Ensure creator is a member if head is not the creator (or if head is null)
        // If 'head' is provided, they are owner. If I am creating it (admin) and not head,
        // I might want to be added or not. For now, let's ensure the 'head' is the primary owner.
        // If no head, the creator (admin) is owner.
        if (!head && req.user && req.user.sub) {
            workspace.members.push({ user: req.user.sub, role: 'owner' });
            workspace.createdBy = req.user.sub;
        } else if (head && req.user && req.user.sub && String(head) !== String(req.user.sub)) {
            // Admin created it for someone else. Admin stays as member/admin? 
            // Let's make admin a member too so they can see it.
            workspace.members.push({ user: req.user.sub, role: 'admin' });
        }

        await workspace.save();

        // 2. Create Default Channels
        const channelsToCreate = ['general', 'announcements'];
        const createdChanIds = [];
        const creationDate = new Date();

        for (const chanName of channelsToCreate) {
            const channel = new Channel({
                workspace: workspace._id,
                company: companyId,
                name: chanName,
                isDefault: true,
                createdBy: head || req.user.sub,
                // Add all workspace members to channel
                members: workspace.members.map(m => ({
                    user: m.user,
                    joinedAt: creationDate
                })),
                systemEvents: [{
                    type: 'channel_created',
                    userId: head || req.user.sub,
                    timestamp: creationDate
                }]
            });
            await channel.save();
            createdChanIds.push(channel._id);
        }

        // 3. Link Channels to Workspace
        workspace.defaultChannels = createdChanIds;
        await workspace.save();

        // 🔐 PHASE 5: Bootstrap conversation keys for default channels
        // This ensures ALL channels have encryption keys at creation time
        const conversationKeysService = require('../../modules/conversations/conversationKeys.service');
        const _channelCreatorId = head || req.user.sub;
        const memberIds = workspace.members.map(m => m.user.toString());

        for (const chanId of createdChanIds) {
            try {
                await conversationKeysService.bootstrapConversationKey({
                    conversationId: chanId.toString(),
                    conversationType: 'channel',
                    workspaceId: workspace._id.toString(),
                    members: memberIds
                });
                console.log(`✅ [PHASE 5] Bootstrapped conversation key for channel ${chanId}`);
            } catch (keyError) {
                console.error(`❌ [PHASE 5] Failed to bootstrap key for channel ${chanId}:`, keyError);
                throw new Error('Failed to initialize channel encryption');
            }
        }

        // 4. Link Workspace to Department
        department.workspaces.push(workspace._id);
        await department.save();



        res.status(201).json({ department });
    } catch (error) {

        res.status(500).json({ message: 'Failed to create department', error: error.message });
    }
});

// PUT /api/departments/:id - Update a department (Admin/Owner only)
router.put('/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        const department = await Department.findByIdAndUpdate(
            id,
            updates,
            { new: true, runValidators: true }
        ).populate('head', 'username email');

        if (!department) {
            return res.status(404).json({ message: 'Department not found' });
        }

        res.json({ department });
    } catch (error) {

        res.status(500).json({ message: 'Failed to update department', error: error.message });
    }
});

// DELETE /api/departments/:id - Delete a department (Admin/Owner only)
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        const department = await Department.findByIdAndDelete(id);

        if (!department) {
            return res.status(404).json({ message: 'Department not found' });
        }

        // Cleanup: Remove this department from all users
        const User = require('../../../models/User');

        // 1. Remove from 'departments' array of all users
        await User.updateMany(
            { departments: id },
            { $pull: { departments: id } }
        );

        // 2. Remove from 'managedDepartments' array of managers
        await User.updateMany(
            { managedDepartments: id },
            { $pull: { managedDepartments: id } }
        );

        // 3. Optional: If the manager has no more departments, should we downgrade role?
        // For now, simpler is safer: just remove the reference.



        res.json({ message: 'Department deleted successfully' });
    } catch (error) {

        res.status(500).json({ message: 'Failed to delete department', error: error.message });
    }
});

// GET /api/departments/:id/members - Get members of a department
router.get('/:id/members', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;

        const department = await Department.findById(id)
            .populate('members', 'username email phone userType');

        if (!department) {
            return res.status(404).json({ message: 'Department not found' });
        }

        res.json({ members: department.members || [] });
    } catch (error) {

        res.status(500).json({ message: 'Failed to fetch members', error: error.message });
    }
});

// POST /api/departments/:id/members - Add member to department (Admin/Owner only)
router.post('/:id/members', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { userId } = req.body;

        const department = await Department.findById(id);

        if (!department) {
            return res.status(404).json({ message: 'Department not found' });
        }

        if (!department.members.includes(userId)) {
            department.members.push(userId);
            await department.save();

            // Sync with User model
            const User = require('../../../models/User');
            await User.findByIdAndUpdate(userId, {
                $addToSet: { departments: id }
            });
        }

        res.json({ department });
    } catch (error) {

        res.status(500).json({ message: 'Failed to add member', error: error.message });
    }
});

// DELETE /api/departments/:departmentId/members/:userId - Remove member from department (Admin/Owner only)
router.delete('/:departmentId/members/:userId', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { departmentId, userId } = req.params;

        const department = await Department.findById(departmentId);

        if (!department) {
            return res.status(404).json({ message: 'Department not found' });
        }

        department.members = department.members.filter(
            memberId => memberId.toString() !== userId
        );

        await department.save();

        // Sync with User model
        const User = require('../../../models/User');
        await User.findByIdAndUpdate(userId, {
            $pull: { departments: departmentId }
        });

        res.json({ department });
    } catch (error) {

        res.status(500).json({ message: 'Failed to remove member', error: error.message });
    }
});

// POST /api/departments/:id/workspaces - Add workspace to department (Admin/Owner only)
router.post('/:id/workspaces', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { workspaceId } = req.body;
        const department = await Department.findById(id);
        if (!department) return res.status(404).json({ message: 'Department not found' });

        if (!department.workspaces.includes(workspaceId)) {
            department.workspaces.push(workspaceId);
            await department.save();
        }
        res.json({ department });
    } catch (error) {
        res.status(500).json({ message: 'Failed to add workspace', error: error.message });
    }
});

// DELETE /api/departments/:id/workspaces/:wsId - Remove workspace (Admin/Owner only)
router.delete('/:id/workspaces/:wsId', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { id, wsId } = req.params;
        const department = await Department.findById(id);
        if (!department) return res.status(404).json({ message: 'Department not found' });

        department.workspaces = department.workspaces.filter(wId => wId.toString() !== wsId);
        await department.save();
        res.json({ department });
    } catch (error) {
        res.status(500).json({ message: 'Failed to remove workspace', error: error.message });
    }
});

module.exports = router;
