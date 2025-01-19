const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const cron = require("node-cron");
const PDFDocument = require("pdfkit-table");
const fs = require("fs");

// Import models
const User = require("./models/User");
const Role = require("./models/Role");
const Permission = require("./models/Permission");
const Ticket = require("./models/Ticket");
const Project = require("./models/Project");
const TicketType = require("./models/TicketType");
const Comment = require("./models/Comment");
const ChangeHistory = require("./models/ChangeHistory");
const Subscription = require("./models/Subscription");
const Feedback = require("./models/Feedback");
const Sla = require("./models/Sla");
const Suggestion = require("./models/Suggestion");
const Notification = require("./models/Notification");
const Post = require("./models/Post");
const EventLog = require("./models/EventLog");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Połączenie z bazą danych
mongoose.connect("mongodb://localhost:27017/ticket-system", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Konfiguracja multer dla obsługi plików
const storage = multer.diskStorage({
  destination: "./uploads/",
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // limit 5MB
});

// Endpointy autoryzacji
app.post("/api/auth/login", async (req, res) => {
  try {
    const { login, password } = req.body;
    const user = await User.findOne({ login }).populate("role");

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: "Nieprawidłowe dane logowania" });
    }

    const token = jwt.sign(
      {
        userId: user._id,
        role: encodeURIComponent(user.role.name),
      },
      "secret_key",
      { expiresIn: "24h" }
    );

    res.json({ token });
  } catch (error) {
    res.status(500).json({ message: "Błąd serwera" });
  }
});

// Middleware autoryzacji
const authMiddleware = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ message: "Brak tokenu autoryzacji" });
    }

    const decoded = jwt.verify(token, "secret_key");
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ message: "Nieprawidłowy token" });
  }
};

// Middleware sprawdzający uprawnienia
const checkPermission = (requiredPermissions) => async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId).populate({
      path: "role",
      populate: { path: "permissions" },
    });

    if (!user) {
      return res.status(401).json({ message: "Użytkownik nie istnieje" });
    }

    // Jeśli użytkownik jest zarządcą, zawsze ma dostęp
    if (user.role.name === "Zarządca") {
      return next();
    }

    // Jeśli użytkownik jest specjalistą i sprawdzamy uprawnienia do zmiany statusu
    if (
      user.role.name === "Specjalista" &&
      (Array.isArray(requiredPermissions)
        ? requiredPermissions.includes("CHANGE_STATUS")
        : requiredPermissions === "CHANGE_STATUS")
    ) {
      return next();
    }

    // Sprawdź czy użytkownik jest managerem projektu dla operacji na typach zgłoszeń
    if (
      (Array.isArray(requiredPermissions)
        ? requiredPermissions.includes("MANAGE_TICKET_TYPES")
        : requiredPermissions === "MANAGE_TICKET_TYPES") &&
      req.params.projectId
    ) {
      const project = await Project.findById(req.params.projectId);
      if (project && project.manager.toString() === user._id.toString()) {
        return next();
      }
    }

    // Dla innych przypadków sprawdzamy standardowo uprawnienia
    const permissions = Array.isArray(requiredPermissions)
      ? requiredPermissions
      : [requiredPermissions];
    const hasPermission = permissions.some((permission) =>
      user.role.permissions.some((p) => p.name === permission)
    );

    if (!hasPermission) {
      return res.status(403).json({ message: "Brak uprawnień" });
    }

    next();
  } catch (error) {
    res.status(500).json({ message: "Błąd podczas weryfikacji uprawnień" });
  }
};

// Endpoint do tworzenia zgłoszenia
app.post("/api/tickets", authMiddleware, async (req, res) => {
  try {
    const { projectId, ticketType, title, description } = req.body;

    // Sprawdzenie czy projekt istnieje
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: "Nie znaleziono projektu" });
    }

    // Sprawdzenie czy typ zgłoszenia jest dostępny w projekcie
    if (!project.ticketTypes.includes(ticketType)) {
      return res.status(400).json({ message: "Niedozwolony typ zgłoszenia" });
    }

    // Walidacja danych zgłoszenia
    if (!title || !description) {
      return res.status(400).json({ message: "Niekompletne dane zgłoszenia" });
    }

    const ticket = new Ticket({
      title,
      description,
      status: "new",
      creator: req.user.userId,
      project: projectId,
      type: ticketType,
    });

    await ticket.save();

    // Powiadomienie dla managera projektu
    if (project.manager) {
      await new Notification({
        content: `Nowe zgłoszenie "${title}" zostało utworzone w projekcie ${project.name}`,
        type: "new_ticket",
        recipient: project.manager,
      }).save();
    }

    // Powiadomienia dla subskrybentów projektu
    const projectSubscribers = await Subscription.find({ project: projectId });
    for (const subscription of projectSubscribers) {
      // Nie wysyłaj powiadomienia twórcy zgłoszenia ani managerowi (który już dostał)
      if (
        subscription.user.toString() !== req.user.userId &&
        subscription.user.toString() !== project.manager?.toString()
      ) {
        await new Notification({
          content: `Nowe zgłoszenie "${title}" zostało utworzone w projekcie ${project.name}`,
          type: "new_ticket",
          recipient: subscription.user,
        }).save();
      }
    }

    await logEvent(
      "CREATE_TICKET",
      req.user.userId,
      `Created ticket: ${title}`
    );

    // Dodaj sprawdzenie SLA po utworzeniu zgłoszenia
    await checkSLA(ticket);

    res.status(201).json(ticket);
  } catch (error) {
    res.status(500).json({ message: "Błąd podczas tworzenia zgłoszenia" });
  }
});

app.get("/api/tickets", authMiddleware, async (req, res) => {
  try {
    // Pobierz rolę użytkownika
    const user = await User.findById(req.user.userId).populate("role");
    if (!user || !user.role) {
      return res
        .status(400)
        .json({ message: "Nie znaleziono roli użytkownika" });
    }

    let tickets;
    if (user.role.name === "Zarządca") {
      // Zarządca widzi wszystkie zgłoszenia
      tickets = await Ticket.find()
        .populate("creator", "login")
        .populate("project", "name");
    } else {
      // Pozostali użytkownicy widzą tylko zgłoszenia z projektów, do których mają dostęp
      const accessibleProjects = await Project.find({
        visibleToRoles: user.role._id,
      });

      tickets = await Ticket.find({
        project: { $in: accessibleProjects.map((p) => p._id) },
      })
        .populate("creator", "login")
        .populate("project", "name");
    }

    res.json(tickets);
  } catch (error) {
    console.error("Error fetching tickets:", error);
    res.status(500).json({ message: "Błąd podczas pobierania zgłoszeń" });
  }
});

// Middleware do logowania zdarzeń
const logEvent = async (action, user, details) => {
  const eventLog = new EventLog({
    action,
    user,
    details,
  });
  await eventLog.save();
};

// Endpointy dla projektów
app.post(
  "/api/projects",
  authMiddleware,
  checkPermission("MANAGE_PROJECTS"),
  async (req, res) => {
    try {
      const { name, key, visibleToRoles, manager } = req.body;

      // Validate required fields
      if (!name || !key || !visibleToRoles || !manager) {
        return res.status(400).json({
          message: "Brakujące dane",
          details: {
            name: !name,
            key: !key,
            visibleToRoles: !visibleToRoles,
            manager: !manager,
          },
        });
      }

      // Check if project with this key already exists
      const existingProject = await Project.findOne({ key });
      if (existingProject) {
        return res
          .status(400)
          .json({ message: "Projekt z tym kluczem już istnieje" });
      }

      const project = new Project({
        name,
        key,
        visibleToRoles,
        manager,
      });

      await project.save();

      await logEvent(
        "CREATE_PROJECT",
        req.user.userId,
        `Created project: ${name}`
      );

      res.status(201).json(project);
    } catch (error) {
      console.error("Project creation error:", error);
      res.status(500).json({ message: "Błąd podczas tworzenia projektu" });
    }
  }
);

app.get("/api/projects", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).populate("role");

    // If user is "Zarządca", show all projects
    let projects;
    if (user.role.name === "Zarządca") {
      projects = await Project.find()
        .populate("ticketTypes")
        .populate("manager");
    } else {
      projects = await Project.find({ visibleToRoles: user.role._id })
        .populate("ticketTypes")
        .populate("manager");
    }

    res.json(projects);
  } catch (error) {
    console.error("Error fetching projects:", error);
    res.status(500).json({ message: "Błąd podczas pobierania projektów" });
  }
});

