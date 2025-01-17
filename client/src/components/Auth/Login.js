import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Box, TextField, Button, Typography, Container } from "@mui/material";
import { login } from "../../services/auth";
import { useAuth } from "../../contexts/AuthContext";

const Login = () => {
  const [credentials, setCredentials] = useState({ login: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login: authLogin } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setError("");
      setLoading(true);
      const { token } = await login(credentials);
      authLogin(token);
      navigate("/tickets");
    } catch (err) {
      setError("Nieprawidłowe dane logowania");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="sm">
      <Box
        sx={{
          mt: 8,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <Typography component="h1" variant="h5">
          Logowanie
        </Typography>
        <Box component="form" onSubmit={handleSubmit} sx={{ mt: 1 }}>
          <TextField
            margin="normal"
            required
            fullWidth
            label="Login"
            value={credentials.login}
            onChange={(e) =>
              setCredentials({ ...credentials, login: e.target.value })
            }
          />
          <TextField
            margin="normal"
            required
            fullWidth
            label="Hasło"
            type="password"
            value={credentials.password}
            onChange={(e) =>
              setCredentials({ ...credentials, password: e.target.value })
            }
          />
          {error && (
            <Typography color="error" sx={{ mt: 2 }}>
              {error}
            </Typography>
          )}
          <Button
            type="submit"
            fullWidth
            variant="contained"
            sx={{ mt: 3, mb: 2 }}
            disabled={loading}
          >
            {loading ? "Logowanie..." : "Zaloguj"}
          </Button>
        </Box>
      </Box>
    </Container>
  );
};

export default Login;
