import React, { useState, useEffect } from "react";
import { Line, Bar, Pie } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Card, Container, Row, Col, Alert, Button } from "react-bootstrap";
import LoadingSpinner from "../shared/LoadingSpinner";
import api from "../../services/api";
import "./Analytics.css";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

const Analytics = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [analyticsData, setAnalyticsData] = useState(null);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const response = await api.get("/analytics");
        setAnalyticsData(response.data);
        setError(null);
      } catch (err) {
        setError("Nie udało się załadować danych analitycznych");
        console.error("Error fetching analytics:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, []);

  const handleDownloadReport = async () => {
    try {
      const response = await api.get("/analytics/report", {
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute(
        "download",
        `raport-analityczny-${new Date().toISOString().split("T")[0]}.pdf`
      );
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      setError("Nie udało się pobrać raportu");
      console.error("Error downloading report:", err);
    }
  };

  if (loading)
    return (
      <Container className="analytics-container">
        <div className="text-center py-5">
          <LoadingSpinner />
          <p className="mt-3">Ładowanie danych analitycznych...</p>
        </div>
      </Container>
    );

  if (error)
    return (
      <Container className="analytics-container">
        <Alert variant="danger" className="my-4">
          {error}
          <Button
            variant="outline-danger"
            size="sm"
            className="ms-3"
            onClick={() => window.location.reload()}
          >
            Spróbuj ponownie
          </Button>
        </Alert>
      </Container>
    );

  if (!analyticsData)
    return (
      <Container className="analytics-container">
        <Alert variant="info" className="my-4">
          Brak dostępnych danych analitycznych.
        </Alert>
      </Container>
    );

  const {
    ticketsByStatus,
    satisfactionDistribution,
    ticketsOverTime,
    averageResolutionTime,
    slaBreaches,
    totalTickets,
    resolvedTickets,
  } = analyticsData;

  // Calculate resolution rate
  const resolutionRate =
    totalTickets > 0 ? ((resolvedTickets / totalTickets) * 100).toFixed(1) : 0;

  // Calculate average satisfaction
  const totalRatings = Object.values(satisfactionDistribution).reduce(
    (a, b) => a + b,
    0
  );
  const weightedSum = Object.entries(satisfactionDistribution).reduce(
    (sum, [rating, count]) => sum + Number(rating) * count,
    0
  );
  const averageSatisfaction =
    totalRatings > 0 ? (weightedSum / totalRatings).toFixed(1) : 0;

  // Calculate SLA compliance rate
  const slaComplianceRate =
    totalTickets > 0
      ? (100 - (slaBreaches / totalTickets) * 100).toFixed(1)
      : 100;

  const statusChartData = {
    labels: Object.keys(ticketsByStatus).map((status) => {
      const statusMap = {
        new: "Nowe",
        in_progress: "W trakcie",
        resolved: "Rozwiązane",
        reopened: "Ponownie otwarte",
        closed: "Zamknięte",
      };
      return statusMap[status] || status;
    }),
    datasets: [
      {
        data: Object.values(ticketsByStatus),
        backgroundColor: [
          "#36A2EB", // Nowe
          "#FFCE56", // W trakcie
          "#4BC0C0", // Rozwiązane
          "#FF6384", // Ponownie otwarte
          "#9966FF", // Zamknięte
        ],
      },
    ],
  };

  const timelineChartData = {
    labels: ticketsOverTime.map((item) => item.date),
    datasets: [
      {
        label: "Utworzone zgłoszenia",
        data: ticketsOverTime.map((item) => item.count),
        borderColor: "#36A2EB",
        backgroundColor: "#36A2EB",
        tension: 0.4,
      },
    ],
  };

  const satisfactionChartData = {
    labels: Object.keys(satisfactionDistribution).map(
      (rating) => `${rating} gwiazdek`
    ),
    datasets: [
      {
        label: "Liczba ocen",
        data: Object.values(satisfactionDistribution),
        backgroundColor: [
          "#FF6384",
          "#36A2EB",
          "#FFCE56",
          "#4BC0C0",
          "#9966FF",
        ],
      },
    ],
  };

  return (
    <Container>
      <div className="d-flex justify-content-between align-items-center my-4">
        <h2>Analityka systemu</h2>
        <div className="text-center">
          <Button variant="primary" onClick={handleDownloadReport}>
            <i className="fas fa-download"></i>
            Pobierz raport
          </Button>
        </div>
      </div>

      <Row className="mb-4">
        <Col md={3}>
          <Card className="analytics-card">
            <Card.Body>
              <Card.Title>Wszystkie zgłoszenia</Card.Title>
              <Card.Text className="analytics-number">
                {totalTickets}
                <small className="text-muted d-block">
                  Aktywne: {totalTickets - resolvedTickets}
                </small>
              </Card.Text>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="analytics-card">
            <Card.Body>
              <Card.Title>Efektywność rozwiązywania</Card.Title>
              <Card.Text className="analytics-number">
                {resolutionRate}%
                <small className="text-muted d-block">
                  {resolvedTickets} rozwiązanych
                </small>
              </Card.Text>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="analytics-card">
            <Card.Body>
              <Card.Title>Średni czas rozwiązania</Card.Title>
              <Card.Text className="analytics-number">
                {Math.round(averageResolutionTime)} godz.
                <small className="text-muted d-block">Cel SLA: 24 godz.</small>
              </Card.Text>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="analytics-card">
            <Card.Body>
              <Card.Title>Naruszenia SLA</Card.Title>
              <Card.Text className="analytics-number danger">
                {slaBreaches}
                <small className="text-muted d-block">
                  {slaComplianceRate}% zgodności
                </small>
              </Card.Text>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Row className="mb-4">
        <Col md={6}>
          <Card className="analytics-card h-100">
            <Card.Body>
              <Card.Title>Status zgłoszeń</Card.Title>
              {Object.keys(ticketsByStatus).length === 0 ? (
                <div className="empty-state">
                  <p className="text-muted">Brak danych o statusach zgłoszeń</p>
                </div>
              ) : (
                <div className="chart-container">
                  <Pie
                    data={statusChartData}
                    options={{ maintainAspectRatio: false }}
                  />
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>
        <Col md={6}>
          <Card className="analytics-card h-100">
            <Card.Body>
              <Card.Title>Zgłoszenia w czasie</Card.Title>
              {ticketsOverTime.length === 0 ? (
                <div className="empty-state">
                  <p className="text-muted">
                    Brak danych o zgłoszeniach w czasie
                  </p>
                </div>
              ) : (
                <div className="chart-container">
                  <Line
                    data={timelineChartData}
                    options={{ maintainAspectRatio: false }}
                  />
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <h3 className="section-title mb-4">Efektywność pracy specjalistów</h3>
      <Row className="mb-4">
        <Col md={6}>
          <Card className="analytics-card h-100">
            <Card.Body>
              <Card.Title>
                Średni czas rozwiązania według specjalisty
              </Card.Title>
              {!analyticsData.specialistPerformance ||
              analyticsData.specialistPerformance.length === 0 ? (
                <div className="empty-state">
                  <p className="text-muted">
                    Brak danych o wydajności specjalistów
                  </p>
                </div>
              ) : (
                <div className="chart-container">
                  <Bar
                    data={{
                      labels: analyticsData.specialistPerformance.map(
                        (s) => s.name
                      ),
                      datasets: [
                        {
                          label: "Średni czas (godz.)",
                          data: analyticsData.specialistPerformance.map(
                            (s) => s.avgResolutionTime
                          ),
                          backgroundColor: "#36A2EB",
                        },
                      ],
                    }}
                    options={{
                      maintainAspectRatio: false,
                      scales: { y: { beginAtZero: true } },
                      plugins: { legend: { display: false } },
                    }}
                  />
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>
        <Col md={6}>
          <Card className="analytics-card h-100">
            <Card.Body>
              <Card.Title>Satysfakcja użytkowników</Card.Title>
              {Object.keys(satisfactionDistribution).length === 0 ? (
                <div className="empty-state">
                  <p className="text-muted">
                    Brak danych o satysfakcji użytkowników
                  </p>
                </div>
              ) : (
                <div className="chart-container">
                  <Bar
                    data={satisfactionChartData}
                    options={{ maintainAspectRatio: false }}
                  />
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <h3 className="section-title mb-4">Informacje zwrotne od klientów</h3>
      <Row className="mb-4">
        <Col md={4}>
          <Card className="analytics-card">
            <Card.Body>
              <Card.Title>Średnia ocena zadowolenia</Card.Title>
              <Card.Text className="analytics-number">
                {averageSatisfaction}
                <small className="text-muted d-block">
                  na podstawie {totalRatings} ocen
                </small>
              </Card.Text>
            </Card.Body>
          </Card>
        </Col>
        <Col md={8}>
          <Card className="analytics-card">
            <Card.Body>
              <Card.Title>Rozkład ocen zadowolenia</Card.Title>
              <div className="chart-container">
                <Bar
                  data={satisfactionChartData}
                  options={{
                    maintainAspectRatio: false,
                    scales: {
                      y: {
                        beginAtZero: true,
                        ticks: {
                          stepSize: 1,
                        },
                      },
                    },
                    plugins: {
                      legend: {
                        display: false,
                      },
                      tooltip: {
                        callbacks: {
                          label: function (context) {
                            const value = context.raw || 0;
                            const total = context.dataset.data.reduce(
                              (a, b) => a + b,
                              0
                            );
                            const percentage = ((value / total) * 100).toFixed(
                              1
                            );
                            return `${value} ocen (${percentage}%)`;
                          },
                        },
                      },
                    },
                  }}
                />
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <h3 className="section-title mb-4">
        Analiza SLA i przeterminowanych zgłoszeń
      </h3>
      <Row className="mb-4">
        <Col md={4}>
          <Card className="analytics-card">
            <Card.Body>
              <Card.Title>Status zgłoszeń</Card.Title>
              <div className="chart-container">
                <Pie
                  data={statusChartData}
                  options={{
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        position: "right",
                        labels: {
                          usePointStyle: true,
                        },
                      },
                      tooltip: {
                        callbacks: {
                          label: function (context) {
                            const label = context.label || "";
                            const value = context.raw || 0;
                            const total = context.dataset.data.reduce(
                              (a, b) => a + b,
                              0
                            );
                            const percentage = ((value / total) * 100).toFixed(
                              1
                            );
                            return `${label}: ${value} (${percentage}%)`;
                          },
                        },
                      },
                    },
                  }}
                />
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={8}>
          <Card className="analytics-card">
            <Card.Body>
              <Card.Title>Przeterminowane zgłoszenia w czasie</Card.Title>
              <div className="chart-container">
                <Line
                  data={{
                    labels:
                      analyticsData.slaBreachesOverTime?.map(
                        (item) => item.date
                      ) || [],
                    datasets: [
                      {
                        label: "Naruszenia SLA",
                        data:
                          analyticsData.slaBreachesOverTime?.map(
                            (item) => item.count
                          ) || [],
                        borderColor: "#FF6384",
                        backgroundColor: "#FF6384",
                        tension: 0.4,
                      },
                    ],
                  }}
                  options={{
                    maintainAspectRatio: false,
                    scales: {
                      y: {
                        beginAtZero: true,
                        ticks: {
                          stepSize: 1,
                        },
                      },
                      x: {
                        grid: {
                          display: false,
                        },
                      },
                    },
                  }}
                />
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <h3 className="section-title mb-4">Trendy i wzorce</h3>
      <Row>
        <Col md={12}>
          <Card className="analytics-card">
            <Card.Body>
              <Card.Title>Zgłoszenia w czasie</Card.Title>
              <div className="chart-container">
                <Line
                  data={timelineChartData}
                  options={{
                    maintainAspectRatio: false,
                    scales: {
                      y: {
                        beginAtZero: true,
                        ticks: {
                          stepSize: 1,
                        },
                      },
                      x: {
                        grid: {
                          display: false,
                        },
                      },
                    },
                    plugins: {
                      tooltip: {
                        callbacks: {
                          label: function (context) {
                            return `${context.dataset.label}: ${context.raw}`;
                          },
                        },
                      },
                    },
                  }}
                />
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};

export default Analytics;
