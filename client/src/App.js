// src/App.jsx - Recompile Trigger
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";

// Context Providers  
import { WorkspaceProvider } from "./contexts/WorkspaceContext";
import ContactsProvider from "./contexts/ContactsContext";
import { NotesProvider } from "./contexts/NotesContext";
import { TasksProvider } from "./contexts/TasksContext";
import { ToastProvider } from "./contexts/ToastContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { BlogsProvider } from "./contexts/BlogsContext"; // ✅ Fix import path
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
import UpdatesPanel from "./components/layout/panels/UpdatesPanel";

// Pages (Protected)
import Home from "./pages/SidebarComp/Home";
import Messages from "./pages/SidebarComp/Messages";
import MyTasks from "./pages/SidebarComp/MyTasks";
import Notes from "./pages/SidebarComp/Notes";
import Updates from "./pages/SidebarComp/Updates";
import WorkspaceSelect from "./pages/WorkspaceSelect";
import FeatureShowcase from "./pages/FeatureShowcase";

// Auth Pages (Public)
import LoginPage from "./pages/LoginPageComp/LoginPage";
import VerifyEmail from "./pages/VerifyEmail";
import ForgotPassword from "./pages/LoginPageComp/ForgotPassword";
import ResetPassword from "./pages/LoginPageComp/ResetPassword";
import OAuthSuccess from "./pages/LoginPageComp/OAuthSuccess";
import AcceptInvite from "./pages/AcceptInvite";
import JoinWorkspace from "./pages/JoinWorkspace";
import JoinChannel from "./pages/JoinChannel";
import ChttrixDocs from "./pages/ChttrixDocs"; // NEW Custom Page

import RegisterCompany from "./pages/RegisterCompany";
import PendingVerification from "./pages/PendingVerification";
import ApplicationReview from "./pages/ApplicationReview";
import CompanyConfirmation from "./pages/CompanyConfirmation";
import CompanySetup from "./pages/CompanySetup";
import DepartmentManagement from "./pages/admin/DepartmentManagement"; // Updated path
import UserManagement from "./pages/admin/UserManagement"; // NEW
import CompanySettings from "./pages/admin/settings/CompanySettings"; // NEW - 8 section settings
import AdminProfile from "./pages/admin/AdminProfile"; // Personal profile
import Analytics from "./pages/admin/Analytics"; // NEW - Analytics dashboard
import ContactAdmin from "./pages/admin/ContactAdmin"; // NEW - Contact platform admin

// Dashboard Pages
import AdminDashboard from "./pages/dashboards/AdminDashboard";
import ManagerDashboard from "./pages/dashboards/ManagerDashboard";
import ManagerOverview from "./components/manager/ManagerOverview";
import ManagerTasks from "./components/manager/ManagerTasks";
import ManagerReports from "./components/manager/ManagerReports";
import TeamAllocation from "./components/manager/TeamAllocation";
import AdminAnalyticsDashboard from "./pages/dashboards/AdminAnalyticsDashboard"; // NEW
import EmployeeDashboard from "./pages/dashboards/EmployeeDashboard";
import AnalyticsDashboard from "./pages/dashboards/AnalyticsDashboard";
import ChttrixAdminDashboard from "./pages/dashboards/ChttrixAdminDashboard";

// Protected route wrappers
// Protected route wrappers
import RequireAuth from "./components/RequireAuth";
import RequireWorkspace from "./components/RequireWorkspace";
import RequireAdmin from "./components/RequireAdmin";
import RequireChttrixAdmin from "./components/RequireChttrixAdmin";
import RequireCompanyAdmin from "./components/RequireCompanyAdmin"; // Restored
import RequireDepartmentManager from "./components/RequireDepartmentManager"; // Restored
import VerifiedOnlyRoute from "./components/VerifiedOnlyRoute"; // Block pending users


