// API configuration
export const API_URL = process.env.REACT_APP_API_URL;

// Authentication configuration
export const AUTH_TOKEN_KEY = process.env.REACT_APP_AUTH_TOKEN_KEY;

// Application settings
export const APP_NAME = "Ticketroo";

// Ticket statuses
export const TICKET_STATUSES = {
  NEW: "new",
  IN_PROGRESS: "in_progress",
  RESOLVED: "resolved",
  REOPENED: "reopened",
  CLOSED: "closed",
};

// User roles
export const USER_ROLES = {
  ADMIN: "Zarządca",
  SPECIALIST: "Specjalista",
  USER: "Użytkownik",
};
