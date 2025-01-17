import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Container, Table, Button, Card, Badge } from "react-bootstrap";
import api from "../../services/api";
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

const TicketList = () => {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchTickets();
  }, []);

  const fetchTickets = async () => {
    try {
      const response = await api.get("/tickets");
      setTickets(response.data);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching tickets:", error);
      setLoading(false);
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <Container>
      <div className="d-flex justify-content-between align-items-center my-4">
        <h2>Zgłoszenia</h2>
        <Button variant="primary" onClick={() => navigate("/tickets/new")}>
          Nowe zgłoszenie
        </Button>
      </div>
      <Card>
        <Card.Body>
          <Table hover>
            <thead>
              <tr>
                <th>Tytuł</th>
                <th>Status</th>
                <th>Projekt</th>
                <th>Data utworzenia</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((ticket) => (
                <tr
                  key={ticket._id}
                  onClick={() => navigate(`/tickets/${ticket._id}`)}
                  style={{ cursor: "pointer" }}
                >
                  <td>{ticket.title}</td>
                  <td>
                    <Badge bg={getStatusBadgeVariant(ticket.status)}>
                      {getStatusDisplayName(ticket.status)}
                    </Badge>
                  </td>
                  <td>{ticket.project?.name}</td>
                  <td>{new Date(ticket.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card.Body>
      </Card>
    </Container>
  );
};

export default TicketList;