// Endpointy dla komentarzy
app.post(
  "/api/tickets/:ticketId/comments",
  authMiddleware,
  async (req, res) => {
    try {
      const { content } = req.body;
      const { ticketId } = req.params;

      const comment = new Comment({
        author: req.user.userId,
        content,
      });

      const ticket = await Ticket.findById(ticketId);
      if (!ticket) {
        return res.status(404).json({ message: "Nie znaleziono zgłoszenia" });
      }

      ticket.comments = ticket.comments || [];
      ticket.comments.push(comment);
      await ticket.save();

      await logEvent(
        "ADD_COMMENT",
        req.user.userId,
        `Added comment to ticket: ${ticketId}`
      );

      res.status(201).json(comment);
    } catch (error) {
      res.status(500).json({ message: "Błąd podczas dodawania komentarza" });
    }
  }
);

// Endpoint do pobierania historii zmian zgłoszenia
app.get("/api/tickets/:ticketId/history", authMiddleware, async (req, res) => {
  try {
    const { ticketId } = req.params;

    const ticket = await Ticket.findById(ticketId);
    if (!ticket) {
      return res.status(404).json({ message: "Nie znaleziono zgłoszenia" });
    }

    const history = await ChangeHistory.find({ ticket: ticketId })
      .sort("-changeDate")
      .populate("ticket");

    if (history.length === 0) {
      return res.status(404).json({ message: "Historia zmian jest pusta" });
    }

    await logEvent(
      "VIEW_HISTORY",
      req.user.userId,
      `Viewed history for ticket ${ticketId}`
    );

    res.json(history);
  } catch (error) {
    res.status(500).json({ message: "Błąd podczas pobierania historii zmian" });
  }
});

// Endpoint do wysyłania sugestii
app.post("/api/suggestions", authMiddleware, async (req, res) => {
  try {
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({ message: "Treść sugestii jest wymagana" });
    }

    const suggestion = new Suggestion({
      content,
      author: req.user.userId,
      status: "new",
    });

    await suggestion.save();

    // Powiadomienie dla deweloperów
    const developers = await User.find({ role: "developer" });
    for (const dev of developers) {
      await new Notification({
        content: "Nowa sugestia wymaga analizy",
        type: "new_suggestion",
        recipient: dev._id,
      }).save();
    }

    await logEvent(
      "CREATE_SUGGESTION",
      req.user.userId,
      "Created new suggestion"
    );

    res.status(201).json({
      message: "Sugestia została wysłana pomyślnie",
      suggestion,
    });
  } catch (error) {
    res.status(500).json({ message: "Błąd podczas wysyłania sugestii" });
  }
});

// Endpointy dla raportów
app.get("/api/reports", authMiddleware, async (req, res) => {
  try {
    const { startDate, endDate, type } = req.query;

    let query = {};
    if (startDate && endDate) {
      query.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    if (type) {
      query.type = type;
    }

    const tickets = await Ticket.find(query)
      .populate("creator")
      .populate("project");

    // Obliczanie dodatkowych statystyk
    const statistics = {
      totalTickets: tickets.length,
      byStatus: {},
      byPriority: {},
      averageResolutionTime: 0,
      slaBreaches: 0,
    };

    let totalResolutionTime = 0;
    let resolvedTickets = 0;

    for (const ticket of tickets) {
      // Liczenie zgłoszeń według statusu
      statistics.byStatus[ticket.status] =
        (statistics.byStatus[ticket.status] || 0) + 1;

      // Liczenie zgłoszeń według priorytetu
      if (ticket.priority) {
        statistics.byPriority[ticket.priority] =
          (statistics.byPriority[ticket.priority] || 0) + 1;
      }

      // Obliczanie średniego czasu rozwiązania
      if (ticket.status === "resolved" && ticket.resolvedAt) {
        const resolutionTime =
          new Date(ticket.resolvedAt) - new Date(ticket.createdAt);
        totalResolutionTime += resolutionTime;
        resolvedTickets++;
      }

      // Sprawdzanie naruszeń SLA
      const sla = await Sla.findOne({ ticketType: ticket.type });
      if (sla) {
        const timeDiff = (new Date() - new Date(ticket.createdAt)) / 1000 / 60;
        if (timeDiff > sla.resolutionTime) {
          statistics.slaBreaches++;
        }
      }
    }

    statistics.averageResolutionTime =
      resolvedTickets > 0 ? totalResolutionTime / resolvedTickets : 0;

    res.json({
      type,
      period: { startDate, endDate },
      data: tickets,
      statistics,
    });
  } catch (error) {
    res.status(500).json({ message: "Błąd podczas generowania raportu" });
  }
});

// Endpoint do generowania raportów
app.post("/api/reports", authMiddleware, async (req, res) => {
  try {
    const { type, dateRange, data } = req.body;

    // Walidacja danych
    if (!type || !dateRange || !data) {
      return res.status(400).json({
        message: "Nieprawidłowe dane",
        details: {
          type: !type,
          dateRange: !dateRange,
          data: !data,
        },
      });
    }

    // Walidacja zakresu dat
    if (!dateRange.startDate || !dateRange.endDate) {
      return res.status(400).json({
        message: "Nieprawidłowy zakres dat",
      });
    }

    const report = new Report({
      type,
      dateRange,
      data,
      generatedBy: req.user.userId,
    });

    await report.save();

    await logEvent(
      "GENERATE_REPORT",
      req.user.userId,
      `Generated ${type} report`
    );

    res.json(report);
  } catch (error) {
    res.status(500).json({ message: "Błąd podczas generowania raportu" });
  }
});

// Aktualizacja statusu zgłoszenia
app.patch("/api/tickets/:ticketId/status", authMiddleware, async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { status } = req.body;

    const ticket = await Ticket.findById(ticketId);
    if (!ticket) {
      return res.status(404).json({ message: "Nie znaleziono zgłoszenia" });
    }

    // Sprawdź czy użytkownik ma uprawnienia (tylko zarządca lub specjalista)
    const user = await User.findById(req.user.userId).populate("role");
    if (
      !user ||
      (user.role.name !== "Zarządca" && user.role.name !== "Specjalista")
    ) {
      return res
        .status(403)
        .json({ message: "Brak uprawnień do zmiany statusu zgłoszenia" });
    }

    const history = new ChangeHistory({
      ticket: ticketId,
      newStatus: status,
      changedBy: req.user.userId,
      changeDetails: `Status changed to: ${status}`,
    });
    await history.save();

    ticket.status = status;
    await ticket.save();

    // Powiadomienia dla subskrybentów zgłoszenia
    const ticketSubscribers = await Subscription.find({ ticket: ticketId });
    for (const subscription of ticketSubscribers) {
      // Pomijamy użytkownika, który dokonał zmiany
      if (subscription.user.toString() !== req.user.userId) {
        await new Notification({
          content: `Status zgłoszenia "${ticket.title}" został zmieniony na: ${status}`,
          type: "ticket_status_change",
          recipient: subscription.user,
        }).save();
      }
    }

    // Powiadomienia dla subskrybentów projektu
    const projectSubscribers = await Subscription.find({
      project: ticket.project,
    });
    for (const subscription of projectSubscribers) {
      // Pomijamy użytkownika, który dokonał zmiany i tych, którzy już dostali powiadomienie
      if (
        subscription.user.toString() !== req.user.userId &&
        !ticketSubscribers.some(
          (ts) => ts.user.toString() === subscription.user.toString()
        )
      ) {
        await new Notification({
          content: `Status zgłoszenia "${ticket.title}" został zmieniony na: ${status}`,
          type: "ticket_status_change",
          recipient: subscription.user,
        }).save();
      }
    }

    await logEvent(
      "UPDATE_TICKET_STATUS",
      req.user.userId,
      `Updated ticket ${ticketId} status to: ${status}`
    );

    // Dodaj sprawdzenie SLA po zmianie statusu
    await checkSLA(ticket);

    // Pobierz zaktualizowane zgłoszenie z populacją
    const updatedTicket = await Ticket.findById(ticketId)
      .populate("creator", "login")
      .populate("project", "name");

    res.json(updatedTicket);
  } catch (error) {
    console.error("Error updating ticket status:", error);
    res.status(500).json({ message: "Błąd podczas aktualizacji statusu" });
  }
});

