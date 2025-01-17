import React, { useState } from "react";
import { Container, Box, Typography, TextField, Button } from "@mui/material";
import { useParams, useNavigate } from "react-router-dom";
import api from "../../services/api";

const TicketTypeForm = () => {
  const [ticketType, setTicketType] = useState({
    name: "",
    description: "",
  });
  const { projectId } = useParams();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/projects/${projectId}/ticket-types`, ticketType);
      navigate(`/projects/${projectId}`);
    } catch (error) {
      console.error("Error creating ticket type:", error);
    }
  };

  return (
    <Container maxWidth="sm">
      <Box sx={{ mt: 4 }}>
        <Typography variant="h5" gutterBottom>
          Nowy typ zgłoszenia
        </Typography>
        <Box component="form" onSubmit={handleSubmit}>
          <TextField
            margin="normal"
            required
            fullWidth
            label="Nazwa"
            value={ticketType.name}
            onChange={(e) =>
              setTicketType({ ...ticketType, name: e.target.value })
            }
          />
          <TextField
            margin="normal"
            fullWidth
            multiline
            rows={4}
            label="Opis"
            value={ticketType.description}
            onChange={(e) =>
              setTicketType({ ...ticketType, description: e.target.value })
            }
          />
          <Button type="submit" variant="contained" fullWidth sx={{ mt: 3 }}>
            Dodaj typ zgłoszenia
          </Button>
        </Box>
      </Box>
    </Container>
  );
};

export default TicketTypeForm;
