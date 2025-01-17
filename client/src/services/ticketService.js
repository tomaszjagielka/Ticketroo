import axios from "axios";

const API_URL = process.env.REACT_APP_API_URL;
const AUTH_TOKEN_KEY = process.env.REACT_APP_AUTH_TOKEN_KEY;

const getAuthHeader = () => ({
  Authorization: `Bearer ${localStorage.getItem(AUTH_TOKEN_KEY)}`,
});

const ticketService = {
  getTicketDetails: async (ticketId) => {
    const response = await axios.get(`${API_URL}/tickets/${ticketId}`, {
      headers: getAuthHeader(),
    });
    return response.data;
  },

  getTicketPosts: async (ticketId) => {
    const response = await axios.get(`${API_URL}/tickets/${ticketId}/posts`, {
      headers: getAuthHeader(),
    });
    return response.data;
  },

  addPost: async (ticketId, content) => {
    const response = await axios.post(
      `${API_URL}/tickets/${ticketId}/posts`,
      { content },
      {
        headers: getAuthHeader(),
      }
    );
    return response.data;
  },

  resolveTicket: async (ticketId, resolution) => {
    const response = await axios.patch(
      `${API_URL}/tickets/${ticketId}/resolve`,
      { resolution },
      {
        headers: getAuthHeader(),
      }
    );
    return response.data;
  },

  reopenTicket: async (ticketId, reason) => {
    const response = await axios.patch(
      `${API_URL}/tickets/${ticketId}/reopen`,
      { reason },
      {
        headers: getAuthHeader(),
      }
    );
    return response.data;
  },

  addSatisfactionRating: async (ticketId, rating, comment) => {
    const response = await axios.post(
      `${API_URL}/tickets/${ticketId}/satisfaction`,
      { rating, comment },
      {
        headers: getAuthHeader(),
      }
    );
    return response.data;
  },

  changeStatus: async (ticketId, status) => {
    const response = await axios.patch(
      `${API_URL}/tickets/${ticketId}/status`,
      { status },
      {
        headers: getAuthHeader(),
      }
    );
    return response.data;
  },
};

export default ticketService;