// Endpoint do wysyłania powiadomień
app.post("/api/notifications", authMiddleware, async (req, res) => {
  try {
    const { content, recipientId, type } = req.body;
    const notification = new Notification({
      content,
      type,
      recipient: recipientId,
      createdAt: new Date(),
      status: "unread",
    });
    await notification.save();
    res.status(201).json(notification);
  } catch (error) {
    res.status(500).json({ message: "Błąd podczas tworzenia powiadomienia" });
  }
});

// Endpoint do pobierania powiadomień użytkownika
app.get("/api/notifications", authMiddleware, async (req, res) => {
  try {
    const notifications = await Notification.find({
      recipient: req.user.userId,
    }).sort("-createdAt");
    res.json(notifications);
  } catch (error) {
    res.status(500).json({ message: "Błąd podczas pobierania powiadomień" });
  }
});

// Funkcja sprawdzająca SLA
const checkSLA = async (ticket) => {
  const sla = await Sla.findOne({
    ticketType: ticket.type,
    priority: ticket.priority || "normal",
  });

  if (!sla) return;

  const now = new Date();
  const creationTime = new Date(ticket.createdAt);

  // Sprawdź czas odpowiedzi (pierwsza odpowiedź/komentarz)
  const firstResponse = await Post.findOne({
    ticket: ticket._id,
    author: { $ne: ticket.creator },
  }).sort("createdAt");

  if (firstResponse) {
    const responseTime =
      (new Date(firstResponse.createdAt) - creationTime) / (1000 * 60); // w minutach
    if (responseTime > sla.responseTime) {
      // Utwórz wpis o naruszeniu czasu odpowiedzi
      await new ChangeHistory({
        ticket: ticket._id,
        changeDate: firstResponse.createdAt,
        changeDetails: `SLA breach: Response time exceeded (${Math.round(
          responseTime
        )} minutes vs ${sla.responseTime} minutes target)`,
        changedBy: firstResponse.author,
      }).save();
    }
  }

  // Sprawdź czas rozwiązania dla zamkniętych zgłoszeń
  if (ticket.status === "resolved" && ticket.resolvedAt) {
    const resolutionTime =
      (new Date(ticket.resolvedAt) - creationTime) / (1000 * 60); // w minutach
    if (resolutionTime > sla.resolutionTime) {
      // Utwórz wpis o naruszeniu czasu rozwiązania
      await new ChangeHistory({
        ticket: ticket._id,
        changeDate: ticket.resolvedAt,
        changeDetails: `SLA breach: Resolution time exceeded (${Math.round(
          resolutionTime
        )} minutes vs ${sla.resolutionTime} minutes target)`,
        changedBy: ticket.resolvedBy,
      }).save();
    }
  } else if (ticket.status !== "resolved") {
    // Sprawdź bieżące naruszenie dla nierozwiązanych zgłoszeń
    const currentTime = (now - creationTime) / (1000 * 60); // w minutach
    if (currentTime > sla.resolutionTime) {
      const existingBreach = await ChangeHistory.findOne({
        ticket: ticket._id,
        changeDetails: /SLA breach: Current resolution time exceeded/,
      });

      if (!existingBreach) {
        // Utwórz wpis o bieżącym naruszeniu czasu rozwiązania
        await new ChangeHistory({
          ticket: ticket._id,
          changeDate: now,
          changeDetails: `SLA breach: Current resolution time exceeded (${Math.round(
            currentTime
          )} minutes vs ${sla.resolutionTime} minutes target)`,
          changedBy: ticket.assignedTo || ticket.creator,
        }).save();

        // Powiadom zarządców i specjalistów
        const managers = await User.find()
          .populate("role")
          .where("role.name")
          .in(["Zarządca", "Specjalista"]);
        for (const manager of managers) {
          await new Notification({
            content: `Przekroczono czas SLA dla zgłoszenia ${
              ticket._id
            } (${Math.round(currentTime)} minut)`,
            type: "sla_breach",
            recipient: manager._id,
          }).save();
        }
      }
    }
  }
};

// Endpoint do dodawania załączników
app.post(
  "/api/tickets/:ticketId/attachments",
  authMiddleware,
  upload.single("file"),
  async (req, res) => {
    try {
      const { ticketId } = req.params;
      const ticket = await Ticket.findById(ticketId);

      if (!ticket) {
        return res.status(404).json({ message: "Nie znaleziono zgłoszenia" });
      }

      const attachment = {
        name: req.file.originalname,
        path: req.file.path,
        type: req.file.mimetype,
        size: req.file.size,
      };

      ticket.attachments.push(attachment);
      await ticket.save();

      await logEvent(
        "ADD_ATTACHMENT",
        req.user.userId,
        `Added attachment to ticket: ${ticketId}`
      );

      res.status(201).json(attachment);
    } catch (error) {
      res.status(500).json({ message: "Błąd podczas dodawania załącznika" });
    }
  }
);

// Endpoint do tworzenia użytkownika (tylko dla zarządcy)
app.post("/api/users", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).populate("role");
    if (!user || user.role.name !== "Zarządca") {
      return res.status(403).json({ message: "Brak uprawnień" });
    }

    const { login, password, roleId } = req.body;

    // Sprawdź czy wszystkie wymagane pola są obecne
    if (!login || !password || !roleId) {
      return res.status(400).json({
        message: "Brakujące dane",
        missingFields: {
          login: !login,
          password: !password,
          roleId: !roleId,
        },
      });
    }

    // Sprawdź czy login jest już zajęty
    const existingUser = await User.findOne({ login });
    if (existingUser) {
      return res.status(400).json({ message: "Login jest już zajęty" });
    }

    // Sprawdź czy rola istnieje
    const role = await Role.findById(roleId);
    if (!role) {
      return res.status(400).json({ message: "Nie znaleziono roli" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({
      login,
      password: hashedPassword,
      role: roleId,
    });

    await newUser.save();
    await logEvent("CREATE_USER", req.user.userId, `Created user: ${login}`);

    const userResponse = { ...newUser.toObject() };
    delete userResponse.password;

    res.status(201).json(userResponse);
  } catch (error) {
    res.status(500).json({ message: "Błąd podczas tworzenia użytkownika" });
  }
});

// Endpoint do dodawania informacji zwrotnej
app.post(
  "/api/tickets/:ticketId/feedback",
  authMiddleware,
  async (req, res) => {
    try {
      const { ticketId } = req.params;
      const { rating, comment } = req.body;

      const ticket = await Ticket.findById(ticketId);
      if (!ticket) {
        return res.status(404).json({ message: "Nie znaleziono zgłoszenia" });
      }

      const feedback = new Feedback({
        ticket: ticketId,
        rating,
        comment,
        author: req.user.userId,
      });

      await feedback.save();
      await logEvent(
        "ADD_FEEDBACK",
        req.user.userId,
        `Added feedback to ticket: ${ticketId}`
      );

      res.status(201).json(feedback);
    } catch (error) {
      res
        .status(500)
        .json({ message: "Błąd podczas dodawania informacji zwrotnej" });
    }
  }
);

// Endpointy dla typów zgłoszeń
app.post(
  "/api/projects/:projectId/ticket-types",
  authMiddleware,
  checkPermission("MANAGE_TICKET_TYPES"),
  async (req, res) => {
    try {
      const { projectId } = req.params;
      const { name, description } = req.body;

      const project = await Project.findById(projectId);
      if (!project) {
        return res.status(404).json({ message: "Nie znaleziono projektu" });
      }

      const ticketType = new TicketType({
        name,
        description,
      });

      await ticketType.save();
      project.ticketTypes.push(ticketType._id);
      await project.save();

      await logEvent(
        "ADD_TICKET_TYPE",
        req.user.userId,
        `Added ticket type to project: ${projectId}`
      );

      res.status(201).json(ticketType);
    } catch (error) {
      res
        .status(500)
        .json({ message: "Błąd podczas dodawania typu zgłoszenia" });
    }
  }
);

