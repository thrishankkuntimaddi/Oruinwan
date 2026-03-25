// src/App.jsx - Recompile Trigger (Updated)
import { BrowserRouter as Router, Routes, Route, Navigate, useParams } from "react-router-dom";

// Context Providers  
import { WorkspaceProvider } from "./contexts/WorkspaceContext";
import ContactsProvider from "./contexts/ContactsContext";
import { NotesProvider } from "./contexts/NotesContext";
import { TasksProvider } from "./contexts/TasksContext";
import { ToastProvider } from "./contexts/ToastContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { UpdatesProvider } from "./contexts/UpdatesContext";
import { SocketProvider } from "./contexts/SocketContext"; // ✅ Add real-time support
import { CompanyProvider } from "./contexts/CompanyContext";
import { DepartmentProvider } from "./contexts/DepartmentContext";

// Layout + Components
import MainLayout from "./components/layout/MainLayout";
import CompanyAdminLayout from "./components/layout/CompanyAdminLayout";
import HomePanel from "./components/home/panels/HomePanel";
import ChannelsPanel from "./components/layout/panels/ChannelsPanel";
import MessagesPanel from "./components/layout/panels/MessagesPanel";
import TasksPanel from "./components/layout/panels/TasksPanel";
import NotesPanel from "./components/layout/panels/NotesPanel";

import MeetingsPanel from "./components/layout/panels/MeetingsPanel";
import { HuddleProvider } from "./contexts/HuddleContext";
import { NotificationsProvider } from "./contexts/NotificationsContext";
import NotificationsPage from "./pages/NotificationsPage";

// Pages (Protected)
import Home from "./pages/SidebarComp/Home";
import Messages from "./pages/SidebarComp/Messages";
import MyTasks from "./pages/SidebarComp/MyTasks";
import Notes from "./pages/SidebarComp/Notes";
import Updates from "./pages/SidebarComp/Updates";
import Meetings from "./pages/SidebarComp/Meetings";
import AppsPage from "./pages/apps/AppsPage";
import WorkspaceSelect from "./pages/WorkspaceSelect";
import FeatureShowcase from "./pages/FeatureShowcase";

// Auth Pages (Public)
import LoginPage from "./pages/LoginPageComp/LoginPage";
import ForgotPassword from "./pages/LoginPageComp/ForgotPassword";
import ResetPassword from "./pages/LoginPageComp/ResetPassword";
import OAuthPasswordSetup from "./pages/LoginPageComp/OAuthPasswordSetup";
import VerifyEmail from "./pages/VerifyEmail";
import OAuthSuccess from "./pages/LoginPageComp/OAuthSuccess";
import SetPassword from "./pages/SetPassword";
import ReactivationFlow from "./pages/ReactivationFlow";
import Settings from "./pages/Settings";
import AcceptInvite from "./pages/AcceptInvite";
import JoinWorkspace from "./pages/JoinWorkspace";
import JoinChannel from "./pages/JoinChannel";

import ChttrixDocs from "./pages/ChttrixDocs";
import Careers from "./pages/Careers";
// import PagePlaceholder from "./pages/PagePlaceholder"; // Removed unused

// Footer Pages
import About from "./pages/company/About";
import Contact from "./pages/company/Contact";
import Brand from "./pages/company/Brand";
import Blog from "./pages/company/Blog";
import Security from "./pages/company/Security";

import HelpCenter from "./pages/resources/HelpCenter";
import Community from "./pages/resources/Community";
import Partners from "./pages/resources/Partners";
import Status from "./pages/resources/Status";

import Privacy from "./pages/legal/Privacy";
import Terms from "./pages/legal/Terms";
import CookieSettings from "./pages/legal/CookieSettings";

