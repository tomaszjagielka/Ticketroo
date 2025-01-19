import React, { useState, useEffect } from "react";
import { Container, Card, Button, Badge } from "react-bootstrap";
import notificationService from "../../services/notificationService";
import LoadingSpinner from "../shared/LoadingSpinner";
import "./NotificationList.css";

const NotificationList = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchNotifications = async () => {
    try {
      const data = await notificationService.getNotifications();
      setNotifications(data);
    } catch (error) {
      setError("Nie udało się pobrać powiadomień");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const handleMarkAsRead = async (notificationId) => {
    try {
      await notificationService.markAsRead(notificationId);
      setNotifications(
        notifications.map((notification) =>
          notification._id === notificationId
            ? { ...notification, status: "read" }
            : notification
        )
      );
    } catch (error) {
      setError("Nie udało się oznaczyć powiadomienia jako przeczytane");
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await notificationService.markAllAsRead();
      setNotifications(
        notifications.map((notification) => ({
          ...notification,
          status: "read",
        }))
      );
    } catch (error) {
      setError(
        "Nie udało się oznaczyć wszystkich powiadomień jako przeczytane"
      );
    }
  };

  if (loading) return <LoadingSpinner />;

  const unreadCount = notifications.filter((n) => n.status === "unread").length;

  return (
    <Container className="my-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>
          Powiadomienia
          {unreadCount > 0 && (
            <Badge bg="primary" className="notification-badge">
              {unreadCount} nieprzeczytanych
            </Badge>
          )}
        </h2>
        {unreadCount > 0 && (
          <Button
            variant="outline-primary"
            onClick={handleMarkAllAsRead}
            className="mark-all-button"
          >
            Oznacz wszystkie jako przeczytane
          </Button>
        )}
      </div>

      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}

      {notifications.length === 0 ? (
        <Card>
          <Card.Body className="text-center">
            <p className="mb-0">Brak powiadomień</p>
          </Card.Body>
        </Card>
      ) : (
        notifications.map((notification) => (
          <Card
            key={notification._id}
            className={`mb-3 notification-card ${
              notification.status === "unread"
                ? "notification-unread"
                : "notification-read"
            }`}
          >
            <Card.Body>
              <div className="d-flex justify-content-between align-items-start">
                <div>
                  <Card.Text>{notification.content}</Card.Text>
                  <small className="notification-timestamp">
                    {new Date(notification.createdAt).toLocaleString()}
                  </small>
                </div>
                {notification.status === "unread" && (
                  <div className="notification-actions">
                    <Button
                      variant="outline-secondary"
                      size="sm"
                      onClick={() => handleMarkAsRead(notification._id)}
                    >
                      Oznacz jako przeczytane
                    </Button>
                  </div>
                )}
              </div>
            </Card.Body>
          </Card>
        ))
      )}
    </Container>
  );
};

export default NotificationList;
