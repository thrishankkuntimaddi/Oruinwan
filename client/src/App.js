// src/App.jsx
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

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
import CompanyAdmin from "./pages/CompanyAdmin";
import RegisterCompany from "./pages/RegisterCompany";
import DepartmentManagement from "./pages/DepartmentManagement";

// Dashboard Pages
import AdminDashboard from "./pages/dashboards/AdminDashboard";
import ManagerDashboard from "./pages/dashboards/ManagerDashboard";
import EmployeeDashboard from "./pages/dashboards/EmployeeDashboard";

// Protected route wrappers
import RequireAuth from "./components/RequireAuth";
import RequireWorkspace from "./components/RequireWorkspace";
import RequireAdmin from "./components/RequireAdmin";


function App() {

  return (
    <ContactsProvider>
      <ToastProvider>
        <ThemeProvider>
          <Router>
            <SocketProvider>
              <CompanyProvider>
                <DepartmentProvider>
                  <NotesProvider>
                    <TasksProvider>
                      <BlogsProvider>
                        <Routes>

                          {/* PROTECTED AREA (requires login) */}

                          {/* Workspace Selection - Must select workspace first */}
                          <Route
                            path="/workspaces"
                            element={
                              <RequireAuth>
                                <WorkspaceSelect />
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


                          {/* Company Admin Console - Admin/Owner Only */}
                          <Route
                            path="/admin/company"
                            element={
                              <RequireAuth>
                                <RequireAdmin>
                                  <CompanyAdmin />
                                </RequireAdmin>
                              </RequireAuth>
                            }
                          />

                          {/* PUBLIC ROUTES */}

                          {/* Landing Page (Feature Showcase) */}
                          <Route path="/" element={<FeatureShowcase />} />
                          <Route path="/features" element={<FeatureShowcase />} />

                          {/* PUBLIC ROUTES */}
                          <Route path="/login" element={<LoginPage />} />
                          <Route path="/register-company" element={<RegisterCompany />} />
                          <Route path="/verify-email" element={<VerifyEmail />} />
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
                          <Route
                            path="/admin/dashboard"
                            element={
                              <RequireAuth>
                                <RequireAdmin>
                                  <AdminDashboard />
                                </RequireAdmin>
                              </RequireAuth>
                            }
                          />

                          <Route
                            path="/admin/departments"
                            element={
                              <RequireAuth>
                                <RequireAdmin>
                                  <DepartmentManagement />
                                </RequireAdmin>
                              </RequireAuth>
                            }
                          />

                          <Route
                            path="/manager/dashboard"
                            element={
                              <RequireAuth>
                                <ManagerDashboard />
                              </RequireAuth>
                            }
                          />

                          <Route
                            path="/employee/dashboard"
                            element={
                              <RequireAuth>
                                <EmployeeDashboard />
                              </RequireAuth>
                            }
                          />

                        </Routes>
                      </BlogsProvider>
                    </TasksProvider>
                  </NotesProvider>
                </DepartmentProvider>
              </CompanyProvider>
            </SocketProvider>
          </Router>
        </ThemeProvider>
      </ToastProvider>
    </ContactsProvider >
  );
}

export default App;