app.delete(
  "/api/projects/:projectId/ticket-types/:typeId",
  authMiddleware,
  checkPermission("MANAGE_TICKET_TYPES"),
  async (req, res) => {
    try {
      const { projectId, typeId } = req.params;

      const project = await Project.findById(projectId);
      if (!project) {
        return res.status(404).json({ message: "Nie znaleziono projektu" });
      }

      project.ticketTypes = project.ticketTypes.filter(
        (type) => type.toString() !== typeId
      );
      await project.save();
      await TicketType.findByIdAndDelete(typeId);

      await logEvent(
        "DELETE_TICKET_TYPE",
        req.user.userId,
        `Removed ticket type from project: ${projectId}`
      );

      res.status(200).json({ message: "Typ zgłoszenia został usunięty" });
    } catch (error) {
      res
        .status(500)
        .json({ message: "Błąd podczas usuwania typu zgłoszenia" });
    }
  }
);

// Endpoint do wylogowania
app.post("/api/auth/logout", authMiddleware, async (req, res) => {
  try {
    // W przyszłości można dodać blacklistę tokenów
    await logEvent("LOGOUT", req.user.userId, "User logged out");
    res.json({ message: "Wylogowano pomyślnie" });
  } catch (error) {
    res.status(500).json({ message: "Błąd podczas wylogowywania" });
  }
});

// Endpoint do przypisywania developera do sugestii
app.patch(
  "/api/suggestions/:suggestionId/assign",
  authMiddleware,
  checkPermission("MANAGE_SUGGESTIONS"),
  async (req, res) => {
    try {
      const { suggestionId } = req.params;
      const { developerId } = req.body;

      const suggestion = await Suggestion.findById(suggestionId);
      if (!suggestion) {
        return res.status(404).json({ message: "Nie znaleziono sugestii" });
      }

      const developer = await User.findById(developerId);
      if (!developer) {
        return res.status(404).json({ message: "Nie znaleziono developera" });
      }

      suggestion.developer = developerId;
      suggestion.status = "assigned";
      await suggestion.save();

      // Powiadomienie dla developera
      await new Notification({
        content: `Przypisano Ci nową sugestię: ${suggestion.content}`,
        type: "suggestion_assigned",
        recipient: developerId,
      }).save();

      await logEvent(
        "ASSIGN_DEVELOPER",
        req.user.userId,
        `Assigned developer ${developerId} to suggestion ${suggestionId}`
      );

      res.json(suggestion);
    } catch (error) {
      res
        .status(500)
        .json({ message: "Błąd podczas przypisywania developera" });
    }
  }
);

// Endpoint do zmiany statusu sugestii
app.patch(
  "/api/suggestions/:suggestionId/status",
  authMiddleware,
  checkPermission("MANAGE_SUGGESTIONS"),
  async (req, res) => {
    try {
      const { suggestionId } = req.params;
      const { status, additionalInfo } = req.body;

      const suggestion = await Suggestion.findById(suggestionId);
      if (!suggestion) {
        return res.status(404).json({ message: "Nie znaleziono sugestii" });
      }

      suggestion.status = status;
      await suggestion.save();

      // Jeśli potrzebne są dodatkowe informacje, wysyłamy powiadomienie
      if (status === "needs_info" && additionalInfo) {
        await new Notification({
          content: `Sugestia wymaga dodatkowych informacji: ${additionalInfo}`,
          type: "suggestion_info_needed",
          recipient: suggestion.author,
        }).save();
      }

      await logEvent(
        "UPDATE_SUGGESTION_STATUS",
        req.user.userId,
        `Updated suggestion ${suggestionId} status to: ${status}`
      );

      res.json(suggestion);
    } catch (error) {
      res
        .status(500)
        .json({ message: "Błąd podczas aktualizacji statusu sugestii" });
    }
  }
);

// Endpoint do przypisywania przepływów do typów zgłoszeń
app.post(
  "/api/projects/:projectId/ticket-types/:typeId/workflows",
  authMiddleware,
  checkPermission("MANAGE_TICKET_TYPES"),
  async (req, res) => {
    try {
      const { projectId, typeId } = req.params;
      const { workflows } = req.body;

      const project = await Project.findById(projectId);
      if (!project) {
        return res.status(404).json({ message: "Nie znaleziono projektu" });
      }

      const ticketType = await TicketType.findById(typeId);
      if (!ticketType) {
        return res
          .status(404)
          .json({ message: "Nie znaleziono typu zgłoszenia" });
      }

      ticketType.workflows = workflows;
      await ticketType.save();

      await logEvent(
        "ASSIGN_WORKFLOWS",
        req.user.userId,
        `Assigned workflows to ticket type ${typeId} in project ${projectId}`
      );

      res.json(ticketType);
    } catch (error) {
      res.status(500).json({
        message: "Błąd podczas przypisywania przepływów do typu zgłoszenia",
      });
    }
  }
);

// Endpoint do przypisywania zespołu do zgłoszenia
app.patch(
  "/api/tickets/:ticketId/assign-team",
  authMiddleware,
  async (req, res) => {
    try {
      const { ticketId } = req.params;
      const { teamId } = req.body;

      const ticket = await Ticket.findById(ticketId);
      if (!ticket) {
        return res.status(404).json({ message: "Nie znaleziono zgłoszenia" });
      }

      ticket.assignedTeam = teamId;
      await ticket.save();

      // Powiadomienie dla zespołu
      const teamMembers = await User.find({ team: teamId });
      for (const member of teamMembers) {
        await new Notification({
          content: `Przypisano nowe zgłoszenie: ${ticket.title}`,
          type: "ticket_assigned",
          recipient: member._id,
        }).save();
      }

      await logEvent(
        "ASSIGN_TEAM",
        req.user.userId,
        `Assigned team ${teamId} to ticket ${ticketId}`
      );

      res.json(ticket);
    } catch (error) {
      res.status(500).json({ message: "Błąd podczas przypisywania zespołu" });
    }
  }
);

// Endpoint do testowania sugestii
app.post(
  "/api/suggestions/:suggestionId/test",
  authMiddleware,
  checkPermission("MANAGE_SUGGESTIONS"),
  async (req, res) => {
    try {
      const { suggestionId } = req.params;
      const { testResults } = req.body;

      const suggestion = await Suggestion.findById(suggestionId);
      if (!suggestion) {
        return res.status(404).json({ message: "Nie znaleziono sugestii" });
      }

      if (testResults.passed) {
        suggestion.status = "ready_for_deployment";
      } else {
        suggestion.status = "needs_revision";
        // Powiadomienie dla developera
        await new Notification({
          content: `Sugestia ${suggestionId} wymaga poprawek po testach`,
          type: "suggestion_test_failed",
          recipient: suggestion.developer,
        }).save();
      }

      await suggestion.save();
      await logEvent(
        "TEST_SUGGESTION",
        req.user.userId,
        `Tested suggestion ${suggestionId}`
      );

      res.json(suggestion);
    } catch (error) {
      res.status(500).json({ message: "Błąd podczas testowania sugestii" });
    }
  }
);

// Endpoint do wdrażania sugestii
app.post(
  "/api/suggestions/:suggestionId/deploy",
  authMiddleware,
  checkPermission("MANAGE_SUGGESTIONS"),
  async (req, res) => {
    try {
      const { suggestionId } = req.params;

      const suggestion = await Suggestion.findById(suggestionId);
      if (!suggestion) {
        return res.status(404).json({ message: "Nie znaleziono sugestii" });
      }

      if (suggestion.status !== "ready_for_deployment") {
        return res
          .status(400)
          .json({ message: "Sugestia nie jest gotowa do wdrożenia" });
      }

      suggestion.status = "deployed";
      await suggestion.save();

      // Powiadomienie dla autora sugestii
      await new Notification({
        content: `Twoja sugestia została wdrożona: ${suggestion.content}`,
        type: "suggestion_deployed",
        recipient: suggestion.author,
      }).save();

      await logEvent(
        "DEPLOY_SUGGESTION",
        req.user.userId,
        `Deployed suggestion ${suggestionId}`
      );

      res.json(suggestion);
    } catch (error) {
      res.status(500).json({ message: "Błąd podczas wdrażania sugestii" });
    }
  }
);

