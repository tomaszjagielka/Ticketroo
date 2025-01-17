import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Card,
  Button,
  Container,
  Row,
  Col,
  ListGroup,
  Alert,
  Badge,
} from "react-bootstrap";
import api from "../../services/api";
import { getUserRole, getUserId } from "../../services/auth";
import LoadingSpinner from "../shared/LoadingSpinner";

const getStatusDisplayName = (status) => {
  switch (status) {
    case "new":
      return "Nowe";
    case "in_progress":
      return "W trakcie";
    case "resolved":
      return "Rozwiązane";
    case "reopened":
      return "Ponownie otwarte";
    case "closed":
      return "Zamknięte";
    default:
      return status;
  }
};

const getStatusBadgeVariant = (status) => {
  switch (status) {
    case "new":
      return "primary";
    case "in_progress":
      return "warning";
    case "resolved":
      return "success";
    case "reopened":
      return "danger";
    case "closed":
      return "secondary";
    default:
      return "secondary";
  }
};

const ProjectDetails = () => {
  const { projectId } = useParams();
  const [project, setProject] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const userRole = getUserRole();
  const userId = getUserId();

  const fetchProjectDetails = useCallback(async () => {
    try {
      const response = await api.get(`/projects/${projectId}`);
      setProject(response.data);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching project details:", error);
      setLoading(false);
      setError("Nie udało się pobrać szczegółów projektu");
    }
  }, [projectId]);

  const fetchProjectTickets = useCallback(async () => {
    try {
      const response = await api.get(`/projects/${projectId}/tickets`);
      setTickets(response.data);
    } catch (error) {
      console.error("Error fetching project tickets:", error);
    }
  }, [projectId]);

  useEffect(() => {
    fetchProjectDetails();
    fetchProjectTickets();
  }, [fetchProjectDetails, fetchProjectTickets]);

  const handleDeleteProject = async () => {
    if (
      window.confirm(
        "Czy na pewno chcesz usunąć ten projekt? Ta operacja jest nieodwracalna."
      )
    ) {
      try {
        await api.delete(`/projects/${projectId}`);
        navigate("/projects");
      } catch (error) {
        console.error("Error deleting project:", error);
        setError("Nie udało się usunąć projektu");
      }
    }
  };

  const handleDeleteTicketType = async (typeId) => {
    if (window.confirm("Czy na pewno chcesz usunąć ten typ zgłoszenia?")) {
      try {
        await api.delete(`/projects/${projectId}/ticket-types/${typeId}`);
        await fetchProjectDetails();
      } catch (error) {
        console.error("Error deleting ticket type:", error);
        setError("Nie udało się usunąć typu zgłoszenia");
      }
    }
  };

  const canManageProject = () => {
    return (
      userRole === "Zarządca" ||
      (project?.manager?._id === userId && userRole === "Specjalista")
    );
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return (
      <Container className="my-4">
        <Alert variant="danger">{error}</Alert>
      </Container>
    );
  }

  if (!project) {
    return (
      <Container className="my-4">
        <Alert variant="warning">Nie znaleziono projektu</Alert>
      </Container>
    );
  }

  return (
    <Container className="my-4">
      <div className="d-flex justify-content-between align-items-center my-4">
        <h2>{project.name}</h2>
        {canManageProject() && (
          <div className="d-flex gap-2">
            <Button
              variant="warning"
              onClick={() => navigate(`/projects/${project._id}/edit`)}
            >
              Edytuj projekt
            </Button>
            <Button variant="danger" onClick={() => handleDeleteProject()}>
              Usuń projekt
            </Button>
          </div>
        )}
      </div>

      <Card>
        <Card.Body>
          <Row>
            <Col md={6}>
              <h5>Informacje o projekcie</h5>
              <p>
                <strong>Klucz projektu:</strong> {project.key}
              </p>
              <p>
                <strong>Manager:</strong>{" "}
                {project.manager?.login || "Nie przypisano"}
                {project.manager?._id === userId && (
                  <Badge bg="info" className="ms-2">
                    Ty
                  </Badge>
                )}
              </p>
            </Col>
            <Col md={6}>
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h5>Typy zgłoszeń</h5>
                {canManageProject() && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() =>
                      navigate(`/projects/${project._id}/ticket-types/new`)
                    }
                  >
                    Dodaj typ
                  </Button>
                )}
              </div>
              {!project.ticketTypes || project.ticketTypes.length === 0 ? (
                <Alert variant="info">
                  Brak zdefiniowanych typów zgłoszeń dla tego projektu
                </Alert>
              ) : (
                <ListGroup>
                  {project.ticketTypes.map((type) => (
                    <ListGroup.Item
                      key={type._id}
                      className="d-flex justify-content-between align-items-center"
                    >
                      {type.name}
                      {canManageProject() && (
                        <Button
                          variant="outline-danger"
                          size="sm"
                          onClick={() => handleDeleteTicketType(type._id)}
                        >
                          Usuń
                        </Button>
                      )}
                    </ListGroup.Item>
                  ))}
                </ListGroup>
              )}
            </Col>
          </Row>

          <h5 className="mt-4">Zgłoszenia w projekcie</h5>
          {tickets.length === 0 ? (
            <Alert variant="info">
              Brak zgłoszeń w tym projekcie. Zgłoszenia pojawią się tutaj, gdy
              zostaną utworzone.
            </Alert>
          ) : (
            <ListGroup>
              {tickets.map((ticket) => (
                <ListGroup.Item
                  key={ticket._id}
                  action
                  href={`/tickets/${ticket._id}`}
                  className="d-flex justify-content-between align-items-center"
                >
                  <div>
                    <h6>{ticket.title}</h6>
                    <small className="text-muted">
                      Status:{" "}
                      <Badge bg={getStatusBadgeVariant(ticket.status)}>
                        {getStatusDisplayName(ticket.status)}
                      </Badge>
                    </small>
                  </div>
                  <small className="text-muted">
                    {new Date(ticket.createdAt).toLocaleDateString()}
                  </small>
                </ListGroup.Item>
              ))}
            </ListGroup>
          )}
        </Card.Body>
      </Card>
    </Container>
  );
};

export default ProjectDetails;
