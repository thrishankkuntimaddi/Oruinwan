import { BrowserRouter as Router, Routes, Route, Navigate, useParams } from "react-router-dom";

import { WorkspaceProvider } from "./contexts/WorkspaceContext";
import ContactsProvider from "./contexts/ContactsContext";
import { NotesProvider } from "./contexts/NotesContext";
import { TasksProvider } from "./contexts/TasksContext";
import { ToastProvider } from "./contexts/ToastContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { UpdatesProvider } from "./contexts/UpdatesContext";
import { SocketProvider } from "./contexts/SocketContext"; 
import { CompanyProvider } from "./contexts/CompanyContext";
import { DepartmentProvider } from "./contexts/DepartmentContext";
import { SearchProvider } from "./contexts/SearchContext"; 

import MainLayout from "./components/layout/MainLayout";
import CompanyAdminLayout from "./components/layout/CompanyAdminLayout";
import HomePanel from "./components/home/panels/HomePanel";
import ChannelsPanel from "./components/layout/panels/ChannelsPanel";
import MessagesPanel from "./components/layout/panels/MessagesPanel";
import TasksPanel from "./components/layout/panels/TasksPanel";
import NotesPanel from "./components/layout/panels/NotesPanel";
import FilesPanel from "./components/layout/panels/FilesPanel";
import KnowledgePanel from "./components/layout/panels/KnowledgePanel";

import MeetingsPanel from "./components/layout/panels/MeetingsPanel";
import { HuddleProvider } from "./contexts/HuddleContext";
import { NotificationsProvider } from "./contexts/NotificationsContext";
import NotificationsPage from "./pages/NotificationsPage";

import Home from "./pages/SidebarComp/Home";
import Messages from "./pages/SidebarComp/Messages";
import MyTasks from "./pages/SidebarComp/MyTasks";
import Notes from "./pages/SidebarComp/Notes";
import Updates from "./pages/SidebarComp/Updates";
import Meetings from "./pages/SidebarComp/Meetings";
import MeetingDetailPage from "./pages/SidebarComp/MeetingDetailPage";
import AppsPage from "./pages/apps/AppsPage";
import AutomationsPage from "./pages/workspace/AutomationsPage";
import AutomationBuilderPage from "./pages/workspace/AutomationBuilderPage";
import TemplateMarketplacePage from "./pages/workspace/TemplateMarketplacePage";
import DeveloperPortalPage from "./pages/developer/DeveloperPortalPage";
import FileLibrary from "./pages/SidebarComp/FileLibrary";
import KnowledgePage from "./pages/SidebarComp/KnowledgePage";
import KnowledgeGraph from "./pages/SidebarComp/KnowledgeGraph";
import WorkspaceSelect from "./pages/WorkspaceSelect";
import FeatureShowcase from "./pages/FeatureShowcase";

import LoginPage from "./pages/LoginPageComp/LoginPage";
import ForgotPassword from "./pages/LoginPageComp/ForgotPassword";
import ResetPassword from "./pages/LoginPageComp/ResetPassword";

import VerifyEmail from "./pages/VerifyEmail";
import OAuthSuccess from "./pages/LoginPageComp/OAuthSuccess";
import SetPassword from "./pages/SetPassword";
import SetupPassword from "./pages/SetupPassword";
import ReactivationFlow from "./pages/ReactivationFlow";
import Settings from "./pages/Settings";
import AcceptInvite from "./pages/AcceptInvite";
import JoinWorkspace from "./pages/JoinWorkspace";
import JoinChannel from "./pages/JoinChannel";

import ChttrixDocs from "./pages/ChttrixDocs";
import Careers from "./pages/Careers";

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
import DepartmentManagement from "./pages/admin/DepartmentManagement"; 
import UserManagement from "./pages/admin/UserManagement"; 
import OnboardingPage from "./pages/admin/OnboardingPage"; 
import CompanySettings from "./pages/admin/settings/CompanySettings"; 
import AdminProfile from "./pages/admin/AdminProfile"; 
import Analytics from "./pages/admin/Analytics"; 
import ContactAdmin from "./pages/admin/ContactAdmin"; 
import WorkspacesManagement from "./pages/admin/WorkspacesManagement"; 
import AuditSecurityPage from "./pages/admin/AuditSecurityPage"; 
import AdminSettingsLimited from "./pages/admin/AdminSettingsLimited"; 

import TeamsManagement from "./pages/admin/TeamsManagement";
import OrgChartPage from "./pages/admin/OrgChartPage";
import WorkspaceTemplates from "./pages/admin/WorkspaceTemplates";
import WorkspacePermissions from "./pages/admin/WorkspacePermissions";