// Endpoint do pobierania dostępnych projektów
app.get("/api/available-projects", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).populate("role");

    if (!user || !user.role) {
      return res.status(400).json({ message: "User role not found" });
    }

    // If user is Zarządca, return all projects
    let projects;
    if (user.role.name === "Zarządca") {
      projects = await Project.find().select("name key ticketTypes");
    } else {
      projects = await Project.find({
        visibleToRoles: { $in: [user.role._id] },
      }).select("name key ticketTypes");
    }

    res.json(projects);
  } catch (error) {
    console.error("Error in available-projects:", error);
    res.status(500).json({ message: "Błąd podczas pobierania projektów" });
  }
});

// Endpoint do pobierania ról
app.get("/api/roles", authMiddleware, async (req, res) => {
  try {
    const roles = await Role.find();
    res.json(roles);
  } catch (error) {
    res.status(500).json({ message: "Błąd podczas pobierania ról" });
  }
});

// Endpoint do pobierania typów zgłoszeń dla projektu
app.get(
  "/api/projects/:projectId/ticket-types",
  authMiddleware,
  async (req, res) => {
    try {
      const { projectId } = req.params;

      const project = await Project.findById(projectId).populate("ticketTypes");
      if (!project) {
        return res.status(404).json({ message: "Nie znaleziono projektu" });
      }

      res.json(project.ticketTypes);
    } catch (error) {
      console.error("Error fetching ticket types:", error);
      res
        .status(500)
        .json({ message: "Błąd podczas pobierania typów zgłoszeń" });
    }
  }
);

// Endpoint do pobierania szczegółów zgłoszenia
app.get("/api/tickets/:ticketId", authMiddleware, async (req, res) => {
  try {
    const { ticketId } = req.params;
    const ticket = await Ticket.findById(ticketId)
      .populate("creator", "login")
      .populate("project", "name");

    if (!ticket) {
      return res.status(404).json({ message: "Nie znaleziono zgłoszenia" });
    }

    // Sprawdź uprawnienia użytkownika
    const user = await User.findById(req.user.userId).populate("role");
    if (!user || !user.role) {
      return res
        .status(400)
        .json({ message: "Nie znaleziono roli użytkownika" });
    }

    // Zarządca ma dostęp do wszystkich zgłoszeń
    if (user.role.name !== "Zarządca") {
      // Sprawdź czy projekt jest dostępny dla roli użytkownika
      const project = await Project.findById(ticket.project);
      if (!project.visibleToRoles.includes(user.role._id)) {
        return res
          .status(403)
          .json({ message: "Brak dostępu do tego zgłoszenia" });
      }
    }

    res.json(ticket);
  } catch (error) {
    console.error("Error fetching ticket details:", error);
    res
      .status(500)
      .json({ message: "Błąd podczas pobierania szczegółów zgłoszenia" });
  }
});

// Endpoint do pobierania postów dla zgłoszenia
app.get("/api/tickets/:ticketId/posts", authMiddleware, async (req, res) => {
  try {
    const { ticketId } = req.params;
    const posts = await Post.find({ ticket: ticketId })
      .populate("author", "login")
      .sort("createdAt");

    res.json(posts);
  } catch (error) {
    res.status(500).json({ message: "Błąd podczas pobierania postów" });
  }
});

// Endpoint do dodawania posta
app.post("/api/tickets/:ticketId/posts", authMiddleware, async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { content } = req.body;

    const ticket = await Ticket.findById(ticketId);
    if (!ticket) {
      return res.status(404).json({ message: "Nie znaleziono zgłoszenia" });
    }

    const post = new Post({
      content,
      author: req.user.userId,
      ticket: ticketId,
      title: "Comment",
    });

    await post.save();
    await post.populate("author", "login");

    // Powiadomienia dla subskrybentów zgłoszenia
    const ticketSubscribers = await Subscription.find({ ticket: ticketId });
    for (const subscription of ticketSubscribers) {
      if (subscription.user.toString() !== req.user.userId) {
        // Don't notify the author
        await new Notification({
          content: `Nowy komentarz w zgłoszeniu "${
            ticket.title
          }": ${content.substring(0, 50)}${content.length > 50 ? "..." : ""}`,
          type: "new_comment",
          recipient: subscription.user,
        }).save();
      }
    }

    // Powiadomienia dla subskrybentów projektu
    const projectSubscribers = await Subscription.find({
      project: ticket.project,
    });
    for (const subscription of projectSubscribers) {
      if (subscription.user.toString() !== req.user.userId) {
        // Don't notify the author
        await new Notification({
          content: `Nowy komentarz w zgłoszeniu "${
            ticket.title
          }" w projekcie: ${content.substring(0, 50)}${
            content.length > 50 ? "..." : ""
          }`,
          type: "project_ticket_comment",
          recipient: subscription.user,
        }).save();
      }
    }

    await logEvent(
      "ADD_POST",
      req.user.userId,
      `Added post to ticket: ${ticketId}`
    );
    res.status(201).json(post);
  } catch (error) {
    console.error("Error adding post:", error);
    res.status(500).json({ message: "Błąd podczas dodawania posta" });
  }
});

// Endpoint do subskrypcji projektu
app.post(
  "/api/projects/:projectId/subscribe",
  authMiddleware,
  async (req, res) => {
    try {
      const { projectId } = req.params;

      // Sprawdź czy projekt istnieje
      const project = await Project.findById(projectId);
      if (!project) {
        return res.status(404).json({ message: "Nie znaleziono projektu" });
      }

      // Sprawdź czy subskrypcja już istnieje
      const existingSubscription = await Subscription.findOne({
        user: req.user.userId,
        project: projectId,
      });

      if (existingSubscription) {
        return res
          .status(400)
          .json({ message: "Projekt jest już subskrybowany" });
      }

      const subscription = new Subscription({
        user: req.user.userId,
        project: projectId,
      });

      await subscription.save();
      await logEvent(
        "SUBSCRIBE_PROJECT",
        req.user.userId,
        `Subscribed to project: ${projectId}`
      );

      res.status(201).json(subscription);
    } catch (error) {
      res.status(500).json({ message: "Błąd podczas subskrypcji projektu" });
    }
  }
);

// Endpoint do subskrypcji zgłoszenia
app.post(
  "/api/tickets/:ticketId/subscribe",
  authMiddleware,
  async (req, res) => {
    try {
      const { ticketId } = req.params;

      // Sprawdź czy zgłoszenie istnieje
      const ticket = await Ticket.findById(ticketId);
      if (!ticket) {
        return res.status(404).json({ message: "Nie znaleziono zgłoszenia" });
      }

      // Sprawdź czy subskrypcja już istnieje
      const existingSubscription = await Subscription.findOne({
        user: req.user.userId,
        ticket: ticketId,
      });

      if (existingSubscription) {
        return res
          .status(400)
          .json({ message: "Zgłoszenie jest już subskrybowane" });
      }

      const subscription = new Subscription({
        user: req.user.userId,
        ticket: ticketId,
      });

      await subscription.save();
      await logEvent(
        "SUBSCRIBE_TICKET",
        req.user.userId,
        `Subscribed to ticket: ${ticketId}`
      );

      res.status(201).json(subscription);
    } catch (error) {
      res.status(500).json({ message: "Błąd podczas subskrypcji zgłoszenia" });
    }
  }
);

// Endpoint do anulowania subskrypcji projektu
app.delete(
  "/api/projects/:projectId/unsubscribe",
  authMiddleware,
  async (req, res) => {
    try {
      const { projectId } = req.params;

      await Subscription.findOneAndDelete({
        user: req.user.userId,
        project: projectId,
      });

      await logEvent(
        "UNSUBSCRIBE_PROJECT",
        req.user.userId,
        `Unsubscribed from project: ${projectId}`
      );

      res.json({ message: "Anulowano subskrypcję projektu" });
    } catch (error) {
      res
        .status(500)
        .json({ message: "Błąd podczas anulowania subskrypcji projektu" });
    }
  }
);

// Endpoint do anulowania subskrypcji zgłoszenia
app.delete(
  "/api/tickets/:ticketId/unsubscribe",
  authMiddleware,
  async (req, res) => {
    try {
      const { ticketId } = req.params;

      await Subscription.findOneAndDelete({
        user: req.user.userId,
        ticket: ticketId,
      });

      await logEvent(
        "UNSUBSCRIBE_TICKET",
        req.user.userId,
        `Unsubscribed from ticket: ${ticketId}`
      );

      res.json({ message: "Anulowano subskrypcję zgłoszenia" });
    } catch (error) {
      res
        .status(500)
        .json({ message: "Błąd podczas anulowania subskrypcji zgłoszenia" });
    }
  }
);

