import axios from "axios";

const API_URL = process.env.REACT_APP_API_URL;
const AUTH_TOKEN_KEY = process.env.REACT_APP_AUTH_TOKEN_KEY;

const getAuthHeader = () => ({
  Authorization: `Bearer ${localStorage.getItem(AUTH_TOKEN_KEY)}`,
});

const notificationService = {
  getNotifications: async () => {
    const response = await axios.get(`${API_URL}/notifications`, {
      headers: getAuthHeader(),
    });
    return response.data;
  },

  markAsRead: async (notificationId) => {
    const response = await axios.patch(
      `${API_URL}/notifications/${notificationId}/mark-read`,
      {},
      {
        headers: getAuthHeader(),
      }
    );
    return response.data;
  },

  markAllAsRead: async () => {
    const response = await axios.patch(
      `${API_URL}/notifications/mark-all-read`,
      {},
      {
        headers: getAuthHeader(),
      }
    );
    return response.data;
  },
};

export default notificationService;
