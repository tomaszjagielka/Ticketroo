import api from "./api";

export const subscribeToProject = async (projectId) => {
  const response = await api.post(`/projects/${projectId}/subscribe`);
  return response.data;
};

export const subscribeToTicket = async (ticketId) => {
  const response = await api.post(`/tickets/${ticketId}/subscribe`);
  return response.data;
};

export const unsubscribeFromProject = async (projectId) => {
  const response = await api.delete(`/projects/${projectId}/unsubscribe`);
  return response.data;
};

export const unsubscribeFromTicket = async (ticketId) => {
  const response = await api.delete(`/tickets/${ticketId}/unsubscribe`);
  return response.data;
};

export const getUserSubscriptions = async () => {
  const response = await api.get("/subscriptions");
  return response.data;
};