import EmployeeDirectoryPage from "./pages/workspace-os/EmployeeDirectoryPage";
import PermissionMatrixPage from "./pages/workspace-os/PermissionMatrixPage";
import AuditLogViewer from "./pages/workspace-os/AuditLogViewer";
import ComplianceLogViewer from "./pages/workspace-os/ComplianceLogViewer";

import AdminDashboard from "./pages/AdminDashboard";
import ManagerLayout from "./components/layout/ManagerLayout.jsx";
import OwnerDashboard from './pages/OwnerDashboard';
import OwnerAnalytics from './pages/OwnerDashboard/OwnerAnalytics'; 
import AdminsManagement from './pages/OwnerDashboard/AdminsManagement'; 
import OwnerBilling from './pages/OwnerDashboard/OwnerBilling'; 
import OwnerSecurity from './pages/OwnerDashboard/OwnerSecurity'; 

import ManagerOverview from "./components/manager/ManagerOverview";

import ManagerProjects from "./components/manager/ManagerProjects"; 

import ManagerTasks from "./components/manager/ManagerTasks";
import ManagerReports from "./components/manager/ManagerReports";

import ManagerSettings from "./components/manager/ManagerSettings"; 
import TeamAllocation from "./components/manager/TeamAllocation";
import UnassignedMembers from "./components/manager/UnassignedMembers"; 
import ManagerWorkspacePage from "./components/manager/ManagerWorkspacePage"; 
import EmployeeDashboard from "./pages/dashboards/EmployeeDashboard";
import ChttrixAdminDashboard from "./pages/dashboards/ChttrixAdminDashboard";
import AIInsightsDashboard from "./pages/dashboards/AIInsightsDashboard";
import InsightsDashboard from "./pages/dashboards/InsightsDashboard";

import AIHub from "./components/ai/AIHub";

import SearchResultsPage from "./components/search/SearchResultsPage";

import RequireAuth from "./components/RequireAuth";
import RequireWorkspace from "./components/RequireWorkspace";
import RequireAdmin from "./components/RequireAdmin";
import RequireOwner from "./components/RequireOwner";
import RequireChttrixAdmin from "./components/RequireChttrixAdmin";
import RequireDepartmentManager from "./components/RequireDepartmentManager"; 
import VerifiedOnlyRoute from "./components/VerifiedOnlyRoute"; 
import ScrollToTop from "./components/ScrollToTop"; 

import PasswordUnlockModal from "./components/security/PasswordUnlockModal";
import { useAuth } from "./contexts/AuthContext";
import AppErrorBoundary from "./shared/components/ui/AppErrorBoundary";

