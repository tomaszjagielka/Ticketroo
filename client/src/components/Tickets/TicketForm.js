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
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";

const TicketForm = () => {
  const [ticket, setTicket] = useState({
    title: "",
    description: "",
    projectId: "",
    ticketType: "",
  });
  const [projects, setProjects] = useState([]);
  const [ticketTypes, setTicketTypes] = useState([]);
  const navigate = useNavigate();

  const fetchTicketTypes = useCallback(
    async (projectId) => {
      try {
        const project = projects.find((p) => p._id === projectId);
        if (project && project.ticketTypes) {
          const response = await api.get(`/projects/${projectId}/ticket-types`);
          setTicketTypes(response.data);
        }
      } catch (error) {
        console.error("Error fetching ticket types:", error);
      }
    },
    [projects]
  );

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    if (ticket.projectId) {
      fetchTicketTypes(ticket.projectId);
    }
  }, [ticket.projectId, fetchTicketTypes]);

  const fetchProjects = async () => {
    try {
      const response = await api.get("/available-projects");
      setProjects(response.data);
    } catch (error) {
      console.error("Error fetching projects:", error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post("/tickets", ticket);
      navigate("/tickets");
    } catch (error) {
      console.error("Error creating ticket:", error);
    }
  };

  return (
    <Container maxWidth="sm">
      <Box sx={{ mt: 4 }}>
        <Typography variant="h5" gutterBottom>
          Nowe zgłoszenie
        </Typography>
        <Box component="form" onSubmit={handleSubmit}>
          <TextField
            margin="normal"
            required
            fullWidth
            label="Tytuł"
            value={ticket.title}
            onChange={(e) => setTicket({ ...ticket, title: e.target.value })}
          />
          <TextField
            margin="normal"
            required
            fullWidth
            multiline
            rows={4}
            label="Opis"
            value={ticket.description}
            onChange={(e) =>
              setTicket({ ...ticket, description: e.target.value })
            }
          />
          <FormControl fullWidth margin="normal" required>
            <InputLabel>Projekt</InputLabel>
            <Select
              value={ticket.projectId}
              label="Projekt"
              onChange={(e) =>
                setTicket({ ...ticket, projectId: e.target.value })
              }
            >
              {projects.map((project) => (
                <MenuItem key={project._id} value={project._id}>
                  {project.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl fullWidth margin="normal" required>
            <InputLabel>Typ zgłoszenia</InputLabel>
            <Select
              value={ticket.ticketType}
              label="Typ zgłoszenia"
              onChange={(e) =>
                setTicket({ ...ticket, ticketType: e.target.value })
              }
              disabled={!ticket.projectId}
            >
              {ticketTypes.map((type) => (
                <MenuItem key={type._id} value={type._id}>
                  {type.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button type="submit" variant="contained" fullWidth sx={{ mt: 3 }}>
            Utwórz zgłoszenie
          </Button>
        </Box>
      </Box>
    </Container>
  );
};

export default TicketForm;
