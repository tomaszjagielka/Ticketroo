import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Container, Table, Button, Card } from "react-bootstrap";
import api from "../../services/api";
import LoadingSpinner from "../shared/LoadingSpinner";

const ProjectList = () => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const response = await api.get("/projects");
      setProjects(response.data);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching projects:", error);
      setLoading(false);
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <Container>
      <div className="d-flex justify-content-between align-items-center my-4">
        <h2>Projekty</h2>
        <Button variant="primary" onClick={() => navigate("/projects/new")}>
          Nowy projekt
        </Button>
      </div>
      <Card>
        <Card.Body>
          <Table hover>
            <thead>
              <tr>
                <th>Nazwa</th>
                <th>Klucz</th>
                <th>Manager</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((project) => (
                <tr
                  key={project._id}
                  onClick={() => navigate(`/projects/${project._id}`)}
                  style={{ cursor: "pointer" }}
                >
                  <td>{project.name}</td>
                  <td>{project.key}</td>
                  <td>{project.manager?.login || "Nie przypisano"}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card.Body>
      </Card>
    </Container>
  );
};

export default ProjectList;