import RegisterCompany from "./pages/RegisterCompany";
import PendingVerification from "./pages/PendingVerification";
import CompanyConfirmation from "./pages/CompanyConfirmation";
import CompanySetup from "./pages/CompanySetup";
import DepartmentManagement from "./pages/admin/DepartmentManagement"; // Updated path
import UserManagement from "./pages/admin/UserManagement"; // NEW
import OnboardingPage from "./pages/admin/OnboardingPage"; // NEW
import CompanySettings from "./pages/admin/settings/CompanySettings"; // NEW - 8 section settings
import AdminProfile from "./pages/admin/AdminProfile"; // Personal profile
import Analytics from "./pages/admin/Analytics"; // NEW - Analytics dashboard
import ContactAdmin from "./pages/admin/ContactAdmin"; // NEW - Contact platform admin
import WorkspacesManagement from "./pages/admin/WorkspacesManagement"; // NEW - Admin workspaces management
import AuditSecurityPage from "./pages/admin/AuditSecurityPage"; // NEW - Audit & Security
import AdminSettingsLimited from "./pages/admin/AdminSettingsLimited"; // NEW - Limited settings for admins

// Workspace Collaboration Extensions (Phase 2)
import TeamsManagement from "./pages/admin/TeamsManagement";
import OrgChartPage from "./pages/admin/OrgChartPage";
import WorkspaceTemplates from "./pages/admin/WorkspaceTemplates";
import WorkspacePermissions from "./pages/admin/WorkspacePermissions";

// Dashboard Pages
import AdminDashboard from "./pages/AdminDashboard";
import ManagerLayout from "./components/layout/ManagerLayout.jsx";
import OwnerDashboard from './pages/OwnerDashboard';
import OwnerAnalytics from './pages/OwnerDashboard/OwnerAnalytics'; // NEW
import AdminsManagement from './pages/OwnerDashboard/AdminsManagement'; // NEW - Owner's admin management
import OwnerBilling from './pages/OwnerDashboard/OwnerBilling'; // NEW - Dedicated billing page
import OwnerSecurity from './pages/OwnerDashboard/OwnerSecurity'; // NEW - Dedicated security page
// import ManagerDashboard from "./pages/ManagerDashboard"; // Unused
import ManagerOverview from "./components/manager/ManagerOverview";
// import ManagerWorkspaces from "./components/manager/ManagerWorkspaces";
import ManagerProjects from "./components/manager/ManagerProjects"; // NEW
// import ManagerLocation from "./components/manager/ManagerLocation"; // NEW - Unused
import ManagerTasks from "./components/manager/ManagerTasks";
import ManagerReports from "./components/manager/ManagerReports";
// import ManagerContactAdmin from "./components/manager/ManagerContactAdmin"; // Unused
import ManagerSettings from "./components/manager/ManagerSettings"; // NEW
import TeamAllocation from "./components/manager/TeamAllocation";
import UnassignedMembers from "./components/manager/UnassignedMembers"; // New component
import EmployeeDashboard from "./pages/dashboards/EmployeeDashboard";
import ChttrixAdminDashboard from "./pages/dashboards/ChttrixAdminDashboard";

// Protected route wrappers
import RequireAuth from "./components/RequireAuth";
import RequireWorkspace from "./components/RequireWorkspace";
import RequireAdmin from "./components/RequireAdmin";
import RequireOwner from "./components/RequireOwner";
import RequireChttrixAdmin from "./components/RequireChttrixAdmin";
import RequireDepartmentManager from "./components/RequireDepartmentManager"; // Restored
import VerifiedOnlyRoute from "./components/VerifiedOnlyRoute"; // Block pending users
import ScrollToTop from "./components/ScrollToTop"; // Fix scroll position on route change

// E2EE Password Unlock
import PasswordUnlockModal from "./components/security/PasswordUnlockModal";
import { useAuth } from "./contexts/AuthContext";
import AppErrorBoundary from "./shared/components/ui/AppErrorBoundary";


