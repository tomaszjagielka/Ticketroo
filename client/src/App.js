import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import PrivateRoute from "./components/PrivateRoute";
import Layout from "./components/Layout/Layout";
import Login from "./components/Auth/Login";
import TicketList from "./components/Tickets/TicketList";
import TicketDetails from "./components/Tickets/TicketDetails";
import ProjectList from "./components/Projects/ProjectList";
import ProjectDetails from "./components/Projects/ProjectDetails";
import UserList from "./components/Users/UserList";
import NotificationList from "./components/Notifications/NotificationList";
import Analytics from "./components/Analytics/Analytics";
import ProjectForm from "./components/Projects/ProjectForm";
import TicketTypeForm from "./components/Projects/TicketTypeForm";
import ProfileEdit from "./components/Users/ProfileEdit";
import TicketForm from "./components/Tickets/TicketForm";

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="App">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/"
              element={
                <PrivateRoute>
                  <Layout>
                    <Navigate to="/projects" />
                  </Layout>
                </PrivateRoute>
              }
            />
            <Route
              path="/projects"
              element={
                <PrivateRoute>
                  <Layout>
                    <ProjectList />
                  </Layout>
                </PrivateRoute>
              }
            />
            <Route
              path="/projects/new"
              element={
                <PrivateRoute>
                  <Layout>
                    <ProjectForm />
                  </Layout>
                </PrivateRoute>
              }
            />
            <Route
              path="/projects/:projectId"
              element={
                <PrivateRoute>
                  <Layout>
                    <ProjectDetails />
                  </Layout>
                </PrivateRoute>
              }
            />
            <Route
              path="/projects/:projectId/edit"
              element={
                <PrivateRoute>
                  <Layout>
                    <ProjectForm />
                  </Layout>
                </PrivateRoute>
              }
            />
            <Route
              path="/projects/:projectId/ticket-types/new"
              element={
                <PrivateRoute>
                  <Layout>
                    <TicketTypeForm />
                  </Layout>
                </PrivateRoute>
              }
            />
            <Route
              path="/tickets"
              element={
                <PrivateRoute>
                  <Layout>
                    <TicketList />
                  </Layout>
                </PrivateRoute>
              }
            />
            <Route
              path="/tickets/new"
              element={
                <PrivateRoute>
                  <Layout>
                    <TicketForm />
                  </Layout>
                </PrivateRoute>
              }
            />
            <Route
              path="/tickets/:ticketId"
              element={
                <PrivateRoute>
                  <Layout>
                    <TicketDetails />
                  </Layout>
                </PrivateRoute>
              }
            />
            <Route
              path="/users"
              element={
                <PrivateRoute>
                  <Layout>
                    <UserList />
                  </Layout>
                </PrivateRoute>
              }
            />
            <Route
              path="/notifications"
              element={
                <PrivateRoute>
                  <Layout>
                    <NotificationList />
                  </Layout>
                </PrivateRoute>
              }
            />
            <Route
              path="/analytics"
              element={
                <PrivateRoute>
                  <Layout>
                    <Analytics />
                  </Layout>
                </PrivateRoute>
              }
            />
            <Route
              path="/profile/edit"
              element={
                <PrivateRoute>
                  <Layout>
                    <ProfileEdit />
                  </Layout>
                </PrivateRoute>
              }
            />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
