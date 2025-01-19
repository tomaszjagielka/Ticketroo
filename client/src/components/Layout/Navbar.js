import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Navbar as BootstrapNavbar,
  Nav,
  Container,
  Badge,
  Button,
} from "react-bootstrap";
import api from "../../services/api";
import { getUserRole } from "../../services/auth";

const Navbar = () => {
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);
  const userRole = getUserRole();

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchUnreadCount = async () => {
    try {
      const response = await api.get("/notifications");
      const unreadNotifications = response.data.filter(
        (n) => n.status === "unread"
      );
      setUnreadCount(unreadNotifications.length);
    } catch (error) {
      console.error("Error fetching notifications:", error);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/login");
  };

  return (
    <BootstrapNavbar bg="light" expand="lg">
      <Container>
        <BootstrapNavbar.Brand as={Link} to="/">
          Ticketroo
        </BootstrapNavbar.Brand>
        <BootstrapNavbar.Toggle aria-controls="basic-navbar-nav" />
        <BootstrapNavbar.Collapse id="basic-navbar-nav">
          <Nav className="me-auto">
            <Nav.Link as={Link} to="/projects">
              Projekty
            </Nav.Link>
            <Nav.Link as={Link} to="/tickets">
              Zgłoszenia
            </Nav.Link>
            <Nav.Link as={Link} to="/notifications">
              Powiadomienia
              {unreadCount > 0 && (
                <Badge bg="danger" pill className="ms-1">
                  {unreadCount}
                </Badge>
              )}
            </Nav.Link>
            {userRole === "Zarządca" && (
              <Nav.Link as={Link} to="/users">
                Użytkownicy
              </Nav.Link>
            )}
            {(userRole === "Analityk" || userRole === "Zarządca") && (
              <Nav.Link as={Link} to="/analytics">
                Analityka
              </Nav.Link>
            )}
          </Nav>
          <Nav>
            <Nav.Link as={Link} to="/profile/edit" className="me-3">
              Edytuj profil
            </Nav.Link>
            <Button variant="outline-danger" onClick={handleLogout}>
              Wyloguj
            </Button>
          </Nav>
        </BootstrapNavbar.Collapse>
      </Container>
    </BootstrapNavbar>
  );
};

export default Navbar;
