// src/App.jsx
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { useState } from "react";

// Context Providers  
import { AuthProvider } from "./contexts/AuthContext";
import ContactsProvider from "./contexts/ContactsContext";

// Layout + Components
import Sidebar from "./components/SidebarComp/Sidebar";
import ChttrixAIChat from "./components/chttrixAIComp/ChttrixAIChat";


// Pages (Protected)
import Home from "./pages/SidebarComp/Home";
import Messages from "./pages/SidebarComp/Messages";
import MyTasks from "./pages/SidebarComp/MyTasks";
import Blogs from "./pages/SidebarComp/Blogs";

// Auth Pages (Public)
import LoginPage from "./pages/LoginPageComp/LoginPage";
import VerifyEmail from "./pages/VerifyEmail";
import ForgotPassword from "./pages/LoginPageComp/ForgotPassword";
import ResetPassword from "./pages/LoginPageComp/ResetPassword";
import OAuthSuccess from "./pages/LoginPageComp/OAuthSuccess";

// Protected route wrapper
import RequireAuth from "./components/RequireAuth";


function App() {
  const [showAI, setShowAI] = useState(false);

  return (
    <AuthProvider>
      <ContactsProvider>
        <Router>
          <Routes>

            {/* PROTECTED AREA (requires login) */}
            <Route
              path="/*"
              element={
                <RequireAuth>
                  <div className="flex h-screen overflow-hidden">

                    {/* Sidebar / Navigation */}
                    <Sidebar onAIClick={() => setShowAI(true)} />

                    {/* Right Panel */}
                    <main className="flex-1 overflow-y-auto bg-gray-50 p-6">
                      <Routes>
                        <Route path="/" element={<Home />} />
                        <Route path="/messages" element={<Messages />} />
                        <Route path="/tasks" element={<MyTasks />} />
                        <Route path="/blogs" element={<Blogs />} />
                      </Routes>
                    </main>
                  </div>

                  {/* AI CHAT FLOATING PANEL */}
                  {showAI && <ChttrixAIChat onClose={() => setShowAI(false)} />}
                </RequireAuth>
              }
            />

            {/* PUBLIC ROUTES */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/oauth-success" element={<OAuthSuccess />} />

          </Routes>
        </Router>
      </ContactsProvider>
    </AuthProvider>
  );
}

export default App;