function DeveloperPortalWrapper() {
  const { workspaceId } = useParams();
  return <DeveloperPortalPage workspaceId={workspaceId} />;
}

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

                              {}

                              {}
                              <Route
                                path="/personal/workspace"
                                element={<Navigate to="/workspaces" replace />}
                              />

                          {}
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

                          {}

                          {}
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

                          {}
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

                          {}
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

                          {}
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

                          {}
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

                          {}
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

                          {}
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

                          {}
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

                          {}
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

                          {}
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

                          {}
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

                          {}
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

                          {}
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

                           {}
                           
                           {}
                           <Route
                             path="/workspace/:workspaceId/files"
                             element={
                               <RequireAuth>
                                 <WorkspaceProvider>
                                   <RequireWorkspace>
                                     <MainLayout sidePanel={<FilesPanel />}>
                                       <FileLibrary />
                                     </MainLayout>
                                   </RequireWorkspace>
                                 </WorkspaceProvider>
                               </RequireAuth>
                             }
                           />
                           <Route
                             path="/workspace/:workspaceId/files/:id"
                             element={
                               <RequireAuth>
                                 <WorkspaceProvider>
                                   <RequireWorkspace>
                                     <MainLayout sidePanel={<FilesPanel />}>
                                       <FileLibrary />
                                     </MainLayout>
                                   </RequireWorkspace>
                                 </WorkspaceProvider>
                               </RequireAuth>
                             }
                           />

                           {}
                           <Route
                             path="/workspace/:workspaceId/knowledge"
                             element={
                               <RequireAuth>
                                 <WorkspaceProvider>
                                   <RequireWorkspace>
                                     <MainLayout sidePanel={<KnowledgePanel />}>
                                       <KnowledgePage />
                                     </MainLayout>
                                   </RequireWorkspace>
                                 </WorkspaceProvider>
                               </RequireAuth>
                             }
                           />
                           <Route
                             path="/workspace/:workspaceId/knowledge/graph"
                             element={
                               <RequireAuth>
                                 <WorkspaceProvider>
                                   <RequireWorkspace>
                                     <MainLayout sidePanel={<KnowledgePanel />}>
                                       <KnowledgeGraph />
                                     </MainLayout>
                                   </RequireWorkspace>
                                 </WorkspaceProvider>
                               </RequireAuth>
                             }
                           />
                           <Route
                             path="/workspace/:workspaceId/knowledge/:id"
                             element={
                               <RequireAuth>
                                 <WorkspaceProvider>
                                   <RequireWorkspace>
                                     <MainLayout sidePanel={<KnowledgePanel />}>
                                       <KnowledgePage />
                                     </MainLayout>
                                   </RequireWorkspace>
                                 </WorkspaceProvider>
                               </RequireAuth>
                             }
                           />
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

                           {}
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

                           {}
                            {}
                            <Route
                              path="/workspace/:workspaceId/templates"
                              element={
                                <RequireAuth>
                                  <WorkspaceProvider>
                                    <RequireWorkspace>
                                      <MainLayout>
                                        <TemplateMarketplacePage />
                                      </MainLayout>
                                    </RequireWorkspace>
                                  </WorkspaceProvider>
                                </RequireAuth>
                              }
                            />

                           <Route
                             path="/workspace/:workspaceId/automations"
                             element={
                               <RequireAuth>
                                 <WorkspaceProvider>
                                   <RequireWorkspace>
                                     <MainLayout>
                                       <AutomationsPage />
                                     </MainLayout>
                                   </RequireWorkspace>
                                 </WorkspaceProvider>
                               </RequireAuth>
                             }
                           />
                           <Route
                             path="/workspace/:workspaceId/automations/new"
                             element={
                               <RequireAuth>
                                 <WorkspaceProvider>
                                   <RequireWorkspace>
                                     <MainLayout>
                                       <AutomationBuilderPage />
                                     </MainLayout>
                                   </RequireWorkspace>
                                 </WorkspaceProvider>
                               </RequireAuth>
                             }
                           />
                           <Route
                             path="/workspace/:workspaceId/automations/:id/edit"
                             element={
                               <RequireAuth>
                                 <WorkspaceProvider>
                                   <RequireWorkspace>
                                     <MainLayout>
                                       <AutomationBuilderPage />
                                     </MainLayout>
                                   </RequireWorkspace>
                                 </WorkspaceProvider>
                               </RequireAuth>
                             }
                           />

                           {}
                           <Route
                             path="/workspace/:workspaceId/search"
                             element={
                               <RequireAuth>
                                 <WorkspaceProvider>
                                   <RequireWorkspace>
                                     <SearchProvider>
                                       <SearchResultsPage />
                                     </SearchProvider>
                                   </RequireWorkspace>
                                 </WorkspaceProvider>
                               </RequireAuth>
                             }
                           />

                            {}
                            <Route
                              path="/workspace/:workspaceId/developer"
                              element={
                                <RequireAuth>
                                  <WorkspaceProvider>
                                    <RequireWorkspace>
                                      <MainLayout>
                                        <DeveloperPortalWrapper />
                                      </MainLayout>
                                    </RequireWorkspace>
                                  </WorkspaceProvider>
                                </RequireAuth>
                              }
                            />

                           {}
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

                          {}
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

                          {}
                          <Route
                            path="/workspace/:workspaceId/meetings/:meetingId"
                            element={
                              <RequireAuth>
                                <WorkspaceProvider>
                                  <RequireWorkspace>
                                    <MeetingDetailWrapper />
                                  </RequireWorkspace>
                                </WorkspaceProvider>
                              </RequireAuth>
                            }
                          />

                          {}
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

                          {}
                          <Route
                            path="/home"
                            element={
                              <RequireAuth>
                                <WorkspaceSelect />
                              </RequireAuth>
                            }
                          />

                          {}
                          <Route path="/" element={<FeatureShowcase />} />
                          <Route path="/features" element={<FeatureShowcase />} />
                          <Route path="/chttrix-docs" element={<ChttrixDocs />} />

                          {}
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

                          {}
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

                          {}
                          {}
                          <Route path="/login" element={<LoginPage />} />
                          <Route path="/register-company" element={<RegisterCompany />} />
                          <Route path="/pending-verification" element={<PendingVerification />} />
                          <Route path="/join-workspace" element={<JoinWorkspace />} />
                          <Route path="/forgot-password" element={<ForgotPassword />} />
                          <Route path="/reset-password" element={<ResetPassword />} />
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
                          {}
                          <Route
                            path="/setup-password"
                            element={
                              <RequireAuth>
                                <SetupPassword />
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
                          {}
                          <Route
                            path="/join-channel"
                            element={
                              <RequireAuth>
                                <JoinChannel />
                              </RequireAuth>
                            }
                          />

                          {}
                          {}
                          {}

                          {}
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
                            <Route path="/owner/insights" element={<InsightsDashboard />} />
                            <Route path="/owner/billing" element={<OwnerBilling />} />
                            <Route path="/owner/security" element={<OwnerSecurity />} />

                            <Route path="/owner/admins" element={<AdminsManagement />} />
                            <Route path="/owner/workspaces" element={<WorkspacesManagement />} />
                            <Route path="/owner/departments" element={<DepartmentManagement />} />
                            <Route path="/owner/users" element={<UserManagement />} />
                            <Route path="/owner/onboard" element={<OnboardingPage />} />
                            <Route path="/owner/settings" element={<CompanySettings />} />

                            {}
                            <Route path="/owner/teams" element={<TeamsManagement />} />
                            <Route path="/owner/org-chart" element={<OrgChartPage />} />
                            <Route path="/owner/workspace-templates" element={<WorkspaceTemplates />} />
                            <Route path="/owner/workspace-permissions" element={<WorkspacePermissions />} />

                            {}
                            <Route path="/owner/employees" element={<EmployeeDirectoryPage />} />
                            <Route path="/owner/permission-matrix" element={<PermissionMatrixPage />} />
                            <Route path="/owner/audit-logs" element={<AuditLogViewer />} />
                            <Route path="/owner/compliance-logs" element={<ComplianceLogViewer />} />
                          </Route>

                          {}
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
                            <Route path="/admin/insights" element={<InsightsDashboard />} />
                            <Route path="/admin/departments" element={<DepartmentManagement />} />
                            <Route path="/admin/workspaces" element={<WorkspacesManagement />} />
                            <Route path="/admin/users" element={<UserManagement />} />
                            <Route path="/admin/onboard" element={<OnboardingPage />} />
                            <Route path="/admin/security" element={<AuditSecurityPage />} />
                            <Route path="/admin/settings" element={<AdminSettingsLimited />} />
                            <Route path="/admin/profile" element={<AdminProfile />} />
                            <Route path="/contact-admin" element={<ContactAdmin />} />

                            {}
                            <Route path="/admin/teams" element={<TeamsManagement />} />
                            <Route path="/admin/org-chart" element={<OrgChartPage />} />
                            <Route path="/admin/workspace-templates" element={<WorkspaceTemplates />} />
                            <Route path="/admin/workspace-permissions" element={<WorkspacePermissions />} />
                          </Route>

                          {}
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
                            <Route path="workspace" element={<ManagerWorkspacePage />} />
                            <Route path="allocation" element={<TeamAllocation />} />
                            <Route path="tasks" element={<ManagerTasks />} />
                            <Route path="reports" element={<ManagerReports />} />
                            <Route path="settings" element={<ManagerSettings />} />

                            {}
                            <Route path="projects" element={<ManagerProjects />} />
                            <Route path="unassigned" element={<UnassignedMembers />} /> {}
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

                          {}
                          <Route
                            path="/workspace/:workspaceId/ai-insights"
                            element={
                              <RequireAuth>
                                <WorkspaceProvider>
                                  <RequireWorkspace>
                                    <MainLayout>
                                      <AIInsightsDashboardWrapper />
                                    </MainLayout>
                                  </RequireWorkspace>
                                </WorkspaceProvider>
                              </RequireAuth>
                            }
                          />

                          {}
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

                        {}
                        <GlobalPasswordUnlockModal />
                        {}
                        <AIHub />
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

function GlobalPasswordUnlockModal() {
  const { requiresPassword, unlockEncryption } = useAuth();

  if (!requiresPassword) return null;

  return <PasswordUnlockModal onSubmit={unlockEncryption} />;
}

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

function MeetingDetailWrapper() {
  const { workspaceId } = useParams();
  return (
    <HuddleProvider workspaceId={workspaceId}>
      <MainLayout sidePanel={<MeetingsPanel />}>
        <MeetingDetailPage />
      </MainLayout>
    </HuddleProvider>
  );
}

function AIInsightsDashboardWrapper() {
  const { workspaceId } = useParams();
  const token = localStorage.getItem('accessToken') || localStorage.getItem('token') || '';
  return <AIInsightsDashboard workspaceId={workspaceId} token={token} />;
}

export default App;