// Endpoint do sprawdzania subskrypcji użytkownika
app.get("/api/subscriptions", authMiddleware, async (req, res) => {
  try {
    const subscriptions = await Subscription.find({ user: req.user.userId })
      .populate("project", "name key")
      .populate("ticket", "title");

    res.json(subscriptions);
  } catch (error) {
    res.status(500).json({ message: "Błąd podczas pobierania subskrypcji" });
  }
});

// Endpoint do oznaczania powiadomienia jako przeczytane
app.patch(
  "/api/notifications/:notificationId/mark-read",
  authMiddleware,
  async (req, res) => {
    try {
      const { notificationId } = req.params;

      const notification = await Notification.findOneAndUpdate(
        { _id: notificationId, recipient: req.user.userId },
        { status: "read" },
        { new: true }
      );

      if (!notification) {
        return res
          .status(404)
          .json({ message: "Nie znaleziono powiadomienia" });
      }

      res.json(notification);
    } catch (error) {
      res
        .status(500)
        .json({ message: "Błąd podczas aktualizacji powiadomienia" });
    }
  }
);

// Endpoint do pobierania zgłoszeń projektu
app.get(
  "/api/projects/:projectId/tickets",
  authMiddleware,
  async (req, res) => {
    try {
      const { projectId } = req.params;

      const tickets = await Ticket.find({ project: projectId })
        .populate("creator", "login")
        .sort("-createdAt");

      res.json(tickets);
    } catch (error) {
      res
        .status(500)
        .json({ message: "Błąd podczas pobierania zgłoszeń projektu" });
    }
  }
);

// Endpoint do pobierania szczegółów projektu
app.get("/api/projects/:projectId", authMiddleware, async (req, res) => {
  try {
    const { projectId } = req.params;
    const user = await User.findById(req.user.userId).populate("role");

    const project = await Project.findById(projectId)
      .populate("ticketTypes")
      .populate("manager", "login");

    if (!project) {
      return res.status(404).json({ message: "Nie znaleziono projektu" });
    }

    // Sprawdź uprawnienia - zarządca widzi wszystko, manager widzi swój projekt, inni użytkownicy według ról
    if (
      user.role.name !== "Zarządca" &&
      project.manager.toString() !== user._id.toString() &&
      !project.visibleToRoles.includes(user.role._id)
    ) {
      return res.status(403).json({ message: "Brak uprawnień" });
    }

    res.json(project);
  } catch (error) {
    console.error("Error fetching project details:", error);
    res
      .status(500)
      .json({ message: "Błąd podczas pobierania szczegółów projektu" });
  }
});

// Endpoint do pobierania listy użytkowników (dla zarządcy i managerów projektów)
app.get("/api/users", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).populate("role");

    // Sprawdź czy użytkownik jest zarządcą lub managerem jakiegoś projektu
    const isManager = await Project.exists({ manager: user._id });

    if (!user || (user.role.name !== "Zarządca" && !isManager)) {
      return res.status(403).json({ message: "Brak uprawnień" });
    }

    // Pobierz użytkowników
    const users = await User.find().populate("role").select("-password");

    res.json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ message: "Błąd podczas pobierania użytkowników" });
  }
});

// Endpoint do pobierania listy ról
app.get("/api/roles", authMiddleware, async (req, res) => {
  try {
    const roles = await Role.find();
    res.json(roles);
  } catch (error) {
    res.status(500).json({ message: "Błąd podczas pobierania ról" });
  }
});

// Endpoint do edycji użytkownika (tylko dla zarządcy)
app.put("/api/users/:userId", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).populate("role");
    if (!user || user.role.name !== "Zarządca") {
      return res.status(403).json({ message: "Brak uprawnień" });
    }

    const { userId } = req.params;
    const { login, password, roleId } = req.body;

    const userToUpdate = await User.findById(userId);
    if (!userToUpdate) {
      return res.status(404).json({ message: "Nie znaleziono użytkownika" });
    }

    // Sprawdź czy nowy login nie jest zajęty przez innego użytkownika
    if (login !== userToUpdate.login) {
      const existingUser = await User.findOne({ login });
      if (existingUser) {
        return res.status(400).json({ message: "Login jest już zajęty" });
      }
      userToUpdate.login = login;
    }

    // Aktualizuj hasło tylko jeśli zostało podane
    if (password) {
      userToUpdate.password = await bcrypt.hash(password, 10);
    }

    // Sprawdź czy rola istnieje
    if (roleId) {
      const role = await Role.findById(roleId);
      if (!role) {
        return res.status(400).json({ message: "Nie znaleziono roli" });
      }
      userToUpdate.role = roleId;
    }

    await userToUpdate.save();
    await logEvent("UPDATE_USER", req.user.userId, `Updated user: ${login}`);

    const userResponse = { ...userToUpdate.toObject() };
    delete userResponse.password;

    res.json(userResponse);
  } catch (error) {
    res.status(500).json({ message: "Błąd podczas aktualizacji użytkownika" });
  }
});

// Endpoint do usuwania użytkownika (tylko dla zarządcy)
app.delete("/api/users/:userId", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).populate("role");
    if (!user || user.role.name !== "Zarządca") {
      return res.status(403).json({ message: "Brak uprawnień" });
    }

    const { userId } = req.params;

    // Nie pozwól usunąć samego siebie
    if (userId === req.user.userId) {
      return res
        .status(400)
        .json({ message: "Nie można usunąć własnego konta" });
    }

    const userToDelete = await User.findById(userId);
    if (!userToDelete) {
      return res.status(404).json({ message: "Nie znaleziono użytkownika" });
    }

    await User.findByIdAndDelete(userId);
    await logEvent(
      "DELETE_USER",
      req.user.userId,
      `Deleted user: ${userToDelete.login}`
    );

    res.json({ message: "Użytkownik został usunięty" });
  } catch (error) {
    res.status(500).json({ message: "Błąd podczas usuwania użytkownika" });
  }
});

// Endpoint do rozwiązywania zgłoszenia
app.patch(
  "/api/tickets/:ticketId/resolve",
  authMiddleware,
  async (req, res) => {
    try {
      const { ticketId } = req.params;
      const { resolution } = req.body;

      const ticket = await Ticket.findById(ticketId);
      if (!ticket) {
        return res.status(404).json({ message: "Nie znaleziono zgłoszenia" });
      }

      // Sprawdź czy użytkownik ma uprawnienia (specjalista, zarządca lub twórca zgłoszenia)
      const user = await User.findById(req.user.userId).populate("role");
      if (
        !user ||
        (user.role.name !== "Specjalista" &&
          user.role.name !== "Zarządca" &&
          user._id.toString() !== ticket.creator.toString())
      ) {
        return res
          .status(403)
          .json({ message: "Brak uprawnień do rozwiązania zgłoszenia" });
      }

      ticket.status = "resolved";
      ticket.resolution = resolution;
      ticket.resolvedBy = req.user.userId;
      ticket.resolvedAt = new Date();
      await ticket.save();

      // Dodaj wpis do historii zmian
      const history = new ChangeHistory({
        ticket: ticketId,
        newStatus: "resolved",
        changedBy: req.user.userId,
        changeDetails: resolution,
      });
      await history.save();

      // Powiadom twórcę zgłoszenia tylko jeśli to nie on sam rozwiązał zgłoszenie
      if (ticket.creator.toString() !== req.user.userId) {
        await new Notification({
          content: `Twoje zgłoszenie "${ticket.title}" zostało rozwiązane`,
          type: "ticket_resolved",
          recipient: ticket.creator,
        }).save();
      }

      await logEvent(
        "RESOLVE_TICKET",
        req.user.userId,
        `Resolved ticket: ${ticketId}`
      );

      // Dodaj sprawdzenie SLA po rozwiązaniu
      await checkSLA(ticket);

      // Pobierz zaktualizowane zgłoszenie z populacją danych użytkownika
      const updatedTicket = await Ticket.findById(ticketId)
        .populate("creator", "login")
        .populate("resolvedBy", "login")
        .populate("project", "name");

      res.json(updatedTicket);
    } catch (error) {
      res
        .status(500)
        .json({ message: "Błąd podczas rozwiązywania zgłoszenia" });
    }
  }
);

