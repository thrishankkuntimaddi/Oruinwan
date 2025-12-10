// server/controllers/workspaceController.js
const Workspace = require("../models/Workspace");
const User = require("../models/User");
const { createInvite } = require("../utils/invite");
const sendEmail = require("../utils/sendEmail");

exports.createWorkspace = async (req, res) => {
  try {
    const { companyId, name } = req.body;
    const userId = req.user?.sub;

    if (!companyId || !name) return res.status(400).json({ message: "companyId and name required" });

    const user = await User.findById(userId);
    if (!user || String(user.companyId) !== String(companyId)) return res.status(403).json({ message: "Not a company member" });

    const role = user.rolesPerCompany ? user.rolesPerCompany[companyId] : null;
    if (!role || (role !== "admin" && role !== "owner")) return res.status(403).json({ message: "Only company admins may create workspaces" });

    const ws = await Workspace.create({
      company: companyId,
      name: name.trim(),
      createdBy: userId,
      members: [{ user: userId, role: "owner" }]
    });

    return res.status(201).json({ workspace: ws });
  } catch (err) {
    console.error("CREATE WORKSPACE ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.listWorkspaces = async (req, res) => {
  try {
    const companyId = req.params.companyId;
    const userId = req.user?.sub;

    const user = await User.findById(userId);
    if (!user || String(user.companyId) !== String(companyId)) return res.status(403).json({ message: "Not a company member" });

    const workspaces = await Workspace.find({ company: companyId }).select("-__v").lean();
    return res.json({ workspaces });
  } catch (err) {
    console.error("LIST WORKSPACES ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.inviteToWorkspace = async (req, res) => {
  try {
    const workspaceId = req.params.id;
    const { email, role = "member", daysValid = 7 } = req.body;
    const inviterId = req.user?.sub;

    const ws = await Workspace.findById(workspaceId);
    if (!ws) return res.status(404).json({ message: "Workspace not found" });

    const inviter = await User.findById(inviterId);
    if (!inviter || String(inviter.companyId) !== String(ws.company)) return res.status(403).json({ message: "Not allowed" });

    const inviterRoleCompany = inviter.rolesPerCompany ? inviter.rolesPerCompany[ws.company] : null;
    const isWorkspaceMember = ws.members.some(m => String(m.user) === String(inviterId));
    if (!(inviterRoleCompany === "admin" || inviterRoleCompany === "owner" || isWorkspaceMember)) {
      return res.status(403).json({ message: "Not allowed to invite" });
    }

    const { rawToken, invite } = await createInvite({
      email,
      companyId: ws.company,
      workspaceId: ws._id,
      role,
      invitedBy: inviterId,
      daysValid
    });

    const inviteLink = `${process.env.FRONTEND_URL}/accept-invite?token=${rawToken}&email=${encodeURIComponent(email)}`;

    try {
      await sendEmail({
        to: email,
        subject: `Invite to workspace ${ws.name}`,
        html: `You were invited to workspace ${ws.name}. Click to accept: <a href="${inviteLink}">${inviteLink}</a>`
      });
    } catch (e) { console.warn("Email send failed:", e?.message || e); }

    return res.json({ message: "Invite created", inviteId: invite._id, inviteLink });
  } catch (err) {
    console.error("INVITE TO WORKSPACE ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
};
