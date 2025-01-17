import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Card,
  Button,
  Container,
  Row,
  Col,
  Badge,
  Form,
  Dropdown,
} from "react-bootstrap";
import {
  subscribeToTicket,
  unsubscribeFromTicket,
  getUserSubscriptions,
} from "../../services/subscriptionService";
import ticketService from "../../services/ticketService";
import LoadingSpinner from "../shared/LoadingSpinner";
import { useAuth } from "../../contexts/AuthContext";
import { TICKET_STATUSES } from "../../config";
import "./TicketDetails.css";

const TicketDetails = () => {
  const { ticketId } = useParams();
  const [ticket, setTicket] = useState(null);
  const [posts, setPosts] = useState([]);
  const [newPost, setNewPost] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [subscribed, setSubscribed] = useState(false);
  const [resolution, setResolution] = useState("");
  const [reopenReason, setReopenReason] = useState("");
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [statusChangeError, setStatusChangeError] = useState(null);
  const navigate = useNavigate();
  const { user } = useAuth();

  const fetchTicketDetails = useCallback(async () => {
    try {
      const data = await ticketService.getTicketDetails(ticketId);
      console.log("Ticket details:", data);
      setTicket(data);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching ticket details:", error);
      if (error.response?.status === 403) {
        setError("Nie masz uprawnień do wyświetlenia tego zgłoszenia");
      } else if (error.response?.status === 404) {
        setError("Nie znaleziono zgłoszenia");
      } else {
        setError("Wystąpił błąd podczas ładowania zgłoszenia");
      }
      setLoading(false);
    }
  }, [ticketId]);

  const fetchPosts = useCallback(async () => {
    try {
      const postsResponse = await ticketService.getTicketPosts(ticketId);
      setPosts(postsResponse);
    } catch (error) {
      console.error("Error fetching posts:", error);
    }
  }, [ticketId]);

  const checkSubscription = useCallback(async () => {
    try {
      const subscriptions = await getUserSubscriptions();
      setSubscribed(subscriptions.some((sub) => sub.ticket?._id === ticketId));
    } catch (error) {
      console.error("Error checking subscription:", error);
    }
  }, [ticketId]);

  useEffect(() => {
    fetchTicketDetails();
    fetchPosts();
    checkSubscription();
  }, [fetchTicketDetails, fetchPosts, checkSubscription]);

  const handleSubscribe = async () => {
    try {
      await subscribeToTicket(ticketId);
      setSubscribed(true);
    } catch (error) {
      console.error("Error subscribing to ticket:", error);
    }
  };

  const handleUnsubscribe = async () => {
    try {
      await unsubscribeFromTicket(ticketId);
      setSubscribed(false);
    } catch (error) {
      console.error("Error unsubscribing from ticket:", error);
    }
  };

  const handleAddPost = async (e) => {
    e.preventDefault();
    try {
      const response = await ticketService.addPost(ticketId, newPost);
      setPosts([...posts, response]);
      setNewPost("");
    } catch (error) {
      console.error("Error adding post:", error);
    }
  };

  const handleResolve = async (e) => {
    e.preventDefault();
    try {
      const updatedTicket = await ticketService.resolveTicket(
        ticketId,
        resolution
      );
      setTicket(updatedTicket);
      setResolution("");
    } catch (err) {
      setError("Nie udało się rozwiązać zgłoszenia");
    }
  };

  const handleReopen = async (e) => {
    e.preventDefault();
    try {
      const updatedTicket = await ticketService.reopenTicket(
        ticketId,
        reopenReason
      );
      setTicket(updatedTicket);
      setReopenReason("");
    } catch (err) {
      setError("Nie udało się ponownie otworzyć zgłoszenia");
    }
  };

  const handleRating = async (e) => {
    e.preventDefault();
    try {
      await ticketService.addSatisfactionRating(ticketId, rating, comment);
      fetchTicketDetails();
      setComment("");
    } catch (err) {
      setError("Nie udało się dodać oceny zadowolenia");
    }
  };

  const handleStatusChange = async (newStatus) => {
    try {
      setStatusChangeError(null);
      const updatedTicket = await ticketService.changeStatus(
        ticketId,
        newStatus
      );
      setTicket(updatedTicket);
    } catch (error) {
      console.error("Error changing status:", error);
      setStatusChangeError(
        error.response?.data?.message ||
          "Nie udało się zmienić statusu zgłoszenia"
      );
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return (
      <Container className="my-4">
        <Card>
          <Card.Body>
            <div className="text-center">
              <h4 className="text-danger">{error}</h4>
              <Button
                variant="primary"
                className="mt-3"
                onClick={() => navigate("/tickets")}
              >
                Wróć do listy zgłoszeń
              </Button>
            </div>
          </Card.Body>
        </Card>
      </Container>
    );
  }

  if (!ticket) {
    return <div>Ticket not found</div>;
  }

  const canResolve = user?.role === "Specjalista" || user?.role === "Zarządca";
  const canReopen =
    user?._id === ticket.creator?._id || user?.role === "Zarządca";
  const canRate =
    (user?._id === ticket.creator?._id || user?.role === "Zarządca") &&
    ticket.status === "resolved";
  const canChangeStatus = ["Specjalista", "Zarządca"].includes(user?.role);

  return (
    <Container className="my-4">
      <Card>
        <Card.Header className="d-flex justify-content-between align-items-center">
          <h3>{ticket.title}</h3>
          <div className="d-flex gap-2">
            {canChangeStatus && (
              <Dropdown>
                <Dropdown.Toggle variant="primary">
                  Zmień status
                </Dropdown.Toggle>
                <Dropdown.Menu>
                  {Object.entries(TICKET_STATUSES).map(([key, value]) => (
                    <Dropdown.Item
                      key={value}
                      onClick={() => handleStatusChange(value)}
                      active={ticket.status === value}
                    >
                      {getStatusDisplayName(value)}
                    </Dropdown.Item>
                  ))}
                </Dropdown.Menu>
              </Dropdown>
            )}
            {subscribed ? (
              <Button variant="outline-danger" onClick={handleUnsubscribe}>
                Anuluj subskrypcję
              </Button>
            ) : (
              <Button variant="outline-success" onClick={handleSubscribe}>
                Subskrybuj
              </Button>
            )}
          </div>
        </Card.Header>
        <Card.Body>
          {statusChangeError && (
            <div className="alert alert-danger">{statusChangeError}</div>
          )}
          <Row>
            <Col md={8}>
              <p>{ticket.description}</p>
            </Col>
            <Col md={4}>
              <div className="mb-3">
                <Badge bg={getStatusBadgeVariant(ticket.status)}>
                  {getStatusDisplayName(ticket.status)}
                </Badge>
              </div>
              <p>
                <strong>Utworzono:</strong>{" "}
                {new Date(ticket.createdAt).toLocaleDateString()}
              </p>
              <p>
                <strong>Autor:</strong> {ticket.creator?.login}
              </p>
              <p>
                <strong>Projekt:</strong> {ticket.project?.name}
              </p>
            </Col>
          </Row>

          {ticket.resolvedAt && (
            <Card className="mt-3">
              <Card.Header>
                <h5>Informacje o rozwiązaniu</h5>
              </Card.Header>
              <Card.Body>
                <p>
                  <strong>Rozwiązano przez:</strong>{" "}
                  {ticket.resolvedBy?.login || "Nie określono"}
                </p>
                <p>
                  <strong>Data rozwiązania:</strong>{" "}
                  {new Date(ticket.resolvedAt).toLocaleString()}
                </p>
                <p>
                  <strong>Rozwiązanie:</strong> {ticket.resolution}
                </p>
                {ticket.satisfaction && (
                  <div className="mt-3">
                    <strong>Ocena rozwiązania:</strong>{" "}
                    <Badge
                      bg={getSatisfactionBadgeVariant(ticket.satisfaction)}
                    >
                      {ticket.satisfaction}/5
                    </Badge>
                  </div>
                )}
              </Card.Body>
            </Card>
          )}

          <h4 className="mt-4">Komentarze</h4>
          <Form onSubmit={handleAddPost} className="mb-4">
            <Form.Group>
              <Form.Control
                as="textarea"
                rows={3}
                value={newPost}
                onChange={(e) => setNewPost(e.target.value)}
                placeholder="Dodaj komentarz..."
              />
            </Form.Group>
            <Button type="submit" className="mt-2">
              Dodaj komentarz
            </Button>
          </Form>

          {posts.map((post) => (
            <Card key={post._id} className="mb-3">
              <Card.Body>
                <Card.Text>{post.content}</Card.Text>
                <Card.Footer className="text-muted">
                  {post.author?.login} -{" "}
                  {new Date(post.createdAt).toLocaleString()}
                </Card.Footer>
              </Card.Body>
            </Card>
          ))}

          {canResolve && ticket.status !== "resolved" && (
            <div className="resolve-section">
              <h3>Rozwiąż zgłoszenie</h3>
              <form onSubmit={handleResolve}>
                <textarea
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value)}
                  placeholder="Opisz rozwiązanie..."
                  required
                />
                <button type="submit">Rozwiąż zgłoszenie</button>
              </form>
            </div>
          )}

          {canReopen && ticket.status === "resolved" && (
            <div className="reopen-section">
              <h3>Ponownie otwórz zgłoszenie</h3>
              <form onSubmit={handleReopen}>
                <textarea
                  value={reopenReason}
                  onChange={(e) => setReopenReason(e.target.value)}
                  placeholder="Podaj powód ponownego otwarcia..."
                  required
                />
                <button type="submit">Ponownie otwórz</button>
              </form>
            </div>
          )}

          {canRate && !ticket.satisfaction && (
            <div className="satisfaction-section">
              <h3>Oceń rozwiązanie</h3>
              <form onSubmit={handleRating}>
                <div className="rating-input">
                  <label>Ocena:</label>
                  <select
                    value={rating}
                    onChange={(e) => setRating(Number(e.target.value))}
                  >
                    <option value="5">5 - Bardzo zadowolony</option>
                    <option value="4">4 - Zadowolony</option>
                    <option value="3">3 - Neutralny</option>
                    <option value="2">2 - Niezadowolony</option>
                    <option value="1">1 - Bardzo niezadowolony</option>
                  </select>
                </div>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Dodaj komentarz (opcjonalnie)..."
                />
                <button type="submit">Wyślij ocenę</button>
              </form>
            </div>
          )}

          {ticket.satisfaction && (
            <div className="satisfaction-info">
              <h3>Ocena zadowolenia</h3>
              <p>
                <strong>Ocena:</strong> {ticket.satisfaction}/5
              </p>
            </div>
          )}
        </Card.Body>
      </Card>
    </Container>
  );
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
    default:
      return "secondary";
  }
};

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

const getSatisfactionBadgeVariant = (rating) => {
  if (rating >= 4) return "success";
  if (rating >= 3) return "warning";
  return "danger";
};

export default TicketDetails;
