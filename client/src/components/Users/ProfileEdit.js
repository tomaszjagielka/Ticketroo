import React, { useState } from "react";
import { updateProfile } from "../../services/userService";
import { useNavigate } from "react-router-dom";
import {
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Box,
  Alert,
} from "@mui/material";

const ProfileEdit = () => {
  const [formData, setFormData] = useState({
    login: "",
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    // Walidacja
    if (
      formData.newPassword &&
      formData.newPassword !== formData.confirmPassword
    ) {
      setError("Nowe hasło i potwierdzenie nie są zgodne");
      return;
    }

    try {
      const dataToSend = {
        ...(formData.login && { login: formData.login }),
        ...(formData.newPassword && {
          currentPassword: formData.currentPassword,
          newPassword: formData.newPassword,
        }),
      };

      await updateProfile(dataToSend);
      setSuccess("Profil został zaktualizowany pomyślnie");
      setFormData({
        login: "",
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Wystąpił błąd podczas aktualizacji profilu"
      );
    }
  };

  return (
    <Container maxWidth="sm">
      <Paper elevation={3} sx={{ p: 4, mt: 4 }}>
        <Typography variant="h5" component="h1" gutterBottom>
          Edycja profilu
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert severity="success" sx={{ mb: 2 }}>
            {success}
          </Alert>
        )}

        <form onSubmit={handleSubmit}>
          <TextField
            fullWidth
            label="Nowy login"
            name="login"
            value={formData.login}
            onChange={handleChange}
            margin="normal"
          />

          <Typography variant="h6" sx={{ mt: 3, mb: 2 }}>
            Zmiana hasła (opcjonalne)
          </Typography>

          <TextField
            fullWidth
            type="password"
            label="Aktualne hasło"
            name="currentPassword"
            value={formData.currentPassword}
            onChange={handleChange}
            margin="normal"
          />

          <TextField
            fullWidth
            type="password"
            label="Nowe hasło"
            name="newPassword"
            value={formData.newPassword}
            onChange={handleChange}
            margin="normal"
          />

          <TextField
            fullWidth
            type="password"
            label="Potwierdź nowe hasło"
            name="confirmPassword"
            value={formData.confirmPassword}
            onChange={handleChange}
            margin="normal"
          />

          <Box sx={{ mt: 3, display: "flex", gap: 2 }}>
            <Button
              type="submit"
              variant="contained"
              color="primary"
              disabled={!formData.login && !formData.newPassword}
            >
              Zapisz zmiany
            </Button>
            <Button variant="outlined" onClick={() => navigate(-1)}>
              Anuluj
            </Button>
          </Box>
        </form>
      </Paper>
    </Container>
  );
};

export default ProfileEdit;
