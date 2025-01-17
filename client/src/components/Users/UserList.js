import React, { useState, useEffect } from "react";
import { Container, Table, Button, Card, Modal, Form } from "react-bootstrap";
import {
  getUsers,
  getRoles,
  createUser,
  updateUser,
  deleteUser,
} from "../../services/userService";
import LoadingSpinner from "../shared/LoadingSpinner";

const UserList = () => {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({
    login: "",
    password: "",
    roleId: "",
  });

  useEffect(() => {
    fetchUsers();
    fetchRoles();
  }, []);

  const fetchUsers = async () => {
    try {
      const data = await getUsers();
      setUsers(data);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching users:", error);
      setLoading(false);
    }
  };

  const fetchRoles = async () => {
    try {
      const data = await getRoles();
      setRoles(data);
    } catch (error) {
      console.error("Error fetching roles:", error);
    }
  };

  const handleShowModal = (user = null) => {
    if (user) {
      setEditingUser(user);
      setFormData({
        login: user.login,
        password: "",
        roleId: user.role?._id || "",
      });
    } else {
      setEditingUser(null);
      setFormData({
        login: "",
        password: "",
        roleId: "",
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingUser(null);
    setFormData({
      login: "",
      password: "",
      roleId: "",
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingUser) {
        const updatedUser = await updateUser(editingUser._id, formData);
        const role = roles.find((r) => r._id === formData.roleId);
        const userWithRole = { ...updatedUser, role };
        setUsers(
          users.map((user) =>
            user._id === userWithRole._id ? userWithRole : user
          )
        );
      } else {
        const newUser = await createUser(formData);
        const role = roles.find((r) => r._id === formData.roleId);
        const userWithRole = { ...newUser, role };
        setUsers([...users, userWithRole]);
      }
      handleCloseModal();
    } catch (error) {
      console.error("Error saving user:", error);
      alert(
        error.response?.data?.message ||
          "Wystąpił błąd podczas zapisywania użytkownika"
      );
    }
  };

  const handleDelete = async (userId) => {
    if (!window.confirm("Czy na pewno chcesz usunąć tego użytkownika?")) {
      return;
    }
    try {
      await deleteUser(userId);
      setUsers(users.filter((user) => user._id !== userId));
    } catch (error) {
      console.error("Error deleting user:", error);
      alert(
        error.response?.data?.message ||
          "Wystąpił błąd podczas usuwania użytkownika"
      );
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <Container>
      <div className="d-flex justify-content-between align-items-center my-4">
        <h2>Użytkownicy</h2>
        <Button variant="primary" onClick={() => handleShowModal()}>
          Dodaj użytkownika
        </Button>
      </div>
      <Card>
        <Card.Body>
          <Table hover>
            <thead>
              <tr>
                <th className="text-center">Login</th>
                <th className="text-center">Rola</th>
                <th className="text-center">Akcje</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user._id}>
                  <td className="text-center">{user.login}</td>
                  <td className="text-center">{user.role?.name}</td>
                  <td className="text-center">
                    <div className="d-flex justify-content-center gap-2">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleShowModal(user)}
                      >
                        Edytuj
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => handleDelete(user._id)}
                      >
                        Usuń
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card.Body>
      </Card>

      <Modal show={showModal} onHide={handleCloseModal}>
        <Modal.Header closeButton>
          <Modal.Title>
            {editingUser ? "Edytuj użytkownika" : "Dodaj użytkownika"}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-3">
              <Form.Label>Login</Form.Label>
              <Form.Control
                type="text"
                value={formData.login}
                onChange={(e) =>
                  setFormData({ ...formData, login: e.target.value })
                }
                required
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>
                {editingUser ? "Nowe hasło (opcjonalne)" : "Hasło"}
              </Form.Label>
              <Form.Control
                type="password"
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
                required={!editingUser}
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Rola</Form.Label>
              <Form.Select
                value={formData.roleId}
                onChange={(e) =>
                  setFormData({ ...formData, roleId: e.target.value })
                }
                required
              >
                <option value="">Wybierz rolę</option>
                {roles.map((role) => (
                  <option key={role._id} value={role._id}>
                    {role.name}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
            <div className="d-flex justify-content-end gap-2">
              <Button variant="secondary" onClick={handleCloseModal}>
                Anuluj
              </Button>
              <Button variant="primary" type="submit">
                {editingUser ? "Zapisz zmiany" : "Dodaj"}
              </Button>
            </div>
          </Form>
        </Modal.Body>
      </Modal>
    </Container>
  );
};

export default UserList;