// Endpoint do ponownego otwierania zgłoszenia
app.patch("/api/tickets/:ticketId/reopen", authMiddleware, async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { reason } = req.body;

    const ticket = await Ticket.findById(ticketId);
    if (!ticket) {
      return res.status(404).json({ message: "Nie znaleziono zgłoszenia" });
    }

    // Sprawdź czy użytkownik ma uprawnienia (specjalista, zarządca lub twórca zgłoszenia)
    const user = await User.findById(req.user.userId).populate("role");
    if (
      !user ||
      (user.role.name !== "Specjalista" &&
        user.role.name !== "Zarządca" &&
        user._id.toString() !== ticket.creator.toString())
    ) {
      return res
        .status(403)
        .json({ message: "Brak uprawnień do ponownego otwarcia zgłoszenia" });
    }

    if (ticket.status !== "resolved") {
      return res.status(400).json({
        message: "Można ponownie otworzyć tylko rozwiązane zgłoszenia",
      });
    }

    ticket.status = "reopened";
    ticket.reopenReason = reason;
    ticket.reopenedAt = new Date();
    ticket.reopenedBy = req.user.userId;
    await ticket.save();

    // Dodaj wpis do historii zmian
    const history = new ChangeHistory({
      ticket: ticketId,
      newStatus: "reopened",
      changedBy: req.user.userId,
      changeDetails: reason,
    });
    await history.save();

    // Powiadom osobę, która rozwiązała zgłoszenie, jeśli to nie ta sama osoba
    if (ticket.resolvedBy && ticket.resolvedBy.toString() !== req.user.userId) {
      await new Notification({
        content: `Zgłoszenie "${ticket.title}" zostało ponownie otwarte. Powód: ${reason}`,
        type: "ticket_reopened",
        recipient: ticket.resolvedBy,
      }).save();
    }

    await logEvent(
      "REOPEN_TICKET",
      req.user.userId,
      `Reopened ticket: ${ticketId}`
    );

    // Pobierz zaktualizowane zgłoszenie z populacją danych użytkownika
    const updatedTicket = await Ticket.findById(ticketId)
      .populate("creator", "login")
      .populate("resolvedBy", "login")
      .populate("reopenedBy", "login")
      .populate("project", "name");

    res.json(updatedTicket);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Błąd podczas ponownego otwierania zgłoszenia" });
  }
});

// Endpoint do dodawania oceny zadowolenia
app.post(
  "/api/tickets/:ticketId/satisfaction",
  authMiddleware,
  async (req, res) => {
    try {
      const { ticketId } = req.params;
      const { rating, comment } = req.body;

      const ticket = await Ticket.findById(ticketId);
      if (!ticket) {
        return res.status(404).json({ message: "Nie znaleziono zgłoszenia" });
      }

      // Sprawdź czy użytkownik jest twórcą zgłoszenia
      if (ticket.creator.toString() !== req.user.userId) {
        return res
          .status(403)
          .json({ message: "Tylko twórca zgłoszenia może wystawić ocenę" });
      }

      if (ticket.status !== "resolved") {
        return res
          .status(400)
          .json({ message: "Można ocenić tylko rozwiązane zgłoszenia" });
      }

      const satisfaction = new Feedback({
        ticket: ticketId,
        rating,
        comment,
        author: req.user.userId,
      });

      await satisfaction.save();

      ticket.satisfaction = rating;
      await ticket.save();

      // Powiadom osobę, która rozwiązała zgłoszenie
      if (ticket.resolvedBy) {
        await new Notification({
          content: `Otrzymano ocenę ${rating}/5 dla rozwiązanego zgłoszenia "${ticket.title}"`,
          type: "satisfaction_rating",
          recipient: ticket.resolvedBy,
        }).save();
      }

      await logEvent(
        "ADD_SATISFACTION_RATING",
        req.user.userId,
        `Added satisfaction rating for ticket: ${ticketId}`
      );

      // Pobierz zaktualizowane zgłoszenie z populacją danych użytkownika
      const updatedTicket = await Ticket.findById(ticketId)
        .populate("creator", "login")
        .populate("resolvedBy", "login")
        .populate("reopenedBy", "login")
        .populate("project", "name");

      res.json(updatedTicket);
    } catch (error) {
      res
        .status(500)
        .json({ message: "Błąd podczas dodawania oceny zadowolenia" });
    }
  }
);

// Endpoint do oznaczania wszystkich powiadomień jako przeczytane
app.patch(
  "/api/notifications/mark-all-read",
  authMiddleware,
  async (req, res) => {
    try {
      await Notification.updateMany(
        { recipient: req.user.userId, status: "unread" },
        { status: "read" }
      );

      await logEvent(
        "MARK_ALL_NOTIFICATIONS_READ",
        req.user.userId,
        "Marked all notifications as read"
      );

      res.json({
        message: "Wszystkie powiadomienia oznaczono jako przeczytane",
      });
    } catch (error) {
      res
        .status(500)
        .json({ message: "Błąd podczas aktualizacji powiadomień" });
    }
  }
);

// Endpoint do pobierania danych analitycznych
app.get("/api/analytics", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).populate("role");
    if (
      !user ||
      (user.role.name !== "Analityk" && user.role.name !== "Zarządca")
    ) {
      return res
        .status(403)
        .json({ message: "Brak uprawnień do wyświetlania analityki" });
    }

    // Pobierz wszystkie zgłoszenia
    const tickets = await Ticket.find();

    // Oblicz statystyki
    const totalTickets = tickets.length;
    const resolvedTickets = tickets.filter(
      (t) => t.status === "resolved"
    ).length;

    // Zgłoszenia według statusu
    const ticketsByStatus = tickets.reduce((acc, ticket) => {
      acc[ticket.status] = (acc[ticket.status] || 0) + 1;
      return acc;
    }, {});

    // Średni czas rozwiązania (w godzinach)
    let totalResolutionTime = 0;
    let resolvedCount = 0;
    tickets.forEach((ticket) => {
      if (
        ticket.status === "resolved" &&
        ticket.resolvedAt &&
        ticket.createdAt
      ) {
        const resolutionTime =
          (new Date(ticket.resolvedAt) - new Date(ticket.createdAt)) /
          (1000 * 60 * 60);
        totalResolutionTime += resolutionTime;
        resolvedCount++;
      }
    });
    const averageResolutionTime =
      resolvedCount > 0 ? totalResolutionTime / resolvedCount : 0;

    // Naruszenia SLA
    const slaBreaches = await ChangeHistory.countDocuments({
      changeDetails: /SLA breach/i,
    });

    // Rozkład ocen zadowolenia
    const feedbacks = await Feedback.find();
    const satisfactionDistribution = feedbacks.reduce((acc, feedback) => {
      acc[feedback.rating] = (acc[feedback.rating] || 0) + 1;
      return acc;
    }, {});

    // Zgłoszenia w czasie
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const ticketsOverTime = await Ticket.aggregate([
      {
        $match: {
          createdAt: { $gte: thirtyDaysAgo },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 },
        },
      },
      {
        $sort: { _id: 1 },
      },
      {
        $project: {
          date: "$_id",
          count: 1,
          _id: 0,
        },
      },
    ]);

    // Przygotuj dane do wysłania
    const analyticsData = {
      totalTickets,
      resolvedTickets,
      ticketsByStatus,
      averageResolutionTime,
      slaBreaches,
      satisfactionDistribution,
      ticketsOverTime,
    };

    res.json(analyticsData);
  } catch (error) {
    console.error("Error generating analytics:", error);
    res.status(500).json({ message: "Błąd podczas generowania analityki" });
  }
});

// Okresowe sprawdzanie SLA (co 15 minut)
cron.schedule("*/1 * * * *", async () => {
  try {
    console.log("Running periodic SLA check...");
    // Pobierz wszystkie nierozwiązane zgłoszenia
    const openTickets = await Ticket.find({
      status: { $ne: "resolved" },
    });

    for (const ticket of openTickets) {
      await checkSLA(ticket);
    }
    console.log(`Completed SLA check for ${openTickets.length} tickets`);
  } catch (error) {
    console.error("Error in periodic SLA check:", error);
  }
});