function App() {

  return (
    <ToastProvider>
      <ThemeProvider>
        <Router>
          <SocketProvider>
            <ContactsProvider>
              <CompanyProvider>
                <DepartmentProvider>
                  <NotesProvider>
                    <TasksProvider>
                      <BlogsProvider>
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
                                  <RequireWorkspace>
                                    <MainLayout sidePanel={<HomePanel />}>
                                      <Home />
                                    </MainLayout>
                                  </RequireWorkspace>
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
                                  <RequireWorkspace>
                                    <MainLayout sidePanel={<HomePanel />}>
                                      <Home />
                                    </MainLayout>
                                  </RequireWorkspace>
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
                                  <RequireWorkspace>
                                    <MainLayout sidePanel={<ChannelsPanel />}>
                                      <Home />
                                    </MainLayout>
                                  </RequireWorkspace>
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
                                  <RequireWorkspace>
                                    <MainLayout sidePanel={<MessagesPanel />}>
                                      <Messages />
                                    </MainLayout>
                                  </RequireWorkspace>
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

                          {/* Tasks */}
                          <Route
                            path="/workspace/:workspaceId/tasks"
                            element={
                              <RequireAuth>
                                <WorkspaceProvider>
                                  <RequireWorkspace>
                                    <MainLayout sidePanel={<TasksPanel />}>
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

                          {/* Updates */}
                          <Route
                            path="/workspace/:workspaceId/updates"
                            element={
                              <RequireAuth>
                                <WorkspaceProvider>
                                  <RequireWorkspace>
                                    <MainLayout sidePanel={<UpdatesPanel />}>
                                      <Updates />
                                    </MainLayout>
                                  </RequireWorkspace>
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

                          {/* Landing Page (Feature Showcase) */}
                          <Route path="/" element={<FeatureShowcase />} />
                          <Route path="/features" element={<FeatureShowcase />} />
                          <Route path="/chttrix-docs" element={<ChttrixDocs />} />

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
                          <Route path="/login" element={<LoginPage />} />
                          <Route path="/register-company" element={<RegisterCompany />} />
                          <Route path="/pending-verification" element={<PendingVerification />} />
                          <Route path="/join-workspace" element={<JoinWorkspace />} />
                          <Route path="/forgot-password" element={<ForgotPassword />} />
                          <Route path="/reset-password" element={<ResetPassword />} />
                          <Route path="/oauth-success" element={<OAuthSuccess />} />
                          <Route path="/accept-invite" element={<AcceptInvite />} />
                          <Route path="/join-workspace" element={<JoinWorkspace />} />
                          <Route
                            path="/join-channel"
                            element={
                              <RequireAuth>
                                <JoinChannel />
                              </RequireAuth>
                            }
                          />

                          {/* Dashboard Routes - Smart redirect based on role */}
                          {/* Company Admin Routes - Wrapped in Layout */}
                          <Route
                            element={
                              <RequireAuth>
                                <RequireAdmin>
                                  <CompanyAdminLayout />
                                </RequireAdmin>
                              </RequireAuth>
                            }
                          >
                            <Route path="/admin/dashboard" element={<AdminDashboard />} />
                            <Route path="/admin/analytics" element={<Analytics />} />
                            <Route path="/admin/departments" element={<DepartmentManagement />} />
                            <Route path="/admin/users" element={<UserManagement />} />
                            <Route path="/admin/settings" element={<CompanySettings />} />
                            <Route path="/admin/profile" element={<AdminProfile />} />
                            <Route path="/contact-admin" element={<ContactAdmin />} />
                          </Route>

                          <Route
                            path="/manager/dashboard"
                            element={
                              <RequireDepartmentManager>
                                <ManagerDashboard />
                              </RequireDepartmentManager>
                            }
                          >
                            <Route index element={<Navigate to="overview" replace />} />
                            <Route path="overview" element={<ManagerOverview />} />
                            <Route path="allocation" element={<TeamAllocation />} />
                            <Route path="tasks" element={<ManagerTasks />} />
                            <Route path="reports" element={<ManagerReports />} />
                          </Route>

                          <Route
                            path="/employee/dashboard"
                            element={
                              <RequireAuth>
                                <EmployeeDashboard />
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
                      </BlogsProvider>
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

export default App;
