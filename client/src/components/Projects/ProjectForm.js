import React, { useState, useEffect, useCallback } from "react";
import {
  Container,
  Box,
  Typography,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  OutlinedInput,
  Chip,
  Alert,
} from "@mui/material";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../services/api";
import LoadingSpinner from "../shared/LoadingSpinner";

const ProjectForm = () => {
  const { projectId } = useParams();
  const [project, setProject] = useState({
    name: "",
    key: "",
    visibleToRoles: [],
    manager: "",
  });
  const [roles, setRoles] = useState([]);
  const [specialists, setSpecialists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const isEditing = Boolean(projectId);

  const fetchProjectDetails = useCallback(async () => {
    try {
      const response = await api.get(`/projects/${projectId}`);
      const projectData = response.data;

      // Filter out null values and ensure we have valid role IDs
      const validRoles = (projectData.visibleToRoles || [])
        .filter((role) => role !== null)
        .map((role) => (typeof role === "string" ? role : role._id))
        .filter((roleId) => roleId); // Additional filter to ensure we have valid IDs

      setProject({
        name: projectData.name || "",
        key: projectData.key || "",
        manager: projectData.manager?._id || "",
        visibleToRoles: validRoles,
      });
    } catch (error) {
      console.error("Error fetching project details:", error);
      setError("Nie udało się pobrać szczegółów projektu");
    }
  }, [projectId]);

  const fetchRoles = useCallback(async () => {
    try {
      const response = await api.get("/roles");
      const filteredRoles = response.data.filter(
        (role) => role.name !== "Zarządca"
      );
      setRoles(filteredRoles);
    } catch (error) {
      console.error("Error fetching roles:", error);
      throw error;
    }
  }, []);

  const fetchSpecialists = useCallback(async () => {
    try {
      const response = await api.get("/users");
      const specialistUsers = response.data.filter(
        (user) => user.role?.name === "Specjalista"
      );
      setSpecialists(specialistUsers);
    } catch (error) {
      console.error("Error fetching specialists:", error);
      throw error;
    }
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        await Promise.all([fetchRoles(), fetchSpecialists()]);
        if (isEditing && projectId) {
          await fetchProjectDetails();
        }
      } catch (error) {
        console.error("Error fetching initial data:", error);
        setError("Wystąpił błąd podczas ładowania danych");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [projectId, isEditing, fetchProjectDetails, fetchRoles, fetchSpecialists]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setError(null);
      const zarządcaRole = await api.get("/roles?name=Zarządca");
      const zarządcaId = zarządcaRole.data[0]?._id;

      // Filter out any potential null values
      const visibleToRoles = [...project.visibleToRoles].filter((role) => role);
      if (zarządcaId && !visibleToRoles.includes(zarządcaId)) {
        visibleToRoles.push(zarządcaId);
      }

      const projectData = {
        name: project.name,
        key: project.key,
        manager: project.manager,
        visibleToRoles,
      };

      if (isEditing) {
        await api.patch(`/projects/${projectId}`, projectData);
      } else {
        await api.post("/projects", projectData);
      }
      navigate("/projects");
    } catch (error) {
      console.error("Error saving project:", error);
      setError(
        isEditing
          ? "Nie udało się zaktualizować projektu"
          : "Nie udało się utworzyć projektu"
      );
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return (
      <Container maxWidth="sm">
        <Box sx={{ mt: 4 }}>
          <Alert severity="error">{error}</Alert>
          <Button
            variant="contained"
            fullWidth
            sx={{ mt: 3 }}
            onClick={() => navigate("/projects")}
          >
            Wróć do listy projektów
          </Button>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="sm">
      <Box sx={{ mt: 4 }}>
        <Typography variant="h5" gutterBottom>
          {isEditing ? "Edytuj projekt" : "Nowy projekt"}
        </Typography>
        <Box component="form" onSubmit={handleSubmit}>
          <TextField
            margin="normal"
            required
            fullWidth
            label="Nazwa projektu"
            value={project.name}
            onChange={(e) => setProject({ ...project, name: e.target.value })}
          />
          <TextField
            margin="normal"
            required
            fullWidth
            label="Klucz projektu"
            value={project.key}
            onChange={(e) => setProject({ ...project, key: e.target.value })}
          />
          <FormControl fullWidth margin="normal" required>
            <InputLabel>Manager projektu</InputLabel>
            <Select
              value={project.manager}
              onChange={(e) =>
                setProject({ ...project, manager: e.target.value })
              }
              input={<OutlinedInput label="Manager projektu" />}
            >
              {specialists.map((specialist) => (
                <MenuItem key={specialist._id} value={specialist._id}>
                  {specialist.login}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl fullWidth margin="normal" required>
            <InputLabel>Widoczny dla ról</InputLabel>
            <Select
              multiple
              value={project.visibleToRoles}
              onChange={(e) =>
                setProject({ ...project, visibleToRoles: e.target.value })
              }
              input={<OutlinedInput label="Widoczny dla ról" />}
              renderValue={(selected) => (
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                  {selected.map((roleId) => {
                    const role = roles.find((r) => r._id === roleId);
                    return role ? (
                      <Chip key={roleId} label={role.name} />
                    ) : null;
                  })}
                </Box>
              )}
            >
              {roles.map((role) => (
                <MenuItem key={role._id} value={role._id}>
                  {role.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button type="submit" variant="contained" fullWidth sx={{ mt: 3 }}>
            {isEditing ? "Zapisz zmiany" : "Utwórz projekt"}
          </Button>
        </Box>
      </Box>
    </Container>
  );
};

export default ProjectForm;