function App() {

  return (
    <ToastProvider>
      <ThemeProvider>
        <Router>
          <ScrollToTop />
          <SocketProvider>
            <ContactsProvider>
              <CompanyProvider>
                <DepartmentProvider>
                  <NotesProvider>
                    <TasksProvider>
                      <UpdatesProvider>
                          <AppErrorBoundary label="App">
                            <Routes>

                              {/* PROTECTED AREA (requires login) */}

                              {/* Redirect /personal/workspace to /workspaces to prevent white screen */}
                              <Route
                                path="/personal/workspace"
                                element={<Navigate to="/workspaces" replace />}
                              />

                          {/* Workspace Selection - Must select workspace first */}
                          <Route
                            path="/workspaces"
                            element={
                              <RequireAuth>
                                <VerifiedOnlyRoute>
                                  <WorkspaceSelect />
                                </VerifiedOnlyRoute>
                              </RequireAuth>
                            }
                          />

                          {/* WORKSPACE-SPECIFIC ROUTES - All require workspaceId + membership */}

                          {/* Home/Main View */}
                          <Route
                            path="/workspace/:workspaceId/home"
                            element={
                              <RequireAuth>
                                <WorkspaceProvider>
                                  <NotificationsProvider>
                                    <RequireWorkspace>
                                      <MainLayout sidePanel={<HomePanel />}>
                                        <Home />
                                      </MainLayout>
                                    </RequireWorkspace>
                                  </NotificationsProvider>
                                </WorkspaceProvider>
                              </RequireAuth>
                            }
                          />

                          {/* Home View - Specific Channel */}
                          <Route
                            path="/workspace/:workspaceId/home/channel/:id"
                            element={
                              <RequireAuth>
                                <WorkspaceProvider>
                                  <NotificationsProvider>
                                    <RequireWorkspace>
                                      <MainLayout sidePanel={<HomePanel />}>
                                        <Home />
                                      </MainLayout>
                                    </RequireWorkspace>
                                  </NotificationsProvider>
                                </WorkspaceProvider>
                              </RequireAuth>
                            }
                          />

                          {/* Home View - Specific DM */}
                          <Route
                            path="/workspace/:workspaceId/home/dm/:id"
                            element={
                              <RequireAuth>
                                <WorkspaceProvider>
                                  <RequireWorkspace>
                                    <MainLayout sidePanel={<HomePanel />}>
                                      <Home />
                                    </MainLayout>
                                  </RequireWorkspace>
                                </WorkspaceProvider>
                              </RequireAuth>
                            }
                          />

                          {/* Home View - New DM */}
                          <Route
                            path="/workspace/:workspaceId/home/dm/new/:dmId"
                            element={
                              <RequireAuth>
                                <WorkspaceProvider>
                                  <RequireWorkspace>
                                    <MainLayout sidePanel={<HomePanel />}>
                                      <Home />
                                    </MainLayout>
                                  </RequireWorkspace>
                                </WorkspaceProvider>
                              </RequireAuth>
                            }
                          />

                          {/* Channels View */}
                          <Route
                            path="/workspace/:workspaceId/channels"
                            element={
                              <RequireAuth>
                                <WorkspaceProvider>
                                  <RequireWorkspace>
                                    <MainLayout sidePanel={<ChannelsPanel />}>
                                      <Home />
                                    </MainLayout>
                                  </RequireWorkspace>
                                </WorkspaceProvider>
                              </RequireAuth>
                            }
                          />

                          {/* Specific Channel */}
                          <Route
                            path="/workspace/:workspaceId/channel/:id"
                            element={
                              <RequireAuth>
                                <WorkspaceProvider>
                                  <NotificationsProvider>
                                    <RequireWorkspace>
                                      <MainLayout sidePanel={<ChannelsPanel />}>
                                        <Home />
                                      </MainLayout>
                                    </RequireWorkspace>
                                  </NotificationsProvider>
                                </WorkspaceProvider>
                              </RequireAuth>
                            }
                          />

                          {/* Direct Messages View */}
                          <Route
                            path="/workspace/:workspaceId/messages"
                            element={
                              <RequireAuth>
                                <WorkspaceProvider>
                                  <NotificationsProvider>
                                    <RequireWorkspace>
                                      <MainLayout sidePanel={<MessagesPanel />}>
                                        <Messages />
                                      </MainLayout>
                                    </RequireWorkspace>
                                  </NotificationsProvider>
                                </WorkspaceProvider>
                              </RequireAuth>
                            }
                          />

                          {/* Specific DM from Messages Panel */}
                          <Route
                            path="/workspace/:workspaceId/messages/dm/:dmId"
                            element={
                              <RequireAuth>
                                <WorkspaceProvider>
                                  <RequireWorkspace>
                                    <MainLayout sidePanel={<MessagesPanel />}>
                                      <Messages />
                                    </MainLayout>
                                  </RequireWorkspace>
                                </WorkspaceProvider>
                              </RequireAuth>
                            }
                          />

                          {/* Specific DM */}
                          <Route
                            path="/workspace/:workspaceId/dm/:id"
                            element={
                              <RequireAuth>
                                <WorkspaceProvider>
                                  <RequireWorkspace>
                                    <MainLayout sidePanel={<MessagesPanel />}>
                                      <Home />
                                    </MainLayout>
                                  </RequireWorkspace>
                                </WorkspaceProvider>
                              </RequireAuth>
                            }
                          />

                          {/* New DM (Initiation) */}
                          <Route
                            path="/workspace/:workspaceId/dm/new/:dmId"
                            element={
                              <RequireAuth>
                                <WorkspaceProvider>
                                  <RequireWorkspace>
                                    <MainLayout sidePanel={<MessagesPanel />}>
                                      <Home />
                                    </MainLayout>
                                  </RequireWorkspace>
                                </WorkspaceProvider>
                              </RequireAuth>
                            }
                          />

                          {/* Tasks — MyTasks has its own built-in sidebar */}
                          <Route
                            path="/workspace/:workspaceId/tasks"
                            element={
                              <RequireAuth>
                                <WorkspaceProvider>
                                  <RequireWorkspace>
                                    <MainLayout>
                                      <MyTasks />
                                    </MainLayout>
                                  </RequireWorkspace>
                                </WorkspaceProvider>
                              </RequireAuth>
                            }
                          />

                          {/* Notes */}
                          <Route
                            path="/workspace/:workspaceId/notes"
                            element={
                              <RequireAuth>
                                <WorkspaceProvider>
                                  <RequireWorkspace>
                                    <MainLayout sidePanel={<NotesPanel />}>
                                      <Notes />
                                    </MainLayout>
                                  </RequireWorkspace>
                                </WorkspaceProvider>
                              </RequireAuth>
                            }
                          />

                          {/* Specific Note */}
                          <Route
                            path="/workspace/:workspaceId/notes/:id"
                            element={
                              <RequireAuth>
                                <WorkspaceProvider>
                                  <RequireWorkspace>
                                    <MainLayout sidePanel={<NotesPanel />}>
                                      <Notes />
                                    </MainLayout>
                                  </RequireWorkspace>
                                </WorkspaceProvider>
                              </RequireAuth>
                            }
                          />

                           {/* Updates — self-contained layout with its own filter sidebar */}
                           <Route
                             path="/workspace/:workspaceId/updates"
                             element={
                               <RequireAuth>
                                 <WorkspaceProvider>
                                   <RequireWorkspace>
                                     <MainLayout>
                                       <Updates />
                                     </MainLayout>
                                   </RequireWorkspace>
                                 </WorkspaceProvider>
                               </RequireAuth>
                             }
                           />

                           {/* Apps & Integrations */}
                          <Route
                            path="/workspace/:workspaceId/apps"
                            element={
                              <RequireAuth>
                                <WorkspaceProvider>
                                  <RequireWorkspace>
                                    <MainLayout>
                                      <AppsPage />
                                    </MainLayout>
                                  </RequireWorkspace>
                                </WorkspaceProvider>
                              </RequireAuth>
                            }
                          />

                          {/* Huddles / Meetings */}
                          <Route
                            path="/workspace/:workspaceId/huddles"
                            element={
                              <RequireAuth>
                                <WorkspaceProvider>
                                  <RequireWorkspace>
                                    <HuddleRouteWrapper />
                                  </RequireWorkspace>
                                </WorkspaceProvider>
                              </RequireAuth>
                            }
                          />

                          {/* Notifications Page */}
                          <Route
                            path="/workspace/:workspaceId/notifications"
                            element={
                              <RequireAuth>
                                <WorkspaceProvider>
                                  <NotificationsProvider>
                                    <RequireWorkspace>
                                      <MainLayout>
                                        <NotificationsPage />
                                      </MainLayout>
                                    </RequireWorkspace>
                                  </NotificationsProvider>
                                </WorkspaceProvider>
                              </RequireAuth>
                            }
                          />

                          {/* Legacy routes - redirect to workspaces */}
                          <Route
                            path="/home"
                            element={
                              <RequireAuth>
                                <WorkspaceSelect />
                              </RequireAuth>
                            }
                          />

                          {/* PUBLIC ROUTES */}
                          <Route path="/" element={<FeatureShowcase />} />
                          <Route path="/features" element={<FeatureShowcase />} />
                          <Route path="/chttrix-docs" element={<ChttrixDocs />} />


                          {/* Footer Routes */}
                          <Route path="/about" element={<About />} />
                          <Route path="/contact" element={<Contact />} />
                          <Route path="/brand" element={<Brand />} />
                          <Route path="/blog" element={<Blog />} />
                          <Route path="/security" element={<Security />} />
                          <Route path="/careers" element={<Careers />} />

                          <Route path="/help" element={<HelpCenter />} />
                          <Route path="/community" element={<Community />} />
                          <Route path="/partners" element={<Partners />} />
                          <Route path="/status" element={<Status />} />

                          <Route path="/privacy" element={<Privacy />} />
                          <Route path="/terms" element={<Terms />} />
                          <Route path="/cookies" element={<CookieSettings />} />

                          {/* COMPANY SETUP ROUTES */}
                          <Route
                            path="/company/confirm"
                            element={
                              <RequireAuth>
                                <CompanyConfirmation />
                              </RequireAuth>
                            }
                          />
                          <Route
                            path="/company/setup"
                            element={
                              <RequireAuth>
                                <CompanySetup />
                              </RequireAuth>
                            }
                          />

                          {/* PUBLIC ROUTES */}
                          {/* Authentication */}
                          <Route path="/login" element={<LoginPage />} />
                          <Route path="/register-company" element={<RegisterCompany />} />
                          <Route path="/pending-verification" element={<PendingVerification />} />
                          <Route path="/join-workspace" element={<JoinWorkspace />} />
                          <Route path="/forgot-password" element={<ForgotPassword />} />
                          <Route path="/reset-password" element={<ResetPassword />} />
                          <Route path="/setup-password" element={<OAuthPasswordSetup />} />
                          <Route path="/verify-email" element={<VerifyEmail />} />
                          <Route path="/oauth-success" element={<OAuthSuccess />} />
                          <Route path="/reactivate" element={<ReactivationFlow />} />
                          <Route path="/accept-invite" element={<AcceptInvite />} />
                          <Route
                            path="/set-password"
                            element={
                              <RequireAuth>
                                <SetPassword />
                              </RequireAuth>
                            }
                          />
                          <Route
                            path="/settings"
                            element={
                              <RequireAuth>
                                <VerifiedOnlyRoute>
                                  <Settings />
                                </VerifiedOnlyRoute>
                              </RequireAuth>
                            }
                          />
                          {/* Route join-workspace duplicate removed */}
                          <Route
                            path="/join-channel"
                            element={
                              <RequireAuth>
                                <JoinChannel />
                              </RequireAuth>
                            }
                          />

                          {/* ============================================ */}
                          {/* DASHBOARD ROUTES - SEPARATED BY ROLE        */}
                          {/* ============================================ */}

                          {/* OWNER ROUTES - Wrapped in CompanyAdminLayout */}
                          <Route
                            element={
                              <RequireAuth>
                                <VerifiedOnlyRoute>
                                  <RequireOwner>
                                    <CompanyAdminLayout />
                                  </RequireOwner>
                                </VerifiedOnlyRoute>
                              </RequireAuth>
                            }
                          >
                            <Route path="/owner/dashboard" element={<OwnerDashboard />} />
                            <Route path="/owner/analytics" element={<OwnerAnalytics />} />
                            <Route path="/owner/billing" element={<OwnerBilling />} />
                            <Route path="/owner/security" element={<OwnerSecurity />} />

                            <Route path="/owner/admins" element={<AdminsManagement />} />
                            <Route path="/owner/workspaces" element={<WorkspacesManagement />} />
                            <Route path="/owner/departments" element={<DepartmentManagement />} />
                            <Route path="/owner/users" element={<UserManagement />} />
                            <Route path="/owner/onboard" element={<OnboardingPage />} />
                            <Route path="/owner/settings" element={<CompanySettings />} />

                            {/* Workspace Collaboration Extensions */}
                            <Route path="/owner/teams" element={<TeamsManagement />} />
                            <Route path="/owner/org-chart" element={<OrgChartPage />} />
                            <Route path="/owner/workspace-templates" element={<WorkspaceTemplates />} />
                            <Route path="/owner/workspace-permissions" element={<WorkspacePermissions />} />
                          </Route>

                          {/* ADMIN DASHBOARD & TOOLS - Admin + Owner */}
                          <Route
                            element={
                              <RequireAuth>
                                <VerifiedOnlyRoute>
                                  <RequireAdmin>
                                    <CompanyAdminLayout />
                                  </RequireAdmin>
                                </VerifiedOnlyRoute>
                              </RequireAuth>
                            }
                          >
                            <Route path="/admin/dashboard" element={<AdminDashboard />} />
                            <Route path="/admin/analytics" element={<Analytics />} />
                            <Route path="/admin/departments" element={<DepartmentManagement />} />
                            <Route path="/admin/workspaces" element={<WorkspacesManagement />} />
                            <Route path="/admin/users" element={<UserManagement />} />
                            <Route path="/admin/onboard" element={<OnboardingPage />} />
                            <Route path="/admin/security" element={<AuditSecurityPage />} />
                            <Route path="/admin/settings" element={<AdminSettingsLimited />} />
                            <Route path="/admin/profile" element={<AdminProfile />} />
                            <Route path="/contact-admin" element={<ContactAdmin />} />

                            {/* Workspace Collaboration Extensions */}
                            <Route path="/admin/teams" element={<TeamsManagement />} />
                            <Route path="/admin/org-chart" element={<OrgChartPage />} />
                            <Route path="/admin/workspace-templates" element={<WorkspaceTemplates />} />
                            <Route path="/admin/workspace-permissions" element={<WorkspacePermissions />} />
                          </Route>

                          {/* MANAGER DASHBOARD - Manager + Admin + Owner */}
                          <Route
                            path="/manager/dashboard"
                            element={
                              <RequireAuth>
                                <VerifiedOnlyRoute>
                                  <RequireDepartmentManager>
                                    <ManagerLayout />
                                  </RequireDepartmentManager>
                                </VerifiedOnlyRoute>
                              </RequireAuth>
                            }
                          >
                            <Route index element={<Navigate to="overview" replace />} />
                            <Route path="overview" element={<ManagerOverview />} />
                            {/* <Route path="workspace" element={<ManagerWorkspaces />} /> */}
                            <Route path="allocation" element={<TeamAllocation />} />
                            <Route path="tasks" element={<ManagerTasks />} />
                            <Route path="reports" element={<ManagerReports />} />
                            <Route path="settings" element={<ManagerSettings />} />

                            {/* Manager sub-routes */}
                            <Route path="projects" element={<ManagerProjects />} />
                            <Route path="unassigned" element={<UnassignedMembers />} /> {/* Distinct Component */}
                          </Route>

                          <Route
                            path="/employee/dashboard"
                            element={
                              <RequireAuth>
                                <VerifiedOnlyRoute>
                                  <EmployeeDashboard />
                                </VerifiedOnlyRoute>
                              </RequireAuth>
                            }
                          />

                          {/* Chttrix Super Admin - Nested Routes */}
                          <Route
                            path="/chttrix-admin/*"
                            element={
                              <RequireChttrixAdmin>
                                <ChttrixAdminDashboard />
                              </RequireChttrixAdmin>
                            }
                          />

                            </Routes>
                          </AppErrorBoundary>

                        {/* 🔐 Global Password Unlock Modal (E2EE) - Renders across all routes */}
                        <GlobalPasswordUnlockModal />
                      </UpdatesProvider>
                    </TasksProvider>
                  </NotesProvider>
                </DepartmentProvider>
              </CompanyProvider>
            </ContactsProvider>
          </SocketProvider>
        </Router>
      </ThemeProvider>
    </ToastProvider>
  );
}

// Global Password Unlock Component
function GlobalPasswordUnlockModal() {
  const { requiresPassword, unlockEncryption } = useAuth();

  if (!requiresPassword) return null;

  return <PasswordUnlockModal onSubmit={unlockEncryption} />;
}

// Huddles Route Wrapper — provides shared HuddleContext to both side panel and main panel
function HuddleRouteWrapper() {
  const { workspaceId } = useParams();
  return (
    <HuddleProvider workspaceId={workspaceId}>
      <MainLayout sidePanel={<MeetingsPanel />}>
        <Meetings />
      </MainLayout>
    </HuddleProvider>
  );
}

export default App;
