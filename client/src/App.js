// src/App.jsx
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { useState } from "react";

import Sidebar from "./components/SidebarComp/Sidebar";
import Home from "./pages/SidebarComp/Home";
import Messages from "./pages/SidebarComp/Messages";
import MyTasks from "./pages/SidebarComp/MyTasks";
import Blogs from "./pages/SidebarComp/Blogs";
import LoginPage from "./pages/LoginPageComp/LoginPage";
import ChttrixAIChat from "./components/chttrixAIComp/ChttrixAIChat";
import VerifyEmail from "./pages/VerifyEmail";
import RequireAuth from "./components/RequireAuth";
import ForgotPassword from "./pages/LoginPageComp/ForgotPassword";
import ResetPassword from "./pages/LoginPageComp/ResetPassword";
import OAuthSuccess from "./pages/LoginPageComp/OAuthSuccess";



function App() {
  const [showAI, setShowAI] = useState(false);

  return (
    <Router>
      <Routes>
        
        {/* PROTECTED ROUTE */}
        <Route
          path="/*"
          element={
            <RequireAuth>
              <div className="flex h-screen overflow-hidden">
                <Sidebar onAIClick={() => setShowAI(true)} />

                <main className="flex-1 overflow-y-auto bg-gray-50 p-6">
                  <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/messages" element={<Messages />} />
                    <Route path="/tasks" element={<MyTasks />} />
                    <Route path="/blogs" element={<Blogs />} />
                  </Routes>
                </main>
              </div>

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
  );
}

export default App;