// Endpoint do pobierania danych analitycznych
app.get("/api/analytics/report", authMiddleware, async (req, res) => {
  try {
    // Fetch analytics data
    const totalTickets = await Ticket.countDocuments();
    const resolvedTickets = await Ticket.countDocuments({ status: "resolved" });
    const slaBreaches = await Ticket.countDocuments({ slaBreached: true });

    // Get tickets by status
    const ticketsByStatus = await Ticket.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    // Get average resolution time
    const resolvedTicketsData = await Ticket.find({
      status: "resolved",
      resolvedAt: { $exists: true },
      createdAt: { $exists: true },
    });

    let totalResolutionTime = 0;
    resolvedTicketsData.forEach((ticket) => {
      const resolutionTime = ticket.resolvedAt - ticket.createdAt;
      totalResolutionTime += resolutionTime;
    });
    const averageResolutionTime =
      resolvedTicketsData.length > 0
        ? totalResolutionTime / resolvedTicketsData.length / (1000 * 60 * 60) // Convert to hours
        : 0;

    // Create PDF document with embedded font
    const doc = new PDFDocument({
      size: "A4",
      info: {
        Title: "Raport Analityczny",
        Author: "System Obsługi Zgłoszeń",
      },
    });

    // Register a standard font that supports Polish characters
    doc.registerFont(
      "NotoSans",
      path.join(__dirname, "fonts/NotoSans-Regular.ttf")
    );
    doc.font("NotoSans");

    // Set response headers
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=raport-analityczny-${
        new Date().toISOString().split("T")[0]
      }.pdf`
    );

    // Pipe the PDF to the response
    doc.pipe(res);

    // Add content to PDF
    doc.fontSize(20).text("Raport analityczny systemu", {
      align: "center",
    });
    doc.moveDown();

    // Add date
    doc
      .fontSize(12)
      .text(`Wygenerowano: ${new Date().toLocaleString("pl-PL")}`, {
        align: "right",
      });
    doc.moveDown();

    // Add summary section
    doc.fontSize(16).text("Podsumowanie", { underline: true });
    doc.moveDown();

    doc.fontSize(12);
    const summaryData = [
      ["Całkowita liczba zgłoszeń", totalTickets],
      ["Rozwiązane zgłoszenia", resolvedTickets],
      [
        "Wskaźnik rozwiązania",
        `${((resolvedTickets / totalTickets) * 100).toFixed(1)}%`,
      ],
      [
        "Średni czas rozwiązania",
        `${Math.round(averageResolutionTime)} godzin`,
      ],
      ["Naruszenia SLA", slaBreaches],
    ];

    // Create a table for summary data
    const summaryTable = {
      headers: ["Metryka", "Wartość"],
      rows: summaryData,
    };

    await doc.table(summaryTable, {
      prepareHeader: () => doc.font("NotoSans").fontSize(12),
      prepareRow: () => doc.font("NotoSans").fontSize(12),
    });

    doc.moveDown();

    // Add status breakdown
    doc.fontSize(16).text("Zgłoszenia według statusu", { underline: true });
    doc.moveDown();

    const statusMap = {
      new: "Nowe",
      in_progress: "W trakcie",
      resolved: "Rozwiązane",
      reopened: "Ponownie otwarte",
      closed: "Zamknięte",
    };

    const statusData = ticketsByStatus.map((status) => [
      statusMap[status._id] || status._id,
      status.count.toString(),
    ]);

    const statusTable = {
      headers: ["Status", "Liczba zgłoszeń"],
      rows: statusData,
    };

    await doc.table(statusTable, {
      prepareHeader: () => doc.font("NotoSans").fontSize(12),
      prepareRow: () => doc.font("NotoSans").fontSize(12),
    });

    // Add footer
    doc.moveDown(2);
    doc
      .fontSize(10)
      .fillColor("grey")
      .text("Wygenerowano automatycznie przez system obsługi zgłoszeń", {
        align: "center",
      });

    // Finalize the PDF
    doc.end();
  } catch (error) {
    console.error("Error generating analytics report:", error);
    res.status(500).json({ message: "Nie udało się wygenerować raportu" });
  }
});

// Endpoint do aktualizacji projektu
app.patch("/api/projects/:projectId", authMiddleware, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { name, key, visibleToRoles, manager } = req.body;

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: "Nie znaleziono projektu" });
    }

    // Sprawdź uprawnienia - tylko zarządca lub manager projektu może edytować
    const user = await User.findById(req.user.userId).populate("role");
    if (
      !user ||
      (user.role.name !== "Zarządca" &&
        project.manager.toString() !== user._id.toString())
    ) {
      return res.status(403).json({ message: "Brak uprawnień" });
    }

    // Sprawdź czy nowy klucz nie jest już używany przez inny projekt
    if (key !== project.key) {
      const existingProject = await Project.findOne({
        key,
        _id: { $ne: projectId },
      });
      if (existingProject) {
        return res
          .status(400)
          .json({ message: "Projekt z tym kluczem już istnieje" });
      }
    }

    // Aktualizuj projekt
    project.name = name;
    project.key = key;
    // Tylko zarządca może zmieniać role i managera
    if (user.role.name === "Zarządca") {
      project.visibleToRoles = visibleToRoles;
      project.manager = manager;
    }

    await project.save();
    await logEvent(
      "UPDATE_PROJECT",
      req.user.userId,
      `Updated project: ${name}`
    );

    // Pobierz zaktualizowany projekt z populacją
    const updatedProject = await Project.findById(projectId)
      .populate("ticketTypes")
      .populate("manager", "login");

    res.json(updatedProject);
  } catch (error) {
    console.error("Project update error:", error);
    res.status(500).json({ message: "Błąd podczas aktualizacji projektu" });
  }
});

// Endpoint do edycji własnego profilu
app.patch("/api/profile", authMiddleware, async (req, res) => {
  try {
    const { login, currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: "Nie znaleziono użytkownika" });
    }

    // Sprawdź czy nowy login nie jest zajęty przez innego użytkownika
    if (login && login !== user.login) {
      const existingUser = await User.findOne({ login });
      if (existingUser) {
        return res.status(400).json({ message: "Login jest już zajęty" });
      }
      user.login = login;
    }

    // Jeśli podano nowe hasło, sprawdź aktualne i zaktualizuj
    if (newPassword) {
      if (!currentPassword) {
        return res
          .status(400)
          .json({ message: "Wymagane jest aktualne hasło" });
      }

      const isPasswordValid = await bcrypt.compare(
        currentPassword,
        user.password
      );
      if (!isPasswordValid) {
        return res
          .status(401)
          .json({ message: "Nieprawidłowe aktualne hasło" });
      }

      user.password = await bcrypt.hash(newPassword, 10);
    }

    await user.save();
    await logEvent("UPDATE_PROFILE", req.user.userId, "Updated user profile");

    const userResponse = { ...user.toObject() };
    delete userResponse.password;

    res.json(userResponse);
  } catch (error) {
    res.status(500).json({ message: "Błąd podczas aktualizacji profilu" });
  }
});

// Endpoint do usuwania projektu (tylko dla zarządcy)
app.delete("/api/projects/:projectId", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).populate("role");
    if (!user || user.role.name !== "Zarządca") {
      return res.status(403).json({ message: "Brak uprawnień" });
    }

    const { projectId } = req.params;
    const project = await Project.findById(projectId);

    if (!project) {
      return res.status(404).json({ message: "Nie znaleziono projektu" });
    }

    // Usuń wszystkie zgłoszenia związane z projektem
    await Ticket.deleteMany({ project: projectId });

    // Usuń wszystkie subskrypcje projektu
    await Subscription.deleteMany({ project: projectId });

    // Usuń projekt
    await Project.findByIdAndDelete(projectId);

    await logEvent(
      "DELETE_PROJECT",
      req.user.userId,
      `Deleted project: ${project.name}`
    );

    res.json({ message: "Projekt został usunięty" });
  } catch (error) {
    console.error("Project deletion error:", error);
    res.status(500).json({ message: "Błąd podczas usuwania projektu" });
  }
});

// Start serwera
const PORT = process.env.PORT || 3004;
app.listen(PORT, () => {
  console.log(`Server port: ${PORT}`);
});
