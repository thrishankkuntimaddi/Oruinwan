// server/routes/departments.js
const express = require('express');
const router = express.Router();
const Department = require('../models/Department');
const requireAuth = require('../middleware/auth'); // Fixed: single default export

// GET /api/departments/:companyId - Get all departments for a company
router.get('/:companyId', requireAuth, async (req, res) => {
    try {
        const { companyId } = req.params;

        // console.log('[DEPARTMENTS] Fetching departments for company:', companyId);

        const departments = await Department.find({ company: companyId })
            .populate('head', 'username email profilePicture')
            .populate('members', 'username email profilePicture')
            .populate('workspaces', 'name description')
            .sort({ name: 1 });

        // console.log(`[DEPARTMENTS] Found ${departments.length} departments`);

        res.json({ departments });
    } catch (error) {
        console.error('[DEPARTMENTS] Error fetching departments:', error);
        res.status(500).json({ message: 'Failed to fetch departments', error: error.message });
    }
});

// POST /api/departments - Create a new department
router.post('/', requireAuth, async (req, res) => {
    try {
        const { companyId, name, description, head } = req.body;

        // console.log('[DEPARTMENTS] Creating department:', name, 'for company:', companyId);

        const department = new Department({
            company: companyId,
            name,
            description,
            head,
            members: head ? [head] : []
        });

        await department.save();

        // console.log('[DEPARTMENTS] Department created:', department._id);

        res.status(201).json({ department });
    } catch (error) {
        console.error('[DEPARTMENTS] Error creating department:', error);
        res.status(500).json({ message: 'Failed to create department', error: error.message });
    }
});

// PUT /api/departments/:id - Update a department
router.put('/:id', requireAuth, async (req, res) => {
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
        console.error('[DEPARTMENTS] Error updating department:', error);
        res.status(500).json({ message: 'Failed to update department', error: error.message });
    }
});

// DELETE /api/departments/:id - Delete a department
router.delete('/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;

        const department = await Department.findByIdAndDelete(id);

        if (!department) {
            return res.status(404).json({ message: 'Department not found' });
        }

        // Cleanup: Remove this department from all users
        const User = require('../models/User');

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

        // console.log(`[DEPARTMENTS] Deleted department ${id} and cleaned up user references`);

        res.json({ message: 'Department deleted successfully' });
    } catch (error) {
        console.error('[DEPARTMENTS] Error deleting department:', error);
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
        console.error('[DEPARTMENTS] Error fetching members:', error);
        res.status(500).json({ message: 'Failed to fetch members', error: error.message });
    }
});

// POST /api/departments/:id/members - Add member to department
router.post('/:id/members', requireAuth, async (req, res) => {
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
            const User = require('../models/User');
            await User.findByIdAndUpdate(userId, {
                $addToSet: { departments: id }
            });
        }

        res.json({ department });
    } catch (error) {
        console.error('[DEPARTMENTS] Error adding member:', error);
        res.status(500).json({ message: 'Failed to add member', error: error.message });
    }
});

// DELETE /api/departments/:departmentId/members/:userId - Remove member from department
router.delete('/:departmentId/members/:userId', requireAuth, async (req, res) => {
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
        const User = require('../models/User');
        await User.findByIdAndUpdate(userId, {
            $pull: { departments: departmentId }
        });

        res.json({ department });
    } catch (error) {
        console.error('[DEPARTMENTS] Error removing member:', error);
        res.status(500).json({ message: 'Failed to remove member', error: error.message });
    }
});

// POST /api/departments/:id/workspaces - Add workspace to department
router.post('/:id/workspaces', requireAuth, async (req, res) => {
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

// DELETE /api/departments/:id/workspaces/:wsId - Remove workspace
router.delete('/:id/workspaces/:wsId', requireAuth, async (req, res) => {
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
